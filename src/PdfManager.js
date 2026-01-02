const PdfManager = (function () {

    const _pdfCacheMap = new Map();

    async function* yieldPageItems(file) {
        const arrayBuffer = await file.arrayBuffer();
        const uid = `pdf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        _pdfCacheMap.set(uid, { arrayBuffer: structuredClone(arrayBuffer) });
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const canvas = await renderCanvas(page);
            yield { uid, totalPage: pdf.numPages, pageNum, canvas };
        }
    }

    async function renderCanvas(pdfjsPage) {
        const scale = 0.5;
        const viewport = pdfjsPage.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await pdfjsPage.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas;
    }

    async function exportPdf(data) {
        // pdf-lib.js
        const newPdfDoc = await PDFLib.PDFDocument.create();
        for (const item of data) {
            const { uid, pageNum } = item;
            const entry = _pdfCacheMap.get(uid);
            entry.srcPdf ??= await PDFLib.PDFDocument.load(entry.arrayBuffer);

            const num = parseInt(pageNum, 10);
            const [copiedPage] = await newPdfDoc.copyPages(entry.srcPdf, [num - 1]);
            newPdfDoc.addPage(copiedPage);
        }

        return await newPdfDoc.save();
    }

    return { yieldPageItems, exportPdf };
})();