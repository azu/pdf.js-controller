// LICENSE : MIT
'use strict';
global.PDFJS = global.PDFJS || {};
//const stringToWorkerSrc = require("./string-to-worker-src");
//const workerCode = require("fs").readFileSync(__dirname + '/../node_modules/pdfjs-dist/build/pdf.worker.js', "utf-8");
require('pdfjs-dist/build/pdf.combined.js');
require('pdfjs-dist/web/compatibility.js');
require("custom-event-polyfill");
const TextLayerBuilder = require('./pdf.js-contrib/text_layer_builder').TextLayerBuilder;
const domify = require('domify');
const domMap = require('./dom-map');
const defaultInnerHTML = `<div class="pdf-slide-progress">
    <div class="pdf-slide-progress-bar"></div>
</div>
<div class="pdf-loading"></div>
<canvas class="pdf-canvas"></canvas>
<div class="pdf-textLayer"></div>
<div class="pdf-annotationLayer"></div>`;
module.exports = class PDFJSController {
    constructor({container, innerHTML, pageNumber, pdfjsDistDir}) {
        this.pdfContainer = container;
        if (pdfjsDistDir) {
            const pdfjsDistDirWithoutSuffix = pdfjsDistDir.replace(/\/$/, '');
            global.PDFJS.workerSrc = `${ pdfjsDistDirWithoutSuffix }/build/pdf.worker.js`;
            global.PDFJS.cMapUrl = `${ pdfjsDistDirWithoutSuffix }/cmaps/`;
            global.PDFJS.cMapPacked = true;
        }
        this.pdfDoc = null;
        this.pageNum = pageNumber || 1;
        this.promiseQueue = Promise.resolve();
        this.pdfContainer = container;
        const html = innerHTML || defaultInnerHTML;
        const dom = domify(html);
        /*
         * @type {Object.<string, Node>}
         */
        const mapping = {
            progressBar: '.pdf-slide-progress-bar',
            canvas: '.pdf-canvas',
            textLayer: '.pdf-textLayer',
            annotationLayer: '.pdf-annotationLayer',
            loading: '.pdf-loading'
        };
        this.domMapObject = domMap(dom, mapping);
        container.appendChild(dom);
        this.canvasContext = this.domMapObject.canvas.getContext('2d');
        this.fitItSize();
    }

    static get Events() {
        return {
            'before_pdf_rendering': 'before-pdf-rendering',
            'after_pdf_rendering': 'after_pdf_rendering'
        };
    }

    loadDocument(url) {
        // load complete
        let loading = this.domMapObject.loading;
        function hideLoadingIcon() {
            loading.style.display = 'none';
        }

        this.pdfContainer.addEventListener(this.constructor.Events.before_pdf_rendering, hideLoadingIcon);
        return PDFJS.getDocument(url).then(pdfDoc_ => {
            this.pdfDoc = pdfDoc_;
            return this._queueRenderPage(this.pageNum);
        }).then(() => {
            this.pdfContainer.removeEventListener(this.constructor.Events.before_pdf_rendering, hideLoadingIcon);
        });
    }

    _queueRenderPage(pageNum) {
        if (this.pdfDoc == null) {
            return this.promiseQueue;
        }
        this.promiseQueue = this.promiseQueue.then(() => {
            return this.renderPage(pageNum);
        });
        return this.promiseQueue;
    }

    fitItSize() {
        return new Promise((resolve) => {
            const containerRect = this.pdfContainer.getBoundingClientRect();
            this.domMapObject.canvas.width = containerRect.width;
            this.domMapObject.canvas.height = containerRect.height;
            resolve(containerRect);
        }).then(() => {
            return this._queueRenderPage(this.pageNum);
        });
    }

    _cleanup() {
        const range = document.createRange();
        const domMapObject = this.domMapObject;
        range.selectNodeContents(domMapObject.textLayer);
        range.deleteContents();
        range.selectNodeContents(domMapObject.annotationLayer);
        range.deleteContents();
    }

    renderPage(pageNum) {
        const beforeEvent = new CustomEvent(this.constructor.Events.before_pdf_rendering, {detail: this});
        this.pdfContainer.dispatchEvent(beforeEvent);
        // Using promise to fetch the page
        return this.pdfDoc.getPage(pageNum).then(page => {
            this._cleanup();
            const domMapObject = this.domMapObject;
            const viewport = page.getViewport(domMapObject.canvas.width / page.getViewport(1).width);
            domMapObject.canvas.height = viewport.height;
            domMapObject.canvas.width = viewport.width;
            domMapObject.textLayer.style.width = domMapObject.canvas.style.width;
            domMapObject.textLayer.style.height = domMapObject.canvas.style.height;
            // Render PDF page into canvas context
            const renderContext = {
                canvasContext: this.canvasContext,
                viewport: viewport
            };
            const renderPromise = page.render(renderContext).promise;
            const textLayerPromise = page.getTextContent().then(textContent => {
                const textLayerBuilder = new TextLayerBuilder({
                    textLayerDiv: domMapObject.textLayer,
                    viewport: viewport,
                    pageIndex: 0
                });
                textLayerBuilder.setTextContent(textContent);
                textLayerBuilder.render();
            });
            return Promise.all([
                renderPromise,
                textLayerPromise
            ]).then(result => {
                this._setupAnnotations(page, viewport, domMapObject.annotationLayer);
            });
        }).then(() => {
            this._updateProgress(pageNum);
            const afterEvent = new CustomEvent(this.constructor.Events.after_pdf_rendering, {detail: this});
            this.pdfContainer.dispatchEvent(afterEvent);
        });
    }

    prevPage() {
        if (this.pageNum <= 1) {
            return;
        }
        this.pageNum--;
        return this._queueRenderPage(this.pageNum);
    }

    nextPage() {
        if (this.pageNum >= this.pdfDoc.numPages) {
            return;
        }
        this.pageNum++;
        return this._queueRenderPage(this.pageNum);
    }

    _updateProgress(pageNum) {
        const progressBar = this.domMapObject.progressBar;
        if (progressBar !== null) {
            const numSlides = this.pdfDoc.numPages;
            let position = pageNum - 1;
            const percent = numSlides === 1 ? 100 : 100 * position / (numSlides - 1);
            progressBar.style.width = `${ percent.toString() }%`;
        }
    }

    _setupAnnotations(page, viewport, annotationArea) {
        return page.getAnnotations().then(annotationsData => {
            const cViewport = viewport.clone({dontFlip: true});
            for (let i = 0; i < annotationsData.length; i++) {
                const data = annotationsData[i];
                if (!data || !data.hasHtml) {
                    continue;
                }
                const element = PDFJS.AnnotationUtils.getHtmlElement(data);
                let rect = data.rect;
                const view = page.view;
                rect = PDFJS.Util.normalizeRect([
                    rect[0],
                    view[3] - rect[1] + view[1],
                    rect[2],
                    view[3] - rect[3] + view[1]
                ]);
                element.style.left = `${ rect[0] }px`;
                element.style.top = `${ rect[1] }px`;
                element.style.position = 'absolute';
                const transform = cViewport.transform;
                const transformStr = `matrix(${ transform.join(',') })`;
                PDFJS.CustomStyle.setProp('transform', element, transformStr);
                const transformOriginStr = `${ -rect[0] }px ${ -rect[1] }px`;
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