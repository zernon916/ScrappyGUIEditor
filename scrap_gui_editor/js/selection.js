const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export class Selection {
  constructor() {
    this.ids = [];
    this.cycleHits = [];
    this.cycleIndex = 0;
  }

  get primary() {
    return this.ids.length ? this.ids[this.ids.length - 1] : null;
  }

  has(id) {
    return this.ids.includes(id);
  }

  clear() {
    this.ids = [];
    this.cycleHits = [];
    this.cycleIndex = 0;
  }

  set(id) {
    this.ids = id ? [id] : [];
  }

  toggle(id) {
    const i = this.ids.indexOf(id);
    if (i >= 0) this.ids.splice(i, 1);
    else this.ids.push(id);
  }

  replace(ids) {
    this.ids = [...new Set(ids)];
  }

  selectFromHits(hits, additive, cycle, rects) {
    if (!hits.length) {
      if (!additive) this.clear();
      return;
    }
    if (cycle && this.cycleHits.length && sameHitSet(this.cycleHits, hits)) {
      this.cycleIndex = (this.cycleIndex + 1) % hits.length;
      const id = hits[this.cycleIndex].id;
      if (additive) this.toggle(id);
      else this.set(id);
      return;
    }
    this.cycleHits = hits;
    this.cycleIndex = 0;
    const pick = rects && !cycle ? smallestHit(hits, rects) : hits[0];
    const id = pick.id;
    if (additive) {
      this.toggle(id);
      return;
    }
    if (!cycle && this.has(id) && this.ids.length > 1) {
      this.ids = this.ids.filter((x) => x !== id);
      this.ids.push(id);
      return;
    }
    this.set(id);
  }
}

function smallestHit(hits, rects) {
  let best = hits[0];
  let bestArea = Infinity;
  for (const w of hits) {
    const r = rects.get(w.id);
    const area = r ? Math.max(1, r.w) * Math.max(1, r.h) : Infinity;
    if (area < bestArea - 0.5) {
      best = w;
      bestArea = area;
    }
  }
  return best;
}

function sameHitSet(a, b) {
  if (a.length !== b.length) return false;
  return a.every((w, i) => w.id === b[i].id);
}

export function hitTestAll(roots, rects, x, y, showHidden, canHit) {
  const hits = [];
  function walk(list) {
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      walk(w.children);
      if (canHit && !canHit(w)) continue;
      if (!w.visible && !showHidden) continue;
      const r = rects.get(w.id);
      if (!r) continue;
      if (x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h) hits.push(w);
    }
  }
  walk(roots);
  return hits;
}

