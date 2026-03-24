# SIP-Right

A SIP/SDP parsing module that checks for packet correctness.

A fork of the excellent parsip module by 
Lorenzo Mangani (http://qxip.net/)
that tries to give useful exceptions for packets that aren't valid.

## Live examples

- [SIP Packet Analysis](https://voiptoolbox.net/utils/packet)
- [SIP PCAP Viewer](https://voiptoolbox.net/sip-pcap-viewer)


## Usage
#### SIP to JSON
```javascript
var sipright = require('sipright');
var sip_message = "..." // Valid SIP Message here

try {
    var sip = sipright.getSIP(sip_message);
    ... // Your packet is correct!
} catch(err) {
    // Your packet isn't correct
    // Read string err to find out why
}
```

## Validation behavior

`getSIP()` can now return non-fatal packet quality signals in `sip.validation_warnings`.

- Severe packet integrity issues throw exceptions (for example invalid or oversized `Content-Length`).
- Softer issues are preserved as warnings (for example duplicate singleton headers, non-canonical header capitalization, extra bytes beyond declared `Content-Length`).

### License
Released under the MIT License

### Acknowledgement
Based on parsip module by Lorenzo Mangani (http://qxip.net/),
which is in turn based on elements from
[jsSIP](https://github.com/versatica/JsSIP) and `SDP-Tranform` packages
