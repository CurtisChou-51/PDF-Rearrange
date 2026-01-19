/* DOMContentLoaded */
document.addEventListener('DOMContentLoaded', () => {

    const { createApp, ref } = Vue;
    const draggable = window.vuedraggable;

    createApp({
        components: {
            draggable
        },
        setup() {
            const isDragover = ref(false);
            const pdfItems = ref([]);

            function onDragOver(e) {
                isDragover.value = true;
            }

            function onDragLeave(e) {
                if (e.target === e.currentTarget)
                    isDragover.value = false;
            }

            async function onDrop(e) {
                isDragover.value = false;
                const files = e.dataTransfer.files;
                if (files && files.length)
                    await addFiles(files);
            }

            async function addFiles(files) {
                for (const file of files)
                    for await (const data of PdfManager.yieldPageItems(file))
                        pdfItems.value.push({ fileName: file.name, ...data });
            }

            function removePdfItemClick(idx) {
                pdfItems.value.splice(idx, 1);
            }

            function onFileChange(e) {
                const files = e.target.files;
                if (files && files.length) {
                    addFiles(files);
                    e.target.value = ''; // 清空 input 以便可重複選同一檔案
                }
            }

            async function exportPdfClick() {
                if (pdfItems.value.length === 0)
                    return alert('沒有可匯出的 PDF 頁面');

                const pdfBytes = await PdfManager.exportPdf(pdfItems.value);
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

            function setCanvasRef(el, data) {
                if (!el)
                    return;
                // canvas 如果沒有變就不重設
                const currentCanvas = el.querySelector('canvas');
                if (currentCanvas == data.canvas)
                    return;
                currentCanvas?.remove();
                el.appendChild(data.canvas);
            }

            return {
                isDragover, pdfItems,
                onFileChange, onDragOver, onDragLeave, onDrop, removePdfItemClick, exportPdfClick, setCanvasRef
            };
        }
    }).mount('#app');
});
