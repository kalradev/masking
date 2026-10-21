const form = document.getElementById("mask-form");
const fileInput = document.getElementById("file");
const dropzone = document.getElementById("dropzone");
const fileName = document.getElementById("file-name");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");
const result = document.getElementById("result");
const preview = document.getElementById("preview");
const downloadLink = document.getElementById("download-link");
const downloadAll = document.getElementById("download-all");
const fileResults = document.getElementById("file-results");
const stats = document.getElementById("stats");
const selectPreview = document.getElementById("select-preview");
const pagesEl = document.getElementById("pages");
const selectDownload = document.getElementById("select-download");
const clearBoxes = document.getElementById("clear-boxes");
const undoBox = document.getElementById("undo-box");
const redoBox = document.getElementById("redo-box");
const clearPdf = document.getElementById("clear-pdf");
const uploadStep = document.getElementById("upload-step");
const methodStep = document.getElementById("method-step");
const formatHint = document.getElementById("format-hint");
const pageMasking = document.getElementById("page-masking");
const pageConvert = document.getElementById("page-convert");
const convertForm = document.getElementById("convert-form");
const convertFileInput = document.getElementById("convert-file");
const convertDropzone = document.getElementById("convert-dropzone");
const convertFileName = document.getElementById("convert-file-name");
const convertUploadStep = document.getElementById("convert-upload-step");
const convertBtn = document.getElementById("convert-btn");
const convertClear = document.getElementById("convert-clear");
const convertStatus = document.getElementById("convert-status");
const convertResult = document.getElementById("convert-result");
const convertStats = document.getElementById("convert-stats");
const convertDownloadAll = document.getElementById("convert-download-all");
const convertFileResults = document.getElementById("convert-file-results");
const convertDropTitle = document.getElementById("convert-drop-title");
const convertDropHint = document.getElementById("convert-drop-hint");
let convertFiles = [];

const FORMAT_HINTS = {
  airtel:
    "Airtel auto detect masks: total purchase order value, value in words, unit price, line total, CGST, SGST, total line value, and payment terms. (INR) stays visible.",
  beetal:
    "Beetal auto detect masks: unit price, delivery date, amount, rate, total amount, total value with GST, PO value in words, and payment terms.",
};

const MAX_FILES = 25;

let selectedFiles = [];
let selectJobId = null;
let regions = [];
let drawing = null;
let nextRegionId = 1;
let undoStack = [];
let redoStack = [];
let maskTimer = null;
let maskPromise = null;
let selectDownloadUrl = null;
let maskGeneration = 0;

function currentVendor() {
  return form.querySelector('input[name="vendor"]:checked')?.value || null;
}

function currentMode() {
  return form.querySelector('input[name="mode"]:checked')?.value || null;
}

function syncMode() {
  const vendor = currentVendor();
  const mode = currentMode();
  methodStep.classList.toggle("hidden", !vendor);
  formatHint.textContent = vendor ? FORMAT_HINTS[vendor] || "" : "";
  uploadStep.classList.toggle("hidden", !(vendor && mode));
  submitBtn.classList.toggle("hidden", !(vendor && mode));
  if (mode === "select") {
    submitBtn.textContent = "Open preview";
  } else if (selectedFiles.length > 1) {
    submitBtn.textContent = `Mask ${selectedFiles.length} PDFs`;
  } else {
    submitBtn.textContent = "Mask PDF";
  }
}

function showPage(page) {
  const isMasking = page === "masking";
  pageMasking.classList.toggle("hidden", !isMasking);
  pageConvert.classList.toggle("hidden", isMasking);
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
  if (isMasking) {
    clearConvertFiles();
    convertResult.classList.add("hidden");
  } else {
    clearSelectedPdf();
  }
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

form.querySelectorAll('input[name="vendor"]').forEach((input) => {
  input.addEventListener("change", () => {
    const autoInput = form.querySelector('input[name="mode"][value="auto"]');
    if (autoInput && !currentMode()) {
      autoInput.checked = true;
    }
    syncMode();
    clearSelectedPdf();
  });
});

form.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener("change", () => {
    syncMode();
    clearSelectedPdf();
  });
});
syncMode();

function setSelectedFile(file) {
  setSelectedFiles(file ? [file] : []);
}

