const state = {
  selectedFiles: [],
  workbench: [],
  books: [],
};

const el = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  folderInput: document.getElementById("folderInput"),
  folderPickBtn: document.getElementById("folderPickBtn"),
  uploadLang: document.getElementById("uploadLang"),
  strictOcrCleanup: document.getElementById("strictOcrCleanup"),
  uploadBtn: document.getElementById("uploadBtn"),
  uploadStatus: document.getElementById("uploadStatus"),
  convertAllBtn: document.getElementById("convertAllBtn"),
  sendAllBtn: document.getElementById("sendAllBtn"),
  refreshWorkbench: document.getElementById("refreshWorkbench"),
  workbenchList: document.getElementById("workbenchList"),
  previewPane: document.getElementById("previewPane"),
  refreshLibrary: document.getElementById("refreshLibrary"),
  libraryList: document.getElementById("libraryList"),
};

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return body;
}

function setUploadStatus(text, isError = false) {
  el.uploadStatus.textContent = text;
  el.uploadStatus.style.color = isError ? "#ff8d8d" : "#9498a3";
}

function onFilesSelected(files) {
  const list = Array.from(files ?? []);
  if (!list.length) return;

  const pdfs = list.filter((file) => file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length) {
    setUploadStatus("Only PDF files are accepted", true);
    return;
  }

  state.selectedFiles = pdfs;
  const ignored = list.length - pdfs.length;
  const ignoredText = ignored > 0 ? ` (${ignored} non-PDF ignored)` : "";
  setUploadStatus(`Selected ${pdfs.length} PDF file(s)${ignoredText}`);
}

async function uploadSelected() {
  if (!state.selectedFiles.length) {
    setUploadStatus("Choose one or more PDF files first", true);
    return;
  }
  const form = new FormData();
  for (const file of state.selectedFiles) {
    form.append("file", file);
  }
  form.append("lang", el.uploadLang.value);

  setUploadStatus(`Uploading ${state.selectedFiles.length} file(s)...`);
  try {
    const payload = await api("/api/admin/upload", {
      method: "POST",
      body: form,
    });
    const uploadedCount = Array.isArray(payload?.results)
      ? payload.results.length
      : payload?.id
        ? 1
        : 0;
    state.selectedFiles = [];
    el.fileInput.value = "";
    el.folderInput.value = "";
    setUploadStatus(`Uploaded ${uploadedCount} file(s) to workbench`);
    await refreshWorkbench();
  } catch (err) {
    setUploadStatus(err instanceof Error ? err.message : "Upload failed", true);
  }
}

async function refreshWorkbench() {
  state.workbench = await api("/api/admin/workbench");
  renderWorkbench();
}

async function refreshLibrary() {
  state.books = await api("/api/books");
  renderLibrary();
}

async function convertItem(item) {
  await api(`/api/admin/workbench/${item.id}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lang: el.uploadLang.value,
      strictOcrCleanup: el.strictOcrCleanup.checked,
    }),
  });
  await refreshWorkbench();
}

async function previewItem(item) {
  const payload = await api(`/api/admin/workbench/${item.id}/preview`);
  el.previewPane.textContent = payload.markdown;
}

async function promoteItem(item) {
  await api(`/api/admin/workbench/${item.id}/promote`, {
    method: "POST",
  });
  el.previewPane.textContent = "Sent to library.";
  await Promise.all([refreshWorkbench(), refreshLibrary()]);
}

async function convertAll() {
  const items = state.workbench.filter((item) =>
    item.status === "uploaded" || item.status === "error"
  );
  if (!items.length) {
    setUploadStatus("No uploaded/error items to convert");
    return;
  }
  setUploadStatus(`Converting ${items.length} item(s)...`);
  let failures = 0;
  for (const item of items) {
    try {
      await convertItem(item);
    } catch (_err) {
      failures += 1;
    }
  }
  await refreshWorkbench();
  if (failures > 0) {
    setUploadStatus(`Converted with ${failures} failure(s)`, true);
    return;
  }
  setUploadStatus(`Converted ${items.length} item(s)`);
}

async function sendAllConverted() {
  const items = state.workbench.filter((item) => item.status === "converted");
  if (!items.length) {
    setUploadStatus("No converted items to send");
    return;
  }
  setUploadStatus(`Sending ${items.length} converted item(s)...`);
  let failures = 0;
  for (const item of items) {
    try {
      await promoteItem(item);
    } catch (_err) {
      failures += 1;
    }
  }
  await Promise.all([refreshWorkbench(), refreshLibrary()]);
  if (failures > 0) {
    setUploadStatus(`Sent with ${failures} failure(s)`, true);
    return;
  }
  setUploadStatus(`Sent ${items.length} item(s) to library`);
}

async function deleteWorkbenchItem(item) {
  await api(`/api/admin/workbench/${item.id}`, { method: "DELETE" });
  if (el.previewPane.textContent.includes(item.originalFilename)) {
    el.previewPane.textContent = "Select an item and load preview.";
  }
  await refreshWorkbench();
}

async function createVersion(book) {
  const label = window.prompt("Version label (optional):", "");
  await api(`/api/admin/books/${book.bookId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label: label || "",
      lang: el.uploadLang.value,
    }),
  });
  alert("Version created.");
}

