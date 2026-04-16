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

const sdp_pcmu_and_dtmf_without_rtpmap_for_0 = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-168@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Type: application/sdp\r\n\
Content-Length: 168\r\n\
\r\n\
v=0\r\n\
o=- 1 1 IN IP4 2.3.4.5\r\n\
s=-\r\n\
t=0 0\r\n\
c=IN IP4 2.3.4.5\r\n\
m=audio 40000 RTP/AVP 0 101\r\n\
a=rtpmap:101 telephone-event/8000\r\n\
a=fmtp:101 0-16\r\n\
';

const sdp_static_payloads_pcma_pcmu_g729_and_dtmf_without_rtpmap = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-170@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Type: application/sdp\r\n\
Content-Length: 197\r\n\
\r\n\
v=0\r\n\
o=- 1 1 IN IP4 2.3.4.5\r\n\
s=-\r\n\
t=0 0\r\n\
c=IN IP4 2.3.4.5\r\n\
m=audio 40000 RTP/AVP 8 0 18 101\r\n\
a=rtpmap:101 telephone-event/8000\r\n\
a=fmtp:101 0-15\r\n\
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

const declared_sdp_missing_final_newline = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-167@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
Content-Type: application/sdp\r\n\
Content-Length: 4\r\n\
\r\n\
v=0';

const non_canonical_x_header_capitalization = 'INVITE sip:5000@sip.host.com;user=phone SIP/2.0\r\n\
Via: SIP/2.0/TCP 192.168.178.22:38488;branch=z9hG4bK1428069545;rport;alias\r\n\
From: "Lorenzo250" <sip:250@sip.host.com;user=phone>;tag=1459587455\r\n\
To: <sip:5000@sip.host.com;user=phone>\r\n\
Call-ID: 2015279366-5066-169@BJC.BGI.BHI.CC\r\n\
CSeq: 1661 INVITE\r\n\
x-cid: 123\r\n\
X-CMS-No-Ice: 1\r\n\
Content-Length: 0\r\n\
\r\n\
';

const record_route_private_ip_mixed_context = 'SIP/2.0 183 Session Progress\r\n\
Via: SIP/2.0/UDP 198.51.100.10:5060;branch=z9hG4bKabc123\r\n\
From: <sip:alice@example.com>;tag=aa11\r\n\
To: <sip:bob@example.net>;tag=bb22\r\n\
Call-ID: rr-mixed-001\r\n\
CSeq: 1 INVITE\r\n\
Record-Route: <sip:198.51.100.20:5060;lr>\r\n\
Record-Route: <sip:10.23.45.67:5060;lr>\r\n\
Contact: <sip:203.0.113.9:5060>\r\n\
Content-Length: 0\r\n\
\r\n\
';

const record_route_private_ip_internal_only = 'SIP/2.0 183 Session Progress\r\n\
Via: SIP/2.0/UDP 10.23.45.66:5060;branch=z9hG4bKdef456\r\n\
From: <sip:alice@10.0.0.5>;tag=aa11\r\n\
To: <sip:bob@10.0.0.6>;tag=bb22\r\n\
Call-ID: rr-internal-001\r\n\
CSeq: 1 INVITE\r\n\
Record-Route: <sip:10.23.45.67:5060;lr>\r\n\
Contact: <sip:10.23.45.68:5060>\r\n\
Content-Length: 0\r\n\
\r\n\
';

const from_to_contact_private_ip_mixed_context = 'SIP/2.0 183 Session Progress\r\n\
Via: SIP/2.0/UDP 203.0.113.10:5060;branch=z9hG4bKvia001\r\n\
From: <sip:alice@10.0.0.10:5060>;tag=ft01\r\n\
To: <sip:bob@10.0.0.11:5060>;tag=ft02\r\n\
Call-ID: ft-mixed-001\r\n\
CSeq: 1 INVITE\r\n\
Contact: <sip:10.0.0.12:5060>\r\n\
Content-Length: 0\r\n\
\r\n\
';

