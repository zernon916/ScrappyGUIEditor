# Scrappy GUI Editor

Local-only visual editor for Scrap Mechanic MyGUI `.layout` files.

GitHub: https://github.com/zernon916/ScrappyGUIEditor

This tool does **not** create accounts, cloud storage, telemetry, or online services. It binds to `127.0.0.1` only.

## Launch

1. Double-click `start_editor.bat`
2. Python 3 is required (already used for the tiny local server)
3. The default browser opens `http://127.0.0.1:8765/index.html`

Open a **mod folder** (the directory that contains `Gui/`), then pick a menu from the **Layout** dropdown (`Gui/Layouts`). That binds `$CONTENT_DATA` so `Gui/Images` can resolve. Refresh the browser for HTML/JS tests; restart the bat file only if `server.py` changed.

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
- 1920×1080 canvas plus 1280×720, 1600×900, 2560×1440, 3440×1440, custom
- Two preview modes (neither writes the file):
  1. Preserve layout units, change only the viewport
  2. Simulate uniform UI scaling (letterbox)
- Zoom: Fit / 25 / 50 / 75 / 100 / 200% — view only
- Checkerboard, grid, snap
- Select, multi-select, overlap cycling (Alt/Ctrl-click or double-click)
- Drag, 8 resize handles, Shift or Lock Aspect Ratio
- Arrow = 1 preview pixel, Shift+Arrow = 10
- Scale % from **imported** size, Scale Up/Down, Reset, Fit to Parent, center, group scale
- PNG preview, replace, Save PNG As (does not overwrite unless you choose that path), Reload Assets
- Undo / Redo (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z)
- Save As by default; Overwrite writes `name.YYYYMMDD-HHMMSS.bak.layout` first
- Source comparison (diff) before save
- Screenshot overlay / side-by-side calibration (not exported)

### Child scaling

`position_real` children **already** follow parent size (they are fractions). The stored child values do not need to change when the parent is resized. Enable **Also scale child stored values** only if you really want to rewrite children; the editor warns first. Pixel-positioned children do not follow parent size unless you enable that option.

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
