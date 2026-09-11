import { parseLayout, applyGeometry, setProp, setWidgetName, setAttr, walkWidgets, getProp } from "./layout-parser.js";
import { exportLayoutXml, unifiedDiff, backupName } from "./exporter.js";
import { History, snapshotGeometry, restoreGeometry } from "./history.js";
import {
  computeRects,
  renderWidgets,
  renderHierarchy,
  writeScreenRect,
  imageScaleInfo,
  isRelative,
} from "./renderer.js";
import { Selection, hitTestAll, boundingBox, renderSelectionOverlay, resizeBox, scaleRectsFromBox } from "./selection.js";

const PRESETS = [
  [1280, 720],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
];

const state = {
  parsed: null,
  fileName: "",
  filePath: "",
  modPath: "",
  guiDir: "",
  layoutsDir: "",
  layouts: [],
  assetPath: "",
  assetIndex: new Map(),
  images: new Map(),
  objectUrls: [],
  selection: new Selection(),
  history: new History(),
  previewW: 1920,
  previewH: 1080,
  refW: 1920,
  refH: 1080,
  scaleMode: "viewport",
  zoom: 0.5,
  fitZoom: true,
  snap: false,
  gridSize: 8,
  showGrid: true,
  checker: true,
  showHidden: true,
  aspectLock: false,
  scaleChildren: false,
  imagePreviewMode: "layout",
  screenshot: { url: null, opacity: 0.45, mode: "overlay" },
  refOverlay: { on: false, x: 200, y: 80, w: 800, h: 600 },
  drag: null,
  byId: new Map(),
  overlapIndex: 0,
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

init();

function init() {
  cacheEls();
  bindUi();
  bindPanelResize();
  state.history.onChange = updateHistoryButtons;
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", () => {
    if (state.fitZoom) applyZoom();
  });
  setStatus("Local editor ready. Open a mod folder, then pick a layout.");
  refreshCanvasChrome();
}

function cacheEls() {
  [
    "btn-open-mod",
    "btn-open-mod-path",
    "mod-path",
    "layout-select",
    "btn-open",
    "file-open",
    "btn-save-as",
    "btn-overwrite",
    "btn-undo",
    "btn-redo",
    "btn-assets",
    "dir-assets",
    "asset-path",
    "btn-asset-path",
    "btn-reload-assets",
    "file-name",
    "parse-errors",
    "preview-res",
    "custom-w",
    "custom-h",
    "scale-mode",
    "zoom",
    "chk-grid",
    "grid-size",
    "chk-snap",
    "chk-checker",
    "chk-hidden",
    "chk-aspect",
    "chk-scale-children",
    "hierarchy",
    "canvas-scroll",
    "canvas-world",
    "layer-shot",
    "layer-widgets",
    "layer-grid",
    "layer-ref",
    "layer-select",
    "drop-mask",
    "prop-empty",
    "prop-form",
    "sel-summary",
    "f-name",
    "f-type",
    "f-skin",
    "f-align",
    "f-visible",
    "f-x",
    "f-y",
    "f-w",
    "f-h",
    "f-px",
    "f-scale",
    "f-caption",
    "f-image",
    "f-img-info",
    "f-keep-aspect",
    "img-preview-mode",
    "f-colour",
    "f-textcolour",
    "f-alpha",
    "f-textalign",
    "f-font",
    "raw-props",
    "unknown-props",
    "btn-scale-up",
    "btn-scale-down",
    "btn-reset-size",
    "btn-fit-parent",
    "btn-fit-image",
    "btn-native-image",
    "btn-center",
    "btn-center-h",
    "btn-center-v",
    "btn-group-scale",
    "group-scale",
    "file-image",
    "btn-replace-image",
    "btn-save-image-as",
    "shot-file",
    "shot-opacity",
    "shot-mode",
    "btn-clear-shot",
    "ref-on",
    "ref-w",
    "ref-h",
    "ref-x",
    "ref-y",
    "btn-snap-ref",
    "modal",
    "diff-view",
    "btn-confirm-save",
    "btn-cancel-save",
    "modal-title",
    "status",
  ].forEach((id) => {
    els[id] = $(id);
    if (!els[id]) throw new Error("Missing element #" + id);
  });
}

