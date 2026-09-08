/* Liber — main app controller */
(function () {
  const shelf = document.getElementById("shelf");
  const emptyState = document.getElementById("empty-state");
  const fileInput = document.getElementById("file-input");
  const viewLibrary = document.getElementById("view-library");
  const viewReader = document.getElementById("view-reader");
  const readerTitle = document.getElementById("reader-title");
  const tocPanel = document.getElementById("toc-panel");
  const toast = document.getElementById("toast");

  let activeBook = null; // { id, format }

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => (toast.hidden = true), 2200);
  }

  function formatOf(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".epub")) return "epub";
    if (name.endsWith(".pdf")) return "pdf";
    if (file.type === "application/epub+zip") return "epub";
    if (file.type === "application/pdf") return "pdf";
    return null;
  }

  async function importFiles(fileList) {
    const files = Array.from(fileList);
    for (const file of files) {
      const format = formatOf(file);
      if (!format) {
        showToast(file.name + " isn't an EPUB or PDF");
        continue;
      }
      const id = "b_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const record = {
        id,
        title: file.name.replace(/\.(epub|pdf)$/i, ""),
        author: "",
        format,
        data: file, // Blob, stored directly in IndexedDB
        addedAt: Date.now(),
        lastOpenedAt: null,
        progress: {},
      };
      try {
        await LiberDB.addBook(record);
      } catch (e) {
        showToast("Couldn't save " + file.name);
      }
    }
    await renderLibrary();
  }

  function progressPercent(book) {
    return (book.progress && book.progress.percent) || 0;
  }

  async function renderLibrary() {
    const books = await LiberDB.getAllBooks();
    books.sort((a, b) => (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt));

    shelf.innerHTML = "";
    emptyState.style.display = books.length ? "none" : "flex";

    books.forEach((book) => {
      const card = document.createElement("div");
      card.className = "book-card";

      const cover = document.createElement("div");
      cover.className = "book-cover";
      const initial = document.createElement("span");
      initial.className = "initial";
      initial.textContent = (book.title || "?").trim().charAt(0).toUpperCase();
      cover.appendChild(initial);

      const badge = document.createElement("span");
      badge.className = "fmt-badge";
      badge.textContent = book.format.toUpperCase();
      cover.appendChild(badge);

      const title = document.createElement("div");
      title.className = "book-title";
      title.textContent = book.title;

      const progress = document.createElement("div");
      progress.className = "book-progress";
      const bar = document.createElement("i");
      bar.style.width = progressPercent(book) + "%";
      progress.appendChild(bar);

      card.appendChild(cover);
      card.appendChild(title);
      card.appendChild(progress);

      card.addEventListener("click", () => openBook(book));
      card.addEventListener(
        "contextmenu",
        (e) => {
          e.preventDefault();
          confirmDelete(book);
        },
        { passive: false }
      );

      let pressTimer;
      card.addEventListener("touchstart", () => {
        pressTimer = setTimeout(() => confirmDelete(book), 600);
      });
      card.addEventListener("touchend", () => clearTimeout(pressTimer));
      card.addEventListener("touchmove", () => clearTimeout(pressTimer));

      shelf.appendChild(card);
    });
  }

  async function confirmDelete(book) {
    if (confirm('Remove "' + book.title + '" from your library?')) {
      await LiberDB.deleteBook(book.id);
      await renderLibrary();
    }
  }

  async function openBook(book) {
    activeBook = book;
    readerTitle.textContent = book.title;
    viewLibrary.classList.remove("active");
    viewReader.classList.add("active");

    if (book.format === "epub") {
      await LiberEpubReader.open(book);
    } else {
      await LiberPdfReader.open(book);
    }
  }

  function closeReader() {
    if (activeBook && activeBook.format === "epub") LiberEpubReader.destroy();
    if (activeBook && activeBook.format === "pdf") LiberPdfReader.destroy();
    activeBook = null;
    viewReader.classList.remove("active");
    viewLibrary.classList.add("active");
    tocPanel.hidden = true;
    renderLibrary();
  }

  function readerNext() {
    if (!activeBook) return;
    activeBook.format === "epub" ? LiberEpubReader.next() : LiberPdfReader.next();
  }
  function readerPrev() {
    if (!activeBook) return;
    activeBook.format === "epub" ? LiberEpubReader.prev() : LiberPdfReader.prev();
  }

  // Wire up UI
  document.getElementById("btn-add").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) importFiles(e.target.files);
    fileInput.value = "";
  });
  document.getElementById("btn-back").addEventListener("click", closeReader);
  document.getElementById("btn-next").addEventListener("click", readerNext);
  document.getElementById("btn-prev").addEventListener("click", readerPrev);
  document.getElementById("btn-toc").addEventListener("click", () => {
    tocPanel.hidden = !tocPanel.hidden;
  });
  document.getElementById("btn-toc-close").addEventListener("click", () => {
    tocPanel.hidden = true;
  });

  // Basic swipe / tap zones on the reader surface for page turns
  const readerSurfaceParent = viewReader;
  let touchStartX = null;
  readerSurfaceParent.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
  });
  readerSurfaceParent.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      dx < 0 ? readerNext() : readerPrev();
    }
    touchStartX = null;
  });

  // Register service worker for offline-first behavior
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  renderLibrary();
})();
