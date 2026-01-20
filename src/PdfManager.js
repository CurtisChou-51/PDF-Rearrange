const PdfManager = (function () {

    const _pdfCacheMap = new Map();

    async function* yieldPageItems(file) {

        const arrayBuffer = await file.arrayBuffer();
        const uid = `pdf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        _pdfCacheMap.set(uid, { arrayBuffer: structuredClone(arrayBuffer) });

        if (file.type.startsWith('image/')) {
            const img = new Image();
            const blob = new Blob([arrayBuffer], { type: file.type });
            const url = URL.createObjectURL(blob);

            img.src = url;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            yield { uid, totalPage: 1, pageNum: 1, canvas, type: file.type };

            URL.revokeObjectURL(url);
            return;
        }
        if (file.type !== 'application/pdf')
            return;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const canvas = await renderCanvas(page);
            yield { uid, totalPage: pdf.numPages, pageNum, canvas, type: file.type };
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
            const { uid, pageNum, type, canvas } = item;
            const entry = _pdfCacheMap.get(uid);

            const isImage = type.startsWith('image/');
            let imageBuffer = entry.arrayBuffer;
            let imageType = type;

            // 非 png/jpg 圖片 => 轉成 png
            if (isImage && imageType !== 'image/png' && imageType !== 'image/jpeg') {
                const dataUrl = canvas.toDataURL('image/png');
                imageBuffer = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
                imageType = 'image/png';
            }

            if (isImage) {
                const pngImage = imageType == 'image/png' ? await newPdfDoc.embedPng(imageBuffer) : await newPdfDoc.embedJpg(imageBuffer);

                // 設定預設頁面大小 (例如 A4: 595 x 842 pt)
                let pageWidth = 595;
                let pageHeight = 842;
                if (pngImage.width > pngImage.height) {
                    pageWidth = 842;
                    pageHeight = 595;
                }
                let scale = Math.min(pageWidth / pngImage.width, pageHeight / pngImage.height);
                scale = scale > 3.3 ? 3.3 : scale;  // 最大放大 3.3 倍
                const imgWidth = pngImage.width * scale;
                const imgHeight = pngImage.height * scale;

                const page = newPdfDoc.addPage([pageWidth, pageHeight]);
                page.drawImage(pngImage, {
                    x: (pageWidth - imgWidth) / 2,
                    y: (pageHeight - imgHeight) / 2,
                    width: imgWidth,
                    height: imgHeight,
                });
            }
            else {
                entry.srcPdf ??= await PDFLib.PDFDocument.load(entry.arrayBuffer);

                const num = parseInt(pageNum, 10);
                const [copiedPage] = await newPdfDoc.copyPages(entry.srcPdf, [num - 1]);
                newPdfDoc.addPage(copiedPage);
            }
        }

        return await newPdfDoc.save();
    }

    return { yieldPageItems, exportPdf };
})();