function bindUi() {
  els["btn-open"].addEventListener("click", () => els["file-open"].click());
  els["file-open"].addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (f) await loadFile(f);
    e.target.value = "";
  });
  els["btn-open-mod"].addEventListener("click", pickModFolder);
  els["btn-open-mod-path"].addEventListener("click", () => openMod(els["mod-path"].value.trim()));
  els["mod-path"].addEventListener("keydown", (e) => {
    if (e.key === "Enter") openMod(els["mod-path"].value.trim());
  });
  els["layout-select"].addEventListener("change", onLayoutPicked);
  const savedMod = localStorage.getItem("smLayoutEditor.modPath");
  if (savedMod) els["mod-path"].value = savedMod;
  els["btn-save-as"].addEventListener("click", () => beginExport(false));
  els["btn-overwrite"].addEventListener("click", () => beginExport(true));
  els["btn-undo"].addEventListener("click", () => undo());
  els["btn-redo"].addEventListener("click", () => redo());
  els["btn-assets"].addEventListener("click", () => els["dir-assets"].click());
  els["dir-assets"].addEventListener("change", async (e) => {
    await indexAssetFiles([...e.target.files]);
    e.target.value = "";
  });
  els["btn-asset-path"].addEventListener("click", () => setAssetPath(els["asset-path"].value.trim()));
  els["btn-reload-assets"].addEventListener("click", reloadAssets);
  els["preview-res"].addEventListener("change", onPreviewRes);
  els["custom-w"].addEventListener("change", onCustomRes);
  els["custom-h"].addEventListener("change", onCustomRes);
  els["scale-mode"].addEventListener("change", () => {
    state.scaleMode = els["scale-mode"].value;
    redraw();
  });
  els["zoom"].addEventListener("change", () => {
    state.fitZoom = els["zoom"].value === "fit";
    if (!state.fitZoom) state.zoom = Number(els["zoom"].value) / 100;
    applyZoom();
  });
  els["chk-grid"].addEventListener("change", () => {
    state.showGrid = els["chk-grid"].checked;
    refreshCanvasChrome();
  });
  els["grid-size"].addEventListener("change", () => {
    state.gridSize = Math.max(1, Number(els["grid-size"].value) || 8);
    refreshCanvasChrome();
  });
  els["chk-snap"].addEventListener("change", () => {
    state.snap = els["chk-snap"].checked;
  });
  els["chk-checker"].addEventListener("change", () => {
    state.checker = els["chk-checker"].checked;
    refreshCanvasChrome();
  });
  els["chk-hidden"].addEventListener("change", () => {
    state.showHidden = els["chk-hidden"].checked;
    redraw();
  });
  els["chk-aspect"].addEventListener("change", () => {
    state.aspectLock = els["chk-aspect"].checked;
  });
  els["chk-scale-children"].addEventListener("change", () => {
    state.scaleChildren = els["chk-scale-children"].checked;
    if (state.scaleChildren) {
      warn(
        "position_real children already follow their parent size. Scaling stored child values is not how these RFS layouts normally work."
      );
    }
  });
  els["img-preview-mode"].addEventListener("change", () => {
    state.imagePreviewMode = els["img-preview-mode"].value;
    redraw();
  });

  ["f-x", "f-y", "f-w", "f-h"].forEach((id) => {
    els[id].addEventListener("change", onNumericFields);
  });
  els["f-name"].addEventListener("change", () => editPropField("name"));
  els["f-visible"].addEventListener("change", () => editPropField("visible"));
  els["f-caption"].addEventListener("change", () => editPropField("caption"));
  els["f-image"].addEventListener("change", () => editPropField("image"));
  els["f-keep-aspect"].addEventListener("change", () => editPropField("keepAspect"));
  els["f-colour"].addEventListener("change", () => editPropField("colour"));
  els["f-textcolour"].addEventListener("change", () => editPropField("textColour"));
  els["f-alpha"].addEventListener("change", () => editPropField("alpha"));
  els["f-textalign"].addEventListener("change", () => editPropField("textAlign"));
  els["f-font"].addEventListener("change", () => editPropField("font"));
  els["f-align"].addEventListener("change", () => editPropField("align"));
  els["f-scale"].addEventListener("change", onScaleField);

  els["btn-scale-up"].addEventListener("click", () => nudgeScale(10));
  els["btn-scale-down"].addEventListener("click", () => nudgeScale(-10));
  els["btn-reset-size"].addEventListener("click", resetOriginalSize);
  els["btn-fit-parent"].addEventListener("click", fitToParent);
  els["btn-fit-image"].addEventListener("click", fitImageToWidget);
  els["btn-native-image"].addEventListener("click", setWidgetToImageNative);
  els["btn-center"].addEventListener("click", () => centerInParent(true, true));
  els["btn-center-h"].addEventListener("click", () => centerInParent(true, false));
  els["btn-center-v"].addEventListener("click", () => centerInParent(false, true));
  els["btn-group-scale"].addEventListener("click", applyGroupScale);
  els["btn-replace-image"].addEventListener("click", () => els["file-image"].click());
  els["file-image"].addEventListener("change", onReplaceImage);
  els["btn-save-image-as"].addEventListener("click", saveReplacementImage);
  els["shot-file"].addEventListener("change", onScreenshot);
  els["shot-opacity"].addEventListener("input", () => {
    state.screenshot.opacity = Number(els["shot-opacity"].value) / 100;
    refreshCanvasChrome();
  });
  els["shot-mode"].addEventListener("change", () => {
    state.screenshot.mode = els["shot-mode"].value;
    document.body.classList.toggle("side-by-side", state.screenshot.mode === "side");
    refreshCanvasChrome();
  });
  els["btn-clear-shot"].addEventListener("click", clearScreenshot);
  els["ref-on"].addEventListener("change", () => {
    state.refOverlay.on = els["ref-on"].checked;
    refreshCanvasChrome();
  });
  ["ref-w", "ref-h", "ref-x", "ref-y"].forEach((id) => {
    els[id].addEventListener("change", () => {
      state.refOverlay.w = Number(els["ref-w"].value) || 0;
      state.refOverlay.h = Number(els["ref-h"].value) || 0;
      state.refOverlay.x = Number(els["ref-x"].value) || 0;
      state.refOverlay.y = Number(els["ref-y"].value) || 0;
      refreshCanvasChrome();
    });
  });
  els["btn-snap-ref"].addEventListener("click", snapToRef);
  els["btn-cancel-save"].addEventListener("click", () => els.modal.classList.add("hidden"));
  els["btn-confirm-save"].addEventListener("click", confirmSave);

  const world = els["canvas-world"];
  world.addEventListener("mousedown", onCanvasDown);
  window.addEventListener("mousemove", onCanvasMove);
  window.addEventListener("mouseup", onCanvasUp);
  world.addEventListener("dblclick", onCanvasDblClick);

  const drop = document.getElementById("app");
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    els["drop-mask"].classList.add("show");
  });
  drop.addEventListener("dragleave", () => els["drop-mask"].classList.remove("show"));
  drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    els["drop-mask"].classList.remove("show");
    const files = [...e.dataTransfer.files];
    const layout = files.find((f) => /\.layout$/i.test(f.name) || /\.xml$/i.test(f.name));
    if (layout) await loadFile(layout);
    const pngs = files.filter((f) => /\.png$/i.test(f.name));
    if (pngs.length) await indexAssetFiles(pngs);
  });

  document.querySelectorAll("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => loadSample(btn.dataset.sample));
  });
}

function bindPanelResize() {
  const workspace = $("workspace");
  if (!workspace) return;
  const MIN_LEFT = 160;
  const MIN_RIGHT = 220;
  const MIN_CANVAS = 180;
  const DEFAULT_LEFT = 260;
  const DEFAULT_RIGHT = 360;

  function clamp(left, right, total) {
    const maxLeft = Math.max(MIN_LEFT, total - MIN_RIGHT - MIN_CANVAS - 12);
    const maxRight = Math.max(MIN_RIGHT, total - MIN_LEFT - MIN_CANVAS - 12);
    left = Math.min(maxLeft, Math.max(MIN_LEFT, left));
    right = Math.min(maxRight, Math.max(MIN_RIGHT, right));
    if (left + right + MIN_CANVAS + 12 > total) {
      right = Math.max(MIN_RIGHT, total - left - MIN_CANVAS - 12);
    }
    return { left, right };
  }

  function apply(left, right) {
    const total = workspace.getBoundingClientRect().width || 1200;
    const next = clamp(left, right, total);
    workspace.style.setProperty("--left-w", next.left + "px");
    workspace.style.setProperty("--right-w", next.right + "px");
    localStorage.setItem("smLayoutEditor.leftW", String(Math.round(next.left)));
    localStorage.setItem("smLayoutEditor.rightW", String(Math.round(next.right)));
    if (state.fitZoom) applyZoom();
  }

  const savedLeft = Number(localStorage.getItem("smLayoutEditor.leftW"));
  const savedRight = Number(localStorage.getItem("smLayoutEditor.rightW"));
  apply(Number.isFinite(savedLeft) && savedLeft > 0 ? savedLeft : DEFAULT_LEFT, Number.isFinite(savedRight) && savedRight > 0 ? savedRight : DEFAULT_RIGHT);

  let drag = null;
  function onMove(ev) {
    if (!drag) return;
    const box = workspace.getBoundingClientRect();
    const curLeft = parseFloat(getComputedStyle(workspace).getPropertyValue("--left-w")) || DEFAULT_LEFT;
    const curRight = parseFloat(getComputedStyle(workspace).getPropertyValue("--right-w")) || DEFAULT_RIGHT;
    if (drag.side === "left") apply(ev.clientX - box.left, curRight);
    else apply(curLeft, box.right - ev.clientX);
  }
  function onUp() {
    if (!drag) return;
    drag.handle.classList.remove("is-dragging");
    document.body.classList.remove("is-col-resizing");
    drag = null;
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);

  ["split-left", "split-right"].forEach((id) => {
    const handle = $(id);
    if (!handle) return;
    handle.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      drag = { side: handle.dataset.side, handle };
      handle.classList.add("is-dragging");
      document.body.classList.add("is-col-resizing");
    });
    handle.addEventListener("dblclick", () => {
      if (handle.dataset.side === "left") {
        const right = parseFloat(getComputedStyle(workspace).getPropertyValue("--right-w")) || DEFAULT_RIGHT;
        apply(DEFAULT_LEFT, right);
      } else {
        const left = parseFloat(getComputedStyle(workspace).getPropertyValue("--left-w")) || DEFAULT_LEFT;
        apply(left, DEFAULT_RIGHT);
      }
    });
  });
}

