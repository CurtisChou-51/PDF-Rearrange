const PdfManager = (function () {

    const _pdfCacheMap = new Map();

    async function* yieldPageItems(file) {

        const arrayBuffer = await file.arrayBuffer();
        const uid = `pdf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        let fileType = file.type;
        if (fileType.startsWith('image/')) {
            const img = new Image();
            const blob = new Blob([arrayBuffer], { type: fileType });
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

            // 非 png/jpg 圖片 => 轉成 png
            if (fileType !== 'image/png' && fileType !== 'image/jpeg') {
                const dataUrl = canvas.toDataURL('image/png');
                _pdfCacheMap.set(uid, { arrayBuffer: Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0)) });
                yield { uid, totalPage: 1, pageNum: 1, canvas, type: 'image/png' };
            }
            else {
                _pdfCacheMap.set(uid, { arrayBuffer: structuredClone(arrayBuffer) });
                yield { uid, totalPage: 1, pageNum: 1, canvas, type: fileType };
            }
            URL.revokeObjectURL(url);
            return;
        }
        if (fileType !== 'application/pdf')
            return;

        _pdfCacheMap.set(uid, { arrayBuffer: structuredClone(arrayBuffer) });
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const canvas = await renderCanvas(page);
            yield { uid, totalPage: pdf.numPages, pageNum, canvas, type: fileType };
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

        // 批次複製各檔案所選頁面
        const copiedPageMap = new Map();
        for (let [uid, pdfDatas] of Object.entries(Object.groupBy(data.filter(x => !x.type.startsWith('image/')), x => x.uid))) {
            const cacheEntry = _pdfCacheMap.get(uid);
            cacheEntry.srcPdf ??= await PDFLib.PDFDocument.load(cacheEntry.arrayBuffer);

            const copiedPageNums = pdfDatas.map(x => x.pageNum).sort((a, b) => a - b);
            const copiedPages = await newPdfDoc.copyPages(cacheEntry.srcPdf, copiedPageNums.map(n => n - 1));

            for (let i = 0; i < copiedPageNums.length; i++) {
                const newKey = `${uid}@${copiedPageNums[i]}`;
                copiedPageMap.set(newKey, copiedPages[i]);
            }
        }

        for (const item of data) {
            const { uid, pageNum, type } = item;
            const entry = _pdfCacheMap.get(uid);

            const isImage = type.startsWith('image/');
            let imageBuffer = entry.arrayBuffer;
            if (isImage) {
                const pngImage = type == 'image/png' ? await newPdfDoc.embedPng(imageBuffer) : await newPdfDoc.embedJpg(imageBuffer);

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
                const newKey = `${uid}@${pageNum}`;
                const copiedPage = copiedPageMap.get(newKey);
                newPdfDoc.addPage(copiedPage);
            }
        }

        return await newPdfDoc.save();
    }

    return { yieldPageItems, exportPdf };
})();