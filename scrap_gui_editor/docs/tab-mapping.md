# Layout tab mapping (optional)

Scrap Mechanic has no real tab control in `.layout` files. In-game, Lua shows one page and hides the others (`gui:setVisible`). The editor cannot read that Lua.

If a menu has tabs, put a **sidecar JSON next to the layout**. The editor uses it to show one page at a time. The game never loads this file.

Do **not** put tab membership in the `.layout`. Do not rename widgets. Widget `name=` is the Lua API.

## File name and place

Same folder as the layout, layout filename plus `.tabs.json`:

```
Gui/Menu/Layouts/Rfs_Menu.layout
Gui/Menu/Layouts/Rfs_Menu.layout.tabs.json
```

UTF-8, 2-space indent, no comments, no trailing commas.

If the file is missing, Scrappy **guesses** from names (`TabCraft`, `MainTab`, `PanelUpgrade`, …). Guessing is a fallback, not the contract.

## Schema (`version`: 1)

```json
{
  "version": 1,
  "layout": "Rfs_Menu.layout",
  "inherit": true,
  "defaultTab": "Main",
  "tabs": [
    { "id": "Main", "label": "Main", "buttons": ["TabMain"] },
    { "id": "Cheats", "label": "Cheats", "buttons": ["TabCheats"] }
  ],
  "shared": ["Root", "MainPanel", "Title", "CloseButton"],
  "pages": {
    "Main": ["MainTab"],
    "Cheats": ["CheatsTab"]
  }
}
```

| Field | Meaning |
|---|---|
| `version` | Must be `1`. |
| `layout` | Exact `.layout` filename this file maps (not a full path). |
| `inherit` | `true`: children of a page root belong to that tab. List roots only. |
| `defaultTab` | Tab id the GUI opens on in-game. |
| `tabs[].id` | PascalCase id matching the `Tab…` button suffix (`TabCraft` → `Craft`, `TabInvSize` → `InvSize`). |
| `tabs[].label` | Text in the editor dropdown. |
| `tabs[].buttons` | Widget `name=` of the tab button and any `ArtTab*` art. Always visible. |
| `shared` | Chrome visible on every tab (`Root`, `MainPanel`, `BgPanel`, `ArtLayer`, `Title`, `CloseButton`, status lines, …). |
| `pages` | Tab id → **page root** widget names that Lua `setVisible`s for that tab. |

### Rules

- Every string must match a `name="…"` in that layout. If Lua mentions a widget the XML does not have, omit it.
- A widget name appears in **only one** of: `shared`, `tabs[].buttons`, or one `pages` list.
- Do not list every `Cell0` / `Icon0` / `UpgSlot0`. List the parent; `inherit` covers children.
- Source of truth is the Lua refresh-tabs function, not name guessing.
- Layouts with no tab buttons do not need a file.

### Nested pages vs loose siblings

**Preferred (RFS Menu / Setup / GenSettings / Recipe Viewer):** one container per tab (`MainTab`, `PanelQueue`). `pages` is one name per tab.

**Craft Station style:** Craft widgets are siblings, not under `PanelCraft`. List every Lua page root (`PanelCats`, `ArtGrid`, `SearchEdit`, …). Still omit descendants of those roots.

## What the editor does

1. Opens `YourMenu.layout`.
2. If `YourMenu.layout.tabs.json` sits beside it, that file wins.
3. Names not listed still fall back to name guessing, so an incomplete map does not hide the whole canvas.
4. Clicking a mapped tab button on the canvas switches the editor page (same as the Tabs dropdown).
5. Nothing is written back into the `.layout`.

Restart `start_editor.bat` after pulling a build that first added this loader. Then refresh the browser and reopen the layout.

## Example (bundled)

See `samples/Rfs_Menu.layout.tabs.json`.