async function pickModFolder() {
  const start = els["mod-path"].value.trim() || localStorage.getItem("smLayoutEditor.modPath") || "";
  setStatus("Choose the mod folder in the Windows dialog (the folder that contains Gui)…");
  try {
    const res = await fetch("/api/pick-mod?start=" + encodeURIComponent(start));
    const data = await res.json();
    if (!data.ok) {
      showErrors([data.error || "Folder picker failed."]);
      return;
    }
    if (data.cancelled || !data.path) {
      setStatus("Folder pick cancelled.");
      return;
    }
    els["mod-path"].value = data.path;
    await openMod(data.path);
  } catch (err) {
    showErrors([
      "Could not open a folder dialog. Leave start_editor.bat running, or paste the mod path and click Load mod. " +
        err.message,
    ]);
  }
}

async function loadSample(name) {
  const res = await fetch("samples/" + name);
  if (!res.ok) {
    showErrors([`Could not load sample ${name}`]);
    return;
  }
  const text = await res.text();
  openXml(text, name, "samples/" + name);
  setStatus(`Sample ${name} — bundled file only, not a mod. Open a mod folder to resolve Gui/Images.`);
}

async function openMod(path, keepLayout = false) {
  if (!path) {
    warn("Paste a mod folder path first. Example: C:\\Coding Projects\\Testing\\RemasteredFrameworkSystems0854-gj");
    return;
  }
  try {
    const res = await fetch("/api/mod?path=" + encodeURIComponent(path));
    const data = await res.json();
    if (!data.ok) {
      showErrors([data.error || "Could not open that mod folder."]);
      setStatus(data.error || "Mod open failed.");
      return;
    }
    state.modPath = data.mod;
    state.guiDir = data.guiDir;
    state.layoutsDir = data.layoutsDir;
    state.layouts = data.layouts || [];
    state.assetPath = data.guiDir;
    state.assetList = data.images || [];
    localStorage.setItem("smLayoutEditor.modPath", data.mod);
    els["mod-path"].value = data.mod;
    const selected = keepLayout ? state.filePath : "";
    fillLayoutDropdown(selected);
    if (!keepLayout) {
      els["file-name"].textContent = data.mod.split(/[/\\]/).pop() + " — pick a layout";
    }
    showErrors([], []);
    setStatus(
      `Mod loaded. ${state.layouts.length} layouts in Gui/${data.layoutsFolderName || "Layouts"}, ${state.assetList.length} PNGs in Gui. Pick a layout.`
    );
    if (state.parsed) {
      await resolveImages();
      redraw();
    }
  } catch (err) {
    showErrors(["Could not reach the local server. Leave start_editor.bat open. " + err.message]);
  }
}

function fillLayoutDropdown(selectedPath) {
  const sel = els["layout-select"];
  sel.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = state.layouts.length ? "Select a layout…" : "No .layout files in Gui/Layouts";
  sel.appendChild(blank);
  for (const layout of state.layouts) {
    const opt = document.createElement("option");
    opt.value = layout.path;
    opt.textContent = layout.name;
    if (layout.path === selectedPath) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.disabled = state.layouts.length === 0;
}

async function onLayoutPicked() {
  const path = els["layout-select"].value;
  if (!path) return;
  if (state.history.canUndo) {
    const ok = confirm("Switch layout? Unsaved editor changes in this session will be discarded unless you already saved.");
    if (!ok) {
      const current = state.layouts.find((l) => l.path === state.filePath);
      fillLayoutDropdown(current ? current.path : "");
      return;
    }
  }
  await loadLayoutFromMod(path);
}

async function loadLayoutFromMod(path) {
  const meta = state.layouts.find((l) => l.path === path);
  try {
    const res = await fetch("/api/file?path=" + encodeURIComponent(path) + "&t=" + Date.now());
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      showErrors([err.error || "Could not read layout file."]);
      return;
    }
    const text = await res.text();
    openXml(text, meta ? meta.name : path.split(/[/\\]/).pop(), path);
    await resolveImages();
    redraw();
    const resolved = state.parsed ? countResolvedImages() : { have: 0, total: 0 };
    setStatus(
      `Loaded ${meta ? meta.name : path} from Gui/Layouts. Images resolved: ${resolved.have}/${resolved.total}.`
    );
  } catch (err) {
    showErrors(["Failed to load layout: " + err.message]);
  }
}

function countResolvedImages() {
  let total = 0;
  let have = 0;
  walkWidgets(state.parsed.roots, (w) => {
    if (!w.imageTexture) return;
    total += 1;
    if (state.images.has(w.imageTexture)) have += 1;
  });
  return { have, total };
}

async function loadFile(file) {
  const text = await file.text();
  openXml(text, file.name, file.path || file.name, file);
}

function openXml(text, fileName, filePath, fileObj) {
  const parsed = parseLayout(text);
  state.parsed = parsed;
  state.fileName = fileName;
  state.filePath = filePath || fileName;
  state.fileObj = fileObj || null;
  state.history.clear();
  state.selection.clear();
  rebuildIndex();
  els["file-name"].textContent = fileName;
  showErrors(parsed.errors, parsed.warnings);
  if (!parsed.ok && !parsed.roots.length) {
    setStatus("Import failed. See parse errors.");
    redraw();
    return;
  }
  setStatus(`Imported ${fileName} — ${parsed.widgets.length} widgets.`);
  redraw();
}

