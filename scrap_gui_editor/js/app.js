import { parseLayout, applyGeometry, setProp, setWidgetName, setAttr, walkWidgets, getProp, reorderWidgetElements, cloneXmlNode, extractWidgetXml, insertWidgetElement, insertXmlNodes, createWidget, buildWidget } from "./layout-parser.js";
import { exportLayoutXml, unifiedDiff, backupName } from "./exporter.js";
import { History, snapshotGeometry, restoreGeometry } from "./history.js";
import {
  computeRects,
  renderWidgets,
  renderHierarchy,
  writeScreenRect,
  imageScaleInfo,
  isRelative,
  isEditorPainted,
  isXmlHidden,
} from "./renderer.js";
import { Selection, hitTestAll, boundingBox, renderSelectionOverlay, resizeBox, scaleRectsFromBox } from "./selection.js";
import { createMenuController, widgetMenuItems, canvasMenuItems, hierarchyMenuItems, menuBarSpec } from "./menus.js";
import { detectTabIds, isOnInactiveTab, tabIdFromButton, tabOwner, tabOwnerLabel, tabLabel, parseTabMap } from "./tabs.js";
import { parseGroups, serializeGroups, uniqueGroupId, matchingGroupId, renameGroupMember } from "./groups.js";
import { host } from "./host.js";

const GITHUB_REPO = "https://github.com/zernon916/ScrappyGUIEditor";

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
  imagesDir: "",
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
  saveWithBackup: true,
  clipboard: [],
  geomClipboard: null,
  menuWidget: null,
  menuPoint: null,
  soloId: null,
  layoutPreview: false,
  showGameLayers: false,
  tabs: [],
  tabMap: null,
  layoutTab: "all",
  groups: [],
  activeGroup: "",
  menus: null,
  watch: { ready: false, layoutMtime: 0, imagesMtime: 0, imagesCount: 0, pending: null },
  restoreSession: true,
  autosaveMinutes: 5,
  autosaveKeep: 4,
  autosaveTimer: null,
  autoUpdate: true,
  diskXml: "",
  lastAutosaveXml: "",
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

init();

function init() {
  cacheEls();
  loadPrefs();
  bindUi();
  bindPanelResize();
  bindMenus();
  state.history.onChange = updateHistoryButtons;
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", () => {
    if (state.fitZoom) applyZoom();
  });
  setInterval(pollDiskWatch, 2000);
  scheduleAutosave();
  setStatus("Local editor ready. Open a mod folder, then pick a layout.");
  refreshCanvasChrome();
  refreshMenubar();
  void restoreLastSession();
  bindUpdater();
}

function cacheEls() {
  [
    "btn-open-mod",
    "btn-open-mod-path",
    "btn-layouts-folder",
    "btn-images-folder",
    "folder-readout",
    "mod-path",
    "layout-select",
    "btn-open",
    "file-open",
    "btn-save-as",
    "btn-save",
    "chk-backup",
    "chk-backup-modal",
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
    "tab-filter-wrap",
    "tab-filter",
    "group-filter",
    "btn-group",
    "btn-ungroup",
    "btn-group-rename",
    "hidden-filter",
    "btn-unhide",
    "btn-unhide-all",
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
    "f-tab",
    "f-skin",
    "f-align",
    "f-visible",
    "btn-bring-front",
    "btn-bring-forward",
    "btn-send-backward",
    "btn-send-back",
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
    "modal-hint",
    "diff-view",
    "btn-confirm-save",
    "btn-cancel-save",
    "modal-title",
    "status",
    "menubar",
    "ctx-menu",
    "disk-banner",
    "disk-banner-text",
    "btn-disk-reload",
    "btn-disk-keep",
    "btn-preview",
    "dialog",
    "dialog-card",
    "dialog-title",
    "dialog-body",
    "dialog-actions",
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
  els["btn-layouts-folder"].addEventListener("click", () => pickCustomFolder("layouts"));
  els["btn-images-folder"].addEventListener("click", () => pickCustomFolder("images"));
  els["mod-path"].addEventListener("keydown", (e) => {
    if (e.key === "Enter") openMod(els["mod-path"].value.trim());
  });
  els["layout-select"].addEventListener("change", onLayoutPicked);
  const savedMod = localStorage.getItem("smLayoutEditor.modPath");
  if (savedMod) els["mod-path"].value = savedMod;
  els["btn-save-as"].addEventListener("click", () => beginExport(false));
  els["btn-save"].addEventListener("click", () => beginExport(true));
  els["chk-backup"].addEventListener("change", () => setSaveWithBackup(els["chk-backup"].checked));
  els["chk-backup-modal"].addEventListener("change", () => setSaveWithBackup(els["chk-backup-modal"].checked));
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
  els["tab-filter"].addEventListener("change", () => {
    state.layoutTab = els["tab-filter"].value || "all";
    redraw();
    refreshMenubar();
  });
  els["group-filter"].addEventListener("change", () => {
    selectGroup(els["group-filter"].value);
  });
  els["btn-group"].addEventListener("click", () => runCommand("groupSel"));
  els["btn-ungroup"].addEventListener("click", () => runCommand("ungroupSel"));
  els["btn-group-rename"].addEventListener("click", () => runCommand("renameGroup"));
  els["hidden-filter"].addEventListener("change", () => {
    selectHiddenWidget(els["hidden-filter"].value);
  });
  els["btn-unhide"].addEventListener("click", () => runCommand("unhideListed"));
  els["btn-unhide-all"].addEventListener("click", () => runCommand("showAllHidden"));
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
  els["btn-bring-front"].addEventListener("click", () => restack("front"));
  els["btn-bring-forward"].addEventListener("click", () => restack("forward"));
  els["btn-send-backward"].addEventListener("click", () => restack("backward"));
  els["btn-send-back"].addEventListener("click", () => restack("back"));
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
  els["btn-preview"].addEventListener("click", () => setLayoutPreview(!state.layoutPreview));
  els["btn-disk-reload"].addEventListener("click", reloadDiskChanges);
  els["btn-disk-keep"].addEventListener("click", keepDiskChanges);
  els.dialog.addEventListener("click", (ev) => {
    if (ev.target === els.dialog) closeDialog();
  });

  const scroll = els["canvas-scroll"];
  scroll.addEventListener("mousedown", onCanvasDown);
  window.addEventListener("mousemove", onCanvasMove);
  window.addEventListener("mouseup", onCanvasUp);
  scroll.addEventListener("dblclick", onCanvasDblClick);
  scroll.addEventListener("contextmenu", onCanvasContextMenu);

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
    const data = await host.pickMod(start);
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
    const data = await host.openMod(path);
    if (!data.ok) {
      showErrors([data.error || "Could not open that mod folder."]);
      setStatus(data.error || "Mod open failed.");
      return;
    }
    state.modPath = data.mod;
    state.guiDir = data.guiDir;
    state.layoutsDir = data.layoutsDir || "";
    state.imagesDir = data.imagesDir || "";
    state.layouts = data.layouts || [];
    state.assetPath = state.imagesDir;
    state.assetList = data.images || [];
    localStorage.setItem("smLayoutEditor.modPath", data.mod);
    els["mod-path"].value = data.mod;
    const selected = keepLayout ? state.filePath : "";
    fillLayoutDropdown(selected);
    fillFolderReadout();
    persistSession();
    if (!keepLayout) {
      els["file-name"].textContent = data.mod.split(/[/\\]/).pop() + " — pick a layout";
    }
    showErrors([], data.warnings || []);
    const layoutNote = state.layoutsDir ? `${state.layouts.length} layouts` : "no default layouts folder";
    const imageNote = state.imagesDir ? `${state.assetList.length} PNGs` : "no default images folder";
    setStatus(`Mod loaded. ${layoutNote}, ${imageNote}. Default path is Gui/Menu/Layouts and Gui/Menu/Images.`);
    state.watch.ready = false;
    pollDiskWatch(true);
    if (state.parsed) {
      await resolveImages();
      redraw();
    }
  } catch (err) {
    showErrors(["Could not reach the local server. Leave start_editor.bat open. " + err.message]);
  }
}

function fillFolderReadout() {
  const layout = state.layoutsDir || "(not set — click Layouts folder…)";
  const images = state.imagesDir || "(not set — click Images folder…)";
  els["folder-readout"].textContent = `Layouts: ${layout}   |   Images: ${images}`;
}

async function pickCustomFolder(kind) {
  const start =
    kind === "layouts"
      ? state.layoutsDir || state.guiDir || state.modPath || ""
      : state.imagesDir || state.guiDir || state.modPath || "";
  const title =
    kind === "layouts"
      ? "Select layout folder (default is Gui/Menu/Layouts)"
      : "Select menu images folder (default is Gui/Menu/Images)";
  setStatus("Choose a folder in the Windows dialog…");
  try {
    const data = await host.pickFolder(start, title);
    if (!data.ok) {
      showErrors([data.error || "Folder picker failed."]);
      return;
    }
    if (data.cancelled || !data.path) {
      setStatus("Folder pick cancelled.");
      return;
    }
    if (kind === "layouts") await applyLayoutsFolder(data.path);
    else await applyImagesFolder(data.path);
  } catch (err) {
    showErrors(["Could not open a folder dialog. Leave start_editor.bat running. " + err.message]);
  }
}

async function applyLayoutsFolder(path) {
  const data = await host.listLayouts(path);
  if (!data.ok) {
    showErrors([data.error || "Could not list layouts in that folder."]);
    return;
  }
  state.layoutsDir = data.path;
  state.layouts = data.layouts || [];
  fillLayoutDropdown("");
  fillFolderReadout();
  persistSession();
  setStatus(`Using layouts folder: ${data.path} (${state.layouts.length} .layout files).`);
}

async function applyImagesFolder(path) {
  const data = await host.listPngs(path);
  if (!data.ok) {
    showErrors([data.error || "Could not list PNGs in that folder."]);
    return;
  }
  state.imagesDir = data.root || path;
  state.assetPath = state.imagesDir;
  state.assetList = data.files || [];
  fillFolderReadout();
  persistSession();
  await resolveImages();
  redraw();
  setStatus(`Using images folder: ${state.imagesDir} (${state.assetList.length} PNGs).`);
  state.watch.ready = false;
  pollDiskWatch(true);
}

