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

const missing_via = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Max-Forwards: 70\r\n\
Content-Length: 0\r\n\
\r\n\
';

const missing_max_forwards = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: 0\r\n\
\r\n\
';

const cseq_method_mismatch = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
Max-Forwards: 70\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 BYE\r\n\
Content-Length: 0\r\n\
\r\n\
';

const cseq_too_large = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
Max-Forwards: 70\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 2147483648 INVITE\r\n\
Content-Length: 0\r\n\
\r\n\
';

const missing_from_tag = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
Max-Forwards: 70\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: 0\r\n\
\r\n\
';

const body_without_content_type = 'MESSAGE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
Max-Forwards: 70\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 MESSAGE\r\n\
Content-Length: 5\r\n\
\r\n\
hello';

const duplicate_content_length = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
Max-Forwards: 70\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: 0\r\n\
Content-Length: 0\r\n\
\r\n\
';

const low_risk_initial_invite_with_to_tag = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
Max-Forwards: 70\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>;tag=abc123\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Length: 0\r\n\
\r\n\
';

const low_risk_cancel_with_require = 'CANCEL sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
Max-Forwards: 70\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 CANCEL\r\n\
Require: 100rel\r\n\
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

    it('parses but warns when content-length exceeds available body bytes', function(){
        const parsed = sipright.getSIP(bad_content_length_too_large);
        expect(parsed.body).to.equal('v=0\r\n');
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('Content-Length (999) exceeds available body bytes') !== -1)
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

    it('parses but warns when request is missing Via header', function(){
        const parsed = sipright.getSIP(missing_via);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('missing Via header on request') !== -1)
        );
    });

    it('parses but warns when request is missing Max-Forwards header', function(){
        const parsed = sipright.getSIP(missing_max_forwards);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('missing Max-Forwards header on request') !== -1)
        );
    });

    it('parses but warns when CSeq method does not match request method', function(){
        const parsed = sipright.getSIP(cseq_method_mismatch);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('CSeq method') !== -1 && warning.indexOf('does not match request method') !== -1)
        );
    });

    it('parses but warns when CSeq value is out of RFC range', function(){
        const parsed = sipright.getSIP(cseq_too_large);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('CSeq value out of range') !== -1)
        );
    });

    it('parses but warns when request From header is missing a tag', function(){
        const parsed = sipright.getSIP(missing_from_tag);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('missing From tag on request') !== -1)
        );
    });

    it('parses but warns when message has body but no Content-Type header', function(){
        const parsed = sipright.getSIP(body_without_content_type);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('message has body but no Content-Type') !== -1)
        );
    });

    it('parses but warns on duplicate Content-Length header', function(){
        const parsed = sipright.getSIP(duplicate_content_length);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('duplicate Content-Length header') !== -1)
        );
    });

    it('does not warn about To tag on initial INVITE unless low_risk is enabled', function(){
        const parsed = sipright.getSIP(low_risk_initial_invite_with_to_tag);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          !warnings.some((warning) => warning.indexOf('initial INVITE contains a To tag') !== -1)
        );
    });

    it('warns about To tag on initial INVITE when low_risk is enabled', function(){
        const parsed = sipright.getSIP(low_risk_initial_invite_with_to_tag, { low_risk: true });
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('initial INVITE contains a To tag') !== -1)
        );
    });

    it('warns on CANCEL with Require/Proxy-Require when low_risk is enabled', function(){
        const parsed = sipright.getSIP(low_risk_cancel_with_require, { low_risk: true });
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('CANCEL contains Require/Proxy-Require') !== -1)
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