function setSelectedFiles(files) {
  selectedFiles = files;
  const transfer = new DataTransfer();
  selectedFiles.forEach((file) => transfer.items.add(file));
  fileInput.files = transfer.files;
  if (!selectedFiles.length) {
    fileName.textContent = "No file selected";
  } else if (selectedFiles.length === 1) {
    fileName.textContent = selectedFiles[0].name;
  } else {
    fileName.textContent = `${selectedFiles.length} PDFs selected`;
  }
  clearPdf.classList.toggle("hidden", !selectedFiles.length);
  syncMode();
}

function clearSelectedPdf() {
  selectedFiles = [];
  fileInput.value = "";
  setSelectedFiles([]);
  selectJobId = null;
  regions = [];
  drawing = null;
  nextRegionId = 1;
  undoStack = [];
  redoStack = [];
  clearTimeout(maskTimer);
  maskTimer = null;
  maskPromise = null;
  selectDownloadUrl = null;
  if (selectDownload) {
    selectDownload.href = "#";
  }
  syncHistoryButtons();
  pagesEl.innerHTML = "";
  preview.src = "";
  downloadLink.href = "#";
  downloadAll.href = "#";
  downloadAll.classList.add("hidden");
  fileResults.innerHTML = "";
  fileResults.classList.add("hidden");
  stats.textContent = "";
  statusEl.textContent = "";
  result.classList.add("hidden");
  selectPreview.classList.add("hidden");
}

fileInput.addEventListener("change", () => {
  takePdfs(fileInput.files);
});

clearPdf.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  clearSelectedPdf();
});

function isPdf(file) {
  return Boolean(
    file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
  );
}

function takePdfs(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) {
    setSelectedFiles([]);
    return;
  }

  const pdfs = files.filter(isPdf);
  if (!pdfs.length) {
    fileInput.value = "";
    setSelectedFiles([]);
    statusEl.textContent = "Only PDF files are allowed.";
    return;
  }

  if (pdfs.length > MAX_FILES) {
    fileInput.value = "";
    setSelectedFiles([]);
    statusEl.textContent = `Upload up to ${MAX_FILES} PDFs at once.`;
    return;
  }

  setSelectedFiles(pdfs);
  statusEl.textContent = "";
}

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (event) => {
  takePdfs(event.dataTransfer.files);
});

function showMasked(data) {
  const files = data.files || [
    {
      original_name: data.original_name || "masked.pdf",
      preview_url: data.preview_url,
      download_url: data.download_url,
      redactions: data.redactions,
      pages_masked: data.pages_masked,
      pages: data.pages,
    },
  ];
  const first = files[0];
  preview.src = first.preview_url;
  downloadLink.href = first.download_url;
  downloadLink.download = (first.original_name || "masked").replace(/\.pdf$/i, "") + "_masked.pdf";
  if (data.zip_url && files.length > 1) {
    downloadAll.href = data.zip_url;
    downloadAll.classList.remove("hidden");
    downloadLink.classList.add("hidden");
  } else {
    downloadAll.classList.add("hidden");
    downloadLink.classList.remove("hidden");
  }
  if (files.length > 1) {
    fileResults.innerHTML = files
      .map(
        (item) =>
          `<li><span>${item.original_name}</span><a href="${item.download_url}" download>Download</a></li>`
      )
      .join("");
    fileResults.classList.remove("hidden");
  } else {
    fileResults.innerHTML = "";
    fileResults.classList.add("hidden");
  }
  const vendorLabel = data.vendor === "beetal" ? "Beetal" : data.vendor === "airtel" ? "Airtel" : "Auto detect";
  const totalRedactions = files.reduce((sum, item) => sum + (item.redactions || 0), 0);
  stats.textContent = `${vendorLabel} auto detect: ${files.length} file${files.length > 1 ? "s" : ""}, ${totalRedactions} redactions.`;
  if (data.note) {
    stats.textContent += ` ${data.note}`;
  }
  selectPreview.classList.add("hidden");
  result.classList.remove("hidden");
  statusEl.textContent = files.length > 1 ? "Done. Download all files below." : "Done. Preview is below.";
}

function pointOnLayer(event, layer) {
  const img = layer.previousElementSibling;
  const rect = (img && img.getBoundingClientRect().height
    ? img
    : layer
  ).getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / height)),
  };
}

