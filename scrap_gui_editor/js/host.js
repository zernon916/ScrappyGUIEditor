/**
 * Disk/host bridge. Electron uses IPC (window.scrappy). The .bat Python server
 * uses /api/* . Same call shapes either way.
 */

export const isElectron = typeof window !== "undefined" && !!window.scrappy;

async function invoke(name, args) {
  if (isElectron) return window.scrappy.invoke(name, args || {});
  return httpInvoke(name, args || {});
}

async function parseRes(res) {
  const text = await res.text();
  if (/^\s*</.test(text)) {
    throw new Error("Open http://127.0.0.1:8765 from start_editor.bat (this tab is not that server).");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Local server did not return JSON. Restart start_editor.bat.");
  }
}

async function httpGet(url) {
  const res = await fetch(url);
  return parseRes(res);
}

async function httpPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseRes(res);
}

async function httpInvoke(name, args) {
  const a = args || {};
  switch (name) {
    case "pick-mod":
      return httpGet("/api/pick-mod?start=" + encodeURIComponent(a.start || ""));
    case "pick-folder":
      return httpGet(
        "/api/pick-folder?start=" + encodeURIComponent(a.start || "") + "&title=" + encodeURIComponent(a.title || "Select folder")
      );
    case "open-mod":
      return httpGet("/api/mod?path=" + encodeURIComponent(a.path || ""));
    case "list-layouts":
      return httpGet("/api/layouts?path=" + encodeURIComponent(a.path || ""));
    case "list-pngs":
      return httpGet("/api/list?path=" + encodeURIComponent(a.path || ""));
    case "read-text": {
      const res = await fetch("/api/file?path=" + encodeURIComponent(a.path || "") + "&t=" + Date.now());
      if (!res.ok) {
        const err = await parseRes(res).catch(() => ({ error: res.statusText }));
        return { ok: false, error: err.error || res.statusText };
      }
      const type = res.headers.get("content-type") || "";
      if (type.includes("json") && res.status !== 200) return parseRes(res);
      return { ok: true, text: await res.text(), path: a.path };
    }
    case "save-file":
      return httpPost("/api/save", { path: a.path, content: a.content, backup: !!a.backup });
    case "autosave":
      return httpPost("/api/autosave", { path: a.path, content: a.content, keep: a.keep });
    case "list-backups":
      return httpGet("/api/backups?path=" + encodeURIComponent(a.path || ""));
    case "list-autosaves":
      return httpGet("/api/autosaves?path=" + encodeURIComponent(a.path || ""));
    case "watch":
      return httpGet(
        "/api/watch?layout=" + encodeURIComponent(a.layout || "") + "&images=" + encodeURIComponent(a.images || "")
      );
    case "reveal":
      return httpGet("/api/reveal?path=" + encodeURIComponent(a.path || ""));
    case "pick-save":
      return { ok: true, skipped: true, cancelled: true };
    case "ready-to-quit":
      return { ok: true, skipped: true };
    case "file-url":
      return {
        ok: true,
        url: "/api/file?path=" + encodeURIComponent(a.path || "") + "&t=" + Date.now(),
      };
    case "app-info":
      return { ok: true, electron: false, version: "", packaged: false };
    case "set-auto-update":
    case "check-updates":
    case "install-update":
      return { ok: true, skipped: true };
    default:
      return { ok: false, error: "Unknown host call: " + name };
  }
}

export const host = {
  isElectron,
  invoke,
  pickMod: (start) => invoke("pick-mod", { start }),
  pickFolder: (start, title) => invoke("pick-folder", { start, title }),
  openMod: (path) => invoke("open-mod", { path }),
  listLayouts: (path) => invoke("list-layouts", { path }),
  listPngs: (path) => invoke("list-pngs", { path }),
  readText: (path) => invoke("read-text", { path }),
  saveFile: (path, content, backup) => invoke("save-file", { path, content, backup }),
  autosave: (path, content, keep) => invoke("autosave", { path, content, keep }),
  listBackups: (path) => invoke("list-backups", { path }),
  listAutosaves: (path) => invoke("list-autosaves", { path }),
  watch: (layout, images) => invoke("watch", { layout, images }),
  reveal: (path) => invoke("reveal", { path }),
  pickSave: (suggested) => invoke("pick-save", { suggested }),
  readyToQuit: () => invoke("ready-to-quit"),
  fileUrl: async (path) => {
    const data = await invoke("file-url", { path });
    if (!data.ok) throw new Error(data.error || "file url failed");
    return data.url;
  },
  appInfo: () => invoke("app-info"),
  setAutoUpdate: (enabled) => invoke("set-auto-update", { enabled }),
  checkUpdates: () => invoke("check-updates"),
  installUpdate: () => invoke("install-update"),
  on: (channel, fn) => {
    if (!isElectron || !window.scrappy.on) return () => {};
    return window.scrappy.on(channel, fn);
  },
};