function fillLayoutDropdown(selectedPath) {
  const sel = els["layout-select"];
  sel.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = state.layouts.length ? "Select a layout…" : "No .layout files — use Layouts folder…";
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
    const data = await host.readText(path);
    if (!data.ok) {
      showErrors([data.error || "Could not read layout file."]);
      return;
    }
    const text = data.text;
    openXml(text, meta ? meta.name : path.split(/[/\\]/).pop(), path);
    state.diskXml = text;
    state.lastAutosaveXml = "";
    persistSession();
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
  const path = file.path || file.name;
  openXml(text, file.name, path, file);
  if (isDiskLayout()) {
    state.diskXml = text;
    state.lastAutosaveXml = "";
    persistSession();
  }
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
  state.soloId = null;
  state.menuWidget = null;
  if (state.menus) state.menus.hideAll();
  rememberRecent();
  if (isDiskLayout()) persistSession();
  state.tabMap = null;
  state.groups = [];
  state.activeGroup = "";
  refreshTabFilter();
  refreshGroupFilter();
  void loadTabMapping();
  void loadGroupMapping();
  state.watch.ready = false;
  pollDiskWatch(true);
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
    renderWidgets(els["layer-widgets"], state.parsed.roots, rects, widgetRenderOptions());
    renderHierarchy(els.hierarchy, state.parsed.roots, new Set(state.selection.ids), (w, ev) => {
      state.selection.selectFromHits([w], ev.shiftKey, false);
      afterSelect();
    }, {
      onContext: (w, ev) => openWidgetMenu(w, ev.clientX, ev.clientY, true),
      onToggle: (w) => {
        w.collapsed = !w.collapsed;
        redraw();
      },
      soloId: state.soloId,
      isTabHidden: (w) => isOnInactiveTab(w, state.tabs, state.layoutTab, state.tabMap),
      tabOwner: (w) => tabOwner(w, state.tabs, state.tabMap),
    });
  } else {
    els["layer-widgets"].innerHTML = "";
    els.hierarchy.innerHTML = "";
  }
  refreshHiddenFilter();
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
  syncActiveGroupFromSelection();
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
  const z = r.width / state.previewW || 1;
  return { x: (ev.clientX - r.left) / z, y: (ev.clientY - r.top) / z };
}

function clampToCanvas(rect) {
  const W = state.previewW;
  const H = state.previewH;
  const keep = 24;
  let { x, y, w, h } = rect;
  w = Math.max(1, w);
  h = Math.max(1, h);
  const visW = Math.min(keep, w);
  const visH = Math.min(keep, h);
  if (x + visW > W) x = W - visW;
  if (y + visH > H) y = H - visH;
  if (x + w < visW) x = visW - w;
  if (y + h < visH) y = visH - h;
  return { x, y, w, h };
}

function snapVal(v) {
  if (!state.snap) return v;
  const g = state.gridSize;
  return Math.round(v / g) * g;
}

function onCanvasDown(ev) {
  if (!state.parsed) return;
  if (ev.button !== 0) return;
  if (ev.target.closest && (ev.target.closest(".panel") || ev.target.closest(".menubar"))) return;
  if (state.menus) state.menus.hideAll();
  const handle = ev.target.dataset && ev.target.dataset.handle;
  const p = worldPoint(ev);
  const { rects } = currentRects();
  if (handle) {
    if (selectedWidgets().some((w) => w.locked)) {
      setStatus("Locked widgets cannot be resized. Unlock from the right-click menu.");
      return;
    }
    const box = boundingBox(state.selection.ids, rects);
    const widgets = scaleTargets().filter((w) => !w.locked);
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
  const hits = hitTestAll(state.parsed.roots, rects, p.x, p.y, state.showHidden, canHitWidget);
  const cycle = ev.altKey || ev.ctrlKey;
  state.selection.selectFromHits(hits, ev.shiftKey, cycle, rects);
  afterSelect();
  if (!ev.shiftKey) maybeSwitchLayoutTab(primaryWidget());
  if (state.selection.ids.length) {
    if (selectedWidgets().every((w) => w.locked)) {
      setStatus("Locked — unlock from the right-click menu.");
      return;
    }
    const widgets = scaleTargets().filter((w) => !w.locked);
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
  const hits = hitTestAll(state.parsed.roots, rects, p.x, p.y, state.showHidden, canHitWidget);
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
  restoreGeometry(state.byId, state.drag.snaps);
  const { rects } = currentRects();
  const widgets = state.drag.snaps.map((s) => state.byId.get(s.id)).filter(Boolean);
  if (state.drag.kind === "move") {
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      state.drag.moved = true;
      if (widgets.length > 1 && !state.drag.noted) {
        state.drag.noted = true;
        setStatus("Moving " + widgets.length + " widgets.");
      }
    }
    for (const w of widgets) {
      const r = rects.get(w.id);
      if (!r) continue;
      const next = clampToCanvas({
        x: snapVal(r.x + dx),
        y: snapVal(r.y + dy),
        w: r.w,
        h: r.h,
      });
      writeScreenRect(w, next, r.parentRect);
    }
  } else if (state.drag.kind === "resize") {
    const lock = state.aspectLock || ev.shiftKey;
    const raw = resizeBox(state.drag.startBox, state.drag.handle, dx, dy, lock);
    const toBox = clampToCanvas({
      x: snapVal(raw.x),
      y: snapVal(raw.y),
      w: Math.max(1, snapVal(raw.w)),
      h: Math.max(1, snapVal(raw.h)),
    });
    applyScaledBox(widgets, rects, state.drag.startBox, toBox);
  }
  rebuildRectsOnly();
}

function rebuildRectsOnly() {
  const { rects } = currentRects();
  renderWidgets(els["layer-widgets"], state.parsed.roots, rects, widgetRenderOptions());
  renderSelectionOverlay(els["layer-select"], state.selection.ids, rects, { handles: true });
  fillProps();
}

function onCanvasUp() {
  if (!state.drag) return;
  const drag = state.drag;
  state.drag = null;
  if (drag.kind === "move" && !drag.moved) return;
  const now = snapshotGeometry(drag.snaps.map((s) => state.byId.get(s.id)).filter(Boolean));
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
    return uniqueWidgets([...top, ...extra]).filter((w) => !w.locked);
  }
  const pixelKids = [];
  for (const w of top) {
    for (const c of w.children) {
      if (!isRelative(c)) pixelKids.push(c);
    }
  }
  return uniqueWidgets([...top, ...pixelKids.filter(() => false)]).filter((w) => !w.locked);
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
  if (els["f-tab"]) {
    els["f-tab"].textContent = state.tabs.length
      ? `Layout tab: ${tabOwnerLabel(w, state.tabs, state.tabMap)}  (${state.tabMap ? "mapping file" : "name guess"})`
      : "";
  }
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
        if (renameGroupMember(state.groups, old, next)) persistGroups();
        redraw();
      };
      const undo = () => {
        setWidgetName(w, old);
        if (renameGroupMember(state.groups, next, old)) persistGroups();
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
  if (ev.key === "Escape") {
    if (!els.dialog.classList.contains("hidden")) {
      closeDialog();
      return;
    }
    if (state.menus) state.menus.hideAll();
    if (state.layoutPreview) {
      setLayoutPreview(false);
      return;
    }
    if (!typing) {
      state.selection.clear();
      afterSelect();
    }
    return;
  }
  if (!typing && ev.key === "F5") {
    ev.preventDefault();
    setLayoutPreview(!state.layoutPreview);
    return;
  }
  if (!typing && ev.key === "F11") {
    ev.preventDefault();
    runCommand("fullscreen");
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    if (ev.shiftKey) beginExport(false);
    else beginExport(true);
    return;
  }
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
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "x") {
    ev.preventDefault();
    runCommand("cut");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "c") {
    ev.preventDefault();
    runCommand("copy");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "v") {
    ev.preventDefault();
    runCommand("paste");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d") {
    ev.preventDefault();
    runCommand("duplicate");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a") {
    ev.preventDefault();
    runCommand("selectAll");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "g") {
    ev.preventDefault();
    runCommand(ev.shiftKey ? "ungroupSel" : "groupSel");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && (ev.key === "=" || ev.key === "+")) {
    ev.preventDefault();
    runCommand("zoomIn");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key === "-") {
    ev.preventDefault();
    runCommand("zoomOut");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && ev.key === "1") {
    ev.preventDefault();
    runCommand("actualSize");
    return;
  }
  if (!typing && ev.key === "F2") {
    ev.preventDefault();
    runCommand("rename");
    return;
  }
  if (!typing && (ev.key === "Delete" || ev.key === "Del")) {
    ev.preventDefault();
    runCommand("delete");
    return;
  }
  if (!typing && (ev.ctrlKey || ev.metaKey) && (ev.key === "[" || ev.key === "]" || ev.key === "{" || ev.key === "}")) {
    ev.preventDefault();
    if (ev.key === "]" || ev.key === "}") restack(ev.shiftKey ? "front" : "forward");
    else restack(ev.shiftKey ? "back" : "backward");
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
  const widgets = scaleTargets().filter((w) => !w.locked);
  const { rects } = currentRects();
  const before = snapshotGeometry(widgets);
  for (const w of widgets) {
    const r = rects.get(w.id);
    if (!r) continue;
    writeScreenRect(w, clampToCanvas({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }), r.parentRect);
    applyGeometry(w);
  }
  commitGeometry(before, snapshotGeometry(widgets), "Nudge");
}

