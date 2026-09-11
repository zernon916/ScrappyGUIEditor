/**
 * Tab pages: optional sidecar JSON next to the layout, else name guessing.
 * Does not change XML; Lua still owns in-game visibility.
 */

import { walkWidgets } from "./layout-parser.js";

const TAB_NAME = /^(?:Art)?Tab([A-Z][A-Za-z0-9]+)$/;
const ALWAYS = /^(Root|MainPanel|BgPanel|ArtLayer|CloseButton|ArtClose)$/i;
const GROUP = /^(?:Art|Panel)[A-Z]/;
const HOME_PAGE = /^(Search|ScrollBar)/i;

export function parseTabMap(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || raw.version !== 1 || !Array.isArray(raw.tabs) || !raw.tabs.length) return null;
  const tabs = [];
  const labels = {};
  const buttonToTab = new Map();
  const pageRoots = new Map();
  const shared = new Set();
  for (const t of raw.tabs) {
    if (!t || t.id == null || t.id === "") continue;
    const id = String(t.id);
    if (!tabs.includes(id)) tabs.push(id);
    labels[id] = t.label ? String(t.label) : id;
    for (const b of t.buttons || []) {
      if (b) buttonToTab.set(String(b), id);
    }
  }
  if (!tabs.length) return null;
  for (const n of raw.shared || []) {
    if (n) shared.add(String(n));
  }
  const pages = raw.pages && typeof raw.pages === "object" ? raw.pages : {};
  for (const id of tabs) {
    const list = pages[id];
    if (!Array.isArray(list)) continue;
    for (const n of list) {
      if (n) pageRoots.set(String(n), id);
    }
  }
  const def = raw.defaultTab != null ? String(raw.defaultTab) : "";
  return {
    version: 1,
    layout: raw.layout ? String(raw.layout) : "",
    inherit: raw.inherit !== false,
    defaultTab: tabs.includes(def) ? def : tabs[0],
    tabs,
    labels,
    buttonToTab,
    pageRoots,
    shared,
  };
}

export function detectTabIds(roots, map) {
  if (map && map.tabs.length) return map.tabs.slice();
  const ids = [];
  if (!roots) return ids;
  walkWidgets(roots, (w) => {
    const m = TAB_NAME.exec(w.name || "");
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  });
  return ids;
}

export function tabIdFromButton(name, map) {
  const n = name || "";
  if (map && map.buttonToTab.has(n)) return map.buttonToTab.get(n);
  const m = TAB_NAME.exec(n);
  return m ? m[1] : null;
}

export function tabLabel(id, map) {
  if (map && map.labels && map.labels[id]) return map.labels[id];
  return id;
}

export function isSharedTabChrome(name, map) {
  const n = name || "";
  if (!n) return false;
  if (map) {
    if (map.shared.has(n) || map.buttonToTab.has(n)) return true;
    if (ALWAYS.test(n) || /^Close/i.test(n)) return true;
    return false;
  }
  if (ALWAYS.test(n)) return true;
  if (TAB_NAME.test(n)) return true;
  if (/^Close/i.test(n)) return true;
  return false;
}

export function tabOwner(widget, tabIds, map) {
  if (!widget || !tabIds || !tabIds.length) return null;
  if (map) {
    const fromMap = ownerFromMap(widget, map);
    if (fromMap) return fromMap;
    if (fromMap === null) return null;
  }
  let n = widget;
  while (n) {
    const fromName = ownerFromName(n.name, tabIds);
    if (fromName) return fromName;
    n = n.parent;
  }
  return null;
}

export function tabOwnerLabel(widget, tabIds, map) {
  if (!tabIds || !tabIds.length) return "";
  if (isSharedTabChrome(widget && widget.name, map)) return "all tabs";
  const owner = tabOwner(widget, tabIds, map);
  return owner || "all tabs";
}

export function isOnInactiveTab(widget, tabIds, active, map) {
  if (!active || active === "all" || !tabIds.length) return false;
  if (isSharedTabChrome(widget && widget.name, map)) return false;
  const owner = tabOwner(widget, tabIds, map);
  if (!owner) return false;
  return owner !== active;
}

function ownerFromMap(widget, map) {
  let n = widget;
  let self = true;
  while (n) {
    const name = n.name || "";
    if (map.pageRoots.has(name)) return map.pageRoots.get(name);
    if (map.shared.has(name) || map.buttonToTab.has(name)) return self ? null : undefined;
    if (!map.inherit) break;
    self = false;
    n = n.parent;
  }
  return undefined;
}

function ownerFromName(name, tabIds) {
  const n = name || "";
  if (!n || isSharedTabChrome(n, null)) return null;
  const sorted = tabIds.slice().sort((a, b) => b.length - a.length);
  for (const id of sorted) {
    if (n.includes(id)) return id;
    if (id === "Upgrade" && /Upg/i.test(n)) return id;
  }
  if (GROUP.test(n) || HOME_PAGE.test(n)) return tabIds[0];
  return null;
}
