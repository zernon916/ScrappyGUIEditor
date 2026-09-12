# Scrappy GUI Editor (desktop)

Local visual editor for Scrap Mechanic MyGUI `.layout` files. This **`Desktop-Version`** branch is the packaged Windows app with GitHub auto-update.

The **`.bat` / Python** download stays on [`main`](https://github.com/zernon916/ScrappyGUIEditor/tree/main). Use that if you do not want an installer.

## Download the EXE

1. Open [Releases](https://github.com/zernon916/ScrappyGUIEditor/releases).
2. Run **`ScrappyGUIEditor-Setup-x.y.z.exe`**.
3. Windows SmartScreen may warn because the installer is unsigned. Choose **More info** → **Run anyway** if you trust this repo.

The installer does not write into your Scrap Mechanic mod folder. Layouts stay where you opened them.

## What’s new in 1.1.0

Editor chrome and tools (same canvas on [`main`](https://github.com/zernon916/ScrappyGUIEditor/tree/main) for the `.bat` build):

- **Q Select, B Box, W Move, E Scale.** Select clicks; Box draws a marquee (intersect, not fully-inside). Neither moves widgets — **Move** does. Scale uses the handles. **Esc** returns to Select, then clears.
- **N / Ctrl+N** hide the left and right docks. Left pages: Hierarchy, Groups, Hidden. Right: Transform, Layers, Text, Image, Overlay, Raw.
- **File / Edit** stay sticky. Open mod, layouts/images folders, Save, and Save As are in **File**. Backup is **Preferences**. Resolution / Scale test live in the **Preview** HUD (**F5**).
- **Ctrl+S** writes immediately (no XML-diff confirm). Groups and Hidden are lists; new groups use an in-app prompt (Electron has no `window.prompt`).
- Unpackaged `start_desktop.bat` uses a separate app name so it does not fight the installed EXE over Chromium cache.

1.0.1 still applies: in-game paint order, W/H resize vs Scale %, panel stretch / wrap-children, and the canvas status bar.

## How to use

1. Launch **Scrappy GUI Editor**.
2. **File → Open mod folder** and pick the folder that contains `Gui\` (your mod root, not a single `.layout`).
3. Pick a menu from the **Layout** dropdown. Defaults are `Gui/Menu/Layouts` and `Gui/Menu/Images` (or `Image`). If your mod uses another tree, **File → Layouts folder…** / **Images folder…**.
4. Use **Q / B / W / E** on the canvas. **File → Save** writes the open file. Timestamped backups are **Edit → Preferences**.

### Worth knowing

- Widget **`name=`** is the Lua API. Do not rename `CloseButton` (etc.) to tidy XML.
- **Tabs** (Craft / Upgrade, …) use an optional `YourMenu.layout.tabs.json` beside the layout. Spec: [`scrap_gui_editor/docs/tab-mapping.md`](scrap_gui_editor/docs/tab-mapping.md).
- **Groups** are editor-only (`YourMenu.layout.groups.json`). They are not written into Save.
- **Autosave** writes `YourMenu.layout.autosave.<time>` next to the layout. That is not the live file. File → Restore Autosave, then Save if you want it live.

## Updates

On launch the installed app checks the latest **GitHub Release** (semver tag such as `v1.1.0`), not every commit. It downloads in the background, autosaves, then asks to restart. Uncheck **Check GitHub for desktop updates on launch** in Edit → Preferences if you do not want it to contact GitHub. File → Check for Updates does the same check on demand.

Updates never overwrite a live `.layout`.

## Run from source (this branch)

Need [Node.js](https://nodejs.org/) 20+.

```bat
npm install
npm start
```

Or double-click **`start_desktop.bat`**. The Python `.bat` editor still works here (`start_editor.bat`) if you prefer the browser.

Build a local installer without publishing:

```bat
npm run dist
```

That writes `dist\ScrappyGUIEditor-Setup-1.1.0.exe`. Do not copy it into a mod folder.

## Shipping a new EXE

1. Bump `"version"` in `package.json`.
2. Push `Desktop-Version`.
3. Tag that commit, for example `v1.1.0`, and push the tag.
4. GitHub Actions builds the NSIS installer and attaches it to a Release. Auto-update looks at that Release.

More format notes: [`scrap_gui_editor/README.md`](scrap_gui_editor/README.md).
