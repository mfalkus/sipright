const Grammar = require('./Grammar');
const SIPMessage = require('./SIPMessage');
const Utils = require('./Utils');
const sdp_transform = require('sdp-transform');

/**
 * Parse SIP Message
 */
exports.parseMessage = (data, ua) =>
{
  let message;
  let bodyStart;
  let headerEnd = data.indexOf('\r\n');

  if (headerEnd === -1)
  {
    throw('parseMessage() | no CRLF found, not a SIP message');

    return;
  }

  // Parse first line. Check if it is a Request or a Reply.
  const firstLine = data.substring(0, headerEnd);
  let parsed = Grammar.parse(firstLine, 'Request_Response');

  if (parsed === -1)
  {
    throw(`parseMessage() | error parsing first line of SIP message: "${firstLine}"`);

    return;
  }
  else if (!parsed.status_code)
  {
    message = new SIPMessage.IncomingRequest(ua);
    message.method = parsed.method;
    message.ruri = parsed.uri;
  }
  else
  {
    message = new SIPMessage.IncomingResponse();
    message.status_code = parsed.status_code;
    message.reason_phrase = parsed.reason_phrase;
  }

  message.data = data;
  message.validation_warnings = [];
  // Backwards-compatible: validation_warnings remains array of strings.
  // New: grouped/detailed warnings for easier downstream triage.
  message.validation_warnings_by_category = {};
  message.validation_warnings_detailed = [];
  let headerStart = headerEnd + 2;
  const parserState = {
    singletonHeaderCounts : {},
    singletonHeaders : {
      from : true,
      to : true,
      'call-id' : true,
      cseq : true
    }
  };

  /* Loop over every line in data. Detect the end of each header and parse
  * it or simply add to the headers collection.
  */
  while (true)
  {
    headerEnd = getHeader(data, headerStart);

    // The SIP message has normally finished.
    if (headerEnd === -2)
    {
      bodyStart = headerStart + 2;
      break;
    }
    // Data.indexOf returned -1 due to a malformed message.
    else if (headerEnd === -1)
    {
      throw('parseMessage() | malformed message');

      return;
    }

    parsed = parseHeader(message, data, headerStart, headerEnd, parserState);

    if (parsed !== true)
    {
      throw('parseMessage() |', parsed.error);

      return;
    }

    headerStart = headerEnd + 2;
  }

  /* RFC3261 18.3.
   * If there are additional bytes in the transport packet
   * beyond the end of the body, they MUST be discarded.
   */
  if (message.hasHeader('content-length'))
  {
    const contentLength = message.getHeader('content-length');
    const trimmedContentLength = String(contentLength).trim();

    if (!/^\d+$/.test(trimmedContentLength))
    {
      throw(`parseMessage() | invalid Content-Length value "${contentLength}"`);
    }

    const declaredContentLength = parseInt(trimmedContentLength, 10);
    const availableBodyLength = data.length - bodyStart;

    if (declaredContentLength > availableBodyLength)
    {
      throw(`parseMessage() | Content-Length (${declaredContentLength}) exceeds available body bytes (${availableBodyLength})`);
    }

    if (declaredContentLength < availableBodyLength)
    {
      addValidationWarning(message, 'integrity', `non-fatal: extra body bytes beyond Content-Length (declared=${declaredContentLength}, actual=${availableBodyLength})`);
    }

    message.body = data.substr(bodyStart, declaredContentLength);
  }
  else
  {
    message.body = data.substring(bodyStart);
  }

  /*
   * Check we have essential headers
   */
  if (!message.from) {
    throw('error no "From" header supplied');
  }
  if (!message.to) {
    throw('error no "To" header supplied');
  }
  if (!message.cseq) {
    throw('error no "Cseq" header supplied');
  }
  if (!message.call_id) {
    throw('error no "Call-ID" header supplied');
  }

  // Packet-quality warnings (non-fatal).
  // INVITE requests almost always include Contact; absence is frequently a sign of malformed traffic.
  if (message instanceof SIPMessage.IncomingRequest && message.method === 'INVITE' && !message.hasHeader('contact'))
  {
    addValidationWarning(message, 'sip', 'non-fatal: missing Contact header on INVITE request');
  }

  addSdpValidationWarnings(message);

  return message;
};

function addValidationWarning(message, category, warning)
{
  if (!message || !warning)
  {
    return;
  }

  const normalizedCategory = category || 'other';

  // Maintain legacy list of strings.
  message.validation_warnings.push(warning);

  // New: grouped lists.
  if (!message.validation_warnings_by_category)
  {
    message.validation_warnings_by_category = {};
  }
  if (!Array.isArray(message.validation_warnings_by_category[normalizedCategory]))
  {
    message.validation_warnings_by_category[normalizedCategory] = [];
  }
  message.validation_warnings_by_category[normalizedCategory].push(warning);

  // New: detailed entries.
  if (!Array.isArray(message.validation_warnings_detailed))
  {
    message.validation_warnings_detailed = [];
  }
  message.validation_warnings_detailed.push({
    category : normalizedCategory,
    warning
  });
}

function addSdpValidationWarnings(message)
{
  try
  {
    const contentType = (message.getHeader && message.getHeader('content-type')) || '';
    const body = message.body || '';

    const looksLikeSdp = /^\s*v=0\s*[\r\n]/m.test(body);
    const isSdpContentType = /application\/sdp/i.test(String(contentType));

    if (!body || (!looksLikeSdp && !isSdpContentType))
    {
      return;
    }

    let sdp;
    try
    {
      sdp = sdp_transform.parse(body);
    }
    catch (err)
    {
      addValidationWarning(message, 'sdp', `non-fatal: failed to parse SDP body (${String(err && err.message || err)})`);
      return;
    }

    if (!sdp || sdp.version !== 0)
    {
      addValidationWarning(message, 'sdp', 'non-fatal: SDP body did not parse cleanly (missing or invalid "v=" line)');
      return;
    }

    const media = Array.isArray(sdp.media) ? sdp.media : [];
    if (media.length === 0)
    {
      addValidationWarning(message, 'sdp', 'non-fatal: SDP contains no media sections ("m=" lines)');
      return;
    }

    // Connection address checks (session level).
    const sessionIp = sdp.connection && sdp.connection.ip;
    if (sessionIp && isSuspiciousMediaIp(sessionIp))
    {
      addValidationWarning(message, 'sdp', `non-fatal: SDP connection address looks non-routable (${sessionIp})`);
    }

    for (const m of media)
    {
      const kind = m && m.type ? String(m.type) : 'unknown';
      const portNum = Number(m && m.port);

      if (!Number.isFinite(portNum))
      {
        addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line has non-numeric port (${m && m.port})`);
      }
      else if (portNum < 0 || portNum > 65535)
      {
        addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line port out of range (${portNum})`);
      }
      else if (portNum > 0 && portNum < 1024)
      {
        addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line uses unusually low port (${portNum})`);
      }
      else if (portNum > 60000 && portNum <= 65535)
      {
        addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line uses unusually high port (${portNum})`);
      }

      // Media-level connection address overrides session-level.
      const mediaIp = (m && m.connection && m.connection.ip) || sessionIp;
      if (mediaIp && isSuspiciousMediaIp(mediaIp))
      {
        addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} connection address looks non-routable (${mediaIp})`);
      }

      // Codec sanity for audio/video.
      if (kind === 'audio' || kind === 'video')
      {
        const payloadsStr = String((m && m.payloads) || '').trim();
        const payloads = payloadsStr ? payloadsStr.split(/\s+/).filter(Boolean) : [];

        if (payloads.length === 0 && portNum !== 0)
        {
          addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line has no payload types listed`);
        }

        const rtp = Array.isArray(m && m.rtp) ? m.rtp : [];
        const codecNames = rtp
          .map((r) => String(r && r.codec || '').toLowerCase())
          .filter(Boolean);

        const nonDtmfCodecs = codecNames.filter((c) => c !== 'telephone-event');

        // If port is non-zero (not rejected) but we can't see any codecs besides DTMF, that's usually a problem.
        if (portNum !== 0 && codecNames.length > 0 && nonDtmfCodecs.length === 0)
        {
          addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line lists only DTMF/telephone-event payloads (no usable media codec)`);
        }
        else if (portNum !== 0 && codecNames.length === 0 && payloads.length > 0)
        {
          // If payloads exist but no rtpmap lines, dynamic PTs are ambiguous.
          const hasDynamicPts = payloads.some((pt) => Number(pt) >= 96);
          if (hasDynamicPts)
          {
            addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line includes dynamic payload types but no rtpmap codec definitions`);
          }
        }
      }

      // ICE candidate sanity: private-only host candidates are a frequent media failure.
      const candidates = Array.isArray(m && m.candidates) ? m.candidates : [];
      if (candidates.length)
      {
        const hasSrflxOrRelay = candidates.some((c) => (c && (c.type === 'srflx' || c.type === 'relay')));
        const hostIps = candidates
          .filter((c) => c && c.type === 'host' && c.ip)
          .map((c) => String(c.ip));
        const allHostIpsSuspicious = hostIps.length > 0 && hostIps.every(isSuspiciousMediaIp);

        if (!hasSrflxOrRelay && allHostIpsSuspicious)
        {
          addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} ICE candidates include only private/host addresses (NAT traversal risk)`);
        }

        for (const c of candidates)
        {
          const cPort = Number(c && c.port);
          if (Number.isFinite(cPort))
          {
            if (cPort < 0 || cPort > 65535)
            {
              addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} ICE candidate port out of range (${cPort})`);
            }
            else if (cPort > 0 && cPort < 1024)
            {
              addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} ICE candidate uses unusually low port (${cPort})`);
            }
            else if (cPort > 60000 && cPort <= 65535)
            {
              addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} ICE candidate uses unusually high port (${cPort})`);
            }
          }
        }
      }
    }
  }
  catch (_err)
  {
    // Never let "extra warnings" logic break SIP parsing.
  }
}