function restack(action) {
  const selected = selectedWidgets();
  if (!selected.length || !state.parsed) return;
  const parent = selected[0].parent;
  if (selected.some((w) => w.parent !== parent)) {
    warn("Stacking only works when every selected widget shares the same parent.");
    return;
  }
  const siblings = parent ? parent.children : state.parsed.roots;
  const before = siblings.map((w) => w.id);
  const nextWidgets = computeStackOrder(siblings, selected, action);
  const after = nextWidgets.map((w) => w.id);
  if (before.join(",") === after.join(",")) {
    setStatus("Already at that end of the sibling stack.");
    return;
  }
  const apply = (ids) => {
    const byId = new Map(siblings.map((w) => [w.id, w]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    siblings.length = 0;
    siblings.push(...ordered);
    const parentXml = parent ? parent.xml : state.parsed.mygui;
    reorderWidgetElements(
      parentXml,
      ordered.map((w) => w.xml)
    );
  };
  apply(after);
  state.history.push({
    label:
      action === "front"
        ? "Bring to front"
        : action === "forward"
          ? "Bring forward"
          : action === "backward"
            ? "Send backward"
            : "Send to back",
    undo: () => {
      apply(before);
      redraw();
    },
    redo: () => {
      apply(after);
      redraw();
    },
  });
  redraw();
  setStatus("Changed widget stack order (XML sibling order).");
}

function computeStackOrder(siblings, selected, action) {
  const set = new Set(selected);
  const group = siblings.filter((w) => set.has(w));
  const others = siblings.filter((w) => !set.has(w));
  if (!group.length) return siblings.slice();
  const firstIdx = Math.min(...group.map((w) => siblings.indexOf(w)));
  const lastIdx = Math.max(...group.map((w) => siblings.indexOf(w)));
  if (action === "front") return others.concat(group);
  if (action === "back") return group.concat(others);
  if (action === "forward") {
    const insertAt = others.findIndex((o) => siblings.indexOf(o) > lastIdx);
    if (insertAt < 0) return siblings.slice();
    return others.slice(0, insertAt + 1).concat(group, others.slice(insertAt + 1));
  }
  let insertAt = -1;
  for (let i = 0; i < others.length; i++) {
    if (siblings.indexOf(others[i]) < firstIdx) insertAt = i;
  }
  if (insertAt < 0) return siblings.slice();
  return others.slice(0, insertAt).concat(group, others.slice(insertAt));
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
    const data = await host.listPngs(path);
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
    const lower = rest.toLowerCase();
    if (lower.startsWith("gui/menu/images/")) out.push(rest.slice("gui/menu/images/".length));
    else if (lower.startsWith("gui/menu/image/")) out.push(rest.slice("gui/menu/image/".length));
    else if (lower.startsWith("gui/images/")) out.push(rest.slice("gui/images/".length));
    else if (lower.startsWith("gui/")) out.push(rest.slice(4));
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
        const url = await host.fileUrl(hit.path);
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
  if (state.imagesDir) await applyImagesFolder(state.imagesDir);
  else if (state.modPath) await openMod(state.modPath, true);
  else if (state.assetPath) await setAssetPath(state.assetPath);
  await resolveImages();
  redraw();
  setStatus("Assets reloaded.");
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
  els["chk-backup-modal"].checked = state.saveWithBackup;
  const backupRow = document.getElementById("backup-modal-row");
  if (backupRow) backupRow.classList.toggle("hidden", !overwrite);
  if (overwrite) {
    els["modal-title"].textContent = state.saveWithBackup ? "Save with backup" : "Save";
    els["modal-hint"].textContent = state.saveWithBackup
      ? "Writes the open layout. A timestamped .bak.layout is created first (the checkbox applies to every Save)."
      : "Writes the open layout. No backup will be created unless you check Save with backup.";
    els["btn-confirm-save"].textContent = "Save";
  } else {
    els["modal-title"].textContent = "Save As — XML changes";
    els["modal-hint"].textContent = "Picks a new file. The original layout is not overwritten.";
    els["btn-confirm-save"].textContent = "Save As…";
  }
  els["diff-view"].textContent = diff.changed ? diff.text : "No XML changes. The file matches the imported source.";
}

async function confirmSave() {
  if (!pendingSave) return;
  const { xml, overwrite } = pendingSave;
  els.modal.classList.add("hidden");
  if (!overwrite) {
    await saveAs(xml);
    return;
  }
  setSaveWithBackup(els["chk-backup-modal"].checked);
  if (!state.filePath || state.filePath.startsWith("samples/")) {
    await saveAs(xml);
    return;
  }
  try {
    const data = await host.saveFile(state.filePath, xml, state.saveWithBackup);
    if (!data.ok) throw new Error(data.error || "Save failed");
    const backupNote = state.saveWithBackup
      ? ` Backup: ${data.backup || "(none, new file)"}`
      : " No backup.";
    setStatus(`Saved ${state.filePath}.${backupNote}`);
    state.parsed.originalXml = xml;
    state.diskXml = xml;
    persistSession();
    state.watch.ready = false;
    pollDiskWatch(true);
  } catch (err) {
    warn("Save via server failed: " + err.message + " Falling back to Save As.");
    await saveAs(xml);
  }
}

async function saveAs(xml) {
  const name = state.fileName || "edited.layout";
  if (host.isElectron) {
    const suggested = isDiskLayout()
      ? state.filePath.replace(/\.layout$/i, "") + ".edited.layout"
      : name.replace(/\.layout$/i, "") + ".edited.layout";
    const pick = await host.pickSave(suggested);
    if (!pick.ok) {
      setStatus("Save As failed. " + (pick.error || ""));
      return;
    }
    if (pick.cancelled || !pick.path) return;
    const data = await host.saveFile(pick.path, xml, false);
    if (!data.ok) {
      setStatus("Save As failed. " + (data.error || ""));
      return;
    }
    setStatus("Saved as " + pick.path + " (original layout was not overwritten).");
    return;
  }
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

function widgetRenderOptions() {
  return {
    images: state.images,
    showHidden: state.layoutPreview ? false : state.showHidden,
    showNames: state.layoutPreview ? false : true,
    imagePreviewMode: state.imagePreviewMode,
    soloId: state.soloId,
    showGameLayers: state.showGameLayers,
    isTabHidden: (w) => isOnInactiveTab(w, state.tabs, state.layoutTab, state.tabMap),
  };
}

function canHitWidget(w) {
  if (isOnInactiveTab(w, state.tabs, state.layoutTab, state.tabMap)) return false;
  if (isXmlHidden(w) && !(state.showHidden && !state.layoutPreview)) return false;
  return isEditorPainted(w, { soloId: state.soloId });
}

function refreshTabFilter() {
  const roots = state.parsed && state.parsed.roots;
  state.tabs = detectTabIds(roots, state.tabMap);
  if (!state.tabs.includes(state.layoutTab) && state.layoutTab !== "all") state.layoutTab = "all";
  if (state.tabs.length && state.layoutTab === "all") {
    state.layoutTab = (state.tabMap && state.tabMap.defaultTab) || state.tabs[0];
  }
  const wrap = els["tab-filter-wrap"];
  const sel = els["tab-filter"];
  if (!wrap || !sel) return;
  wrap.classList.toggle("hidden", state.tabs.length === 0);
  sel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "All (stacked)";
  sel.appendChild(all);
  for (const id of state.tabs) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = tabLabel(id, state.tabMap);
    sel.appendChild(opt);
  }
  sel.value = state.layoutTab;
  refreshMenubar();
}

async function loadTabMapping() {
  const p = state.filePath || "";
  if (!p || p.indexOf("<") !== -1) return;
  const mapPath = p + ".tabs.json";
  try {
    const data = await host.readText(mapPath);
    if (!data.ok) return;
    const text = data.text;
    if (state.filePath !== p) return;
    const map = parseTabMap(text);
    if (!map) {
      setStatus("Tab mapping file found but invalid (need version 1). Using name guess.");
      return;
    }
    state.tabMap = map;
    state.layoutTab = "all";
    refreshTabFilter();
    redraw();
    setStatus("Tab mapping loaded from " + mapPath.split(/[/\\]/).pop() + ".");
  } catch {
    /* no sidecar is normal */
  }
}

function namedSelection() {
  return selectedWidgets().filter((w) => w.name);
}

function widgetsByNames(names) {
  const map = new Map();
  if (state.parsed) {
    walkWidgets(state.parsed.roots, (w) => {
      if (w.name) map.set(w.name, w);
    });
  }
  return (names || []).map((n) => map.get(n)).filter(Boolean);
}

function groupsSidecarPath() {
  const p = state.filePath || "";
  if (!isDiskLayout()) return "";
  return p + ".groups.json";
}

function groupsStorageKey() {
  return "scrappy.groups:" + (state.filePath || state.fileName || "");
}

function refreshGroupFilter() {
  const sel = els["group-filter"];
  if (!sel) return;
  const keep = sel.value;
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "(none)";
  sel.appendChild(none);
  for (const g of state.groups) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.label + " (" + g.members.length + ")";
    sel.appendChild(opt);
  }
  const valid = state.activeGroup && state.groups.some((g) => g.id === state.activeGroup);
  sel.value = valid ? state.activeGroup : keep && state.groups.some((g) => g.id === keep) ? keep : "";
  if (!valid) state.activeGroup = sel.value;
  if (els["btn-ungroup"]) els["btn-ungroup"].disabled = !state.activeGroup;
  if (els["btn-group-rename"]) els["btn-group-rename"].disabled = !state.activeGroup;
  if (els["btn-group"]) els["btn-group"].disabled = namedSelection().length < 2;
  refreshMenubar();
}

function syncActiveGroupFromSelection() {
  const names = namedSelection().map((w) => w.name);
  state.activeGroup = matchingGroupId(state.groups, names);
  refreshGroupFilter();
}

function selectGroup(id) {
  const g = state.groups.find((x) => x.id === id);
  state.activeGroup = g ? g.id : "";
  if (g) {
    const widgets = widgetsByNames(g.members);
    state.selection.replace(widgets.map((w) => w.id));
    const missing = g.members.length - widgets.length;
    setStatus(
      missing
        ? "Selected group “" + g.label + "” (" + widgets.length + " found, " + missing + " names missing)."
        : "Selected group “" + g.label + "” (" + widgets.length + " widgets)."
    );
  }
  refreshGroupFilter();
  redraw();
}

function groupSelection() {
  const named = namedSelection();
  if (named.length < 2) {
    setStatus("Select two or more named widgets to group. Unnamed widgets cannot join a group.");
    return;
  }
  const existing = matchingGroupId(
    state.groups,
    named.map((w) => w.name)
  );
  if (existing) {
    state.activeGroup = existing;
    refreshGroupFilter();
    setStatus("That selection is already a group.");
    return;
  }
  const label = window.prompt("Group name", "Group " + (state.groups.length + 1));
  if (label == null) return;
  const trimmed = String(label).trim() || "Group";
  const id = uniqueGroupId(state.groups, trimmed);
  state.groups.push({ id, label: trimmed, members: named.map((w) => w.name) });
  state.activeGroup = id;
  persistGroups();
  refreshGroupFilter();
  setStatus("Grouped " + named.length + " widgets as “" + trimmed + "”. Not written into the layout.");
}

function ungroupActive() {
  if (!state.activeGroup) {
    setStatus("Pick a group in the Groups dropdown first.");
    return;
  }
  state.groups = state.groups.filter((g) => g.id !== state.activeGroup);
  state.activeGroup = "";
  persistGroups();
  refreshGroupFilter();
  setStatus("Group removed. Widgets are unchanged.");
}

function renameActiveGroup() {
  const g = state.groups.find((x) => x.id === state.activeGroup);
  if (!g) return;
  const label = window.prompt("Group name", g.label);
  if (label == null) return;
  g.label = String(label).trim() || g.label;
  persistGroups();
  refreshGroupFilter();
}

async function loadGroupMapping() {
  const p = state.filePath || "";
  if (!p || p.indexOf("<") !== -1) return;
  if (isDiskLayout()) {
    try {
      const data = await host.readText(p + ".groups.json");
      if (data.ok) {
        const parsed = parseGroups(data.text);
        if (state.filePath !== p) return;
        if (parsed) {
          state.groups = parsed.groups;
          state.activeGroup = "";
          refreshGroupFilter();
          setStatus("Groups loaded from " + (p + ".groups.json").split(/[/\\]/).pop() + ".");
          return;
        }
      }
    } catch {
      /* missing sidecar is normal */
    }
  }
  try {
    const raw = localStorage.getItem(groupsStorageKey());
    if (raw) {
      const parsed = parseGroups(raw);
      if (parsed) state.groups = parsed.groups;
    }
  } catch {
    /* ignore */
  }
  refreshGroupFilter();
}

function listEditorHidden() {
  const out = [];
  if (!state.parsed) return out;
  walkWidgets(state.parsed.roots, (w) => {
    if (w.editorHidden) out.push(w);
  });
  return out;
}

function refreshHiddenFilter() {
  const sel = els["hidden-filter"];
  if (!sel) return;
  const hidden = listEditorHidden();
  const keep = sel.value;
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = hidden.length ? hidden.length + " hidden" : "(none hidden)";
  sel.appendChild(none);
  for (const w of hidden) {
    const opt = document.createElement("option");
    opt.value = w.id;
    const label = (w.name || "(unnamed)") + "  " + w.type;
    opt.textContent = label;
    sel.appendChild(opt);
  }
  sel.value = keep && hidden.some((w) => w.id === keep) ? keep : "";
  if (els["btn-unhide"]) els["btn-unhide"].disabled = !sel.value;
  if (els["btn-unhide-all"]) els["btn-unhide-all"].disabled = hidden.length === 0;
}

function selectHiddenWidget(id) {
  const w = state.byId.get(id);
  if (!w) {
    refreshHiddenFilter();
    return;
  }
  state.selection.set(w.id);
  afterSelect();
  if (els["hidden-filter"]) els["hidden-filter"].value = w.id;
  if (els["btn-unhide"]) els["btn-unhide"].disabled = !w.editorHidden;
  setStatus("Selected hidden “" + (w.name || w.type) + "”. Unhide to show it on the canvas.");
}

function unhideFromList() {
  const id = els["hidden-filter"] && els["hidden-filter"].value;
  const w = state.byId.get(id);
  if (!w || !w.editorHidden) {
    setStatus("Pick a hidden widget in the Hidden dropdown.");
    return;
  }
  toggleFlag([w], "editorHidden", "Unhide in editor");
  setStatus("Unhid “" + (w.name || w.type) + "” in the editor. Layout file unchanged.");
}

function persistGroups() {
  const xml = serializeGroups(state.fileName || "", state.groups);
  try {
    localStorage.setItem(groupsStorageKey(), xml);
  } catch {
    /* quota */
  }
  const path = groupsSidecarPath();
  if (!path) return;
  host.saveFile(path, xml, false).then((data) => {
    if (!data.ok) setStatus("Could not write groups sidecar (layout save is unchanged).");
  }).catch(() => setStatus("Could not write groups sidecar (layout save is unchanged)."));
}

function maybeSwitchLayoutTab(w) {
  const id = tabIdFromButton(w && w.name, state.tabMap);
  if (!id || !state.tabs.includes(id) || state.layoutTab === id) return;
  state.layoutTab = id;
  if (els["tab-filter"]) els["tab-filter"].value = id;
  redraw();
  refreshMenubar();
  setStatus("Showing " + id + " tab.");
}

function isDiskLayout() {
  const p = state.filePath || "";
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("\\\\");
}

function bindMenus() {
  state.menus = createMenuController({ onCommand: runCommand });
  state.menus.setOnOpenBar(() => refreshMenubar());
  refreshMenubar();
}

function refreshMenubar() {
  if (state.menus) state.menus.paintBar(menuBarSpec(menuContext()));
}

function menuContext() {
  const sel = selectedWidgets();
  const w = state.menuWidget || primaryWidget();
  const img = w && w.imageTexture ? state.images.get(w.imageTexture) : null;
  return {
    hasLayout: !!state.parsed,
    hasLayoutPath: isDiskLayout(),
    canUndo: state.history.canUndo,
    canRedo: state.history.canRedo,
    canPaste: state.clipboard.length > 0,
    canPasteGeom: !!state.geomClipboard,
    hasSelection: sel.length > 0,
    selectionCount: sel.length,
    showGrid: state.showGrid,
    snap: state.snap,
    showHidden: state.showHidden,
    showGameLayers: state.showGameLayers,
    scaleMode: state.scaleMode,
    layoutPreview: state.layoutPreview,
    fullscreen: !!document.fullscreenElement,
    widget: w,
    hasChildren: !!(w && w.children.length),
    targetLocked: !!(w && w.locked),
    hasResolvedImage: !!(img && (img.width || img.path || img.file)),
    hasImageDiskPath: !!(img && img.path),
    soloId: state.soloId,
    recent: loadRecent(),
    selectionLocked: sel.length > 0 && sel.every((x) => x.locked),
    selectionHidden: sel.length > 0 && sel.every((x) => x.editorHidden),
    saveWithBackup: state.saveWithBackup,
    tabs: state.tabs || [],
    tabLabels: Object.fromEntries((state.tabs || []).map((id) => [id, tabLabel(id, state.tabMap)])),
    layoutTab: state.layoutTab,
    groups: state.groups || [],
    activeGroup: state.activeGroup || "",
    hasActiveGroup: !!state.activeGroup,
    hiddenWidgets: listEditorHidden(),
  };
}

function openWidgetMenu(widget, x, y, fromHierarchy) {
  if (!widget) return;
  state.menuWidget = widget;
  if (!state.selection.has(widget.id)) state.selection.set(widget.id);
  afterSelect();
  const items = fromHierarchy ? hierarchyMenuItems(menuContext()) : widgetMenuItems(menuContext());
  state.menus.showContext(items, x, y);
}

function onCanvasContextMenu(ev) {
  ev.preventDefault();
  if (!state.parsed) return;
  const p = worldPoint(ev);
  state.menuPoint = p;
  const { rects } = currentRects();
  const hits = hitTestAll(state.parsed.roots, rects, p.x, p.y, state.showHidden, canHitWidget);
  if (!hits.length) {
    state.menuWidget = null;
    state.menus.showContext(canvasMenuItems(menuContext()), ev.clientX, ev.clientY);
    return;
  }
  openWidgetMenu(hits[0], ev.clientX, ev.clientY, false);
}

function setLayoutPreview(on) {
  state.layoutPreview = !!on;
  document.body.classList.toggle("layout-preview", state.layoutPreview);
  els["btn-preview"].classList.toggle("is-on", state.layoutPreview);
  els["btn-preview"].textContent = state.layoutPreview ? "Exit Preview" : "Preview";
  redraw();
  requestAnimationFrame(() => {
    applyZoom();
    requestAnimationFrame(applyZoom);
  });
  setStatus(
    state.layoutPreview
      ? "Layout preview — XML-hidden widgets stay hidden (same as in-game). F5 to exit."
      : "Editor view."
  );
}

function loadRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem("smLayoutEditor.recent") || "[]");
    return Array.isArray(raw) ? raw.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function rememberRecent() {
  if (!isDiskLayout()) return;
  const item = {
    path: state.filePath,
    name: state.fileName,
    mod: state.modPath || "",
    label: (state.modPath ? state.modPath.split(/[/\\]/).pop() + " / " : "") + state.fileName,
    at: Date.now(),
  };
  const next = [item, ...loadRecent().filter((r) => r.path !== item.path)].slice(0, 10);
  localStorage.setItem("smLayoutEditor.recent", JSON.stringify(next));
}