function boxStyle(region) {
  return `left:${region.x * 100}%;top:${region.y * 100}%;width:${region.width * 100}%;height:${region.height * 100}%;`;
}

function copyRegions() {
  return regions.map((region) => ({ ...region }));
}

function syncHistoryButtons() {
  undoBox.disabled = undoStack.length === 0;
  redoBox.disabled = redoStack.length === 0;
}

function rememberState() {
  undoStack.push(copyRegions());
  redoStack = [];
  syncHistoryButtons();
}

function regionsPayload() {
  return regions.map(({ page, x, y, width, height }) => ({ page, x, y, width, height }));
}

async function applyMaskNow() {
  if (!selectJobId) {
    return null;
  }
  const generation = (maskGeneration += 1);
  statusEl.textContent = "Updating mask...";
  const response = await fetch("/api/mask-regions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: selectJobId, regions: regionsPayload() }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Masking failed.");
  }
  if (generation !== maskGeneration) {
    return selectDownloadUrl;
  }
  selectDownloadUrl = `${data.download_url}?t=${Date.now()}`;
  selectDownload.href = selectDownloadUrl;
  statusEl.textContent = "Mask applied. You can download the PDF.";
  return selectDownloadUrl;
}

function scheduleAutoMask() {
  if (!selectJobId) {
    return;
  }
  clearTimeout(maskTimer);
  statusEl.textContent = "Updating mask...";
  maskTimer = setTimeout(() => {
    maskPromise = applyMaskNow().catch((error) => {
      statusEl.textContent = error.message;
    });
  }, 400);
}

async function flushAutoMask() {
  clearTimeout(maskTimer);
  maskTimer = null;
  maskPromise = applyMaskNow();
  await maskPromise;
}

function redrawRegions() {
  pagesEl.querySelectorAll(".mask-box").forEach((box) => box.remove());
  regions.forEach((region) => {
    const layer = document.querySelector(`.draw-layer[data-page="${region.page}"]`);
    if (layer) {
      addBox(layer, region, false);
    }
  });
}

function undoSelection() {
  if (!undoStack.length || drawing) {
    return;
  }
  redoStack.push(copyRegions());
  regions = undoStack.pop();
  redrawRegions();
  syncHistoryButtons();
  scheduleAutoMask();
}

function redoSelection() {
  if (!redoStack.length || drawing) {
    return;
  }
  undoStack.push(copyRegions());
  regions = redoStack.pop();
  redrawRegions();
  syncHistoryButtons();
  scheduleAutoMask();
}

function addBox(layer, region, live) {
  const box = document.createElement("div");
  box.className = live ? "mask-box live" : "mask-box";
  box.style.cssText = boxStyle(region);
  if (!live) {
    box.title = "Click to remove";
    box.addEventListener("mousedown", (event) => event.stopPropagation());
    box.addEventListener("click", (event) => {
      event.stopPropagation();
      rememberState();
      regions = regions.filter((item) => item.id !== region.id);
      box.remove();
      scheduleAutoMask();
    });
  }
  layer.appendChild(box);
  return box;
}

function renderSelectPages(pages) {
  pagesEl.innerHTML = "";
  regions = [];
  nextRegionId = 1;
  undoStack = [];
  redoStack = [];
  syncHistoryButtons();
  pages.forEach((page) => {
    const stage = document.createElement("div");
    stage.className = "page-stage";
    const img = document.createElement("img");
    img.src = page.url;
    img.alt = `Page ${page.index + 1}`;
    const layer = document.createElement("div");
    layer.className = "draw-layer";
    layer.dataset.page = String(page.index);

    layer.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const start = pointOnLayer(event, layer);
      const liveRegion = { page: page.index, x: start.x, y: start.y, width: 0, height: 0 };
      drawing = {
        layer,
        start,
        region: liveRegion,
        box: addBox(layer, liveRegion, true),
      };
    });

    stage.append(img, layer);
    pagesEl.appendChild(stage);
  });
  scheduleAutoMask();
}