function rebuildIndex() {
  state.byId = new Map();
  if (!state.parsed) return;
  walkWidgets(state.parsed.roots, (w) => state.byId.set(w.id, w));
}

function showErrors(errors, warnings = []) {
  const box = els["parse-errors"];
  const msgs = [...(errors || []).map((e) => ({ t: "err", m: e })), ...(warnings || []).map((e) => ({ t: "warn", m: e }))];
  if (!msgs.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = msgs.map((x) => `<div class="${x.t}">${escapeHtml(x.m)}</div>`).join("");
}

function warn(msg) {
  showErrors(state.parsed?.errors || [], [...(state.parsed?.warnings || []), msg]);
  setStatus(msg);
}

function selectedWidgets() {
  return state.selection.ids.map((id) => state.byId.get(id)).filter(Boolean);
}

function primaryWidget() {
  return state.byId.get(state.selection.primary) || null;
}

function currentRects() {
  if (!state.parsed) return { rects: new Map(), letterbox: null };
  return computeRects(state.parsed.roots, state.previewW, state.previewH, state.scaleMode, state.refW, state.refH);
}

function redraw() {
  refreshCanvasChrome();
  const { rects } = currentRects();
  if (state.parsed) {
    renderWidgets(els["layer-widgets"], state.parsed.roots, rects, {
      images: state.images,
      showHidden: state.showHidden,
      showNames: true,
      imagePreviewMode: state.imagePreviewMode,
    });
    renderHierarchy(els.hierarchy, state.parsed.roots, new Set(state.selection.ids), (w, ev) => {
      state.selection.selectFromHits([w], ev.shiftKey, false);
      afterSelect();
    });
  } else {
    els["layer-widgets"].innerHTML = "";
    els.hierarchy.innerHTML = "";
  }
  renderSelectionOverlay(els["layer-select"], state.selection.ids, rects, { handles: true });
  fillProps();
  applyZoom();
}

function refreshCanvasChrome() {
  const world = els["canvas-world"];
  world.style.width = state.previewW + "px";
  world.style.height = state.previewH + "px";
  world.classList.toggle("checker", state.checker);
  const grid = els["layer-grid"];
  if (state.showGrid) {
    grid.style.backgroundImage = `linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)`;
    grid.style.backgroundSize = `${state.gridSize}px ${state.gridSize}px`;
    grid.style.display = "block";
  } else grid.style.display = "none";

  const shot = els["layer-shot"];
  if (state.screenshot.url && state.screenshot.mode === "overlay") {
    shot.style.backgroundImage = `url("${state.screenshot.url}")`;
    shot.style.opacity = String(state.screenshot.opacity);
    shot.style.display = "block";
  } else {
    shot.style.display = "none";
  }
  const side = document.getElementById("shot-side");
  if (side) {
    side.style.backgroundImage = state.screenshot.url && state.screenshot.mode === "side" ? `url("${state.screenshot.url}")` : "none";
    side.classList.toggle("hidden", !(state.screenshot.url && state.screenshot.mode === "side"));
  }
  const ref = els["layer-ref"];
  if (state.refOverlay.on) {
    ref.style.display = "block";
    ref.style.left = state.refOverlay.x + "px";
    ref.style.top = state.refOverlay.y + "px";
    ref.style.width = state.refOverlay.w + "px";
    ref.style.height = state.refOverlay.h + "px";
  } else ref.style.display = "none";
}

function applyZoom() {
  const scroll = els["canvas-scroll"];
  let z = state.zoom;
  if (state.fitZoom) {
    const pad = 32;
    const sx = (scroll.clientWidth - pad) / state.previewW;
    const sy = (scroll.clientHeight - pad) / state.previewH;
    z = Math.max(0.05, Math.min(sx, sy));
    state.zoom = z;
  }
  els["canvas-world"].style.transform = `scale(${z})`;
  document.getElementById("zoom-readout").textContent = `View ${Math.round(z * 100)}%  (canvas zoom only)`;
}

function afterSelect() {
  const w = primaryWidget();
  if (w && w.type === "ImageBox") {
    els["chk-aspect"].checked = true;
    state.aspectLock = true;
  }
  redraw();
}

function onPreviewRes() {
  const v = els["preview-res"].value;
  if (v === "custom") {
    onCustomRes();
    return;
  }
  const [w, h] = v.split("x").map(Number);
  state.previewW = w;
  state.previewH = h;
  redraw();
}

function onCustomRes() {
  els["preview-res"].value = "custom";
  state.previewW = Math.max(1, Number(els["custom-w"].value) || 1920);
  state.previewH = Math.max(1, Number(els["custom-h"].value) || 1080);
  redraw();
}

function worldPoint(ev) {
  const r = els["canvas-world"].getBoundingClientRect();
  const z = r.width / state.previewW;
  return { x: (ev.clientX - r.left) / z, y: (ev.clientY - r.top) / z };
}

function snapVal(v) {
  if (!state.snap) return v;
  const g = state.gridSize;
  return Math.round(v / g) * g;
}

function onCanvasDown(ev) {
  if (!state.parsed) return;
  if (ev.button !== 0) return;
  const handle = ev.target.dataset && ev.target.dataset.handle;
  const p = worldPoint(ev);
  const { rects } = currentRects();
  if (handle) {
    const box = boundingBox(state.selection.ids, rects);
    const widgets = scaleTargets();
    state.drag = {
      kind: "resize",
      handle,
      startX: p.x,
      startY: p.y,
      startBox: box,
      snaps: snapshotGeometry(widgets),
      lock: state.aspectLock || ev.shiftKey,
    };
    ev.preventDefault();
    return;
  }
  const hits = hitTestAll(state.parsed.roots, rects, p.x, p.y, state.showHidden);
  const cycle = ev.altKey || ev.ctrlKey;
  state.selection.selectFromHits(hits, ev.shiftKey, cycle);
  afterSelect();
  if (state.selection.ids.length) {
    const widgets = scaleTargets();
    state.drag = {
      kind: "move",
      startX: p.x,
      startY: p.y,
      snaps: snapshotGeometry(widgets),
      moved: false,
    };
  }
}

function onCanvasDblClick(ev) {
  if (!state.parsed) return;
  const p = worldPoint(ev);
  const { rects } = currentRects();
  const hits = hitTestAll(state.parsed.roots, rects, p.x, p.y, state.showHidden);
  if (hits.length > 1) {
    state.overlapIndex = (state.overlapIndex + 1) % hits.length;
    state.selection.set(hits[state.overlapIndex].id);
    afterSelect();
    setStatus(`Cycled overlap: ${hits[state.overlapIndex].name || hits[state.overlapIndex].type} (${state.overlapIndex + 1}/${hits.length})`);
  }
}

function onCanvasMove(ev) {
  if (!state.drag) return;
  const p = worldPoint(ev);
  const dx = p.x - state.drag.startX;
  const dy = p.y - state.drag.startY;
  const { rects } = currentRects();
  restoreGeometry(state.byId, state.drag.snaps);
  const widgets = scaleTargets();
  if (state.drag.kind === "move") {
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) state.drag.moved = true;
    for (const w of widgets) {
      const r = rects.get(w.id);
      if (!r) continue;
      const next = {
        x: snapVal(r.x + dx),
        y: snapVal(r.y + dy),
        w: r.w,
        h: r.h,
      };
      writeScreenRect(w, next, r.parentRect);
    }
  } else if (state.drag.kind === "resize") {
    const lock = state.aspectLock || ev.shiftKey;
    const toBox = resizeBox(state.drag.startBox, state.drag.handle, dx, dy, lock);
    toBox.x = snapVal(toBox.x);
    toBox.y = snapVal(toBox.y);
    toBox.w = Math.max(1, snapVal(toBox.w));
    toBox.h = Math.max(1, snapVal(toBox.h));
    applyScaledBox(widgets, rects, state.drag.startBox, toBox);
  }
  rebuildRectsOnly();
}

