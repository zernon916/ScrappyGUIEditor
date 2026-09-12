const fs = require("fs");
const path = require("path");

const ALLOWED_READ = new Set([".layout", ".xml", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".md"]);
const TABS_SUFFIX = ".layout.tabs.json";
const GROUPS_SUFFIX = ".layout.groups.json";
const STATES_SUFFIX = ".layout.states.json";
const AUTOSAVE_MARK = ".layout.autosave.";
const ALLOWED_WRITE = new Set([".layout", ".xml", ".png"]);

function safePath(raw) {
  if (!raw) throw new Error("Missing path");
  return path.resolve(String(raw));
}

function allowedRead(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (ALLOWED_READ.has(ext)) return true;
  if (name.endsWith(TABS_SUFFIX) || name.endsWith(GROUPS_SUFFIX) || name.endsWith(STATES_SUFFIX)) return true;
  return name.includes(AUTOSAVE_MARK);
}

function allowedWrite(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (ALLOWED_WRITE.has(ext)) return true;
  if (name.endsWith(GROUPS_SUFFIX) || name.endsWith(TABS_SUFFIX)) return true;
  return name.includes(AUTOSAVE_MARK);
}

function findDir(parent, name) {
  if (!parent || !fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) return null;
  const wanted = name.toLowerCase();
  for (const child of fs.readdirSync(parent)) {
    const full = path.join(parent, child);
    try {
      if (fs.statSync(full).isDirectory() && child.toLowerCase() === wanted) return full;
    } catch {
      /* skip */
    }
  }
  return null;
}

function listLayouts(folder) {
  const layouts = [];
  if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return layouts;
  for (const name of fs.readdirSync(folder).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))) {
    const full = path.join(folder, name);
    try {
      if (fs.statSync(full).isFile() && path.extname(name).toLowerCase() === ".layout") {
        layouts.push({ name, path: full });
      }
    } catch {
      /* skip */
    }
  }
  return layouts;
}

function listPngs(folder, limit = 4000) {
  const files = [];
  if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return files;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (files.length >= limit) return;
      if (ent.name.toLowerCase() === "maptiles") continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && path.extname(ent.name).toLowerCase() === ".png") {
        files.push({
          name: ent.name,
          rel: path.relative(folder, full).replace(/\\/g, "/"),
          path: full,
        });
      }
    }
  }
  walk(folder);
  return files;
}

function openMod(modPath) {
  const mod = safePath(modPath);
  if (!fs.existsSync(mod) || !fs.statSync(mod).isDirectory()) {
    return { ok: false, error: "Not a folder: " + mod };
  }
  const gui = findDir(mod, "gui");
  const menu = gui ? findDir(gui, "menu") : null;
  const layoutsDir = menu ? findDir(menu, "layouts") : null;
  let imagesDir = null;
  if (menu) imagesDir = findDir(menu, "images") || findDir(menu, "image");
  const warnings = [];
  if (!gui) warnings.push("No Gui folder in this mod. Use the Layouts folder and Images folder buttons.");
  else if (!menu) warnings.push("No Gui/Menu folder. Default is Gui/Menu/Layouts and Gui/Menu/Images. Use the folder buttons if yours is different.");
  else {
    if (!layoutsDir) warnings.push("No Gui/Menu/Layouts folder. Use Layouts folder… to pick yours.");
    if (!imagesDir) warnings.push("No Gui/Menu/Images (or Image) folder. Use Images folder… to pick yours.");
  }
  return {
    ok: true,
    mod,
    guiDir: gui,
    menuDir: menu,
    layoutsDir,
    imagesDir,
    layoutsFolderName: "Menu/Layouts",
    layouts: layoutsDir ? listLayouts(layoutsDir) : [],
    images: imagesDir ? listPngs(imagesDir) : [],
    warnings,
  };
}

function readText(filePath) {
  const p = safePath(filePath);
  if (!allowedRead(p)) return { ok: false, error: "File type not allowed" };
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return { ok: false, error: "File not found" };
  return { ok: true, text: fs.readFileSync(p, "utf8"), path: p };
}

