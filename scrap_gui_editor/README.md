# Scrappy GUI Editor

Local-only visual editor for Scrap Mechanic MyGUI `.layout` files.

GitHub: https://github.com/zernon916/ScrappyGUIEditor

**Download and how to use:** see the [repo README](../README.md) (`main` branch). This file is the inspected MyGUI format, feature list, and tests.

This tool does **not** create accounts, cloud storage, telemetry, or online services. It binds to `127.0.0.1` only.

## Launch

1. Double-click `start_editor.bat`
2. Python 3 is required (already used for the tiny local server)
3. The default browser opens `http://127.0.0.1:8765/index.html`

Open a **mod folder**, then pick a menu from the **Layout** dropdown. Defaults are `Gui/Menu/Layouts` and `Gui/Menu/Images` (or `Image`). If a mod uses another tree, use **Layouts folder…** and **Images folder…**.

`start_editor.bat` starts a **local** Python server because the browser cannot list a mod folder by path, reload PNGs, or write a timestamped backup. There is no database.

## Test files

Use a Testing snapshot as the mod, for example:

`C:\Coding Projects\Testing\RemasteredFrameworkSystems0854-gj`

Bundled `samples/` still work as a fallback, but they will not resolve that mod’s PNGs.

---

## Stage 1 — actual `.layout` structure (inspected, not guessed)

Inspected sources:

- `C:\Coding Projects\Testing\RemasteredFrameworkSystems0854-*` (1045 layout files, 14 unique names)
- Vanilla `C:\Steam\steamapps\common\Scrap Mechanic\Data\Gui\Layouts`

### XML shape

```xml
<?xml version="1.0" encoding="UTF-8"?>
<MyGUI type="Layout" version="3.2.0">
  <!-- comments are present and must be kept -->
  <Widget type="Widget" skin="PanelEmpty" position_real="0 0 1 1" name="Root">
    <Property key="NeedMouse" value="true"/>
    <Widget type="Button" skin="PrimaryButton" position_real="0.74 0.02 0.22 0.06" name="CloseButton">
      <Property key="Caption" value="CLOSE"/>
    </Widget>
  </Widget>
</MyGUI>
```

Some files also contain an empty `<CodeGeneratorSettings />`.

### Widget types found in the Testing layouts

`Widget`, `Button`, `TextBox`, `EditBox`, `ImageBox`, `ProgressBar`, `ScrollBar`

Vanilla layouts also use types such as `Canvas`. Unknown types render as labeled placeholders and are preserved.

### Placement and size (from the files)

| Mechanism | Where | Units |
|---|---|---|
| **`position_real="x y w h"`** | Almost every RFS widget | Fractions of the **parent** (0–1). Dominant format. |
| **`position="x y"` + `size="w h"`** | Early `Rfs_CraftStation` icons | Pixels relative to parent |
| **`Property key="Position"` / `"Size"`** | Early `Rfs_CraftStation` cells | Same pixel values, stored as properties |

A widget’s children use coordinates **relative to that widget**, not the screen.

Root is almost always `position_real="0 0 1 1"` (full screen).

**`align`:** not present in the Testing RFS layouts. Some vanilla layouts use `align="Default"`, `"Center"`, `"Stretch"`, `"Right Top"`. The editor shows/preserves `align` if it exists. How it combines with `position_real` in-game is **uncertain** (needs an in-game test).

### Images

- Property `ImageTexture` (example: `$CONTENT_DATA/Gui/Images/craftstation/btn_craft.png`)
- Property `ImageKeepAspect` = `true` / `false`
- No `ImageResource`, tile, or nine-slice keys in the `.layout` files

Latest CraftStation snapshots often leave `ImageBox` widgets **without** `ImageTexture` (Lua assigns textures at runtime).

### Skins

Skins are **names only** (`BackgroundInteractableWide`, `PrimaryButton`, `ImageBox`, …). Definitions live in Scrap Mechanic’s per-resolution resource XML, e.g. `Data\Gui\Resolutions\1920x1080\...`. Those skins use MyGUI `SubSkin` slices (nine-slice style) **outside** the layout file.

The editor approximates skin chrome. It is **not** pixel-perfect vs the game.

### Colours

`Colour` and `TextColour` are RGB floats `0–1`, e.g. `1 0.780392 0.227451`. `Alpha` is a 0–1 float.

### What is uncertain (needs an in-game screenshot)

- Whether pixel `position`/`size` is then scaled by SM’s resolution skins, or is raw screen pixels
- Exact interaction of `align` / `layer` with `position_real`
- Font glyph metrics (`SM_HeaderLarge_Wide`, etc.)
- True nine-slice appearance of `PrimaryButton` / `BackgroundInteractableWide`
- How ultrawide (3440×1440) treats `position_real` vs a uniform UI scale
- Cover/Fill and Tile image modes — **not found** in layouts; editor can preview them but will not export them