function rebuildRectsOnly() {
  const { rects } = currentRects();
  renderWidgets(els["layer-widgets"], state.parsed.roots, rects, {
    images: state.images,
    showHidden: state.showHidden,
    showNames: true,
    imagePreviewMode: state.imagePreviewMode,
  });
  renderSelectionOverlay(els["layer-select"], state.selection.ids, rects, { handles: true });
  fillProps();
}

function onCanvasUp() {
  if (!state.drag) return;
  const drag = state.drag;
  state.drag = null;
  if (drag.kind === "move" && !drag.moved) return;
  const now = snapshotGeometry(scaleTargets());
  if (sameSnaps(drag.snaps, now)) return;
  commitGeometry(drag.snaps, now, drag.kind === "resize" ? "Resize" : "Move");
}

function sameSnaps(a, b) {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.x === b[i].x && s.y === b[i].y && s.w === b[i].w && s.h === b[i].h);
}

function scaleTargets() {
  const selected = selectedWidgets();
  const selectedSet = new Set(selected.map((w) => w.id));
  const top = selected.filter((w) => !w.parent || !selectedSet.has(w.parent.id));
  if (state.scaleChildren) {
    const extra = [];
    for (const w of top) collectDesc(w, extra);
    return uniqueWidgets([...top, ...extra]);
  }
  const pixelKids = [];
  for (const w of top) {
    for (const c of w.children) {
      if (!isRelative(c)) pixelKids.push(c);
    }
  }
  return uniqueWidgets([...top, ...pixelKids.filter(() => false)]);
}

function collectDesc(w, out) {
  for (const c of w.children) {
    out.push(c);
    collectDesc(c, out);
  }
}

function uniqueWidgets(list) {
  const seen = new Set();
  const out = [];
  for (const w of list) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
  }
  return out;
}

function applyScaledBox(widgets, rects, fromBox, toBox) {
  const next = scaleRectsFromBox(
    widgets.map((w) => w.id),
    rects,
    fromBox,
    toBox
  );
  for (const w of widgets) {
    const r = rects.get(w.id);
    const nr = next.get(w.id);
    if (!r || !nr) continue;
    writeScreenRect(w, nr, r.parentRect);
  }
}

function commitGeometry(before, after, label) {
  for (const s of after) {
    const w = state.byId.get(s.id);
    if (w) applyGeometry(w);
  }
  state.history.push({
    label,
    undo: () => {
      restoreGeometry(state.byId, before);
      before.forEach((s) => applyGeometry(state.byId.get(s.id)));
      redraw();
    },
    redo: () => {
      restoreGeometry(state.byId, after);
      after.forEach((s) => applyGeometry(state.byId.get(s.id)));
      redraw();
    },
  });
  redraw();
}

function mutateWidgets(label, fn) {
  const widgets = scaleTargets();
  if (!widgets.length) return;
  const before = snapshotGeometry(widgets);
  fn(widgets);
  for (const w of widgets) applyGeometry(w);
  const after = snapshotGeometry(widgets);
  if (sameSnaps(before, after)) return;
  state.history.push({
    label,
    undo: () => {
      restoreGeometry(state.byId, before);
      before.forEach((s) => {
        const w = state.byId.get(s.id);
        if (w) applyGeometry(w);
      });
      redraw();
    },
    redo: () => {
      restoreGeometry(state.byId, after);
      after.forEach((s) => {
        const w = state.byId.get(s.id);
        if (w) applyGeometry(w);
      });
      redraw();
    },
  });
  redraw();
}

