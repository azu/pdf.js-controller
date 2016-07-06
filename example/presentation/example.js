// LICENSE : MIT
"use strict";
var PDFController = require("pdf.js-controller");
var container = document.getElementById("pdf-container");
var controller = new PDFController({
    container: container,
    pdfjsDistDir: "/node_modules/pdfjs-dist/"
});
var PDFURL = "./example.pdf";
controller.loadDocument(PDFURL).then(initializedEvent).catch(function (error) {
    console.error(error);
});
function getCornerColor(context) {
    var canvasColor = context.getImageData(0, 0, 1, 1);
    var pixels = canvasColor.data;
    var r = pixels[0];
    var g = pixels[1];
    var b = pixels[2];
    return "rgb(" + r + ',' + g + ',' + b + ")";
}

container.addEventListener(PDFController.Events.before_pdf_rendering, function (event) {
    var context = controller.canvasContext;
    var cornerColor = getCornerColor(context);
    container.style.backgroundColor = cornerColor;
    document.body.style.backgroundColor = cornerColor;
    controller.domMapObject.canvas.style.visibility = "hidden";
});
container.addEventListener(PDFController.Events.after_pdf_rendering, function (event) {
    var context = controller.canvasContext;
    var cornerColor = getCornerColor(context);
    container.style.backgroundColor = cornerColor;
    document.body.style.backgroundColor = cornerColor;
    controller.domMapObject.canvas.style.visibility = "visible";
});

function initializedEvent() {
    document.getElementById('js-prev').addEventListener('click', controller.prevPage.bind(controller));
    document.getElementById('js-next').addEventListener('click', controller.nextPage.bind(controller));

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