function isSuspiciousMediaIp(ip)
{
  const s = String(ip || '').trim().toLowerCase();
  if (!s)
  {
    return false;
  }

  // IPv4 checks.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s))
  {
    const parts = s.split('.').map((x) => Number(x));
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    {
      return true;
    }

    const [a, b] = parts;

    if (a === 0 || a === 127)
    {
      return true;
    }
    if (a === 10)
    {
      return true;
    }
    if (a === 192 && b === 168)
    {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31)
    {
      return true;
    }
    // CGNAT 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127)
    {
      return true;
    }

    return false;
  }

  // IPv6 checks (rough, but good enough for warnings).
  if (s === '::1' || s === '::')
  {
    return true;
  }
  if (s.startsWith('fc') || s.startsWith('fd'))
  {
    // ULA fc00::/7 (approx check).
    return true;
  }
  if (s.startsWith('fe80:'))
  {
    // Link-local.
    return true;
  }

  return false;
}

/**
 * Extract and parse every header of a SIP message.
 */
function getHeader(data, headerStart)
{
  // 'start' position of the header.
  let start = headerStart;
  // 'end' position of the header.
  let end = 0;
  // 'partial end' position of the header.
  let partialEnd = 0;

  // End of message.
  if (data.substring(start, start + 2).match(/(^\r\n)/))
  {
    return -2;
  }

  while (end === 0)
  {
    // Partial End of Header.
    partialEnd = data.indexOf('\r\n', start);

    // 'indexOf' returns -1 if the value to be found never occurs.
    if (partialEnd === -1)
    {
      return partialEnd;
    }

    if (!data.substring(partialEnd + 2, partialEnd + 4).match(/(^\r\n)/) && data.charAt(partialEnd + 2).match(/(^\s+)/))
    {
      // Not the end of the message. Continue from the next position.
      start = partialEnd + 2;
    }
    else
    {
      end = partialEnd;
    }
  }

  return end;
}