function fillProps() {
  const w = primaryWidget();
  const sel = selectedWidgets();
  if (!sel.length) {
    els["prop-empty"].classList.remove("hidden");
    els["prop-form"].classList.add("hidden");
    els["sel-summary"].textContent = "Nothing selected";
    return;
  }
  els["prop-empty"].classList.add("hidden");
  els["prop-form"].classList.remove("hidden");
  const names = sel.map((x) => x.name || x.type).join(", ");
  els["sel-summary"].textContent = sel.length > 1 ? `${sel.length} selected: ${names}` : `${w.type}  ${w.name || "(unnamed)"}`;
  if (!w) return;
  const { rects } = currentRects();
  const r = rects.get(w.id);
  els["f-name"].value = w.name;
  els["f-type"].value = w.type;
  els["f-skin"].value = w.skin;
  els["f-align"].value = w.align || "";
  els["f-visible"].checked = w.visible;
  els["f-x"].value = formatField(w.x);
  els["f-y"].value = formatField(w.y);
  els["f-w"].value = formatField(w.w);
  els["f-h"].value = formatField(w.h);
  els["f-px"].textContent = r
    ? `Preview px: ${Math.round(r.x)}, ${Math.round(r.y)}  ${Math.round(r.w)}×${Math.round(r.h)}   source=${w.posSource}`
    : "";
  const sx = w.originalW ? (w.w / w.originalW) * 100 : 100;
  const sy = w.originalH ? (w.h / w.originalH) * 100 : 100;
  els["f-scale"].value = formatField((sx + sy) / 2);
  document.getElementById("scale-readout").textContent = `Scale X ${formatField(sx)}%  Y ${formatField(sy)}%  (from imported size)`;
  document.getElementById("distort-warn").classList.toggle("hidden", Math.abs(sx - sy) < 0.5);
  els["f-caption"].value = w.caption;
  els["f-image"].value = w.imageTexture;
  els["f-keep-aspect"].checked = w.imageKeepAspect === true;
  els["f-colour"].value = w.colour;
  els["f-textcolour"].value = w.textColour;
  els["f-alpha"].value = w.alpha;
  els["f-textalign"].value = w.textAlign;
  els["f-font"].value = w.fontName;
  const img = w.imageTexture ? state.images.get(w.imageTexture) : null;
  const info = imageScaleInfo(w, r, img);
  if (img) {
    els["f-img-info"].innerHTML = `<strong>${escapeHtml(img.filename)}</strong>  source ${img.width}×${img.height}px
      ${info ? `<br>widget ${Math.round(info.widgetW)}×${Math.round(info.widgetH)}px  scale X ${(info.scaleX * 100).toFixed(1)}%  Y ${(info.scaleY * 100).toFixed(1)}%` : ""}
      ${info && info.mismatch ? `<div class="warn">Image is stretched unevenly.</div>` : ""}`;
  } else {
    els["f-img-info"].textContent = w.imageTexture ? "PNG not resolved. Select the Gui / assets folder." : "No ImageTexture on this widget.";
  }
  const mode = els["img-preview-mode"].value;
  document.getElementById("preview-only-warn").classList.toggle("hidden", mode === "layout" || mode === "stretch" || mode === "contain");
  els["raw-props"].textContent = w.propOrder.map((k) => `${k} = ${w.props[k]}`).join("\n") || "(no Property children)";
  els["unknown-props"].textContent = w.unknownProps.length
    ? w.unknownProps.map((p) => `${p.key} = ${p.value}`).join("\n")
    : "(none)";
  const extras = [];
  if (w.layer) extras.push(`layer=${w.layer}`);
  for (const a of w.extraAttrs) extras.push(`${a.name}=${a.value}`);
  document.getElementById("extra-attrs").textContent = extras.join("\n") || "(none)";
}

function formatField(n) {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1 || n === 0) {
    const r = Math.round(n * 10000) / 10000;
    return String(r);
  }
  return String(Math.round(n * 1e6) / 1e6);
}

function onNumericFields() {
  const w = primaryWidget();
  if (!w) return;
  const x = Number(els["f-x"].value);
  const y = Number(els["f-y"].value);
  const width = Number(els["f-w"].value);
  const height = Number(els["f-h"].value);
  if (![x, y, width, height].every(Number.isFinite)) return;
  const before = snapshotGeometry([w]);
  w.x = x;
  w.y = y;
  w.w = width;
  w.h = height;
  w.geomDirty = true;
  applyGeometry(w);
  const after = snapshotGeometry([w]);
  if (sameSnaps(before, after)) return;
  state.history.push({
    label: "Edit numbers",
    undo: () => {
      restoreGeometry(state.byId, before);
      applyGeometry(w);
      redraw();
    },
    redo: () => {
      restoreGeometry(state.byId, after);
      applyGeometry(w);
      redraw();
    },
  });
  redraw();
}

function onScaleField() {
  const pct = Number(els["f-scale"].value);
  if (!Number.isFinite(pct) || pct <= 0) return;
  const factor = pct / 100;
  mutateWidgets("Scale %", (widgets) => {
    for (const w of widgets) {
      w.w = w.originalW * factor;
      w.h = w.originalH * factor;
      applyGeometry(w);
    }
  });
}

function nudgeScale(deltaPct) {
  const w = primaryWidget();
  if (!w) return;
  const cur = w.originalW ? (w.w / w.originalW) * 100 : 100;
  els["f-scale"].value = String(Math.max(1, cur + deltaPct));
  onScaleField();
}

function resetOriginalSize() {
  mutateWidgets("Reset original size", (widgets) => {
    for (const w of widgets) {
      w.w = w.originalW;
      w.h = w.originalH;
      applyGeometry(w);
    }
  });
}

function fitToParent() {
  mutateWidgets("Fit to parent", (widgets) => {
    for (const w of widgets) {
      if (isRelative(w) || w.posSource === "none") {
        w.x = 0;
        w.y = 0;
        w.w = 1;
        w.h = 1;
        if (w.posSource === "none") w.posSource = "position_real";
      } else {
        const { rects } = currentRects();
        const r = rects.get(w.id);
        if (!r) continue;
        writeScreenRect(w, { x: r.parentRect.x, y: r.parentRect.y, w: r.parentRect.w, h: r.parentRect.h }, r.parentRect);
      }
      applyGeometry(w);
    }
  });
}

function centerInParent(horiz, vert) {
  mutateWidgets("Center", (widgets) => {
    const { rects } = currentRects();
    for (const w of widgets) {
      if (isRelative(w)) {
        if (horiz) w.x = (1 - w.w) / 2;
        if (vert) w.y = (1 - w.h) / 2;
      } else {
        const r = rects.get(w.id);
        if (!r) continue;
        const next = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (horiz) next.x = r.parentRect.x + (r.parentRect.w - r.w) / 2;
        if (vert) next.y = r.parentRect.y + (r.parentRect.h - r.h) / 2;
        writeScreenRect(w, next, r.parentRect);
      }
      applyGeometry(w);
    }
  });
}

function fitImageToWidget() {
  const w = primaryWidget();
  if (!w) return;
  const beforeKeep = w.imageKeepAspect;
  const beforeVal = getProp(w, "ImageKeepAspect");
  const redo = () => {
    w.imageKeepAspect = true;
    setProp(w, "ImageKeepAspect", "true");
    redraw();
  };
  const undo = () => {
    w.imageKeepAspect = beforeKeep;
    setProp(w, "ImageKeepAspect", beforeVal == null ? "false" : beforeVal);
    redraw();
  };
  redo();
  state.history.push({ label: "Fit image to widget (ImageKeepAspect)", undo, redo });
}

function setWidgetToImageNative() {
  const w = primaryWidget();
  if (!w || !w.imageTexture) return;
  const img = state.images.get(w.imageTexture);
  if (!img) {
    warn("Resolve the PNG first (select assets folder).");
    return;
  }
  mutateWidgets("Widget to image native size", (widgets) => {
    const { rects } = currentRects();
    for (const ww of widgets) {
      const r = rects.get(ww.id);
      if (!r) continue;
      writeScreenRect(ww, { x: r.x, y: r.y, w: img.width, h: img.height }, r.parentRect);
      applyGeometry(ww);
    }
  });
}