function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem("smLayoutEditor.prefs") || "{}");
    if (prefs.gridSize) {
      state.gridSize = prefs.gridSize;
      const el = document.getElementById("grid-size");
      if (el) el.value = String(prefs.gridSize);
    }
    if (typeof prefs.snap === "boolean") {
      state.snap = prefs.snap;
      const el = document.getElementById("chk-snap");
      if (el) el.checked = prefs.snap;
    }
    if (typeof prefs.showHidden === "boolean") {
      state.showHidden = prefs.showHidden;
      const el = document.getElementById("chk-hidden");
      if (el) el.checked = prefs.showHidden;
    }
    if (typeof prefs.checker === "boolean") {
      state.checker = prefs.checker;
      const el = document.getElementById("chk-checker");
      if (el) el.checked = prefs.checker;
    }
    if (typeof prefs.saveWithBackup === "boolean") {
      state.saveWithBackup = prefs.saveWithBackup;
      const el = document.getElementById("chk-backup");
      if (el) el.checked = prefs.saveWithBackup;
      const modal = document.getElementById("chk-backup-modal");
      if (modal) modal.checked = prefs.saveWithBackup;
    }
    if (typeof prefs.restoreSession === "boolean") state.restoreSession = prefs.restoreSession;
    if (typeof prefs.autoUpdate === "boolean") state.autoUpdate = prefs.autoUpdate;
    if (Number.isFinite(prefs.autosaveMinutes)) state.autosaveMinutes = Math.max(0, Math.min(60, prefs.autosaveMinutes));
    if (Number.isFinite(prefs.autosaveKeep)) state.autosaveKeep = Math.max(1, Math.min(10, prefs.autosaveKeep));
    if (prefs.previewRes) {
      const el = document.getElementById("preview-res");
      if (el) {
        el.value = prefs.previewRes;
        onPreviewRes();
      }
    }
  } catch {
    /* ignore */
  }
}