async function listVersions(book) {
  const versions = await api(`/api/admin/books/${book.bookId}/versions`);
  if (!versions.length) {
    alert("No versions yet.");
    return;
  }
  const lines = versions.map((v) => `- ${v.label} (${v.createdAt})`);
  alert(lines.join("\n"));
}

async function deleteBook(book) {
  const ok = window.confirm(`Delete "${book.title}" from library?`);
  if (!ok) return;
  await api(`/api/admin/books/${book.bookId}`, { method: "DELETE" });
  await refreshLibrary();
}

function renderWorkbench() {
  el.workbenchList.innerHTML = "";
  if (!state.workbench.length) {
    el.workbenchList.innerHTML = `<p class="muted">Workbench is empty.</p>`;
    return;
  }

  state.workbench.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="title">${item.originalFilename}</div>
      <div class="meta">
        <span class="status">${item.status}</span>
        &nbsp; lang=${item.lang}
        ${item.title ? `&nbsp; · &nbsp;${item.title}` : ""}
      </div>
      ${item.errorMessage ? `<div class="meta">Error: ${item.errorMessage}</div>` : ""}
      <div class="actions"></div>
    `;
    const actions = card.querySelector(".actions");

    const addButton = (text, onClick) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.addEventListener("click", onClick);
      actions.appendChild(btn);
    };

    addButton("Convert", async () => {
      try {
        await convertItem(item);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Convert failed");
      }
    });

    addButton("Preview", async () => {
      try {
        await previewItem(item);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Preview failed");
      }
    });

    addButton("Send", async () => {
      try {
        await promoteItem(item);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Send failed");
      }
    });

    addButton("Delete", async () => {
      try {
        await deleteWorkbenchItem(item);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      }
    });

    el.workbenchList.appendChild(card);
  });
}

function renderLibrary() {
  el.libraryList.innerHTML = "";
  if (!state.books.length) {
    el.libraryList.innerHTML = `<p class="muted">No books in library.</p>`;
    return;
  }

  state.books.forEach((book) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="title">${book.title}</div>
      <div class="meta">${book.author} · ${book.totalChunks} chunks</div>
      <div class="actions"></div>
    `;
    const actions = card.querySelector(".actions");

    const addButton = (text, onClick) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.addEventListener("click", onClick);
      actions.appendChild(btn);
    };

    addButton("Create Version", async () => {
      try {
        await createVersion(book);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Versioning failed");
      }
    });

    addButton("List Versions", async () => {
      try {
        await listVersions(book);
      } catch (err) {
        alert(err instanceof Error ? err.message : "List versions failed");
      }
    });

    addButton("Delete", async () => {
      try {
        await deleteBook(book);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Delete failed");
      }
    });

    el.libraryList.appendChild(card);
  });
}

el.fileInput.addEventListener("change", (e) => {
  onFilesSelected(e.target.files);
});

el.folderInput.addEventListener("change", (e) => {
  onFilesSelected(e.target.files);
});

el.dropzone.addEventListener("click", () => {
  el.fileInput.click();
});

el.folderPickBtn.addEventListener("click", () => {
  el.folderInput.click();
});

el.dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  el.dropzone.classList.add("dragover");
});

el.dropzone.addEventListener("dragleave", () => {
  el.dropzone.classList.remove("dragover");
});

el.dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  el.dropzone.classList.remove("dragover");
  onFilesSelected(e.dataTransfer?.files);
});

el.uploadBtn.addEventListener("click", uploadSelected);
el.convertAllBtn.addEventListener("click", () => {
  void convertAll();
});
el.sendAllBtn.addEventListener("click", () => {
  void sendAllConverted();
});
el.refreshWorkbench.addEventListener("click", refreshWorkbench);
el.refreshLibrary.addEventListener("click", refreshLibrary);

Promise.all([refreshWorkbench(), refreshLibrary()]).catch((err) => {
  console.error(err);
  setUploadStatus(err instanceof Error ? err.message : "Failed to load admin data", true);
});