const from_to_contact_private_ip_internal_only = 'SIP/2.0 183 Session Progress\r\n\
Via: SIP/2.0/UDP 10.0.0.1:5060;branch=z9hG4bKvia002\r\n\
From: <sip:alice@10.0.0.10:5060>;tag=ft01\r\n\
To: <sip:bob@10.0.0.11:5060>;tag=ft02\r\n\
Call-ID: ft-internal-001\r\n\
CSeq: 1 INVITE\r\n\
Contact: <sip:10.0.0.12:5060>\r\n\
Content-Length: 0\r\n\
\r\n\
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
        // Should continue with other non-fatal warnings too (no early-return on integrity warnings).
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('missing Contact header on INVITE request') !== -1)
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
        expect(parsed.validation_infos).to.satisfy((infos) =>
          infos.some((info) => info.indexOf('non-canonical header capitalization "from"') !== -1) &&
          infos.some((info) => info.indexOf('non-canonical header capitalization "to"') !== -1) &&
          infos.some((info) => info.indexOf('non-canonical header capitalization "call-id"') !== -1) &&
          infos.some((info) => info.indexOf('non-canonical header capitalization "cseq"') !== -1)
        );
    });

    it('warns only when X- header starts with lowercase x-', function(){
        const parsed = sipright.getSIP(non_canonical_x_header_capitalization);
        expect(parsed.validation_infos).to.satisfy((infos) =>
          infos.some((info) => info.indexOf('X- extension header should start with "X-"') !== -1) &&
          !infos.some((info) => info.indexOf('non-canonical header capitalization "X-CMS-No-Ice"') !== -1)
        );
    });

    it('warns when Record-Route contains private IP with mixed public/private context', function(){
        const parsed = sipright.getSIP(record_route_private_ip_mixed_context);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('Record-Route contains non-routable address (10.23.45.67)') !== -1)
        );
    });

    it('does not warn on private Record-Route when message context is internal-only', function(){
        const parsed = sipright.getSIP(record_route_private_ip_internal_only);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          !warnings.some((warning) => warning.indexOf('Record-Route contains non-routable address') !== -1)
        );
    });

    it('warns on private From/To/Contact URI hosts when message has public context', function(){
        const parsed = sipright.getSIP(from_to_contact_private_ip_mixed_context);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('Contact header contains non-routable URI host (10.0.0.12)') !== -1)
        );
        expect(parsed.validation_infos).to.satisfy((infos) =>
          infos.some((info) => info.indexOf('From header contains non-routable URI host (10.0.0.10)') !== -1 && info.indexOf('may reveal private routing/topology information') !== -1) &&
          infos.some((info) => info.indexOf('To header contains non-routable URI host (10.0.0.11)') !== -1 && info.indexOf('may reveal private routing/topology information') !== -1)
        );
    });

    it('does not warn on private From/To/Contact URI hosts when message context is internal-only', function(){
        const parsed = sipright.getSIP(from_to_contact_private_ip_internal_only);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          !warnings.some((warning) => warning.indexOf('Contact header contains non-routable URI host') !== -1)
        );
        expect(parsed.validation_infos).to.satisfy((infos) =>
          !infos.some((info) => info.indexOf('From header contains non-routable URI host') !== -1) &&
          !infos.some((info) => info.indexOf('To header contains non-routable URI host') !== -1)
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

    it('does not warn when SDP audio offers PCMU (static PT 0) plus telephone-event', function(){
        const parsed = sipright.getSIP(sdp_pcmu_and_dtmf_without_rtpmap_for_0);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          !warnings.some((warning) => warning.indexOf('lists only DTMF/telephone-event payloads') !== -1)
        );
    });

    it('does not warn when SDP audio offers static PT codecs (8/0/18) plus telephone-event but no rtpmap for static PTs', function(){
        const parsed = sipright.getSIP(sdp_static_payloads_pcma_pcmu_g729_and_dtmf_without_rtpmap);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          !warnings.some((warning) => warning.indexOf('lists only DTMF/telephone-event payloads') !== -1)
        );
    });

    it('parses but warns when Content-Type is application/sdp but body is not valid SDP', function(){
        const parsed = sipright.getSIP(declared_sdp_but_not_sdp);
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('SDP body did not parse cleanly') !== -1) ||
          warnings.some((warning) => warning.indexOf('failed to parse SDP body') !== -1)
        );
    });

    it('parses but warns when SDP body is missing final newline', function(){
        const parsed = sipright.getSIP(declared_sdp_missing_final_newline);
        expect(parsed.body).to.equal('v=0');
        expect(parsed.validation_warnings).to.satisfy((warnings) =>
          warnings.some((warning) => warning.indexOf('SDP body is missing final newline') !== -1)
        );
    });

  });
});