function saveFile(filePath, content, backup) {
  const p = safePath(filePath);
  if (!allowedWrite(p)) return { ok: false, error: "Refusing to write this file type" };
  const name = path.basename(p).toLowerCase();
  const groupsWrite = name.endsWith(GROUPS_SUFFIX);
  let backupPath = null;
  if (backup && fs.existsSync(p) && !groupsWrite) {
    const stamp = stampNow();
    const ext = path.extname(p);
    const stem = path.basename(p, ext);
    backupPath = path.join(path.dirname(p), `${stem}.${stamp}.bak${ext}`);
    fs.copyFileSync(p, backupPath);
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  return { ok: true, path: p, backup: backupPath };
}

function stampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function autosave(layoutPath, content, keep) {
  const layout = safePath(layoutPath);
  if (path.extname(layout).toLowerCase() !== ".layout") {
    return { ok: false, error: "Autosave only next to a .layout file" };
  }
  keep = Math.max(1, Math.min(10, Number(keep) || 4));
  const dir = path.dirname(layout);
  const prefix = path.basename(layout) + ".autosave.";
  let dest = path.join(dir, prefix + stampNow());
  let extra = 2;
  while (fs.existsSync(dest)) {
    dest = path.join(dir, prefix + stampNow() + "-" + extra);
    extra += 1;
  }
  fs.writeFileSync(dest, content, "utf8");
  const found = fs
    .readdirSync(dir)
    .filter((n) => n.startsWith(prefix))
    .map((n) => path.join(dir, n))
    .filter((f) => {
      try {
        return fs.statSync(f).isFile();
      } catch {
        return false;
      }
    })
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const pruned = [];
  for (const old of found.slice(keep)) {
    try {
      fs.unlinkSync(old);
      pruned.push(path.basename(old));
    } catch {
      /* skip */
    }
  }
  return { ok: true, path: dest, pruned };
}

function listNamed(layoutPath, kind) {
  const p = safePath(layoutPath);
  const parent = path.dirname(p);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    return { ok: false, error: "Folder not found" };
  }
  const base = path.basename(p);
  const items = [];
  for (const name of fs.readdirSync(parent)) {
    const lower = name.toLowerCase();
    if (kind === "backups") {
      if (!lower.includes(".bak.layout")) continue;
      const stem = path.basename(p, path.extname(p)).toLowerCase();
      if (stem && !lower.startsWith(stem + ".")) continue;
    } else {
      if (!name.startsWith(base + ".autosave.")) continue;
    }
    const full = path.join(parent, name);
    try {
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      items.push({ name, path: full, mtime: st.mtimeMs / 1000, size: st.size });
    } catch {
      /* skip */
    }
  }
  items.sort((a, b) => b.mtime - a.mtime);
  return kind === "backups" ? { ok: true, backups: items } : { ok: true, autosaves: items };
}

function watchStamp(layoutPath, imagesPath) {
  let layout = null;
  if (layoutPath) {
    const p = safePath(layoutPath);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      const st = fs.statSync(p);
      layout = { path: p, exists: true, mtime: st.mtimeMs / 1000, size: st.size };
    } else {
      layout = { path: p, exists: false, mtime: 0, size: 0 };
    }
  }
  let latest = 0;
  let count = 0;
  if (imagesPath) {
    try {
      const folder = safePath(imagesPath);
      if (fs.existsSync(folder) && fs.statSync(folder).isDirectory()) {
        function walk(dir) {
          let entries;
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const ent of entries) {
            if (count >= 4000) return;
            if (ent.name.toLowerCase() === "maptiles") continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (ent.isFile() && path.extname(ent.name).toLowerCase() === ".png") {
              try {
                const st = fs.statSync(full);
                if (st.mtimeMs / 1000 > latest) latest = st.mtimeMs / 1000;
                count += 1;
              } catch {
                /* skip */
              }
            }
          }
        }
        walk(folder);
      }
    } catch {
      /* skip */
    }
  }
  return { ok: true, layout, images: { mtime: latest, count } };
}

module.exports = {
  safePath,
  allowedRead,
  openMod,
  listLayouts,
  listPngs,
  readText,
  saveFile,
  autosave,
  listNamed,
  watchStamp,
};