Do not treat the canvas as pixel-perfect until you overlay an in-game screenshot in Calibration mode.

---

## Features

- Import / drag-and-drop `.layout`
- File / Edit / View / Layout / Help menu bar
- Right-click menus on widgets, empty canvas, and hierarchy
- Cut / Copy / Paste / Duplicate / Delete / Rename (F2)
- Open Recent, Restore Backup, Close Layout, Preferences
- Preview button (F5) hides editor chrome for a layout-only view
- 1920×1080 canvas plus 1280×720, 1600×900, 2560×1440, 3440×1440, custom
- Two preview modes (neither writes the file):
  1. Preserve layout units, change only the viewport
  2. Simulate uniform UI scaling (letterbox)
- Zoom: Fit / 25 / 50 / 75 / 100 / 200%, zoom in/out, actual size — view only
- Tab switcher: optional `YourMenu.layout.tabs.json` beside the layout lists which widgets belong to which tab ([docs/tab-mapping.md](docs/tab-mapping.md)). If that file is missing, Scrappy guesses from names (`TabCraft`, `MainTab`, …). View one tab or All stacked. Does not change the `.layout`.
- Lua states: optional `YourMenu.layout.states.json` for stacked widgets Lua `setVisible`s (upgrade art, selected slot, …). One option per set on the canvas. No name guessing. Does not change the `.layout`. Spec: [docs/states.md](docs/states.md).
- Editor groups: multi-select widgets and Group them (`Ctrl+G`). Hierarchy **Groups** dropdown reselects the set. Stored in `YourMenu.layout.groups.json` beside the layout, never inside Save / the `.layout` ([docs/groups.md](docs/groups.md)).
- Hidden dropdown (Hierarchy): lists widgets hidden with Hide in Editor. Pick one and Unhide, or Unhide all. Does not list layout `Visible=false` tab pages and does not write the `.layout`.
- Select, multi-select, select all, overlap cycling (Alt/Ctrl-click or double-click)
- Align, distribute, lock, hide-in-editor, solo
- Drag, 8 resize handles, Shift or Lock Aspect Ratio
- Pixel **W / H** resize (top-left stays) separate from Scale %. Optional: resize each widget instead of scaling the group from its box
- Auto-size parent to wrap children (MyGUI clips to the parent; the editor does not)
- Resize a parent without stretching buttons; optional **Stretch children when this panel resizes**
- Arrow = 1 preview pixel, Shift+Arrow = 10
- Scale % from **imported** size, Scale Up/Down, Reset, Fit to Parent, center, group scale
- Stacking: Bring to Front / Forward / Backward / Send to Back (XML sibling order). Canvas paint uses that same order (later siblings on top)
- Status line under the canvas so it does not cover Hierarchy
- PNG preview, replace, Save PNG As (does not overwrite unless you choose that path), Reload Assets
- Reveal layout or image in Windows Explorer
- Undo / Redo (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z)
- Save writes the open file. **Save with backup** is a checkbox (toolbar, File menu, save dialog, Preferences). When checked, every Save writes a timestamped `.bak.layout` first. The setting is remembered.
- Session restore: last mod, layouts folder, images folder, and layout reopen on launch (Preferences).
- Autosave: rotating `YourMenu.layout.autosave.<time>` next to the layout (default every 5 minutes, keep 4). Not the live `.layout`. File > Restore Autosave. Interval and keep-count are in Preferences.
- Source comparison (diff) before save
- Screenshot overlay / side-by-side calibration (not exported)
- Disk watch: if the open layout or PNG folder changes while the editor is running, a banner offers Reload or Keep editor

### Child scaling and parent clip

`position_real` children are fractions of the parent. If you only change the parent box and leave those fractions alone, buttons **stretch in-game**.

- **Stretch children when this panel resizes** off (default): select the panel only, then resize it. Buttons keep their pixel size. Widgets that already fill the parent (`0 0 1 1`, or covering almost the whole panel) still grow with it.
- That checkbox on: children stretch with the panel (MyGUI’s usual fraction behavior).
- **Auto-size parent to wrap children** on (default): moving children grows panels such as `PanelCats` so the game does not clip them. The editor still paints children that sit outside the parent; Scrap Mechanic does not.

### Image display vs export

| Mode | Export |
|---|---|
| Stretch | `ImageKeepAspect=false` |
| Contain/Fit | `ImageKeepAspect=true` |
| Cover/Fill, Native, Tile | Editor preview only |

---

## Round-trip tests

```
cd scrap_gui_editor
node tests/roundtrip.mjs
```

Verified on the bundled samples:

1. Import then export with no edits preserves the file bytes
2. Moving one widget changes only that widget’s position line
3. Pixel `Position`/`Size` properties are detected correctly

In-game load of an edited file still needs a Scrap Mechanic check on your machine.