document.addEventListener("mousemove", (event) => {
  if (!drawing) {
    return;
  }
  const current = pointOnLayer(event, drawing.layer);
  drawing.region.x = Math.min(drawing.start.x, current.x);
  drawing.region.y = Math.min(drawing.start.y, current.y);
  drawing.region.width = Math.abs(current.x - drawing.start.x);
  drawing.region.height = Math.abs(current.y - drawing.start.y);
  drawing.box.style.cssText = boxStyle(drawing.region);
});

document.addEventListener("mouseup", () => {
  if (!drawing) {
    return;
  }
  const { region, box } = drawing;
  drawing = null;
  if (region.width < 0.01 || region.height < 0.01) {
    box.remove();
    return;
  }
  box.remove();
  rememberState();
  const saved = { ...region, id: nextRegionId };
  nextRegionId += 1;
  regions.push(saved);
  addBox(document.querySelector(`.draw-layer[data-page="${saved.page}"]`), saved, false);
  scheduleAutoMask();
});

undoBox.addEventListener("click", undoSelection);
redoBox.addEventListener("click", redoSelection);

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!(event.ctrlKey || event.metaKey) || selectPreview.classList.contains("hidden")) {
    return;
  }
  if (key === "z" && !event.shiftKey) {
    event.preventDefault();
    undoSelection();
  } else if (key === "y" || (key === "z" && event.shiftKey)) {
    event.preventDefault();
    redoSelection();
  }
});

clearBoxes.addEventListener("click", () => {
  if (!regions.length) {
    return;
  }
  rememberState();
  regions = [];
  pagesEl.querySelectorAll(".mask-box").forEach((box) => box.remove());
  scheduleAutoMask();
});

selectDownload.addEventListener("click", async (event) => {
  event.preventDefault();
  if (!selectJobId) {
    return;
  }
  try {
    await flushAutoMask();
    if (!selectDownloadUrl) {
      return;
    }
    const link = document.createElement("a");
    link.href = selectDownloadUrl;
    link.download = "masked.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentVendor()) {
    statusEl.textContent = "Select Airtel or Beetal first.";
    return;
  }
  if (!currentMode()) {
    statusEl.textContent = "Select a method first.";
    return;
  }
  if (!selectedFiles.length) {
    statusEl.textContent = "Choose a PDF first.";
    return;
  }

  submitBtn.disabled = true;
  result.classList.add("hidden");
  selectPreview.classList.add("hidden");

  try {
    if (currentMode() === "select") {
      if (selectedFiles.length > 1) {
        throw new Error("Select on preview works with one PDF. Use Auto detect to mask several files.");
      }
      statusEl.textContent = "Opening PDF preview...";
      const body = new FormData();
      body.append("file", selectedFiles[0]);
      const response = await fetch("/api/upload", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      selectJobId = data.job_id;
      renderSelectPages(data.pages);
      selectPreview.classList.remove("hidden");
      statusEl.textContent = "Draw boxes to mask. Download when you are ready.";
      return;
    }

    statusEl.textContent =
      selectedFiles.length > 1 ? `Masking ${selectedFiles.length} PDFs...` : "Masking PDF...";
    const body = new FormData();
    body.append("vendor", currentVendor());
    body.append("mode", "auto");
    selectedFiles.forEach((file) => body.append("files", file));
    const response = await fetch("/api/mask-batch", {
      method: "POST",
      body,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Masking failed.");
    }
    showMasked(data);
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});

function currentConvertDir() {
  return convertForm.querySelector('input[name="convert-dir"]:checked')?.value || null;
}

function syncConvert() {
  const dir = currentConvertDir();
  convertUploadStep.classList.toggle("hidden", !dir);
  convertBtn.classList.toggle("hidden", !dir);
  if (dir === "pdf-to-word") {
    convertFileInput.accept = ".pdf,application/pdf";
    convertDropTitle.textContent = "Drop PDFs here";
    convertDropHint.textContent = "or click to choose one or more PDF files";
    convertBtn.textContent =
      convertFiles.length > 1 ? `Convert ${convertFiles.length} PDFs` : "Convert to Word";
  } else if (dir === "word-to-pdf") {
    convertFileInput.accept =
      ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    convertDropTitle.textContent = "Drop Word files here";
    convertDropHint.textContent = "or click to choose one or more Word files";
    convertBtn.textContent =
      convertFiles.length > 1 ? `Convert ${convertFiles.length} files` : "Convert to PDF";
  }
}

function setConvertFiles(files) {
  convertFiles = files;
  const transfer = new DataTransfer();
  convertFiles.forEach((file) => transfer.items.add(file));
  convertFileInput.files = transfer.files;
  if (!convertFiles.length) {
    convertFileName.textContent = "No file selected";
  } else if (convertFiles.length === 1) {
    convertFileName.textContent = convertFiles[0].name;
  } else {
    convertFileName.textContent = `${convertFiles.length} files selected`;
  }
  convertClear.classList.toggle("hidden", !convertFiles.length);
  syncConvert();
}

function clearConvertFiles() {
  convertFiles = [];
  convertFileInput.value = "";
  setConvertFiles([]);
  convertStatus.textContent = "";
  convertResult.classList.add("hidden");
  convertDownloadAll.classList.add("hidden");
  convertDownloadAll.href = "#";
  convertFileResults.innerHTML = "";
  convertStats.textContent = "";
}

function isPdfFile(file) {
  return Boolean(
    file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
  );
}

function isWordFile(file) {
  const name = (file?.name || "").toLowerCase();
  return Boolean(
    file &&
      (name.endsWith(".docx") ||
        name.endsWith(".doc") ||
        file.type === "application/msword" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  );
}

function takeConvertFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) {
    setConvertFiles([]);
    return;
  }
  const dir = currentConvertDir();
  const filtered =
    dir === "word-to-pdf" ? files.filter(isWordFile) : files.filter(isPdfFile);
  if (!filtered.length) {
    convertFileInput.value = "";
    setConvertFiles([]);
    convertStatus.textContent =
      dir === "word-to-pdf" ? "Only Word files (.doc / .docx) are allowed." : "Only PDF files are allowed.";
    return;
  }
  if (filtered.length > MAX_FILES) {
    convertFileInput.value = "";
    setConvertFiles([]);
    convertStatus.textContent = `Upload up to ${MAX_FILES} files at once.`;
    return;
  }
  setConvertFiles(filtered);
  convertStatus.textContent = "";
}

convertForm.querySelectorAll('input[name="convert-dir"]').forEach((input) => {
  input.addEventListener("change", () => {
    clearConvertFiles();
    syncConvert();
  });
});
syncConvert();

convertFileInput.addEventListener("change", () => {
  takeConvertFiles(convertFileInput.files);
});

convertClear.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  clearConvertFiles();
});

