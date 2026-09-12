const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { autoUpdater } = require("electron-updater");
const io = require("./io");

if (!app.isPackaged) {
  const devName = "Scrappy GUI Editor Dev";
  app.setName(devName);
  app.setPath("userData", path.join(app.getPath("appData"), devName));
}

let mainWindow = null;
let autoUpdateEnabled = true;
let updateDownloaded = false;
let allowQuit = false;
let quitTimer = null;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.autoRunAppAfterInstall = true;

function editorRoot() {
  return path.join(__dirname, "..", "scrap_gui_editor");
}

function wrap(fn) {
  return async (event, args) => {
    try {
      return await fn(event, args);
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Scrappy GUI Editor",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(editorRoot(), "index.html"));
  mainWindow.on("close", (ev) => {
    if (allowQuit) return;
    ev.preventDefault();
    send("before-quit");
    if (quitTimer) clearTimeout(quitTimer);
    quitTimer = setTimeout(() => {
      allowQuit = true;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      else app.quit();
    }, 4000);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("scrappy:" + channel, payload);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle(
  "scrappy:pick-mod",
  wrap(async (_e, args) => {
    const start = (args && args.start) || app.getPath("documents");
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Select Scrap Mechanic mod folder (the folder that contains Gui)",
      defaultPath: start || undefined,
      properties: ["openDirectory"],
    });
    if (res.canceled || !res.filePaths[0]) return { ok: true, cancelled: true, path: null };
    return { ok: true, cancelled: false, path: res.filePaths[0] };
  })
);

ipcMain.handle(
  "scrappy:pick-folder",
  wrap(async (_e, args) => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: (args && args.title) || "Select folder",
      defaultPath: (args && args.start) || undefined,
      properties: ["openDirectory"],
    });
    if (res.canceled || !res.filePaths[0]) return { ok: true, cancelled: true, path: null };
    return { ok: true, cancelled: false, path: res.filePaths[0] };
  })
);

ipcMain.handle(
  "scrappy:pick-save",
  wrap(async (_e, args) => {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: "Save layout as",
      defaultPath: (args && args.suggested) || "edited.layout",
      filters: [
        { name: "Layout", extensions: ["layout"] },
        { name: "XML", extensions: ["xml"] },
      ],
    });
    if (res.canceled || !res.filePath) return { ok: true, cancelled: true, path: null };
    return { ok: true, cancelled: false, path: res.filePath };
  })
);

ipcMain.handle("scrappy:open-mod", wrap((_e, args) => io.openMod(args.path)));
ipcMain.handle(
  "scrappy:list-layouts",
  wrap((_e, args) => {
    const folder = io.safePath(args.path);
    return { ok: true, path: folder, layouts: io.listLayouts(folder) };
  })
);
ipcMain.handle(
  "scrappy:list-pngs",
  wrap((_e, args) => {
    const folder = io.safePath(args.path);
    return { ok: true, files: io.listPngs(folder), root: folder };
  })
);
ipcMain.handle("scrappy:read-text", wrap((_e, args) => io.readText(args.path)));
ipcMain.handle("scrappy:save-file", wrap((_e, args) => io.saveFile(args.path, args.content, !!args.backup)));
ipcMain.handle("scrappy:autosave", wrap((_e, args) => io.autosave(args.path, args.content, args.keep)));
ipcMain.handle("scrappy:list-backups", wrap((_e, args) => io.listNamed(args.path, "backups")));
ipcMain.handle("scrappy:list-autosaves", wrap((_e, args) => io.listNamed(args.path, "autosaves")));
ipcMain.handle("scrappy:watch", wrap((_e, args) => io.watchStamp(args.layout, args.images)));
ipcMain.handle(
  "scrappy:reveal",
  wrap((_e, args) => {
    const p = io.safePath(args.path);
    if (!require("fs").existsSync(p)) return { ok: false, error: "Path not found" };
    shell.showItemInFolder(p);
    return { ok: true, path: p };
  })
);
ipcMain.handle(
  "scrappy:file-url",
  wrap((_e, args) => {
    const p = io.safePath(args.path);
    if (!io.allowedRead(p)) return { ok: false, error: "File type not allowed" };
    return { ok: true, url: pathToFileURL(p).href };
  })
);
ipcMain.handle(
  "scrappy:app-info",
  wrap(() => ({
    ok: true,
    electron: true,
    version: app.getVersion(),
    packaged: app.isPackaged,
  }))
);
ipcMain.handle(
  "scrappy:ready-to-quit",
  wrap(() => {
    allowQuit = true;
    if (quitTimer) {
      clearTimeout(quitTimer);
      quitTimer = null;
    }
    if (updateDownloaded && app.isPackaged) {
      autoUpdater.quitAndInstall(false, true);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    } else {
      app.quit();
    }
    return { ok: true };
  })
);

ipcMain.handle(
  "scrappy:set-auto-update",
  wrap((_e, args) => {
    autoUpdateEnabled = !!(args && args.enabled);
    if (autoUpdateEnabled && app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {});
    }
    return { ok: true, enabled: autoUpdateEnabled };
  })
);

ipcMain.handle(
  "scrappy:check-updates",
  wrap(async () => {
    if (!app.isPackaged) return { ok: true, skipped: true, reason: "dev" };
    if (!autoUpdateEnabled) return { ok: true, skipped: true, reason: "off" };
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, updateInfo: result && result.updateInfo };
  })
);

ipcMain.handle(
  "scrappy:install-update",
  wrap(() => {
    if (!updateDownloaded) return { ok: false, error: "No update downloaded" };
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  })
);

autoUpdater.on("update-available", (info) => {
  send("update-available", { version: info.version });
});
autoUpdater.on("update-downloaded", (info) => {
  updateDownloaded = true;
  send("update-downloaded", { version: info.version });
});
autoUpdater.on("error", (err) => {
  send("update-error", { error: String(err.message || err) });
});
