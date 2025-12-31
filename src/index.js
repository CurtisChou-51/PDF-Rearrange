/* DOMContentLoaded */
document.addEventListener('DOMContentLoaded', () => {
    const pdfContainer = document.getElementById('pdf-list');
    Sortable.create(pdfContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onSort: updateOrderDisplay,
        filter: '.remove-btn',
        onFilter: function () { return false; }
    });

    pdfContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        pdfContainer.classList.add('dragover');
    });

    pdfContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (e.target === pdfContainer)
            pdfContainer.classList.remove('dragover');
    });

    pdfContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        pdfContainer.classList.remove('dragover');
        if (e.dataTransfer.files.length)
            addFiles(e.dataTransfer.files);
    });

    pdfContainer.addEventListener('click', (event) => {
        if (event.target && event.target.classList.contains('remove-btn'))
            removePdfFile(event.target.dataset.fid);
    });

    const pdfInput = document.getElementById('pdfInput');
    pdfInput.addEventListener('change', async event => {
        const files = event.target.files;
        addFiles(files);
    });

    async function addFiles(files) {
        if (!files || files.length === 0)
            return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type !== 'application/pdf')
                continue;

            const pdfData = await file.arrayBuffer();
            const uid = `pdf-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
            let fileInfo = { uid: uid, domId: 'fileInput_' + uid, fileName: file.name };
            await createPdfItemDom(pdfData, fileInfo);
            createFileInputDom(file, fileInfo.domId);
        }
        updateOrderDisplay();
        pdfInput.value = '';
    }


    function createFileInputDom(file, domId) {
        if (document.getElementById(domId))
            return;
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf';
        fileInput.id = domId;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        document.body.appendChild(fileInput);
    }

    async function createPdfItemDom(pdfData, fileInfo) {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            let pdfItemId = `${fileInfo.uid}-${pageNum}`;
            const pdfItem = document.createElement('div');
            pdfItem.id = pdfItemId;
            pdfItem.className = "pdf-item";
            pdfItem.innerHTML = `
<button class="remove-btn" title="移除" data-fid="${pdfItemId}">×</button>
<div class="pdf-preview"></div>
<div class="pdf-title">${fileInfo.fileName}</div>
<div class="pdf-info">頁數: ${pageNum} of ${pdf.numPages}</div>`;

            pdfItem.dataset.domid = fileInfo.domId;
            pdfContainer.appendChild(pdfItem);

            const page = await pdf.getPage(pageNum);
            const scale = 0.5;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderContext = { canvasContext: context, viewport: viewport };
            await page.render(renderContext).promise;

            pdfItem.querySelector('.pdf-preview').appendChild(canvas);
        }
    }

    // 更新排序顯示
    function updateOrderDisplay() {
        const orderDisplay = document.getElementById('order-display');
        const pdfTitles = [...pdfContainer.querySelectorAll('.pdf-item .pdf-title')];
        orderDisplay.innerHTML = `<ol>${pdfTitles.map(x => `<li>${x.innerText}</li>`).join('')}</ol>`;
    }

    function removePdfFile(id) {
        document.getElementById(id)?.remove();
        document.getElementById('fileInput_' + id)?.remove();
        updateOrderDisplay();
    }

    async function exportPdf() {
        const pdfItems = [...document.querySelectorAll('#pdf-list .pdf-item')];
        if (pdfItems.length === 0) {
            alert('沒有可匯出的 PDF 頁面');
            return;
        }

        // pdf-lib.js
        const { PDFDocument } = window.PDFLib;
        const newPdfDoc = await PDFDocument.create();

        const map = new Map()
        const groups = Object.groupBy(pdfItems, x => x.dataset.domid);
        for (const [domId, v] of Object.entries(groups)) {
    
            const fileInput = document.getElementById(domId);
            if (!fileInput || !fileInput.files.length)
                continue;
            const file = fileInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const srcPdf = await PDFDocument.load(arrayBuffer);
            debugger
            map.set(domId, srcPdf);
        }


        for (const item of pdfItems) {
            // 載入原 PDF 並複製對應頁面
            const srcPdf = map.get(item.dataset.domid);
            const pageNum = parseInt(item.id.split('-').pop(), 10);
            if (pageNum > 0 && pageNum <= srcPdf.getPageCount()) {
                const [copiedPage] = await newPdfDoc.copyPages(srcPdf, [pageNum - 1]);
                newPdfDoc.addPage(copiedPage);
            }
        }

        const pdfBytes = await newPdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sorted.pdf';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    document.getElementById('exportPdf').addEventListener('click', () => {
        exportPdf();
    });

    updateOrderDisplay();
});