function savePrefs(partial) {
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem("smLayoutEditor.prefs") || "{}");
  } catch {
    prefs = {};
  }
  Object.assign(prefs, partial);
  localStorage.setItem("smLayoutEditor.prefs", JSON.stringify(prefs));
}

function persistSession() {
  try {
    localStorage.setItem(
      "smLayoutEditor.session",
      JSON.stringify({
        modPath: state.modPath || "",
        layoutsDir: state.layoutsDir || "",
        imagesDir: state.imagesDir || "",
        filePath: isDiskLayout() ? state.filePath : "",
        fileName: state.fileName || "",
      })
    );
  } catch {
    /* ignore */
  }
}

async function restoreLastSession() {
  if (!state.restoreSession) return;
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem("smLayoutEditor.session") || "null");
  } catch {
    session = null;
  }
  if (!session || !session.modPath) return;
  setStatus("Restoring last session…");
  await openMod(session.modPath, true);
  if (session.layoutsDir && session.layoutsDir !== state.layoutsDir) {
    try {
      await applyLayoutsFolder(session.layoutsDir);
    } catch {
      /* folder may have moved */
    }
  }
  if (session.imagesDir && session.imagesDir !== state.imagesDir) {
    try {
      await applyImagesFolder(session.imagesDir);
    } catch {
      /* folder may have moved */
    }
  }
  if (session.filePath) {
    await loadLayoutFromMod(session.filePath);
    if (state.parsed) setStatus("Restored " + (session.fileName || session.filePath));
  }
}

function scheduleAutosave() {
  if (state.autosaveTimer) {
    clearInterval(state.autosaveTimer);
    state.autosaveTimer = null;
  }
  const minutes = Math.max(0, Number(state.autosaveMinutes) || 0);
  if (minutes < 1) return;
  state.autosaveTimer = setInterval(() => {
    void runAutosave();
  }, minutes * 60 * 1000);
}

async function runAutosave() {
  if (!state.parsed || !isDiskLayout()) return;
  walkWidgets(state.parsed.roots, (w) => applyGeometry(w));
  const xml = exportLayoutXml(state.parsed.document);
  if (!xml || xml === state.diskXml || xml === state.lastAutosaveXml) return;
  try {
    const data = await host.autosave(state.filePath, xml, state.autosaveKeep);
    if (!data.ok) throw new Error(data.error || "Autosave failed");
    state.lastAutosaveXml = xml;
    setStatus("Autosaved " + (data.path || "").split(/[/\\]/).pop());
  } catch {
    /* leave the last status; next tick retries */
  }
}

function setSaveWithBackup(on) {
  state.saveWithBackup = !!on;
  if (els["chk-backup"]) els["chk-backup"].checked = state.saveWithBackup;
  if (els["chk-backup-modal"]) els["chk-backup-modal"].checked = state.saveWithBackup;
  savePrefs({ saveWithBackup: state.saveWithBackup });
  refreshMenubar();
}

async function pollDiskWatch(force = false) {
  const layout = isDiskLayout() ? state.filePath : "";
  const images = state.imagesDir || "";
  if (!layout && !images) return;
  try {
    const data = await host.watch(layout, images);
    if (!data.ok) return;
    if (force || !state.watch.ready) {
      rememberWatchStamp(data);
      state.watch.ready = true;
      hideDiskBanner();
      return;
    }
    let layoutChanged = false;
    let imagesChanged = false;
    if (data.layout && data.layout.exists && state.watch.layoutMtime && data.layout.mtime > state.watch.layoutMtime + 0.05) {
      layoutChanged = true;
    }
    if (data.images && (data.images.mtime > state.watch.imagesMtime + 0.05 || data.images.count !== state.watch.imagesCount)) {
      if (state.watch.imagesMtime || state.watch.imagesCount) imagesChanged = true;
    }
    if (layoutChanged || imagesChanged) showDiskBanner(layoutChanged, imagesChanged, data);
  } catch {
    /* server offline */
  }
}

function rememberWatchStamp(data) {
  if (data.layout) state.watch.layoutMtime = data.layout.mtime || 0;
  if (data.images) {
    state.watch.imagesMtime = data.images.mtime || 0;
    state.watch.imagesCount = data.images.count || 0;
  }
}

function showDiskBanner(layoutChanged, imagesChanged, data) {
  if (!els["disk-banner"].classList.contains("hidden") && state.watch.pending) {
    state.watch.pending.layout = state.watch.pending.layout || layoutChanged;
    state.watch.pending.images = state.watch.pending.images || imagesChanged;
    state.watch.pending.data = data;
  } else {
    state.watch.pending = { layout: layoutChanged, images: imagesChanged, data };
  }
  const bits = [];
  if (state.watch.pending.layout) bits.push("layout file");
  if (state.watch.pending.images) bits.push("PNG folder");
  els["disk-banner-text"].textContent =
    bits.join(" and ") + " changed on disk. Reload to pick up those changes, or keep the editor copy.";
  els["disk-banner"].classList.remove("hidden");
}

function hideDiskBanner() {
  els["disk-banner"].classList.add("hidden");
  state.watch.pending = null;
}

function keepDiskChanges() {
  if (state.watch.pending && state.watch.pending.data) rememberWatchStamp(state.watch.pending.data);
  hideDiskBanner();
  setStatus("Kept the editor copy. You will be notified again if the files change.");
}

async function reloadDiskChanges() {
  const pending = state.watch.pending;
  if (!pending) return;
  if (pending.layout && isDiskLayout()) {
    if (state.history.canUndo) {
      const ok = confirm("Reload the layout from disk? Unsaved editor changes will be discarded.");
      if (!ok) {
        keepDiskChanges();
        return;
      }
    }
    hideDiskBanner();
    await loadLayoutFromMod(state.filePath);
  } else {
    hideDiskBanner();
  }
  if (pending.images) await reloadAssets();
  state.watch.ready = false;
  await pollDiskWatch(true);
  setStatus("Reloaded from disk.");
}

function closeDialog() {
  els.dialog.classList.add("hidden");
}

function openDialog({ title, html, actions, narrow }) {
  els["dialog-title"].textContent = title;
  els["dialog-body"].innerHTML = html;
  els["dialog-card"].classList.toggle("narrow", !!narrow);
  const row = els["dialog-actions"];
  row.innerHTML = "";
  for (const a of actions || []) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a.label;
    if (a.primary) b.classList.add("primary");
    b.addEventListener("click", () => {
      if (a.close !== false) closeDialog();
      if (a.onClick) a.onClick();
    });
    row.appendChild(b);
  }
  els.dialog.classList.remove("hidden");
}

function siblingList(widget) {
  return widget.parent ? widget.parent.children : state.parsed.roots;
}

function parentXmlOf(widget) {
  return widget.parent ? widget.parent.xml : state.parsed.mygui;
}

function topOfSelection(widgets) {
  const set = new Set(widgets.map((w) => w.id));
  return widgets.filter((w) => !w.parent || !set.has(w.parent.id));
}

function usedNames() {
  const used = new Set();
  if (state.parsed) walkWidgets(state.parsed.roots, (w) => { if (w.name) used.add(w.name); });
  return used;
}

function uniqueName(base, used) {
  if (!base) return "";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(base + "_" + i)) i += 1;
  const n = base + "_" + i;
  used.add(n);
  return n;
}

function uniquifyTree(widget, used) {
  if (widget.name) setWidgetName(widget, uniqueName(widget.name, used));
  for (const c of widget.children) uniquifyTree(c, used);
}

function insertWidgetAt(widget, parent, index) {
  const list = parent ? parent.children : state.parsed.roots;
  const xmlParent = parent ? parent.xml : state.parsed.mygui;
  const before = list[index] || null;
  widget.parent = parent;
  list.splice(Math.max(0, Math.min(index, list.length)), 0, widget);
  insertWidgetElement(xmlParent, widget.xml, before ? before.xml : null);
  rebuildIndex();
}

function removeWidgetRecord(widget) {
  const list = siblingList(widget);
  const index = list.indexOf(widget);
  if (index < 0) return null;
  list.splice(index, 1);
  const extracted = extractWidgetXml(parentXmlOf(widget), widget.xml);
  widget.parent = widget.parent;
  return { widget, index, parent: widget.parent, extracted };
}

function restoreWidgetRecord(rec) {
  const list = rec.parent ? rec.parent.children : state.parsed.roots;
  const xmlParent = rec.parent ? rec.parent.xml : state.parsed.mygui;
  rec.widget.parent = rec.parent;
  list.splice(rec.index, 0, rec.widget);
  if (rec.extracted && rec.extracted.nodes.length) {
    insertXmlNodes(xmlParent, rec.extracted.index, rec.extracted.nodes);
  } else {
    insertWidgetElement(xmlParent, rec.widget.xml, list[rec.index + 1] ? list[rec.index + 1].xml : null);
  }
  rebuildIndex();
}

function nudgeClone(widget) {
  if (isRelative(widget) || widget.posSource === "position_real") {
    widget.x += 0.02;
    widget.y += 0.02;
  } else {
    widget.x += 16;
    widget.y += 16;
  }
  applyGeometry(widget);
}

function placeAtPoint(widget, parent, pt) {
  const { rects } = currentRects();
  const parentRect = parent && rects.get(parent.id)
    ? rects.get(parent.id)
    : { x: 0, y: 0, w: state.previewW, h: state.previewH };
  const w = Math.min(parentRect.w * 0.2, 220);
  const h = Math.min(parentRect.h * 0.14, 120);
  writeScreenRect(widget, { x: pt.x, y: pt.y, w, h }, parentRect);
  applyGeometry(widget);
}

