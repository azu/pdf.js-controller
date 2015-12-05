// LICENSE : MIT
"use strict";
global.PDFJS = {};
//const stringToWorkerSrc = require("./string-to-worker-src");
//const workerCode = require("fs").readFileSync(__dirname + '/../node_modules/pdfjs-dist/build/pdf.worker.js', "utf-8");
require('pdfjs-dist/build/pdf.combined.js');
require("pdfjs-dist/web/compatibility.js");
const TextLayerBuilder = require("./pdf.js-contrib/text_layer_builder").TextLayerBuilder;

const domify = require("domify");
const domMap = require("./dom-map");
module.exports = class PDFJSController {
    constructor({ container , pdfjsDistDir } = {}) {
        this.pdfContainer = container;
        if (pdfjsDistDir) {
            const pdfjsDistDirWithoutSuffix = pdfjsDistDir.replace(/\/$/, "");
            global.PDFJS.workerSrc = pdfjsDistDirWithoutSuffix + "/build/pdf.worker.js";
            global.PDFJS.cMapUrl = pdfjsDistDirWithoutSuffix + "/cmaps/";
            global.PDFJS.cMapPacked = true;
        }
        this.pdfDoc = null;
        this.pageNum = 1;
        this.promiseQueue = Promise.resolve();
        this.pdfContainer = container;
        var html = require("fs").readFileSync(__filename + ".hbs", "utf-8");
        var dom = domify(html);
        /*
         * @type {Object.<string, Node>}
         */
        var mapping = {
            progressBar: ".slide-progress-bar",
            canvas: ".pdf-canvas",
            textLayer: ".pdf-textLayer",
            annotationLayer: ".pdf-annotationLayer",
            loading: ".pdf-loading"
        };
        this.domMapObject = domMap(dom, mapping);
        container.appendChild(dom);
        this.canvasContext = this.domMapObject.canvas.getContext('2d');
        this.fitItSize();
    }

    static get Events() {
        return {
            "before_pdf_rendering": "before-pdf-rendering",
            "after_pdf_rendering": "after_pdf_rendering"
        }
    }

    loadDocument(url) {
        var that = this;
        // load complete
        function hideLoadingIcon() {
            that.domMapObject.loading.style.display = "none"
        }

        that.pdfContainer.addEventListener(this.constructor.Events.before_pdf_rendering, hideLoadingIcon);
        return PDFJS.getDocument(url).then(function (pdfDoc_) {
            that.pdfDoc = pdfDoc_;
            return that.queueRenderPage(that.pageNum);
        }).then(() => {
            that.pdfContainer.removeEventListener(this.constructor.Events.before_pdf_rendering, hideLoadingIcon);
        });
    }

    queueRenderPage(pageNum) {
        var that = this;
        if (that.pdfDoc == null) {
            return this.promiseQueue;
        }
        this.promiseQueue = this.promiseQueue.then(function () {
            return that.renderPage(pageNum);
        });
        return this.promiseQueue;
    }

    fitItSize() {
        var that = this;
        return new Promise(function (resolve) {
            var containerRect = that.pdfContainer.getBoundingClientRect();
            that.domMapObject.canvas.width = containerRect.width;
            that.domMapObject.canvas.height = containerRect.height;
            resolve(containerRect);
        }).then(function () {
            return that.queueRenderPage(that.pageNum);
        });
    }

    cleanup() {
        var range = document.createRange();
        var domMapObject = this.domMapObject;
        range.selectNodeContents(domMapObject.textLayer);
        range.deleteContents();
        range.selectNodeContents(domMapObject.annotationLayer);
        range.deleteContents();
    }

    renderPage(pageNum) {
        var that = this;
        var beforeEvent = new CustomEvent(this.constructor.Events.before_pdf_rendering, {
            detail: this
        });
        this.pdfContainer.dispatchEvent(beforeEvent);

        // Using promise to fetch the page
        return that.pdfDoc.getPage(pageNum).then((page)=> {
            that.cleanup();
            var domMapObject = that.domMapObject;
            var viewport = page.getViewport(domMapObject.canvas.width / page.getViewport(1.0).width);
            domMapObject.canvas.height = viewport.height;
            domMapObject.canvas.width = viewport.width;
            domMapObject.textLayer.style.width = domMapObject.canvas.style.width;
            domMapObject.textLayer.style.height = domMapObject.canvas.style.height;

            // Render PDF page into canvas context
            var renderContext = {
                canvasContext: that.canvasContext,
                viewport: viewport
            };
            var renderPromise = page.render(renderContext).promise;
            var textLayerPromise = page.getTextContent().then(function (textContent) {
                var textLayerBuilder = new TextLayerBuilder({
                    textLayerDiv: domMapObject.textLayer,
                    viewport: viewport,
                    pageIndex: 0
                });
                textLayerBuilder.setTextContent(textContent);
                textLayerBuilder.render();
            });
            return Promise.all([renderPromise, textLayerPromise]).then((result)  => {
                this.setupAnnotations(page, viewport, domMapObject.annotationLayer);
            });
        }).then(() => {
            that.updateProgress(pageNum);
            var afterEvent = new CustomEvent(this.constructor.Events.after_pdf_rendering, {
                detail: this
            });
            that.pdfContainer.dispatchEvent(afterEvent);
        });
    }

    prevPage() {
        if (this.pageNum <= 1) {
            return;
        }
        this.pageNum--;
        return this.queueRenderPage(this.pageNum);
    }

    nextPage() {
        if (this.pageNum >= this.pdfDoc.numPages) {
            return;
        }
        this.pageNum++;
        return this.queueRenderPage(this.pageNum);
    }

    updateProgress(pageNum) {
        var progressBar = this.domMapObject.progressBar;
        if (progressBar !== null) {
            var numSlides = this.pdfDoc.numPages;
            var position = pageNum - 1;
            var percent = (numSlides === 1) ? 100 : 100 * position / (numSlides - 1);
            progressBar.style.width = percent.toString() + '%';
        }
    }

    setupAnnotations(page, viewport, annotationArea) {
        return page.getAnnotations().then((annotationsData) => {
            var cViewport = viewport.clone({
                dontFlip: true
            });
            for (var i = 0; i < annotationsData.length; i++) {
                var data = annotationsData[i];
                if (!data || !data.hasHtml) {
                    continue;
                }

                var element = PDFJS.AnnotationUtils.getHtmlElement(data);
                var rect = data.rect;
                var view = page.view;
                rect = PDFJS.Util.normalizeRect([
                    rect[0],
                    view[3] - rect[1] + view[1],
                    rect[2],
                    view[3] - rect[3] + view[1]
                ]);
                element.style.left = (rect[0]) + 'px';
                element.style.top = (rect[1]) + 'px';
                element.style.position = 'absolute';

                var transform = cViewport.transform;
                var transformStr = 'matrix(' + transform.join(',') + ')';
                PDFJS.CustomStyle.setProp('transform', element, transformStr);
                var transformOriginStr = -rect[0] + 'px ' + -rect[1] + 'px';
                PDFJS.CustomStyle.setProp('transformOrigin', element, transformOriginStr);

                if (data.subtype === 'Link' && !data.url) {
                    // In this example,  we do not handle the `Link` annotation without url.
                    // If you want to handle these links, see `web/page_view.js`.
                    continue;
                }
                annotationArea.appendChild(element);
            }
        });
    }
};
