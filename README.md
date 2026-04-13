# SIP-Right

A SIP/SDP parsing module that checks for packet correctness.

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

You can enable additional low-signal validations (which may be noisy depending on the SIP traffic) by passing an options object:

```javascript
var sip = sipright.getSIP(sip_message, { low_risk: true });
```

In addition to the legacy `validation_warnings` array, `getSIP()` also returns grouped warning views:

- **`sip.validation_warnings_by_category`**: map of category name to warning strings
- **`sip.validation_warnings_detailed`**: array of `{ category, warning }` objects

Current categories include:

- **`integrity`**: framing/body length anomalies
- **`sip`**: SIP header quality and RFC3261-style packet issues
- **`sdp`**: SDP/media heuristics (codec/IP/port issues, SDP parse problems)

### License
Released under the MIT License

### Acknowledgement

Originally based on parsip module by Lorenzo Mangani (http://qxip.net/),
which is in turn based on elements from
[jsSIP](https://github.com/versatica/JsSIP) and `SDP-Tranform` packages
