export function isRelative(widget) {
  return widget.posSource === "position_real";
}

export function computeRects(roots, screenW, screenH, mode, refW, refH) {
  const rects = new Map();
  if (mode === "uniform") {
    layoutTree(roots, { x: 0, y: 0, w: refW, h: refH }, rects);
    const scale = Math.min(screenW / refW, screenH / refH);
    const ox = (screenW - refW * scale) / 2;
    const oy = (screenH - refH * scale) / 2;
    for (const [id, r] of rects) {
      rects.set(id, {
        x: ox + r.x * scale,
        y: oy + r.y * scale,
        w: r.w * scale,
        h: r.h * scale,
        parentRect: scaleRect(r.parentRect, ox, oy, scale),
        space: "uniform",
        scale,
        ox,
        oy,
      });
    }
    return { rects, letterbox: { x: ox, y: oy, w: refW * scale, h: refH * scale, scale } };
  }
  layoutTree(roots, { x: 0, y: 0, w: screenW, h: screenH }, rects);
  return { rects, letterbox: null };
}

function scaleRect(r, ox, oy, scale) {
  if (!r) return r;
  return { x: ox + r.x * scale, y: oy + r.y * scale, w: r.w * scale, h: r.h * scale };
}

function layoutTree(widgets, parentRect, out) {
  for (const w of widgets) {
    const r = nativeToScreen(w, parentRect);
    out.set(w.id, { x: r.x, y: r.y, w: r.w, h: r.h, parentRect: { ...parentRect } });
    layoutTree(w.children, r, out);
  }
}

export function nativeToScreen(widget, parentRect) {
  if (isRelative(widget)) {
    return {
      x: parentRect.x + widget.x * parentRect.w,
      y: parentRect.y + widget.y * parentRect.h,
      w: widget.w * parentRect.w,
      h: widget.h * parentRect.h,
    };
  }
  return {
    x: parentRect.x + widget.x,
    y: parentRect.y + widget.y,
    w: widget.w,
    h: widget.h,
  };
}

export function screenToNative(widget, screenRect, parentRect) {
  if (isRelative(widget)) {
    return {
      x: parentRect.w ? (screenRect.x - parentRect.x) / parentRect.w : 0,
      y: parentRect.h ? (screenRect.y - parentRect.y) / parentRect.h : 0,
      w: parentRect.w ? screenRect.w / parentRect.w : 0,
      h: parentRect.h ? screenRect.h / parentRect.h : 0,
    };
  }
  return {
    x: screenRect.x - parentRect.x,
    y: screenRect.y - parentRect.y,
    w: screenRect.w,
    h: screenRect.h,
  };
}

export function writeScreenRect(widget, screenRect, parentRect) {
  const n = screenToNative(widget, screenRect, parentRect);
  widget.x = n.x;
  widget.y = n.y;
  widget.w = n.w;
  widget.h = n.h;
  widget.geomDirty = true;
}

