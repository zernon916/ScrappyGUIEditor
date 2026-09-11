/**
 * Editor-only widget groups. Never written into the .layout.
 * Optional sidecar: YourMenu.layout.groups.json next to the layout.
 */

export function parseGroups(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || raw.version !== 1 || !Array.isArray(raw.groups)) return null;
  const groups = [];
  const used = new Set();
  for (const g of raw.groups) {
    if (!g) continue;
    const id = String(g.id || "").trim();
    if (!id || used.has(id)) continue;
    used.add(id);
    const members = [];
    const seen = new Set();
    for (const m of g.members || []) {
      const name = String(m || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      members.push(name);
    }
    groups.push({
      id,
      label: g.label ? String(g.label) : id,
      members,
    });
  }
  return {
    version: 1,
    layout: raw.layout ? String(raw.layout) : "",
    groups,
  };
}

export function serializeGroups(layoutName, groups) {
  const payload = {
    version: 1,
    layout: layoutName || "",
    groups: (groups || []).map((g) => ({
      id: g.id,
      label: g.label || g.id,
      members: [...(g.members || [])],
    })),
  };
  return JSON.stringify(payload, null, 2) + "\n";
}

export function uniqueGroupId(groups, label) {
  const base = slugId(label) || "Group";
  const ids = new Set((groups || []).map((g) => g.id));
  if (!ids.has(base)) return base;
  let n = 2;
  while (ids.has(base + n)) n += 1;
  return base + n;
}

export function matchingGroupId(groups, names) {
  const set = new Set(names || []);
  if (!set.size) return "";
  for (const g of groups || []) {
    if (g.members.length !== set.size) continue;
    if (g.members.every((m) => set.has(m))) return g.id;
  }
  return "";
}

export function renameGroupMember(groups, oldName, newName) {
  if (!oldName || oldName === newName) return false;
  let changed = false;
  for (const g of groups || []) {
    g.members = g.members.map((m) => {
      if (m !== oldName) return m;
      changed = true;
      return newName || m;
    });
    if (newName) {
      const seen = new Set();
      g.members = g.members.filter((m) => {
        if (seen.has(m)) return false;
        seen.add(m);
        return true;
      });
    } else {
      g.members = g.members.filter((m) => m !== oldName);
    }
  }
  return changed;
}

function slugId(label) {
  const s = String(label || "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 32);
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}
