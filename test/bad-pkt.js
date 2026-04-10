/* sipright core */

var expect    = require("chai").expect;
var assert = require('chai').assert;

const sipright = require('../index');

const nocrlf_message = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\n\
To: <sip:5000@sip.host.com;user=phone>\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\n\
\n\
';

const bad_uri_nocrlf_message = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
\r\n\
';

const missing_from = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
To: <sip:5000@sip.host.com>;user=phone\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
\r\n\
';

const missing_cseq = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
To: <sip:5000@sip.host.com>;user=phone\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
\r\n\
';

const bad_content_length_non_numeric = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: abc\r\n\
\r\n\
v=0\r\n\
';

const bad_content_length_too_large = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: 999\r\n\
\r\n\
v=0\r\n\
';

const content_length_extra_bytes = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: 4\r\n\
\r\n\
v=0\r\n\
';

const duplicate_singletons = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
From: "Lorenzo251" <sip:251@sip.host.com;user=phone>;tag=1459587456\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
To: <sip:5001@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
Call-ID: duplicate@id\r\n\
CSeq: 1661 INVITE\r\n\
CSeq: 1662 INVITE\r\n\
\r\n\
';

const non_canonical_header_case = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
from: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
to: <sip:5000@sip.host.com;user=phone>\r\n\
call-id: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
cseq: 1661 INVITE\r\n\
\r\n\
';

const invite_missing_contact = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: 0\r\n\
\r\n\
';

const sdp_private_media_ip = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Type: application/sdp\r\n\
Content-Length: 116\r\n\
\r\n\
v=0\r\n\
o=- 1 1 IN IP4 192.168.1.10\r\n\
s=-\r\n\
t=0 0\r\n\
c=IN IP4 192.168.1.10\r\n\
m=audio 12345 RTP/AVP 0\r\n\
a=rtpmap:0 PCMU/8000\r\n\
';

const sdp_dtmf_only = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Type: application/sdp\r\n\
Content-Length: 121\r\n\
\r\n\
v=0\r\n\
o=- 1 1 IN IP4 2.3.4.5\r\n\
s=-\r\n\
t=0 0\r\n\
c=IN IP4 2.3.4.5\r\n\
m=audio 40000 RTP/AVP 101\r\n\
a=rtpmap:101 telephone-event/8000\r\n\
';

const declared_sdp_but_not_sdp = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Type: application/sdp\r\n\
Content-Length: 13\r\n\
\r\n\
hello world\r\n\
';

describe("ParSIP", function() {
 describe("SIP Parser", function() {

    it('cannot parse message without any CRLF', function(){
        assert.throws(
          () => sipright.getSIP(nocrlf_message),
          'parseMessage() | no CRLF found, not a SIP message'
        );
    });

    it('cannot parse message with bad URI', function(){
        assert.throws(
          () => sipright.getSIP(bad_uri_nocrlf_message),
          'error parsing header "To"'
        );
    });

    it('cannot parse message without From header', function(){
        assert.throws(
          () => sipright.getSIP(missing_from),
          'error no "From" header supplied'
        );
    });

    it('cannot parse message without cseq header', function(){
        assert.throws(
          () => sipright.getSIP(missing_cseq),
          'error no "Cseq" header supplied'
        );
    });

    it('cannot parse message with non-numeric content-length', function(){
        assert.throws(
          () => sipright.getSIP(bad_content_length_non_numeric),
          'invalid Content-Length value'
        );
    });

    it('cannot parse message with oversized content-length', function(){
        assert.throws(
          () => sipright.getSIP(bad_content_length_too_large),
          'Content-Length (999) exceeds available body bytes'
        );
    });

    it('parses but warns when body has bytes beyond content-length', function(){
        const parsed = sipright.getSIP(content_length_extra_bytes);
        expect(parsed.body).to.equal('v=0\r');
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('extra body bytes beyond Content-Length') !== -1)
        );
    });

    it('parses but warns on duplicate singleton headers', function(){
        const parsed = sipright.getSIP(duplicate_singletons);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('duplicate singleton header "From"') !== -1) &&
          warnings.some((warning) => warning.indexOf('duplicate singleton header "To"') !== -1) &&
          warnings.some((warning) => warning.indexOf('duplicate singleton header "Call-ID"') !== -1) &&
          warnings.some((warning) => warning.indexOf('duplicate singleton header "CSeq"') !== -1)
        );
    });

    it('parses but warns on non-canonical header capitalization', function(){
        const parsed = sipright.getSIP(non_canonical_header_case);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('non-canonical header capitalization "from"') !== -1) &&
          warnings.some((warning) => warning.indexOf('non-canonical header capitalization "to"') !== -1) &&
          warnings.some((warning) => warning.indexOf('non-canonical header capitalization "call-id"') !== -1) &&
          warnings.some((warning) => warning.indexOf('non-canonical header capitalization "cseq"') !== -1)
        );
    });

    it('parses but warns when INVITE request is missing Contact header', function(){
        const parsed = sipright.getSIP(invite_missing_contact);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('missing Contact header on INVITE request') !== -1)
        );
    });

    it('parses but warns when SDP uses private media IPs', function(){
        const parsed = sipright.getSIP(sdp_private_media_ip);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('SDP connection address looks non-routable') !== -1)
        );
    });

    it('parses but warns when SDP audio has only telephone-event payloads', function(){
        const parsed = sipright.getSIP(sdp_dtmf_only);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('lists only DTMF/telephone-event payloads') !== -1)
        );
    });

    it('parses but warns when Content-Type is application/sdp but body is not valid SDP', function(){
        const parsed = sipright.getSIP(declared_sdp_but_not_sdp);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('SDP body did not parse cleanly') !== -1) ||
          warnings.some((warning) => warning.indexOf('failed to parse SDP body') !== -1)
        );
    });

  });
});