export function parseColour(value) {
  if (!value) return null;
  const n = String(value)
    .trim()
    .split(/\s+/)
    .map(Number);
  if (n.length < 3 || n.some((x) => !Number.isFinite(x))) return null;
  const a = n.length > 3 ? n[3] : 1;
  return {
    r: clamp01(n[0]),
    g: clamp01(n[1]),
    b: clamp01(n[2]),
    a: clamp01(a),
    css: `rgba(${Math.round(clamp01(n[0]) * 255)}, ${Math.round(clamp01(n[1]) * 255)}, ${Math.round(clamp01(n[2]) * 255)}, ${clamp01(a)})`,
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export const SKIN_STYLE = {
  PanelEmpty: { bg: "transparent", border: "1px dashed rgba(255,255,255,0.12)", color: "#eee" },
  BackgroundInteractableWide: { bg: "#2b261d", border: "2px solid #7a6844", color: "#f3ead2" },
  BackgroundInventoryToolTip: { bg: "#161616", border: "1px solid #4a4a4a", color: "#ddd" },
  PrimaryButton: { bg: "#c47a1a", border: "1px solid #e8b15a", color: "#fff" },
  SecondaryButton: { bg: "#3a434c", border: "1px solid #6a7580", color: "#e6e6e6" },
  InventoryTab: { bg: "#4a3d28", border: "1px solid #8a7348", color: "#f0e6d0" },
  TextBox: { bg: "transparent", border: "1px dashed rgba(255,255,255,0.06)", color: "#f2f2f2" },
  ImageBox: { bg: "rgba(90,90,90,0.18)", border: "1px solid rgba(255,255,255,0.14)", color: "#ddd" },
  EditBox: { bg: "#111318", border: "1px solid #6b7380", color: "#eee" },
  EditBoxEmpty: { bg: "transparent", border: "1px dashed rgba(255,255,255,0.1)", color: "#eee" },
  ProgressBar: { bg: "#222", border: "1px solid #888", color: "#eee" },
  HUDProgressBarYellow: { bg: "#3a3008", border: "1px solid #c9a227", color: "#ffd978" },
  CraftbotProgressBar: { bg: "#2a2208", border: "1px solid #c9a227", color: "#ffd978" },
  InventoryVSlider: { bg: "#2a2a2a", border: "1px solid #777", color: "#ccc" },
  InventoryHSlider: { bg: "#2a2a2a", border: "1px solid #777", color: "#ccc" },
  WhiteSkin: { bg: "#fff", border: "none", color: "#000" },
  PropertyIndicator: { bg: "#d4a017", border: "1px solid #f0d060", color: "#111" },
  ToggleButton: { bg: "#35503a", border: "1px solid #6a9a70", color: "#e8ffe8" },
  ItemColorLine: { bg: "#8a8a8a", border: "none", color: "#fff" },
};

const SUPPORTED_RENDER = new Set(["Widget", "Button", "TextBox", "EditBox", "ImageBox", "ProgressBar", "ScrollBar"]);

export function renderWidgets(container, roots, rects, options) {
  container.innerHTML = "";
  const frag = document.createDocumentFragment();
  paintList(frag, roots, rects, options);
  container.appendChild(frag);
}

function paintList(parentEl, list, rects, options) {
  for (const w of list) {
    const r = rects.get(w.id);
    if (!r) continue;
    const el = document.createElement("div");
    el.className = "sm-widget";
    el.dataset.id = w.id;
    el.style.left = r.x + "px";
    el.style.top = r.y + "px";
    el.style.width = Math.max(0, r.w) + "px";
    el.style.height = Math.max(0, r.h) + "px";
    if (!w.visible) {
      if (!options.showHidden) {
        el.style.display = "none";
      } else {
        el.classList.add("is-hidden");
      }
    }
    const supported = SUPPORTED_RENDER.has(w.type);
    if (!supported) el.classList.add("is-placeholder");
    const skin = SKIN_STYLE[w.skin] || { bg: "rgba(40,80,120,0.25)", border: "1px solid #5aa", color: "#cfe" };
    const colour = parseColour(w.colour);
    el.style.background = colour ? colour.css : skin.bg;
    el.style.border = skin.border;
    el.style.color = skin.color;
    if (w.alpha !== "" && w.alpha != null) {
      const a = Number(w.alpha);
      if (Number.isFinite(a)) el.style.opacity = String(a);
    }

    const imgInfo = options.images && w.imageTexture ? options.images.get(w.imageTexture) : null;
    const previewMode = options.imagePreviewMode || "layout";
    if (imgInfo && imgInfo.url) {
      const img = document.createElement("img");
      img.className = "sm-widget-img";
      img.src = imgInfo.url;
      img.alt = imgInfo.filename || "";
      img.draggable = false;
      applyImageFit(img, el, w, previewMode, imgInfo);
      el.appendChild(img);
    }

    const label = document.createElement("div");
    label.className = "sm-widget-label";
    if (w.caption) {
      label.textContent = w.caption;
      applyTextAlign(label, w.textAlign);
      const tc = parseColour(w.textColour);
      if (tc) label.style.color = tc.css;
    } else if (!supported) {
      label.textContent = `${w.type || "Unknown"} ${w.name || ""}`.trim();
      label.classList.add("placeholder-label");
    } else if (!imgInfo && options.showNames) {
      label.textContent = w.name || w.type;
      label.classList.add("name-label");
    }
    el.appendChild(label);
    parentEl.appendChild(el);
    if (w.children.length) paintList(parentEl, w.children, rects, options);
  }
}

function applyImageFit(img, el, widget, previewMode, imgInfo) {
  img.style.position = "absolute";
  img.style.left = "0";
  img.style.top = "0";
  img.style.width = "100%";
  img.style.height = "100%";
  const layoutKeep = widget.imageKeepAspect === true;
  let mode = previewMode;
  if (mode === "layout") mode = layoutKeep ? "contain" : "stretch";
  img.dataset.previewMode = mode;
  if (mode === "stretch") {
    img.style.objectFit = "fill";
  } else if (mode === "contain") {
    img.style.objectFit = "contain";
  } else if (mode === "cover") {
    img.style.objectFit = "cover";
    img.dataset.nonExportable = "1";
  } else if (mode === "native") {
    img.style.objectFit = "none";
    img.style.objectPosition = "left top";
    img.dataset.nonExportable = "1";
  } else if (mode === "tile") {
    img.style.display = "none";
    el.style.backgroundImage = `url("${imgInfo.url}")`;
    el.style.backgroundRepeat = "repeat";
    el.style.backgroundSize = `${imgInfo.width}px ${imgInfo.height}px`;
    img.dataset.nonExportable = "1";
  }
}

function applyTextAlign(el, textAlign) {
  const a = (textAlign || "").toLowerCase();
  el.style.display = "flex";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.padding = "2px 6px";
  el.style.whiteSpace = "pre-wrap";
  el.style.overflow = "hidden";
  if (a.includes("left")) el.style.justifyContent = "flex-start";
  else if (a.includes("right")) el.style.justifyContent = "flex-end";
  else el.style.justifyContent = "center";
  if (a.includes("top")) el.style.alignItems = "flex-start";
  else if (a.includes("bottom")) el.style.alignItems = "flex-end";
  else el.style.alignItems = "center";
}

export function imageScaleInfo(widget, rect, imgInfo) {
  if (!rect || !imgInfo || !imgInfo.width || !imgInfo.height) return null;
  const sx = imgInfo.width ? rect.w / imgInfo.width : 0;
  const sy = imgInfo.height ? rect.h / imgInfo.height : 0;
  const mismatch = Math.abs(sx - sy) > 0.02 && sx > 0 && sy > 0;
  return {
    imgW: imgInfo.width,
    imgH: imgInfo.height,
    widgetW: rect.w,
    widgetH: rect.h,
    scaleX: sx,
    scaleY: sy,
    mismatch,
  };
}

export function renderHierarchy(container, roots, selectedIds, onClick) {
  container.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "tree";
  function add(list, parent) {
    for (const w of list) {
      const li = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "tree-item";
      if (selectedIds.has(w.id)) row.classList.add("is-selected");
      if (!w.visible) row.classList.add("is-hidden");
      const title = w.name || "(unnamed)";
      row.innerHTML = `<span class="t-type">${escapeHtml(w.type)}</span><span class="t-name">${escapeHtml(title)}</span>`;
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onClick(w, ev);
      });
      li.appendChild(row);
      if (w.children.length) {
        const sub = document.createElement("ul");
        add(w.children, sub);
        li.appendChild(sub);
      }
      parent.appendChild(li);
    }
  }
  add(roots, ul);
  container.appendChild(ul);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
