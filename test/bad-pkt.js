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

describe("ParSIP", function() {
 describe("SIP Parser", function() {

    it('cannot parse message without any CRLF', function(){
        assert.throws(
          () => sipright.getSIP(nocrlf_message),
          'parseMessage() | no CRLF found, not a SIP message'
        );
    });

    it('cannot parse message without any CRLF', function(){
        assert.throws(
          () => sipright.getSIP(bad_uri_nocrlf_message),
          'error parsing header "To"'
        );
    });

  });
});
