# Layout Lua states (optional)

Scrap Mechanic has no “one of these images” control in `.layout` files. In-game, Lua shows one stacked widget and hides the others (`gui:setVisible`) — upgrade-level art, selected-slot highlights, empty vs filled, and similar.

That is **not** a menu tab. Tabs are whole pages with `TabCraft`-style buttons (`YourMenu.layout.tabs.json`). States are exclusive sets that share the same rect.

The editor cannot read Lua. If a layout has these stacks, put a **sidecar JSON next to the layout**. The editor uses it to show one option per set. The game never loads this file.

Do **not** put state membership in the `.layout`. Do not rename widgets. Widget `name=` is the Lua API.

## File name and place

Same folder as the layout, layout filename plus `.states.json`:

```
Gui/Menu/Layouts/Rfs_CraftStation.layout
Gui/Menu/Layouts/Rfs_CraftStation.layout.states.json
```

UTF-8, 2-space indent, no comments, no trailing commas.

If the file is missing, Scrappy shows every stacked widget at once. There is **no name guessing**.

## Schema (`version`: 1)

```json
{
  "version": 1,
  "layout": "Rfs_CraftStation.layout",
  "inherit": true,
  "sets": [
    {
      "id": "UpgradeLevel",
      "label": "Upgrade level",
      "default": "Lv1",
      "options": [
        { "id": "Lv1", "label": "Level 1", "widgets": ["ArtStationLv1"] },
        { "id": "Lv2", "label": "Level 2", "widgets": ["ArtStationLv2"] },
        { "id": "Lv3", "label": "Level 3", "widgets": ["ArtStationLv3"] }
      ]
    },
    {
      "id": "SlotSelected",
      "label": "Selected slot",
      "default": "None",
      "options": [
        { "id": "None", "label": "None", "widgets": [] },
        { "id": "Slot0", "label": "Slot 0", "widgets": ["ArtSel0"] },
        { "id": "Slot1", "label": "Slot 1", "widgets": ["ArtSel1"] }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `version` | Must be `1`. |
| `layout` | Exact `.layout` filename this file maps (not a full path). |
| `inherit` | `true`: children of a listed widget belong to that option. List roots only. |
| `sets[].id` | Stable PascalCase id for the exclusive set. |
| `sets[].label` | Text in the editor dropdown. |
| `sets[].default` | Option id the GUI usually opens on in-game. |
| `sets[].options[].id` | Stable id for this Lua state. |
| `sets[].options[].label` | Text in the editor dropdown. |
| `sets[].options[].widgets` | Widget `name=` values Lua `setVisible`s for this option. Empty list is valid (nothing extra shown, e.g. “None”). |

### Rules

- Source of truth is the Lua that calls `setVisible` / `setImage` for these widgets, not the XML order.
- Every string must match a `name="…"` in that layout. If Lua mentions a widget the XML does not have, omit it.
- Inside **one set**, a widget name appears in **only one** option.
- Independent stacks are **separate sets** (upgrade art and selected-slot art can both be visible).
- Do not list every `Cell0` / `Icon0` child. List the parent; `inherit` covers children.
- Real menu tabs still use `.tabs.json`, not this file.
- Layouts with no Lua-swapped stacks do not need a file.

## What the editor does

1. Opens `YourMenu.layout`.
2. If `YourMenu.layout.states.json` sits beside it, dropdowns appear (chrome + View → Lua States).
3. Each set shows one option. Other members of that set are hidden on the canvas (dimmed in Hierarchy).
4. Nothing is written back into the `.layout`.

Reopen the layout after you edit the sidecar.

## Example (bundled)

See `samples/example.layout.states.json`.
