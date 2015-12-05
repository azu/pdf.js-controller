// LICENSE : MIT
"use strict";
var PDFJSController = require("pdf.js-controller");
var container = document.getElementById("pdf-container");
var controller = new PDFJSController({
    container: container,
    pdfjsDistDir: "./node_modules/pdfjs-dist/"
});
controller.loadDocument("./example.pdf").catch(function (error) {
    console.error(error);
}).then(function () {
    controller.nextPage();

});