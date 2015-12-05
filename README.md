# pdf.js-controller

This library provide programming friendly usage of [mozilla/pdf.js](https://github.com/mozilla/pdf.js "mozilla/pdf.js").

- Not official library
- Load pdf and show
- Display pdf as like presentation
    - Provide controller interface
- Copy text from pdf
- Click link in pdf

![slide](https://monosnap.com/file/MaOSPVD6tKMul2AUyppSJrKd7T63LD.png)

## Installation

    npm install pdf.js-controller

Dependencies

- [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist "pdfjs-dist")

## Usage

### Create Presentation Viewer

See [example/presentation](example/presentation)

```js
// container element
var container = document.getElementById("pdf-container");

var PDFController = require("pdf.js-controller");
var controller = new PDFController({
    container: container,
    // path to dir of pdfjs-dist
    pdfDistDir: __dirname + "/node_modules/pdfjs-dist/"
});
// path to URL of pdf.
// Apply CORS to this path. It means that the URL should be same origin.
var PDFURL = "./example.pdf";
controller.loadDocument(PDFURL)
    .then(initializedEvent)
    .catch(function (error) {
    console.error(error);
});

container.addEventListener(PDFController.Events.before_pdf_rendering, function (event) {
    // before render
});
container.addEventListener(PDFController.Events.after_pdf_rendering, function (event) {
     // after render
});

function initializedEvent() {
    window.addEventListener("resize", function (event) {
        controller.fitItSize();
    });
    document.onkeydown = function (event) {
        var kc = event.keyCode;
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            return;
        }
        if (kc === 37 || kc === 40 || kc === 75 || kc === 65) {
            // left, down, K, A
            event.preventDefault();
            controller.prevPage();
        } else if (kc === 38 || kc === 39 || kc === 74 || kc === 83) {
            // up, right, J, S
            event.preventDefault();
            controller.nextPage();
        }

    };
}
```

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT