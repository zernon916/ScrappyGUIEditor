# Scrappy GUI Editor

Local visual editor for Scrap Mechanic MyGUI `.layout` files.

This is the **`.bat` / Python** build. It stays on your PC: no accounts, cloud, or telemetry. A tiny server binds to `127.0.0.1` only.

Want an installer instead? Use the Windows app on [`Desktop-Version`](https://github.com/zernon916/ScrappyGUIEditor/tree/Desktop-Version) / [Releases](https://github.com/zernon916/ScrappyGUIEditor/releases). Use **this `main` branch** if you just want the `.bat` editor.

## Download

1. Open the latest `main` zip: [ScrappyGUIEditor-main.zip](https://github.com/zernon916/ScrappyGUIEditor/archive/refs/heads/main.zip)
2. Or clone: `git clone https://github.com/zernon916/ScrappyGUIEditor.git`
3. Unzip / open the folder. You want `start_editor.bat` at the top (it launches `scrap_gui_editor\start_editor.bat`).

**Need:** [Python 3](https://www.python.org/downloads/) on Windows, with **Add python.exe to PATH** checked. You do not need Node for normal use.

## What’s new (1.0.1, same canvas as the desktop app)

- **Paint order matches the game.** Later XML siblings draw on top. Empty `ImageBox` cells look solid so you can see coverage, and the properties panel warns when a later widget covers the selection.
- **Resize is not Scale %.** **W px / H px** plus **Apply size to selection** changes width and height with the top-left fixed. Scale % still multiplies the size from when you opened the file.
- **Resize a panel without stretching its buttons.** Select only the panel (for example `PanelCats`). Leave **Stretch children when this panel resizes** off. Category buttons keep their pixel size; art that already fills the panel (`0 0 1 1`) still grows with it.
- **Auto-size parent to wrap children** (on by default) grows panels such as `PanelCats` when you move children, so MyGUI does not clip them in-game. The editor paints children even outside the parent; the game does not.
- **Handle drag scales the group** (on by default) scales the whole selection from its box. Turn it off to resize each selected widget’s own box.
- The **status bar** sits under the canvas only, so it no longer covers the bottom of Hierarchy.

Refresh the browser after you unzip a new `main` download so these scripts load.

## How to use

1. Double-click **`start_editor.bat`**. Leave that console open.
2. Your browser should open [http://127.0.0.1:8765/index.html](http://127.0.0.1:8765/index.html). If it does not, paste that address yourself. Do not open `index.html` as a file.
3. Click **Open mod folder** and pick the folder that contains `Gui\` (your mod root, not a single `.layout`).
4. Pick a menu from the **Layout** dropdown. Defaults are `Gui/Menu/Layouts` and `Gui/Menu/Images` (or `Image`). If your mod uses another tree, use **Layouts folder…** and **Images folder…**.
5. Move widgets on the canvas. **Save** writes the open file. Check **Save with backup** if you want a timestamped `.bak.layout` first.
6. When you are done, close the browser tab and stop the console with Ctrl+C.

Next launch can reopen the last mod, folders, and layout (Edit → Preferences).

### Worth knowing

- Widget **`name=`** is the Lua API. Do not rename `CloseButton` (etc.) to tidy XML.
- **Tabs** (Craft / Upgrade, …) use an optional `YourMenu.layout.tabs.json` beside the layout. If that file is missing, the editor guesses from names. Spec: [`scrap_gui_editor/docs/tab-mapping.md`](scrap_gui_editor/docs/tab-mapping.md).
- **Groups** are editor-only (`YourMenu.layout.groups.json`). They are not written into Save.
- **Autosave** writes `YourMenu.layout.autosave.<time>` next to the layout. That is not the live file. File → Restore Autosave, then Save if you want it live. Interval is in Preferences.
- Refresh the browser after HTML/JS/CSS changes. Restart the `.bat` only when `server.py` changes.
- If **Reveal in Explorer** or folder pickers fail, you are not on the bat server. Use `http://127.0.0.1:8765` with the console still running.

More format notes, features, and round-trip tests: [`scrap_gui_editor/README.md`](scrap_gui_editor/README.md).