function pasteDestination() {
  if (state.menuWidget) {
    const w = state.menuWidget;
    const parent = w.parent;
    const list = siblingList(w);
    return { parent, index: list.indexOf(w) + 1 };
  }
  const sel = selectedWidgets();
  if (sel.length) {
    const w = sel[sel.length - 1];
    return { parent: w.parent, index: siblingList(w).indexOf(w) + 1 };
  }
  const roots = state.parsed.roots;
  if (roots.length === 1) return { parent: roots[0], index: roots[0].children.length };
  return { parent: null, index: roots.length };
}

function copySelection() {
  const selected = topOfSelection(selectedWidgets());
  if (!selected.length) return;
  state.clipboard = selected.map((w) => cloneXmlNode(w.xml));
  setStatus("Copied " + selected.length + " widget" + (selected.length === 1 ? "" : "s") + ".");
}

function pasteClipboard() {
  if (!state.parsed || !state.clipboard.length) return;
  const dest = pasteDestination();
  const used = usedNames();
  const created = [];
  let index = dest.index;
  const atClick = !!(state.menuPoint && !state.menuWidget);
  for (const xml of state.clipboard) {
    const clone = cloneXmlNode(xml);
    const widget = buildWidget(clone, dest.parent, []);
    uniquifyTree(widget, used);
    if (atClick) placeAtPoint(widget, dest.parent, state.menuPoint);
    else nudgeClone(widget);
    insertWidgetAt(widget, dest.parent, index);
    created.push(widget);
    index += 1;
  }
  const records = created.map((w) => ({
    widget: w,
    parent: w.parent,
    index: siblingList(w).indexOf(w),
  }));
  state.history.push({
    label: "Paste",
    undo: () => {
      for (const rec of [...records].reverse()) {
        const live = rec.widget;
        const r = removeWidgetRecord(live);
        rec.extracted = r && r.extracted;
        rec.index = r ? r.index : rec.index;
      }
      state.selection.clear();
      redraw();
    },
    redo: () => {
      for (const rec of records) restoreWidgetRecord(rec);
      state.selection.replace(created.map((w) => w.id));
      redraw();
    },
  });
  state.selection.replace(created.map((w) => w.id));
  afterSelect();
  setStatus("Pasted " + created.length + " widget" + (created.length === 1 ? "" : "s") + ".");
}

function deleteSelection() {
  const selected = topOfSelection(selectedWidgets().filter((w) => !w.locked));
  if (!selected.length) {
    setStatus("Nothing to delete (locked widgets are skipped).");
    return;
  }
  const records = selected.map((w) => removeWidgetRecord(w)).filter(Boolean);
  state.history.push({
    label: "Delete",
    undo: () => {
      for (const rec of records) restoreWidgetRecord(rec);
      state.selection.replace(records.map((r) => r.widget.id));
      redraw();
    },
    redo: () => {
      for (const rec of [...records].reverse()) {
        const r = removeWidgetRecord(rec.widget);
        rec.extracted = r && r.extracted;
        rec.index = r ? r.index : rec.index;
      }
      state.selection.clear();
      redraw();
    },
  });
  state.selection.clear();
  afterSelect();
  setStatus("Deleted " + records.length + " widget" + (records.length === 1 ? "" : "s") + ".");
}

function duplicateSelection() {
  copySelection();
  pasteClipboard(true);
}

function addNewWidget(kind) {
  if (!state.parsed) return;
  const dest = pasteDestination();
  const isImage = kind === "image";
  const name = uniqueName(isImage ? "ImageBox" : "Widget", usedNames());
  const widget = createWidget(
    {
      type: isImage ? "ImageBox" : "Widget",
      skin: isImage ? "ImageBox" : "PanelEmpty",
      name,
      positionReal: "0.1 0.1 0.2 0.15",
      props: isImage ? { ImageKeepAspect: "true" } : { NeedMouse: "true" },
    },
    dest.parent
  );
  if (state.menuPoint) placeAtPoint(widget, dest.parent, state.menuPoint);
  insertWidgetAt(widget, dest.parent, dest.index);
  const rec = { widget, parent: widget.parent, index: siblingList(widget).indexOf(widget) };
  state.history.push({
    label: isImage ? "Add Image" : "Add Widget",
    undo: () => {
      const r = removeWidgetRecord(widget);
      rec.extracted = r && r.extracted;
      rec.index = r ? r.index : rec.index;
      rec.parent = r ? r.parent : rec.parent;
      state.selection.clear();
      redraw();
    },
    redo: () => {
      restoreWidgetRecord(rec);
      state.selection.set(widget.id);
      redraw();
    },
  });
  state.selection.set(widget.id);
  afterSelect();
  if (isImage) els["file-image"].click();
}

function alignSelection(kind) {
  const widgets = selectedWidgets().filter((w) => !w.locked);
  if (!widgets.length) return;
  const { rects } = currentRects();
  const box =
    widgets.length === 1
      ? rects.get(widgets[0].id) && rects.get(widgets[0].id).parentRect
      : boundingBox(
          widgets.map((w) => w.id),
          rects
        );
  if (!box) return;
  const before = snapshotGeometry(widgets);
  for (const w of widgets) {
    const r = rects.get(w.id);
    if (!r) continue;
    const next = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (kind === "left") next.x = box.x;
    if (kind === "right") next.x = box.x + box.w - r.w;
    if (kind === "center") next.x = box.x + (box.w - r.w) / 2;
    if (kind === "top") next.y = box.y;
    if (kind === "bottom") next.y = box.y + box.h - r.h;
    if (kind === "middle") next.y = box.y + (box.h - r.h) / 2;
    writeScreenRect(w, next, r.parentRect);
  }
  commitGeometry(before, snapshotGeometry(widgets), "Align");
}

function distributeSelection(axis) {
  const widgets = selectedWidgets().filter((w) => !w.locked);
  if (widgets.length < 3) {
    setStatus("Distribute needs at least 3 unlocked widgets.");
    return;
  }
  const { rects } = currentRects();
  const keyed = widgets
    .map((w) => ({ w, r: rects.get(w.id) }))
    .filter((x) => x.r)
    .sort((a, b) => (axis === "h" ? a.r.x - b.r.x : a.r.y - b.r.y));
  if (keyed.length < 3) return;
  const first = keyed[0].r;
  const last = keyed[keyed.length - 1].r;
  const span =
    axis === "h"
      ? last.x + last.w - first.x
      : last.y + last.h - first.y;
  const sizes = keyed.reduce((s, x) => s + (axis === "h" ? x.r.w : x.r.h), 0);
  const gap = (span - sizes) / (keyed.length - 1);
  const before = snapshotGeometry(keyed.map((x) => x.w));
  let cursor = axis === "h" ? first.x : first.y;
  for (const item of keyed) {
    const next = { x: item.r.x, y: item.r.y, w: item.r.w, h: item.r.h };
    if (axis === "h") next.x = cursor;
    else next.y = cursor;
    writeScreenRect(item.w, next, item.r.parentRect);
    cursor += (axis === "h" ? item.r.w : item.r.h) + gap;
  }
  commitGeometry(before, snapshotGeometry(keyed.map((x) => x.w)), "Distribute");
}

function toggleFlag(widgets, field, label) {
  if (!widgets.length) return;
  const next = !widgets.every((w) => w[field]);
  const before = widgets.map((w) => ({ id: w.id, value: !!w[field] }));
  const apply = (values) => {
    for (const v of values) {
      const w = state.byId.get(v.id);
      if (w) w[field] = v.value;
    }
  };
  for (const w of widgets) w[field] = next;
  state.history.push({
    label,
    undo: () => {
      apply(before);
      redraw();
    },
    redo: () => {
      for (const w of widgets) w[field] = next;
      redraw();
    },
  });
  redraw();
}

function zoomBy(factor) {
  if (state.fitZoom) {
    applyZoom();
    state.fitZoom = false;
    els.zoom.value = "100";
  }
  state.zoom = Math.max(0.05, Math.min(4, state.zoom * factor));
  applyZoom();
}

function walkDesc(w, fn) {
  for (const c of w.children) {
    fn(c);
    walkDesc(c, fn);
  }
}

async function revealPath(path) {
  if (!path) {
    setStatus("No disk path to reveal.");
    return;
  }
  try {
    const data = await host.reveal(path);
    if (!data.ok) throw new Error(data.error || "Reveal failed");
    setStatus("Opened Explorer at " + path);
  } catch (err) {
    setStatus("Could not reveal in Explorer. " + err.message);
  }
}