["dragenter", "dragover"].forEach((eventName) => {
  convertDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    convertDropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  convertDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    convertDropzone.classList.remove("dragover");
  });
});

convertDropzone.addEventListener("drop", (event) => {
  takeConvertFiles(event.dataTransfer.files);
});

function showConvertResult(data) {
  const files = data.files || [];
  convertFileResults.innerHTML = files
    .map(
      (item) =>
        `<li><span>${item.original_name} → ${item.output_name}</span><a href="${item.download_url}" download>Download</a></li>`
    )
    .join("");
  if (data.zip_url && files.length > 1) {
    convertDownloadAll.href = data.zip_url;
    convertDownloadAll.classList.remove("hidden");
  } else {
    convertDownloadAll.classList.add("hidden");
  }
  convertStats.textContent = `Converted ${files.length} file${files.length > 1 ? "s" : ""}.`;
  convertResult.classList.remove("hidden");
  convertStatus.textContent = files.length > 1 ? "Done. Download all below." : "Done.";
}

convertForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentConvertDir()) {
    convertStatus.textContent = "Choose PDF → Word or Word → PDF first.";
    return;
  }
  if (!convertFiles.length) {
    convertStatus.textContent = "Choose files first.";
    return;
  }

  convertBtn.disabled = true;
  convertResult.classList.add("hidden");
  convertStatus.textContent =
    convertFiles.length > 1 ? `Converting ${convertFiles.length} files...` : "Converting...";

  try {
    const body = new FormData();
    body.append("direction", currentConvertDir());
    convertFiles.forEach((file) => body.append("files", file));
    const response = await fetch("/api/convert", {
      method: "POST",
      body,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Conversion failed.");
    }
    showConvertResult(data);
  } catch (error) {
    convertStatus.textContent = error.message;
  } finally {
    convertBtn.disabled = false;
  }
});
