/**
 * Lua visibility states: optional sidecar JSON next to the layout.
 * Stacked widgets that Lua setVisible()s (upgrade art, selected slot, …).
 * Does not change XML. No name guessing — missing file means show everything.
 */

export function parseStateMap(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || raw.version !== 1 || !Array.isArray(raw.sets) || !raw.sets.length) return null;
  const inherit = raw.inherit !== false;
  const sets = [];
  for (const s of raw.sets) {
    if (!s || s.id == null || s.id === "") continue;
    const id = String(s.id);
    const options = [];
    const nameToOption = new Map();
    for (const o of s.options || []) {
      if (!o || o.id == null || o.id === "") continue;
      const oid = String(o.id);
      const widgets = [];
      for (const n of o.widgets || []) {
        if (!n) continue;
        const name = String(n);
        widgets.push(name);
        if (!nameToOption.has(name)) nameToOption.set(name, oid);
      }
      options.push({
        id: oid,
        label: o.label ? String(o.label) : oid,
        widgets,
      });
    }
    if (!options.length) continue;
    const def = s.default != null ? String(s.default) : "";
    sets.push({
      id,
      label: s.label ? String(s.label) : id,
      defaultOption: options.some((o) => o.id === def) ? def : options[0].id,
      options,
      nameToOption,
    });
  }
  if (!sets.length) return null;
  return {
    version: 1,
    layout: raw.layout ? String(raw.layout) : "",
    inherit,
    sets,
  };
}

export function defaultStateChoice(map) {
  const out = {};
  if (!map) return out;
  for (const set of map.sets) out[set.id] = set.defaultOption;
  return out;
}

export function optionOwner(widget, set, inherit) {
  if (!widget || !set) return null;
  let n = widget;
  while (n) {
    const name = n.name || "";
    if (name && set.nameToOption.has(name)) return set.nameToOption.get(name);
    if (!inherit) break;
    n = n.parent;
  }
  return null;
}

export function isOnInactiveState(widget, map, choice) {
  if (!map || !map.sets.length) return false;
  for (const set of map.sets) {
    const active = choice && choice[set.id];
    if (!active) continue;
    const owner = optionOwner(widget, set, map.inherit);
    if (owner && owner !== active) return true;
  }
  return false;
}

export function stateOwnerLabel(widget, map, choice) {
  if (!widget || !map || !map.sets.length) return "";
  const parts = [];
  for (const set of map.sets) {
    const owner = optionOwner(widget, set, map.inherit);
    if (!owner) continue;
    const opt = set.options.find((o) => o.id === owner);
    const showing = choice && choice[set.id] === owner;
    parts.push(set.label + ": " + ((opt && opt.label) || owner) + (showing ? "" : " (hidden)"));
  }
  return parts.join(" · ");
}