export function boundingBox(ids, rects) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const id of ids) {
    const r = rects.get(id);
    if (!r) continue;
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  if (!Number.isFinite(x1)) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function renderSelectionOverlay(overlay, ids, rects, options) {
  overlay.innerHTML = "";
  if (options && options.marquee) {
    const m = options.marquee;
    const boxEl = document.createElement("div");
    boxEl.className = "marquee";
    const x = Math.min(m.x1, m.x2);
    const y = Math.min(m.y1, m.y2);
    boxEl.style.left = x + "px";
    boxEl.style.top = y + "px";
    boxEl.style.width = Math.abs(m.x2 - m.x1) + "px";
    boxEl.style.height = Math.abs(m.y2 - m.y1) + "px";
    overlay.appendChild(boxEl);
  }
  if (!ids.length) return;
  const box = boundingBox(ids, rects);
  if (!box) return;
  const frame = document.createElement("div");
  frame.className = "sel-box";
  frame.style.left = box.x + "px";
  frame.style.top = box.y + "px";
  frame.style.width = box.w + "px";
  frame.style.height = box.h + "px";
  overlay.appendChild(frame);
  for (const id of ids) {
    const r = rects.get(id);
    if (!r) continue;
    const item = document.createElement("div");
    item.className = "sel-item";
    item.style.left = r.x + "px";
    item.style.top = r.y + "px";
    item.style.width = r.w + "px";
    item.style.height = r.h + "px";
    overlay.appendChild(item);
  }
  if (!options || options.handles !== false) {
    const showHandles = options && options.handles === "scale"
      ? true
      : options && options.handles === "single"
        ? ids.length === 1
        : true;
    if (showHandles) {
      for (const h of HANDLES) {
        const handle = document.createElement("div");
        handle.className = "sel-handle";
        handle.dataset.handle = h;
        positionHandle(handle, box, h);
        overlay.appendChild(handle);
      }
    }
  }
}

function positionHandle(el, box, h) {
  const xMid = box.x + box.w / 2;
  const yMid = box.y + box.h / 2;
  const x2 = box.x + box.w;
  const y2 = box.y + box.h;
  const pos = {
    nw: [box.x, box.y],
    n: [xMid, box.y],
    ne: [x2, box.y],
    e: [x2, yMid],
    se: [x2, y2],
    s: [xMid, y2],
    sw: [box.x, y2],
    w: [box.x, yMid],
  }[h];
  el.style.left = pos[0] + "px";
  el.style.top = pos[1] + "px";
}

export function resizeBox(box, handle, dx, dy, lockAspect, minSize = 1) {
  let { x, y, w, h } = box;
  const aspect = box.w / Math.max(box.h, 0.0001);
  const orig = { ...box };
  if (handle.includes("e")) w = orig.w + dx;
  if (handle.includes("s")) h = orig.h + dy;
  if (handle.includes("w")) {
    w = orig.w - dx;
    x = orig.x + dx;
  }
  if (handle.includes("n")) {
    h = orig.h - dy;
    y = orig.y + dy;
  }
  if (lockAspect && handle.length === 2) {
    if (Math.abs(dx) > Math.abs(dy)) {
      h = w / aspect;
      if (handle.includes("n")) y = orig.y + orig.h - h;
    } else {
      w = h * aspect;
      if (handle.includes("w")) x = orig.x + orig.w - w;
    }
  } else if (lockAspect && (handle === "n" || handle === "s")) {
    const nw = h * aspect;
    x = orig.x + (orig.w - nw) / 2;
    w = nw;
  } else if (lockAspect && (handle === "e" || handle === "w")) {
    const nh = w / aspect;
    y = orig.y + (orig.h - nh) / 2;
    h = nh;
  }
  if (w < minSize) {
    if (handle.includes("w")) x = orig.x + orig.w - minSize;
    w = minSize;
  }
  if (h < minSize) {
    if (handle.includes("n")) y = orig.y + orig.h - minSize;
    h = minSize;
  }
  return { x, y, w, h };
}

export function scaleRectsFromBox(ids, rects, fromBox, toBox) {
  const sx = fromBox.w ? toBox.w / fromBox.w : 1;
  const sy = fromBox.h ? toBox.h / fromBox.h : 1;
  const result = new Map();
  for (const id of ids) {
    const r = rects.get(id);
    if (!r) continue;
    result.set(id, {
      x: toBox.x + (r.x - fromBox.x) * sx,
      y: toBox.y + (r.y - fromBox.y) * sy,
      w: r.w * sx,
      h: r.h * sy,
    });
  }
  return result;
}

/** Same handle delta on each widget’s own box. Positions stay except the dragged edge. */
export function resizeEachRects(ids, rects, handle, dx, dy, lockAspect) {
  const result = new Map();
  for (const id of ids) {
    const r = rects.get(id);
    if (!r) continue;
    result.set(id, resizeBox(r, handle, dx, dy, lockAspect));
  }
  return result;
}

/** Widgets whose screen rects intersect the marquee (not fully-inside). */
export function boxHits(roots, rects, marquee, showHidden, canHit) {
  const x1 = Math.min(marquee.x1, marquee.x2);
  const y1 = Math.min(marquee.y1, marquee.y2);
  const x2 = Math.max(marquee.x1, marquee.x2);
  const y2 = Math.max(marquee.y1, marquee.y2);
  const hits = [];
  function walk(list) {
    for (const w of list || []) {
      walk(w.children);
      if (canHit && !canHit(w)) continue;
      if (!w.visible && !showHidden) continue;
      const r = rects.get(w.id);
      if (!r) continue;
      if (r.x < x2 && r.x + r.w > x1 && r.y < y2 && r.y + r.h > y1) hits.push(w);
    }
  }
  walk(roots);
  return hits;
}

export { HANDLES };
