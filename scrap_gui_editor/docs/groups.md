# Editor widget groups (optional)

Groups are **editor-only**. They do not change the `.layout`, and **Save** does not write them into XML.

Use them to multi-select a set of widgets again (queue bars, pills, upgrade slots) without parenting them in MyGUI.

## File

Same folder as the layout, layout filename plus `.groups.json`:

```
Gui/menu/layouts/Rfs_CraftStation.layout
Gui/menu/layouts/Rfs_CraftStation.layout.groups.json
```

Created and updated by the editor when you Group / Ungroup / Rename a group. The game never loads this file.

UTF-8, 2-space indent, no comments, no trailing commas.

## Schema (`version`: 1)

```json
{
  "version": 1,
  "layout": "Rfs_CraftStation.layout",
  "groups": [
    { "id": "QueueBars", "label": "Queue bars", "members": ["ArtQTrack0", "ArtQFill0_1"] }
  ]
}
```

- `members` are widget `name=` values, not internal editor ids.
- Unnamed widgets cannot join a group.
- A widget may sit in more than one group.

## UI

Hierarchy panel: **Groups** dropdown, Group, Ungroup, Rename.

- Shift-click to select several widgets, then **Group** (or `Ctrl+G`).
- Pick a group in the dropdown to select its members.
- **Ungroup** / `Ctrl+Shift+G` removes the selected group, not the widgets.