function applyGroupScale() {
  const pct = Number(els["group-scale"].value);
  if (!Number.isFinite(pct) || pct <= 0) return;
  const widgets = scaleTargets();
  if (!widgets.length) return;
  const { rects } = currentRects();
  const box = boundingBox(widgets.map((w) => w.id), rects);
  if (!box) return;
  const f = pct / 100;
  const toBox = { x: box.x, y: box.y, w: box.w * f, h: box.h * f };
  const before = snapshotGeometry(widgets);
  applyScaledBox(widgets, rects, box, toBox);
  widgets.forEach(applyGeometry);
  commitGeometry(before, snapshotGeometry(widgets), "Group scale");
}

function snapToRef() {
  const widgets = scaleTargets();
  if (!widgets.length) return;
  const { rects } = currentRects();
  const box = boundingBox(widgets.map((w) => w.id), rects);
  if (!box) return;
  const toBox = { x: state.refOverlay.x, y: state.refOverlay.y, w: state.refOverlay.w, h: state.refOverlay.h };
  const before = snapshotGeometry(widgets);
  applyScaledBox(widgets, rects, box, toBox);
  widgets.forEach(applyGeometry);
  commitGeometry(before, snapshotGeometry(widgets), "Snap to reference rect");
}

function editPropField(kind) {
  const w = primaryWidget();
  if (!w) return;
  const apply = {
    name: () => {
      const old = w.name;
      const next = els["f-name"].value;
      const redo = () => {
        setWidgetName(w, next);
        redraw();
      };
      const undo = () => {
        setWidgetName(w, old);
        redraw();
      };
      return { label: "Rename", redo, undo };
    },
    visible: () => propSwap(w, "Visible", "visible", els["f-visible"].checked ? "true" : "false", (val) => {
      w.visible = val === "true";
    }),
    caption: () => propSwap(w, "Caption", "caption", els["f-caption"].value),
    image: () => {
      const cmd = propSwap(w, "ImageTexture", "imageTexture", els["f-image"].value);
      const redo = cmd.redo;
      cmd.redo = () => {
        redo();
        resolveImages().then(redraw);
      };
      return cmd;
    },
    keepAspect: () => propSwap(w, "ImageKeepAspect", "imageKeepAspect", els["f-keep-aspect"].checked ? "true" : "false", (val) => {
      w.imageKeepAspect = val === "true";
    }),
    colour: () => propSwap(w, "Colour", "colour", els["f-colour"].value),
    textColour: () => propSwap(w, "TextColour", "textColour", els["f-textcolour"].value),
    alpha: () => propSwap(w, "Alpha", "alpha", els["f-alpha"].value),
    textAlign: () => propSwap(w, "TextAlign", "textAlign", els["f-textalign"].value),
    font: () => propSwap(w, "FontName", "fontName", els["f-font"].value),
    align: () => {
      const old = w.align || "";
      const next = els["f-align"].value;
      return {
        label: "Edit align",
        redo: () => {
          w.align = next;
          if (next) setAttr(w.xml, "align", next);
          redraw();
        },
        undo: () => {
          w.align = old;
          if (old) setAttr(w.xml, "align", old);
          redraw();
        },
      };
    },
  };
  const cmd = apply[kind] && apply[kind]();
  if (!cmd) return;
  cmd.redo();
  state.history.push(cmd);
}

function propSwap(widget, key, field, nextValue, assign) {
  const old = widget.props[key];
  const oldField = widget[field];
  const redo = () => {
    if (assign) assign(nextValue);
    else widget[field] = nextValue;
    setProp(widget, key, nextValue);
    redraw();
  };
  const undo = () => {
    if (assign) assign(old == null ? oldField : old);
    else widget[field] = oldField;
    if (old != null) setProp(widget, key, old);
    else setProp(widget, key, nextValue === oldField ? nextValue : String(oldField ?? ""));
    redraw();
  };
  return { label: "Edit " + key, redo, undo };
}

function onKey(ev) {
  const typing = /input|textarea|select/i.test(ev.target.tagName);
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
    ev.preventDefault();
    if (ev.shiftKey) redo();
    else undo();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
    ev.preventDefault();
    redo();
    return;
  }
  if (typing) return;
  if (!state.selection.ids.length) return;
  const step = ev.shiftKey ? 10 : 1;
  let dx = 0;
  let dy = 0;
  if (ev.key === "ArrowLeft") dx = -step;
  else if (ev.key === "ArrowRight") dx = step;
  else if (ev.key === "ArrowUp") dy = -step;
  else if (ev.key === "ArrowDown") dy = step;
  else return;
  ev.preventDefault();
  const widgets = scaleTargets();
  const { rects } = currentRects();
  const before = snapshotGeometry(widgets);
  for (const w of widgets) {
    const r = rects.get(w.id);
    if (!r) continue;
    writeScreenRect(w, { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }, r.parentRect);
    applyGeometry(w);
  }
  commitGeometry(before, snapshotGeometry(widgets), "Nudge");
}

function undo() {
  state.history.undo();
  updateHistoryButtons();
}
function redo() {
  state.history.redo();
  updateHistoryButtons();
}
function updateHistoryButtons() {
  els["btn-undo"].disabled = !state.history.canUndo;
  els["btn-redo"].disabled = !state.history.canRedo;
  els["btn-undo"].title = state.history.undoLabel || "Undo";
  els["btn-redo"].title = state.history.redoLabel || "Redo";
}

async function indexAssetFiles(files) {
  for (const f of files) {
    const rel = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
    state.assetIndex.set(rel, f);
    state.assetIndex.set(rel.toLowerCase(), f);
    const base = rel.split("/").pop();
    if (!state.assetIndex.has(base)) state.assetIndex.set(base, f);
    const parts = rel.split("/");
    const guiIdx = parts.map((p) => p.toLowerCase()).lastIndexOf("gui");
    if (guiIdx >= 0) {
      const fromGui = parts.slice(guiIdx + 1).join("/");
      state.assetIndex.set(fromGui, f);
      state.assetIndex.set("Gui/" + fromGui, f);
    }
  }
  els["asset-path"].placeholder = `${files.length} local files indexed`;
  await resolveImages();
  setStatus(`Indexed ${state.assetIndex.size} asset paths.`);
  redraw();
}

async function setAssetPath(path) {
  if (!path) return;
  state.assetPath = path;
  try {
    const res = await fetch("/api/list?path=" + encodeURIComponent(path));
    const data = await res.json();
    if (!data.ok) {
      warn(data.error || "Could not list asset folder.");
      return;
    }
    state.assetList = data.files;
    await resolveImages();
    setStatus(`Asset folder: ${path} (${data.files.length} PNGs)`);
    redraw();
  } catch (err) {
    warn("Asset folder listing failed. You can still pick a folder locally.");
  }
}

