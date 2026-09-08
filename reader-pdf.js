/* Liber.PdfReader — thin wrapper around pdf.js */
(function () {
  let pdfDoc = null;
  let pageNum = 1;
  let currentBookId = null;
  let rendering = false;

  function canvas() {
    return document.getElementById("pdf-viewer");
  }

  async function open(bookRecord) {
    currentBookId = bookRecord.id;
    document.getElementById("epub-viewer").hidden = true;
    const c = canvas();
    c.hidden = false;

    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
    }

    const data = await bookRecord.data.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    pageNum = (bookRecord.progress && bookRecord.progress.page) || 1;
    if (pageNum > pdfDoc.numPages) pageNum = 1;

    await renderPage(pageNum);
    buildToc();
    return true;
  }

  async function renderPage(num) {
    if (!pdfDoc || rendering) return;
    rendering = true;
    const page = await pdfDoc.getPage(num);
    const c = canvas();
    const viewportBase = page.getViewport({ scale: 1 });
    const scale = Math.min(
      c.parentElement.clientWidth / viewportBase.width,
      c.parentElement.clientHeight / viewportBase.height
    );
    const viewport = page.getViewport({ scale: scale || 1 });
    c.width = viewport.width;
    c.height = viewport.height;
    const ctx = c.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    rendering = false;

    const percent = Math.round((num / pdfDoc.numPages) * 100);
    document.getElementById("reader-progress").textContent =
      num + " / " + pdfDoc.numPages;
    LiberDB.updateBook(currentBookId, {
      progress: { page: num, percent },
      lastOpenedAt: Date.now(),
    });
  }

  async function buildToc() {
    const list = document.getElementById("toc-list");
    list.innerHTML = "";
    try {
      const outline = await pdfDoc.getOutline();
      (outline || []).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item.title;
        li.addEventListener("click", async () => {
          if (Array.isArray(item.dest)) {
            const idx = await pdfDoc.getPageIndex(item.dest[0]);
            pageNum = idx + 1;
            renderPage(pageNum);
          }
          document.getElementById("toc-panel").hidden = true;
        });
        list.appendChild(li);
      });
    } catch (e) {
      /* some PDFs have no outline */
    }
  }

  function next() {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    pageNum += 1;
    renderPage(pageNum);
  }
  function prev() {
    if (!pdfDoc || pageNum <= 1) return;
    pageNum -= 1;
    renderPage(pageNum);
  }

  function destroy() {
    pdfDoc = null;
    pageNum = 1;
    currentBookId = null;
  }

  window.LiberPdfReader = { open, next, prev, destroy };
})();