function parseHeader(message, data, headerStart, headerEnd, parserState)
{
  let parsed;
  const hcolonIndex = data.indexOf(':', headerStart);

  if (hcolonIndex === -1 || hcolonIndex > headerEnd)
  {
    return {
      error : 'malformed header: missing colon separator'
    };
  }

  const headerName = data.substring(headerStart, hcolonIndex).trim();
  const headerValue = data.substring(hcolonIndex + 1, headerEnd).trim();
  const normalizedHeaderName = headerName.toLowerCase();

  if (normalizedHeaderName.length > 1)
  {
    const canonicalHeaderName = Utils.headerize(headerName);

    if (headerName !== canonicalHeaderName)
    {
      addValidationWarning(message, 'sip', `non-fatal: non-canonical header capitalization "${headerName}" (expected "${canonicalHeaderName}")`);
    }
  }

  if (parserState.singletonHeaders[normalizedHeaderName])
  {
    parserState.singletonHeaderCounts[normalizedHeaderName] = (parserState.singletonHeaderCounts[normalizedHeaderName] || 0) + 1;

    if (parserState.singletonHeaderCounts[normalizedHeaderName] > 1)
    {
      addValidationWarning(message, 'sip', `non-fatal: duplicate singleton header "${Utils.headerize(headerName)}"`);
      return true;
    }
  }

  // If header-field is well-known, parse it.
  switch (normalizedHeaderName)
  {
    case 'via':
    case 'v':
      message.addHeader('via', headerValue);
      if (message.getHeaders('via').length === 1)
      {
        parsed = message.parseHeader('Via');
        if (parsed)
        {
          message.via = parsed;
          message.via_branch = parsed.branch;
        }
      }
      else
      {
        parsed = 0;
      }
      break;
    case 'from':
    case 'f':
      message.setHeader('from', headerValue);
      parsed = message.parseHeader('from');
      if (parsed)
      {
        message.from = parsed;
        message.from_tag = parsed.getParam('tag');
      }
      break;
    case 'to':
    case 't':
      message.setHeader('to', headerValue);
      parsed = message.parseHeader('to');
      if (parsed)
      {
        message.to = parsed;
        message.to_tag = parsed.getParam('tag');
      }
      break;
    case 'record-route':
      parsed = Grammar.parse(headerValue, 'Record_Route');

      if (parsed === -1)
      {
        parsed = undefined;
      }
      else
      {
        for (const header of parsed)
        {
          message.addHeader('record-route', headerValue.substring(header.possition, header.offset));
          message.headers['Record-Route'][message.getHeaders('record-route').length - 1].parsed = header.parsed;
        }
      }
      break;
    case 'call-id':
    case 'i':
      message.setHeader('call-id', headerValue);
      parsed = message.parseHeader('call-id');
      if (parsed)
      {
        message.call_id = headerValue;
      }
      break;
    case 'contact':
    case 'm':
      parsed = Grammar.parse(headerValue, 'Contact');

      if (parsed === -1)
      {
        parsed = undefined;
      }
      else
      {
        for (const header of parsed)
        {
          message.addHeader('contact', headerValue.substring(header.possition, header.offset));
          message.headers.Contact[message.getHeaders('contact').length - 1].parsed = header.parsed;
        }
      }
      break;
    case 'content-length':
    case 'l':
      message.setHeader('content-length', headerValue);
      // Defer strict validation to the post-parse integrity checks.
      parsed = 0;
      break;
    case 'content-type':
    case 'c':
      message.setHeader('content-type', headerValue);
      parsed = message.parseHeader('content-type');
      break;
    case 'cseq':
      message.setHeader('cseq', headerValue);
      parsed = message.parseHeader('cseq');
      if (parsed)
      {
        message.cseq = parsed.value;
      }
      if (message instanceof SIPMessage.IncomingResponse)
      {
        message.method = parsed.method;
      }
      break;
    case 'max-forwards':
      message.setHeader('max-forwards', headerValue);
      parsed = message.parseHeader('max-forwards');
      break;
    case 'www-authenticate':
      message.setHeader('www-authenticate', headerValue);
      parsed = message.parseHeader('www-authenticate');
      break;
    case 'proxy-authenticate':
      message.setHeader('proxy-authenticate', headerValue);
      parsed = message.parseHeader('proxy-authenticate');
      break;
    case 'session-expires':
    case 'x':
      message.setHeader('session-expires', headerValue);
      parsed = message.parseHeader('session-expires');
      if (parsed)
      {
        message.session_expires = parsed.expires;
        message.session_expires_refresher = parsed.refresher;
      }
      break;
    case 'refer-to':
    case 'r':
      message.setHeader('refer-to', headerValue);
      parsed = message.parseHeader('refer-to');
      if (parsed)
      {
        message.refer_to = parsed;
      }
      break;
    case 'replaces':
      message.setHeader('replaces', headerValue);
      parsed = message.parseHeader('replaces');
      if (parsed)
      {
        message.replaces = parsed;
      }
      break;
    case 'event':
    case 'o':
      message.setHeader('event', headerValue);
      parsed = message.parseHeader('event');
      if (parsed)
      {
        message.event = parsed;
      }
      break;
    default:
      // Do not parse this header.
      message.setHeader(headerName, headerValue);
      parsed = 0;
  }

  if (parsed === undefined)
  {
    return {
      error : `error parsing header "${headerName}"`
    };
  }
  else
  {
    return true;
  }
}

/**
 * Parse VQ Headers
 */
exports.parseVQ = function(str){
  var result = {};
  str.split(/;| /).forEach(function(x){
    var arr = x.split('=');
    arr[1] && (result[arr[0]] = arr[1]);
  });
  return result;
}