async function runCommand(cmd, arg) {
  if (state.menus) state.menus.hideContext();
  switch (cmd) {
    case "openMod":
      pickModFolder();
      break;
    case "openLayout":
      els["btn-open"].click();
      break;
    case "openRecent": {
      const rec = loadRecent()[arg];
      if (!rec) break;
      if (rec.mod) await openMod(rec.mod, true);
      await loadLayoutFromMod(rec.path);
      break;
    }
    case "toggleBackup":
      setSaveWithBackup(!state.saveWithBackup);
      break;
    case "save":
      beginExport(true);
      break;
    case "saveAs":
      beginExport(false);
      break;
    case "restoreBackup":
      await restoreBackupDialog();
      break;
    case "restoreAutosave":
      await restoreAutosaveDialog();
      break;
    case "checkUpdates":
      await checkForUpdatesNow();
      break;
    case "reloadAssets":
      await reloadAssets();
      break;
    case "closeLayout":
      if (state.history.canUndo && !confirm("Close this layout? Unsaved editor changes will be discarded.")) break;
      state.parsed = null;
      state.fileName = "";
      state.filePath = "";
      state.selection.clear();
      state.history.clear();
      state.soloId = null;
    state.tabMap = null;
    state.tabs = [];
    state.layoutTab = "all";
    state.groups = [];
    state.activeGroup = "";
    refreshGroupFilter();
      els["file-name"].textContent = "No file loaded";
      els["layout-select"].value = "";
      hideDiskBanner();
      refreshTabFilter();
      persistSession();
      redraw();
      setStatus("Layout closed.");
      break;
    case "undo":
      undo();
      break;
    case "redo":
      redo();
      break;
    case "cut":
      copySelection();
      deleteSelection();
      break;
    case "copy":
      copySelection();
      break;
    case "paste":
      pasteClipboard();
      break;
    case "duplicate":
      duplicateSelection();
      break;
    case "delete":
      deleteSelection();
      break;
    case "rename":
      if (primaryWidget()) {
        els["f-name"].focus();
        els["f-name"].select();
      }
      break;
    case "preferences":
      showPreferences();
      break;
    case "previewUnits":
      els["scale-mode"].value = "viewport";
      state.scaleMode = "viewport";
      redraw();
      break;
    case "previewUniform":
      els["scale-mode"].value = "uniform";
      state.scaleMode = "uniform";
      redraw();
      break;
    case "layoutPreview":
      setLayoutPreview(!state.layoutPreview);
      break;
    case "layoutTab":
      state.layoutTab = arg || "all";
      if (els["tab-filter"]) els["tab-filter"].value = state.layoutTab;
      redraw();
      break;
    case "groupSel":
      groupSelection();
      break;
    case "ungroupSel":
      ungroupActive();
      break;
    case "renameGroup":
      renameActiveGroup();
      break;
    case "selectGroup":
      selectGroup(arg);
      break;
    case "selectHidden":
      selectHiddenWidget(arg);
      break;
    case "unhideListed":
      unhideFromList();
      break;
    case "zoomIn":
      zoomBy(1.25);
      break;
    case "zoomOut":
      zoomBy(1 / 1.25);
      break;
    case "fitCanvas":
      state.fitZoom = true;
      els.zoom.value = "fit";
      applyZoom();
      break;
    case "actualSize":
      state.fitZoom = false;
      state.zoom = 1;
      els.zoom.value = "100";
      applyZoom();
      break;
    case "toggleGrid":
      els["chk-grid"].checked = !els["chk-grid"].checked;
      state.showGrid = els["chk-grid"].checked;
      refreshCanvasChrome();
      break;
    case "toggleSnap":
      els["chk-snap"].checked = !els["chk-snap"].checked;
      state.snap = els["chk-snap"].checked;
      break;
    case "toggleHidden":
      els["chk-hidden"].checked = !els["chk-hidden"].checked;
      state.showHidden = els["chk-hidden"].checked;
      redraw();
      break;
    case "toggleGameLayers":
      state.showGameLayers = !state.showGameLayers;
      redraw();
      setStatus(state.showGameLayers ? "Showing MyGUI layer badges." : "Layer badges hidden.");
      break;
    case "fullscreen":
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => setStatus("Fullscreen was blocked by the browser."));
      break;
    case "selectAll":
      if (!state.parsed) break;
      {
        const ids = [];
        walkWidgets(state.parsed.roots, (w) => ids.push(w.id));
        state.selection.replace(ids);
        afterSelect();
      }
      break;
    case "deselectAll":
      state.selection.clear();
      afterSelect();
      break;
    case "alignLeft":
      alignSelection("left");
      break;
    case "alignCenter":
      alignSelection("center");
      break;
    case "alignRight":
      alignSelection("right");
      break;
    case "alignTop":
      alignSelection("top");
      break;
    case "alignMiddle":
      alignSelection("middle");
      break;
    case "alignBottom":
      alignSelection("bottom");
      break;
    case "distributeH":
      distributeSelection("h");
      break;
    case "distributeV":
      distributeSelection("v");
      break;
    case "front":
      restack("front");
      break;
    case "forward":
      restack("forward");
      break;
    case "backward":
      restack("backward");
      break;
    case "back":
      restack("back");
      break;
    case "lockSel":
      toggleFlag(selectedWidgets(), "locked", "Lock");
      break;
    case "hideSel":
      toggleFlag(selectedWidgets(), "editorHidden", "Hide in editor");
      break;
    case "hideEditor":
      if (state.menuWidget) toggleFlag([state.menuWidget], "editorHidden", "Hide in editor");
      break;
    case "lock":
      if (state.menuWidget) toggleFlag([state.menuWidget], "locked", "Lock");
      break;
    case "solo":
      state.soloId = state.menuWidget && state.soloId === state.menuWidget.id ? null : state.menuWidget && state.menuWidget.id;
      redraw();
      break;
    case "resetImageSize":
      setWidgetToImageNative();
      break;
    case "copyGeom": {
      const w = state.menuWidget || primaryWidget();
      if (!w) break;
      const { rects } = currentRects();
      state.geomClipboard = {
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        posSource: w.posSource,
        screen: rects.get(w.id) ? { ...rects.get(w.id) } : null,
      };
      setStatus("Copied position and size.");
      break;
    }
    case "pasteGeom": {
      const w = state.menuWidget || primaryWidget();
      if (!w || !state.geomClipboard || w.locked) break;
      const before = snapshotGeometry([w]);
      const g = state.geomClipboard;
      if (g.posSource === w.posSource || !g.screen) {
        w.x = g.x;
        w.y = g.y;
        w.w = g.w;
        w.h = g.h;
      } else {
        const { rects } = currentRects();
        const r = rects.get(w.id);
        if (r) writeScreenRect(w, { x: g.screen.x, y: g.screen.y, w: g.screen.w, h: g.screen.h }, r.parentRect);
      }
      applyGeometry(w);
      commitGeometry(before, snapshotGeometry([w]), "Paste position and size");
      break;
    }
    case "revealImage": {
      const w = state.menuWidget || primaryWidget();
      const img = w && w.imageTexture ? state.images.get(w.imageTexture) : null;
      await revealPath(img && img.path);
      break;
    }
    case "revealLayout":
      await revealPath(state.filePath);
      break;
    case "addWidget":
      addNewWidget("widget");
      break;
    case "addImage":
      addNewWidget("image");
      break;
    case "showAllHidden":
      if (state.parsed) walkWidgets(state.parsed.roots, (w) => { w.editorHidden = false; });
      state.soloId = null;
      els["chk-hidden"].checked = true;
      state.showHidden = true;
      redraw();
      setStatus("All editor-hidden widgets are visible again. Layout file unchanged.");
      break;
    case "unlockAll":
      if (state.parsed) walkWidgets(state.parsed.roots, (w) => { w.locked = false; });
      redraw();
      break;
    case "expandChildren":
      if (state.menuWidget) {
        state.menuWidget.collapsed = false;
        walkDesc(state.menuWidget, (c) => { c.collapsed = false; });
        redraw();
      }
      break;
    case "collapseChildren":
      if (state.menuWidget) {
        state.menuWidget.collapsed = true;
        walkDesc(state.menuWidget, (c) => { c.collapsed = true; });
        redraw();
      }
      break;
    case "selectChildren":
      if (state.menuWidget) {
        state.selection.replace(state.menuWidget.children.map((c) => c.id));
        afterSelect();
      }
      break;
    case "lockChildren":
      if (state.menuWidget) {
        const kids = [];
        walkDesc(state.menuWidget, (c) => kids.push(c));
        toggleFlag(kids, "locked", "Lock children");
      }
      break;
    case "hideChildren":
      if (state.menuWidget) {
        const kids = [];
        walkDesc(state.menuWidget, (c) => kids.push(c));
        toggleFlag(kids, "editorHidden", "Hide children");
      }
      break;
    case "helpGuide":
      openDialog({
        title: "Scrappy GUI Editor Guide",
        narrow: true,
        html: `<p>Local-only MyGUI layout editor for Scrap Mechanic. Nothing leaves this PC.</p>
          <ul>
            <li>Open a mod folder, then pick a layout. Defaults are <code>Gui/Menu/Layouts</code> and <code>Gui/Menu/Images</code>.</li>
            <li>Right-click a widget, empty canvas, or hierarchy row for actions.</li>
            <li><code>position_real</code> values are fractions of the parent. Canvas zoom is view-only.</li>
            <li>Save writes the open layout. Check <strong>Save with backup</strong> to write a timestamped <code>.bak.layout</code> first. That checkbox is remembered and used for File &gt; Save, Ctrl+S, and the save dialog.</li>
            <li>If a layout or PNG changes on disk, a banner offers reload.</li>
            <li>Groups (Hierarchy panel) are editor-only. They save as <code>.layout.groups.json</code> beside the layout, never inside Save.</li>
            <li>Last mod / folders / layout reopen automatically. Autosaves are <code>.layout.autosave.&lt;time&gt;</code> beside the file (Preferences). File &gt; Restore Autosave loads a copy; Save writes the live layout.</li>
          </ul>`,
        actions: [{ label: "Close", primary: true }],
      });
      break;
    case "helpKeys":
      openDialog({
        title: "Keyboard Shortcuts",
        html: `<ul>
          <li><kbd>Ctrl+S</kbd> Save · <kbd>Ctrl+Shift+S</kbd> Save As</li>
          <li><kbd>Ctrl+Z</kbd> Undo · <kbd>Ctrl+Y</kbd> Redo</li>
          <li><kbd>Ctrl+X</kbd> Cut · <kbd>Ctrl+C</kbd> Copy · <kbd>Ctrl+V</kbd> Paste · <kbd>Ctrl+D</kbd> Duplicate</li>
          <li><kbd>Delete</kbd> Delete · <kbd>F2</kbd> Rename · <kbd>Ctrl+A</kbd> Select all</li>
          <li>Shift-click adds to the selection. Click a selected widget to drag all of them. Groups work the same way.</li>
          <li><kbd>Ctrl+G</kbd> Group selection · <kbd>Ctrl+Shift+G</kbd> Ungroup</li>
          <li><kbd>Ctrl+[</kbd> / <kbd>Ctrl+]</kbd> stack · Shift for ends</li>
          <li><kbd>F5</kbd> Layout preview · <kbd>F11</kbd> Fullscreen · <kbd>Esc</kbd> cancel</li>
          <li>Arrows nudge 1px · Shift+Arrows 10px</li>
        </ul>`,
        actions: [{ label: "Close", primary: true }],
      });
      break;
    case "helpBug":
      window.open(GITHUB_REPO + "/issues", "_blank");
      break;
    case "helpGithub":
      window.open(GITHUB_REPO, "_blank");
      break;
    case "helpAbout": {
      const info = await host.appInfo().catch(() => ({ ok: false }));
      const ver = info && info.version ? " v" + info.version : "";
      const how = host.isElectron
        ? "This is the desktop app. Edit → Preferences can turn GitHub update checks off. Updates never write into your mod folder."
        : "This is the .bat / Python build. The helper server binds to <code>127.0.0.1</code> only.";
      openDialog({
        title: "About Scrappy",
        narrow: true,
        html: `<p><strong>Scrappy GUI Editor${ver}</strong> is a local-only visual editor for Scrap Mechanic MyGUI <code>.layout</code> files.</p>
          <p>${how}</p>
          <p>No accounts, cloud, or telemetry.</p>
          <p><a href="${GITHUB_REPO}" target="_blank" rel="noopener">${GITHUB_REPO}</a></p>`,
        actions: [{ label: "Close", primary: true }],
      });
      break;
    }
    default:
      break;
  }
  state.menuWidget = null;
  state.menuPoint = null;
  refreshMenubar();
}

