const SIPParser = require('./lib/Parser');
const authSIP = require('./lib/AuthSIP');
const SDPParser = require('sdp-transform');
const jwtDecode = require("jwt-decode")


const Functions = {
	getSIP: (sip_message, options) => SIPParser.parseMessage(sip_message, undefined, options),
	authSIP: authSIP.authorize,
	getSDP: SDPParser.parse,
	getVQ: SIPParser.parseVQ,
	getJWT: jwtDecode
}
module.exports = Functions;
