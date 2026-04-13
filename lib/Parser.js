const Grammar = require('./Grammar');
const SIPMessage = require('./SIPMessage');
const Utils = require('./Utils');
const sdp_transform = require('sdp-transform');

/**
 * Parse SIP Message
 */
exports.parseMessage = (data, ua, options) =>
{
  const opts = options || {};
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
    },
    contentLengthHeaderCount : 0
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
      // Some real-world capture/export pipelines produce truncated payloads while leaving the original
      // Content-Length intact. Treat this as a packet-quality signal (integrity warning) and parse using
      // the available bytes rather than hard-failing.
      addValidationWarning(message, 'integrity', `non-fatal: Content-Length (${declaredContentLength}) exceeds available body bytes (${availableBodyLength}); using available bytes`);
      message.body = data.substr(bodyStart, availableBodyLength);
      return message;
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

  addRfc3261ValidationWarnings(message, opts);
  addSdpValidationWarnings(message);

  return message;
};

function addRfc3261ValidationWarnings(message, opts)
{
  try
  {
    const isRequest = message instanceof SIPMessage.IncomingRequest;
    if (!isRequest)
    {
      return;
    }

    // RFC 3261 8.1.1: all requests MUST have Via and Max-Forwards.
    if (!message.hasHeader('via'))
    {
      addValidationWarning(message, 'sip', 'non-fatal: missing Via header on request (RFC3261 8.1.1)');
    }
    if (!message.hasHeader('max-forwards'))
    {
      addValidationWarning(message, 'sip', 'non-fatal: missing Max-Forwards header on request (RFC3261 8.1.1)');
    }

    // RFC 3261 8.1.1.5: CSeq method MUST match request method and CSeq number range constraints.
    if (typeof message.s === 'function')
    {
      const cseqParsed = message.s('cseq');
      if (cseqParsed && cseqParsed.method && message.method && String(cseqParsed.method).toUpperCase() !== String(message.method).toUpperCase())
      {
        addValidationWarning(message, 'sip', `non-fatal: CSeq method (${cseqParsed.method}) does not match request method (${message.method}) (RFC3261 8.1.1.5)`);
      }

      const cseqValue = Number(cseqParsed && cseqParsed.value);
      if (!Number.isFinite(cseqValue) || !Number.isInteger(cseqValue) || cseqValue < 0 || cseqValue >= 2147483648)
      {
        addValidationWarning(message, 'sip', `non-fatal: CSeq value out of range (${cseqParsed && cseqParsed.value}) (RFC3261 8.1.1.5)`);
      }
    }

    // RFC 3261 8.1.1.3: From MUST contain a tag parameter.
    if (message.from && !message.from_tag)
    {
      addValidationWarning(message, 'sip', 'non-fatal: missing From tag on request (RFC3261 8.1.1.3)');
    }

    // Body present but no Content-Type is a common interop failure.
    if (message.body && String(message.body).length > 0 && !message.hasHeader('content-type'))
    {
      addValidationWarning(message, 'integrity', 'non-fatal: message has body but no Content-Type header');
    }

    // low_risk extras (can be noisy).
    if (opts && opts.low_risk === true)
    {
      // RFC 3261 8.1.1.2: requests outside of a dialog MUST NOT contain a To tag.
      // Heuristic: treat INVITE with no Route/Replaces as likely initial.
      const likelyInitialInvite =
        String(message.method).toUpperCase() === 'INVITE' &&
        !message.hasHeader('route') &&
        !message.hasHeader('replaces');
      if (likelyInitialInvite && message.to_tag)
      {
        addValidationWarning(message, 'sip', 'non-fatal: initial INVITE contains a To tag (RFC3261 8.1.1.2; low_risk)');
      }

      // RFC 3261 8.2.2.3: Require/Proxy-Require MUST NOT be used in CANCEL (and should be ignored).
      if (String(message.method).toUpperCase() === 'CANCEL')
      {
        if (message.hasHeader('require') || message.hasHeader('proxy-require'))
        {
          addValidationWarning(message, 'sip', 'non-fatal: CANCEL contains Require/Proxy-Require header (RFC3261 8.2.2.3; low_risk)');
        }
      }

      // Max-Forwards value sanity.
      if (message.hasHeader('max-forwards'))
      {
        const mfRaw = message.getHeader('max-forwards');
        const mfTrim = String(mfRaw).trim();
        const mfNum = Number(mfTrim);
        if (!/^\d+$/.test(mfTrim) || !Number.isFinite(mfNum))
        {
          addValidationWarning(message, 'sip', `non-fatal: Max-Forwards is not numeric ("${mfRaw}") (low_risk)`);
        }
        else if (mfNum < 0)
        {
          addValidationWarning(message, 'sip', `non-fatal: Max-Forwards is negative (${mfNum}) (low_risk)`);
        }
        else if (mfNum > 255)
        {
          addValidationWarning(message, 'sip', `non-fatal: Max-Forwards is unusually large (${mfNum}) (low_risk)`);
        }
      }
    }
  }
  catch (_err)
  {
    // Never let warning logic break SIP parsing.
  }
}

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

        // Some codecs use static RTP payload types (e.g., PT 0 = PCMU) and are commonly
        // offered without an explicit a=rtpmap line. The SDP parser may only populate
        // `m.rtp` entries for payloads that have rtpmap attributes, so infer a small set
        // of well-known static payload codecs from the m-line.
        const staticAudioPtToCodec = {
          0: 'pcmu',
          3: 'gsm',
          4: 'g723',
          5: 'dvi4',
          6: 'dvi4',
          7: 'lpc',
          8: 'pcma',
          9: 'g722',
          10: 'l16',
          11: 'l16',
          12: 'qcelp',
          13: 'cn',
          14: 'mpa',
          15: 'g728',
          16: 'dvi4',
          17: 'dvi4',
          18: 'g729',
        };
        const staticVideoPtToCodec = {
          31: 'h261',
          32: 'mpv',
          34: 'h263',
        };

        const inferredStaticCodecs = payloads
          .map((pt) => Number(pt))
          .filter((pt) => Number.isFinite(pt))
          .map((pt) => {
            if (kind === 'audio')
            {
              return staticAudioPtToCodec[pt] || '';
            }
            return staticVideoPtToCodec[pt] || '';
          })
          .filter(Boolean);

        const effectiveCodecNames = Array.from(new Set(codecNames.concat(inferredStaticCodecs)));
        const nonDtmfCodecs = effectiveCodecNames.filter((c) => c !== 'telephone-event');

        // If port is non-zero (not rejected) but we can't see any codecs besides DTMF, that's usually a problem.
        if (portNum !== 0 && effectiveCodecNames.length > 0 && nonDtmfCodecs.length === 0)
        {
          addValidationWarning(message, 'sdp', `non-fatal: SDP ${kind} m-line lists only DTMF/telephone-event payloads (no usable media codec)`);
        }
        else if (portNum !== 0 && effectiveCodecNames.length === 0 && payloads.length > 0)
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
    // Header field names are case-insensitive. We warn on non-canonical
    // capitalization mainly to catch accidental header typos. For X-*
    // extension headers, variants are extremely common in the wild (e.g.,
    // "X-CID", "X-CMS-...", "X-MS-...") so treat them more leniently:
    // only warn if the leading "x-" is lowercase.
    if (normalizedHeaderName.startsWith('x-'))
    {
      if (headerName.startsWith('x-'))
      {
        addValidationWarning(message, 'sip', `non-fatal: X- extension header should start with "X-" (got "${headerName}")`);
      }
    }
    else
    {
      const canonicalHeaderName = Utils.headerize(headerName);
      if (headerName !== canonicalHeaderName)
      {
        addValidationWarning(message, 'sip', `non-fatal: non-canonical header capitalization "${headerName}" (expected "${canonicalHeaderName}")`);
      }
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

  // Content-Length duplicates are especially risky/ambiguous. Warn and ignore subsequent values.
  if (normalizedHeaderName === 'content-length' || normalizedHeaderName === 'l')
  {
    parserState.contentLengthHeaderCount = (parserState.contentLengthHeaderCount || 0) + 1;
    if (parserState.contentLengthHeaderCount > 1)
    {
      addValidationWarning(message, 'integrity', 'non-fatal: duplicate Content-Length header');
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