function imageCandidates(tex) {
  const p = String(tex).replace(/\\/g, "/");
  const out = [p];
  if (p.startsWith("$CONTENT_DATA/")) {
    const rest = p.slice("$CONTENT_DATA/".length);
    out.push(rest);
    if (rest.toLowerCase().startsWith("gui/")) out.push(rest.slice(4));
  }
  out.push(p.split("/").pop());
  return [...new Set(out)];
}

async function resolveImages() {
  revokeUrls();
  state.images = new Map();
  if (!state.parsed) return;
  const textures = new Set();
  walkWidgets(state.parsed.roots, (w) => {
    if (w.imageTexture) textures.add(w.imageTexture);
  });
  for (const tex of textures) {
    const info = await loadTexture(tex);
    if (info) state.images.set(tex, info);
  }
}

async function loadTexture(tex) {
  for (const c of imageCandidates(tex)) {
    const f = state.assetIndex.get(c) || state.assetIndex.get(c.toLowerCase());
    if (f) return fileToImage(f, c.split("/").pop());
  }
  if (state.assetPath && state.assetList) {
    for (const c of imageCandidates(tex)) {
      const hit = state.assetList.find((x) => x.rel.replace(/\\/g, "/") === c || x.rel.endsWith("/" + c) || x.name === c.split("/").pop());
      if (hit) {
        const url = "/api/file?path=" + encodeURIComponent(hit.path) + "&t=" + Date.now();
        const dim = await probeImage(url);
        return { url, width: dim.w, height: dim.h, filename: hit.name, path: hit.path };
      }
    }
  }
  return null;
}

function fileToImage(file, filename) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    state.objectUrls.push(url);
    const img = new Image();
    img.onload = () => resolve({ url, width: img.naturalWidth, height: img.naturalHeight, filename, file });
    img.onerror = () => resolve({ url, width: 0, height: 0, filename, file });
    img.src = url;
  });
}

function probeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = url;
  });
}

function revokeUrls() {
  for (const u of state.objectUrls) URL.revokeObjectURL(u);
  state.objectUrls = [];
}

async function reloadAssets() {
  if (state.modPath) await openMod(state.modPath, true);
  else if (state.assetPath) await setAssetPath(state.assetPath);
  await resolveImages();
  redraw();
  setStatus("Assets reloaded from the open mod.");
}

async function onReplaceImage(e) {
  const file = e.target.files[0];
  e.target.value = "";
  const w = primaryWidget();
  if (!file || !w) return;
  const info = await fileToImage(file, file.name);
  state.pendingImage = { widget: w, file, info };
  state.images.set(w.imageTexture || file.name, info);
  const before = w.imageTexture;
  w.imageTexture = suggestTexturePath(file.name, before);
  setProp(w, "ImageTexture", w.imageTexture);
  state.images.set(w.imageTexture, info);
  state.history.push({
    label: "Replace image path",
    undo: () => {
      w.imageTexture = before;
      if (before) setProp(w, "ImageTexture", before);
      redraw();
    },
    redo: () => {
      w.imageTexture = suggestTexturePath(file.name, before);
      setProp(w, "ImageTexture", w.imageTexture);
      redraw();
    },
  });
  setStatus(`Previewing ${file.name}. Use Save PNG As to write a new file. The original PNG is not overwritten.`);
  redraw();
}

function suggestTexturePath(filename, previous) {
  if (previous && previous.includes("/")) {
    const parts = previous.replace(/\\/g, "/").split("/");
    parts[parts.length - 1] = filename;
    return parts.join("/");
  }
  return "$CONTENT_DATA/Gui/Images/" + filename;
}

async function saveReplacementImage() {
  if (!state.pendingImage) {
    warn("Pick a replacement PNG first.");
    return;
  }
  const file = state.pendingImage.file;
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: file.name,
        types: [{ description: "PNG", accept: { "image/png": [".png"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      setStatus("Saved PNG as " + handle.name + ". Original file was not overwritten unless you chose that path.");
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setStatus("Downloaded replacement PNG. Put it in your mod Gui folder and update the path if needed.");
}

function onScreenshot(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (state.screenshot.url && state.screenshot.url.startsWith("blob:")) URL.revokeObjectURL(state.screenshot.url);
  state.screenshot.url = URL.createObjectURL(f);
  refreshCanvasChrome();
}

function clearScreenshot() {
  if (state.screenshot.url && state.screenshot.url.startsWith("blob:")) URL.revokeObjectURL(state.screenshot.url);
  state.screenshot.url = null;
  refreshCanvasChrome();
}

let pendingSave = null;

function beginExport(overwrite) {
  if (!state.parsed) return;
  walkWidgets(state.parsed.roots, (w) => applyGeometry(w));
  const xml = exportLayoutXml(state.parsed.document);
  const diff = unifiedDiff(state.parsed.originalXml, xml, state.fileName, state.fileName);
  pendingSave = { xml, overwrite, diff };
  els.modal.classList.remove("hidden");
  els["modal-title"].textContent = overwrite ? "Overwrite with backup" : "Save As — XML changes";
  els["diff-view"].textContent = diff.changed ? diff.text : "No XML changes. The file matches the imported source.";
  els["btn-confirm-save"].textContent = overwrite ? "Backup and overwrite" : "Save As…";
}

async function confirmSave() {
  if (!pendingSave) return;
  const { xml, overwrite } = pendingSave;
  els.modal.classList.add("hidden");
  if (!overwrite) {
    await saveAs(xml);
    return;
  }
  if (!state.filePath || state.filePath.startsWith("samples/")) {
    await saveAs(xml);
    return;
  }
  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: state.filePath, content: xml, backup: true }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Save failed");
    setStatus(`Saved ${state.filePath}. Backup: ${data.backup || "(none, new file)"}`);
    state.parsed.originalXml = xml;
  } catch (err) {
    warn("Overwrite via server failed: " + err.message + " Falling back to Save As.");
    await saveAs(xml);
  }
}

async function saveAs(xml) {
  const name = state.fileName || "edited.layout";
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name.replace(/\.layout$/i, "") + ".edited.layout",
        types: [{ description: "Scrap Mechanic layout", accept: { "text/xml": [".layout", ".xml"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(xml);
      await writable.close();
      setStatus("Saved as " + handle.name);
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const blob = new Blob([xml], { type: "text/xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/\.layout$/i, "") + ".edited.layout";
  a.click();
  setStatus("Downloaded " + a.download + " (Save As). Original file was not overwritten.");
}

function setStatus(msg) {
  els.status.textContent = msg;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

PRESETS.forEach(() => {});
