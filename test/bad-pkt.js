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

  });
});
