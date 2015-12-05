// LICENSE : MIT
"use strict";
window.URL = window.URL || window.webkitURL;
module.exports = function stringToWorkerSrc(src) {
    // "Server response", used in all examples
    var response = src;
    var blob;
    try {
        blob = new Blob([response], {type: 'application/javascript'});
    } catch (e) { // Backwards-compatibility
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(response);
        blob = blob.getBlob();
    }
    return URL.createObjectURL(blob);
};