async function restoreBackupDialog() {
  if (!isDiskLayout()) {
    setStatus("Restore Backup needs a layout saved on disk.");
    return;
  }
  try {
    const data = await host.listBackups(state.filePath);
    if (!data.ok) throw new Error(data.error || "Could not list backups");
    if (!data.backups.length) {
      openDialog({
        title: "Restore Backup",
        narrow: true,
        html: "<p>No timestamped <code>.bak.layout</code> files were found next to this layout.</p>",
        actions: [{ label: "Close", primary: true }],
      });
      return;
    }
    const list = data.backups
      .map(
        (b) =>
          `<button type="button" data-bak="${encodeURIComponent(b.path)}">${escapeHtml(b.name)} — ${new Date(b.mtime * 1000).toLocaleString()}</button>`
      )
      .join("");
    openDialog({
      title: "Restore Backup",
      html: `<p>Loads a backup into the editor. Save afterwards to write it back.</p><div class="backup-list">${list}</div>`,
      actions: [{ label: "Cancel" }],
    });
    els["dialog-body"].querySelectorAll("[data-bak]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        closeDialog();
        const path = decodeURIComponent(btn.getAttribute("data-bak"));
        const fileRes = await host.readText(path);
        if (!fileRes.ok) {
          setStatus("Could not read backup.");
          return;
        }
        const text = fileRes.text;
        openXml(text, state.fileName, state.filePath);
        setStatus("Loaded backup into the editor: " + path.split(/[/\\]/).pop() + ". Save to write it to the live layout.");
      });
    });
  } catch (err) {
    setStatus("Backup list failed. Restart start_editor.bat. " + err.message);
  }
}

async function restoreAutosaveDialog() {
  if (!isDiskLayout()) {
    setStatus("Restore Autosave needs a layout saved on disk.");
    return;
  }
  try {
    const data = await host.listAutosaves(state.filePath);
    if (!data.ok) throw new Error(data.error || "Could not list autosaves");
    if (!data.autosaves.length) {
      openDialog({
        title: "Restore Autosave",
        narrow: true,
        html: "<p>No autosaves yet for this layout. Scrappy writes <code>.layout.autosave.&lt;time&gt;</code> beside the file on the interval in Preferences. Those files are not the live layout.</p>",
        actions: [{ label: "Close", primary: true }],
      });
      return;
    }
    const list = data.autosaves
      .map(
        (b) =>
          `<button type="button" data-auto="${encodeURIComponent(b.path)}">${escapeHtml(b.name)} — ${new Date(b.mtime * 1000).toLocaleString()}</button>`
      )
      .join("");
    openDialog({
      title: "Restore Autosave",
      html: `<p>Loads a crash copy into the editor. Save afterwards to write it to the live layout.</p><div class="backup-list">${list}</div>`,
      actions: [{ label: "Cancel" }],
    });
    els["dialog-body"].querySelectorAll("[data-auto]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        closeDialog();
        const path = decodeURIComponent(btn.getAttribute("data-auto"));
        const fileRes = await host.readText(path);
        if (!fileRes.ok) {
          setStatus("Could not read autosave.");
          return;
        }
        const body = fileRes.text;
        openXml(body, state.fileName, state.filePath);
        setStatus("Loaded autosave into the editor: " + path.split(/[/\\]/).pop() + ". Save to write it to the live layout.");
      });
    });
  } catch (err) {
    setStatus("Autosave list failed. Restart start_editor.bat. " + err.message);
  }
}

function bindUpdater() {
  if (!host.isElectron) return;
  void host.setAutoUpdate(!!state.autoUpdate);
  host.on("update-available", (payload) => {
    setStatus("Update " + ((payload && payload.version) || "") + " is downloading in the background.");
  });
  host.on("update-downloaded", (payload) => {
    void promptInstallUpdate(payload);
  });
  host.on("update-error", (payload) => {
    setStatus("Update check failed: " + ((payload && payload.error) || "unknown"));
  });
  host.on("before-quit", () => {
    void (async () => {
      await runAutosave();
      await host.readyToQuit();
    })();
  });
}

async function promptInstallUpdate(payload) {
  await runAutosave();
  const ver = (payload && payload.version) || "";
  const go = window.confirm(
    "Scrappy " +
      ver +
      " is ready. Restart now to install?\n\nAn autosave was written next to the layout (not the live file)."
  );
  if (go) {
    await runAutosave();
    const data = await host.installUpdate();
    if (!data.ok) setStatus("Could not install update. " + (data.error || ""));
  } else {
    setStatus("Update downloaded. It will install the next time you quit Scrappy.");
  }
}

async function checkForUpdatesNow() {
  if (!host.isElectron) {
    setStatus("This .bat build does not auto-update. Use the desktop installer from GitHub Releases, or download a new zip from main.");
    return;
  }
  if (!state.autoUpdate) {
    setStatus("Auto-update is off in Preferences. Turn it on to check GitHub Releases.");
    return;
  }
  const data = await host.checkUpdates();
  if (!data.ok) {
    setStatus("Update check failed. " + (data.error || ""));
    return;
  }
  if (data.skipped && data.reason === "dev") {
    setStatus("Update checks run in the installed app, not while developing with npm start.");
    return;
  }
  if (data.skipped && data.reason === "off") {
    setStatus("Auto-update is off.");
    return;
  }
  setStatus("Checked GitHub Releases for a newer installer.");
}

function showPreferences() {
  openDialog({
    title: "Preferences",
    narrow: true,
    html: `<label>Default preview resolution
        <select id="pref-res">
          <option value="1280x720">1280×720</option>
          <option value="1600x900">1600×900</option>
          <option value="1920x1080">1920×1080</option>
          <option value="2560x1440">2560×1440</option>
          <option value="3440x1440">3440×1440</option>
        </select>
      </label>
      <label>Grid size <input id="pref-grid" type="number" min="1" value="${state.gridSize}" /></label>
      <label class="check"><input id="pref-snap" type="checkbox" ${state.snap ? "checked" : ""} /> Enable snap by default</label>
      <label class="check"><input id="pref-hidden" type="checkbox" ${state.showHidden ? "checked" : ""} /> Show hidden widgets</label>
      <label class="check"><input id="pref-checker" type="checkbox" ${state.checker ? "checked" : ""} /> Checkerboard</label>
      <label class="check"><input id="pref-backup" type="checkbox" ${state.saveWithBackup ? "checked" : ""} /> Save with backup</label>
      <label class="check"><input id="pref-session" type="checkbox" ${state.restoreSession ? "checked" : ""} /> Reopen last mod, folders, and layout</label>
      <label class="check"><input id="pref-autoupdate" type="checkbox" ${state.autoUpdate ? "checked" : ""} /> Check GitHub for desktop updates on launch</label>
      <label>Autosave every (minutes, 0 = off) <input id="pref-autosave-min" type="number" min="0" max="60" value="${state.autosaveMinutes}" /></label>
      <label>Keep this many autosaves <input id="pref-autosave-keep" type="number" min="1" max="10" value="${state.autosaveKeep}" /></label>
      <p class="hint">Session (folders + last menu) stays on this PC. Autosaves are <code>YourMenu.layout.autosave.&lt;time&gt;</code> next to the layout — not the live file, and the game does not load them. Uncheck desktop updates if you do not want the installed app to contact GitHub. Updates never write into your mod folder.</p>`,
    actions: [
      { label: "Cancel" },
      {
        label: "Save",
        primary: true,
        onClick: () => {
          const previewRes = document.getElementById("pref-res").value;
          const gridSize = Math.max(1, Number(document.getElementById("pref-grid").value) || 8);
          const snap = document.getElementById("pref-snap").checked;
          const showHidden = document.getElementById("pref-hidden").checked;
          const checker = document.getElementById("pref-checker").checked;
          const saveWithBackup = document.getElementById("pref-backup").checked;
          const restoreSession = document.getElementById("pref-session").checked;
          const autoUpdate = document.getElementById("pref-autoupdate").checked;
          const autosaveMinutes = Math.max(0, Math.min(60, Number(document.getElementById("pref-autosave-min").value) || 0));
          const autosaveKeep = Math.max(1, Math.min(10, Number(document.getElementById("pref-autosave-keep").value) || 4));
          savePrefs({ previewRes, gridSize, snap, showHidden, checker, saveWithBackup, restoreSession, autoUpdate, autosaveMinutes, autosaveKeep });
          state.gridSize = gridSize;
          els["grid-size"].value = String(gridSize);
          state.snap = snap;
          els["chk-snap"].checked = snap;
          state.showHidden = showHidden;
          els["chk-hidden"].checked = showHidden;
          state.checker = checker;
          els["chk-checker"].checked = checker;
          setSaveWithBackup(saveWithBackup);
          state.restoreSession = restoreSession;
          state.autoUpdate = autoUpdate;
          void host.setAutoUpdate(autoUpdate);
          state.autosaveMinutes = autosaveMinutes;
          state.autosaveKeep = autosaveKeep;
          scheduleAutosave();
          els["preview-res"].value = previewRes;
          onPreviewRes();
          refreshCanvasChrome();
          redraw();
          setStatus(
            autosaveMinutes
              ? "Preferences saved. Autosave every " + autosaveMinutes + " min, keep " + autosaveKeep + "."
              : "Preferences saved. Autosave is off."
          );
        },
      },
    ],
  });
  const resEl = document.getElementById("pref-res");
  if (resEl) resEl.value = els["preview-res"].value === "custom" ? "1920x1080" : els["preview-res"].value;
}

PRESETS.forEach(() => {});
