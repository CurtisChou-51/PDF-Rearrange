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
            for await (const data of PdfManager.yieldPageItems(file)) {
                const pdfItem = createPdfItemDom({ fileName: file.name, ...data });
                pdfContainer.appendChild(pdfItem);
            }
        }
        updateOrderDisplay();
        pdfInput.value = '';
    }

    /**
     * 建立 PdfItem DOM 元素
     * @returns {HTMLDivElement} PdfItem DOM 元素
     */
    function createPdfItemDom({ uid, pageNum, type, canvas, totalPage, fileName }) {
        let pdfItemId = `${uid}-${pageNum}`;
        const pdfItem = document.createElement('div');
        pdfItem.id = pdfItemId;
        pdfItem.className = "pdf-item";
        pdfItem.innerHTML = `
<button class="remove-btn" title="移除" data-fid="${pdfItemId}">×</button>
<div class="pdf-preview"></div>
<div class="pdf-title">${fileName}</div>
<div class="pdf-info">頁數: ${pageNum} of ${totalPage}</div>`;

        pdfItem.querySelector('.pdf-preview').appendChild(canvas);
        pdfItem.dataset.uid = uid;
        pdfItem.dataset.pageNum = pageNum;
        pdfItem.dataset.type = type;
        return pdfItem;
    }

    // 更新排序顯示
    function updateOrderDisplay() {
        const orderDisplay = document.getElementById('order-display');
        const pdfTitles = [...pdfContainer.querySelectorAll('.pdf-item .pdf-title')];
        orderDisplay.innerHTML = `<ol>${pdfTitles.map(x => `<li>${x.innerText}</li>`).join('')}</ol>`;
    }

    function removePdfFile(id) {
        document.getElementById(id)?.remove();
        updateOrderDisplay();
    }

    async function exportPdf() {
        const pdfItems = [...document.querySelectorAll('#pdf-list .pdf-item')];
        if (pdfItems.length === 0) {
            alert('沒有可匯出的 PDF 頁面');
            return;
        }

        const data = pdfItems.map(x => x.dataset);
        const pdfBytes = await PdfManager.exportPdf(data);
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
