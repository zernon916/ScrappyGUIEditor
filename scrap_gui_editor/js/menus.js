/**
 * Menubar and right-click menus. Commands are string ids handled in app.js.
 */

export function widgetMenuItems(ctx) {
  const w = ctx.widget;
  const name = w ? w.name || w.type || "Widget" : "Widget";
  return [
    { label: name, kind: "title" },
    { cmd: "cut", label: "Cut", shortcut: "Ctrl+X", disabled: !ctx.hasSelection || ctx.targetLocked },
    { cmd: "copy", label: "Copy", shortcut: "Ctrl+C", disabled: !ctx.hasSelection },
    { cmd: "paste", label: "Paste", shortcut: "Ctrl+V", disabled: !ctx.canPaste },
    { cmd: "duplicate", label: "Duplicate", shortcut: "Ctrl+D", disabled: !ctx.hasSelection || ctx.targetLocked },
    { cmd: "rename", label: "Rename", shortcut: "F2", disabled: !ctx.hasSelection },
    { sep: true },
    { cmd: "front", label: "Bring to Front", shortcut: "Ctrl+Shift+]" },
    { cmd: "forward", label: "Bring Forward", shortcut: "Ctrl+]" },
    { cmd: "backward", label: "Send Backward", shortcut: "Ctrl+[" },
    { cmd: "back", label: "Send to Back", shortcut: "Ctrl+Shift+[" },
    { sep: true },
    { cmd: "hideEditor", label: "Hide in Editor", checked: !!(w && w.editorHidden) },
    { cmd: "lock", label: "Lock", checked: !!(w && w.locked) },
    { cmd: "solo", label: "Solo", checked: !!(w && ctx.soloId === w.id) },
    { sep: true },
    { cmd: "resetImageSize", label: "Reset to Image Size", disabled: !ctx.hasResolvedImage },
    { cmd: "copyGeom", label: "Copy Position and Size", disabled: !w },
    { cmd: "pasteGeom", label: "Paste Position and Size", disabled: !ctx.canPasteGeom || ctx.targetLocked },
    { sep: true },
    { cmd: "revealImage", label: "Reveal Image in Explorer", disabled: !ctx.hasImageDiskPath },
    { cmd: "revealLayout", label: "Reveal Layout in Explorer", disabled: !ctx.hasLayoutPath },
    { sep: true },
    { cmd: "delete", label: "Delete", shortcut: "Delete", disabled: !ctx.hasSelection || ctx.targetLocked },
  ];
}

export function hierarchyMenuItems(ctx) {
  const extra = [
    { sep: true },
    { cmd: "expandChildren", label: "Expand Children", disabled: !ctx.hasChildren },
    { cmd: "collapseChildren", label: "Collapse Children", disabled: !ctx.hasChildren },
    { cmd: "selectChildren", label: "Select Children", disabled: !ctx.hasChildren },
    { cmd: "lockChildren", label: "Lock Children", disabled: !ctx.hasChildren },
    { cmd: "hideChildren", label: "Hide Children", disabled: !ctx.hasChildren },
  ];
  return widgetMenuItems(ctx).concat(extra);
}

export function canvasMenuItems(ctx) {
  return [
    { cmd: "paste", label: "Paste", shortcut: "Ctrl+V", disabled: !ctx.canPaste },
    { cmd: "selectAll", label: "Select All" },
    { cmd: "deselectAll", label: "Deselect All", disabled: !ctx.hasSelection },
    { sep: true },
    { cmd: "addWidget", label: "Add Widget" },
    { cmd: "addImage", label: "Add Image" },
    { sep: true },
    { cmd: "toggleGrid", label: "Show Grid", checked: ctx.showGrid },
    { cmd: "toggleSnap", label: "Enable Snap", checked: ctx.snap },
    { cmd: "fitCanvas", label: "Fit Canvas" },
    { cmd: "actualSize", label: "Reset Zoom" },
    { sep: true },
    { cmd: "showAllHidden", label: "Show All Hidden Widgets" },
    { cmd: "unlockAll", label: "Unlock All" },
  ];
}

export function menuBarSpec(ctx) {
  return [
    {
      id: "file",
      label: "File",
      items: [
        { cmd: "openMod", label: "Open Mod Folder" },
        { cmd: "openLayout", label: "Open Layout" },
        {
          label: "Open Recent",
          submenu: ctx.recent.length
            ? ctx.recent.map((r, i) => ({
                cmd: "openRecent",
                label: r.label,
                arg: i,
              }))
            : [{ label: "(empty)", disabled: true }],
        },
        { sep: true },
        { cmd: "toggleBackup", label: "Save with Backup", checked: ctx.saveWithBackup },
        { cmd: "save", label: "Save", shortcut: "Ctrl+S", disabled: !ctx.hasLayout },
        { cmd: "saveAs", label: "Save As", shortcut: "Ctrl+Shift+S", disabled: !ctx.hasLayout },
        { cmd: "restoreBackup", label: "Restore Backup", disabled: !ctx.hasLayoutPath },
        { cmd: "restoreAutosave", label: "Restore Autosave", disabled: !ctx.hasLayoutPath },
        { sep: true },
        { cmd: "reloadAssets", label: "Reload Assets" },
        { cmd: "closeLayout", label: "Close Layout", disabled: !ctx.hasLayout },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { cmd: "undo", label: "Undo", shortcut: "Ctrl+Z", disabled: !ctx.canUndo },
        { cmd: "redo", label: "Redo", shortcut: "Ctrl+Y", disabled: !ctx.canRedo },
        { sep: true },
        { cmd: "cut", label: "Cut", shortcut: "Ctrl+X", disabled: !ctx.hasSelection },
        { cmd: "copy", label: "Copy", shortcut: "Ctrl+C", disabled: !ctx.hasSelection },
        { cmd: "paste", label: "Paste", shortcut: "Ctrl+V", disabled: !ctx.canPaste },
        { cmd: "duplicate", label: "Duplicate", shortcut: "Ctrl+D", disabled: !ctx.hasSelection },
        { cmd: "delete", label: "Delete", shortcut: "Delete", disabled: !ctx.hasSelection },
        { sep: true },
        { cmd: "preferences", label: "Preferences" },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        {
          label: "Preview Mode",
          submenu: [
            { cmd: "previewUnits", label: "Preserve layout units", checked: ctx.scaleMode === "viewport" },
            { cmd: "previewUniform", label: "Simulate uniform UI scaling", checked: ctx.scaleMode === "uniform" },
          ],
        },
        { cmd: "layoutPreview", label: "Layout Preview", shortcut: "F5", checked: ctx.layoutPreview },
        {
          label: "Layout Tabs",
          disabled: !ctx.tabs.length,
          submenu: ctx.tabs.length
            ? [{ cmd: "layoutTab", label: "All (stacked)", arg: "all", checked: ctx.layoutTab === "all" }].concat(
                ctx.tabs.map((id) => ({
                  cmd: "layoutTab",
                  label: (ctx.tabLabels && ctx.tabLabels[id]) || id,
                  arg: id,
                  checked: ctx.layoutTab === id,
                }))
              )
            : [{ label: "(none in this layout)", disabled: true }],
        },
        { sep: true },
        { cmd: "zoomIn", label: "Zoom In", shortcut: "Ctrl+=" },
        { cmd: "zoomOut", label: "Zoom Out", shortcut: "Ctrl+-" },
        { cmd: "fitCanvas", label: "Fit Canvas" },
        { cmd: "actualSize", label: "Actual Size", shortcut: "Ctrl+1" },
        { sep: true },
        { cmd: "toggleGrid", label: "Show Grid", checked: ctx.showGrid },
        { cmd: "toggleSnap", label: "Enable Snap", checked: ctx.snap },
        { cmd: "toggleHidden", label: "Show Hidden", checked: ctx.showHidden },
        {
          label: "Hidden widgets",
          disabled: !ctx.hiddenWidgets || !ctx.hiddenWidgets.length,
          submenu: (ctx.hiddenWidgets && ctx.hiddenWidgets.length
            ? ctx.hiddenWidgets.map((w) => ({
                cmd: "selectHidden",
                label: (w.name || "(unnamed)") + "  " + w.type,
                arg: w.id,
              }))
            : [{ label: "(none hidden)", disabled: true }]
          ).concat([
            { sep: true },
            { cmd: "showAllHidden", label: "Unhide All", disabled: !ctx.hiddenWidgets || !ctx.hiddenWidgets.length },
          ]),
        },
        { cmd: "toggleGameLayers", label: "Show Game Layers", checked: ctx.showGameLayers },
        { sep: true },
        { cmd: "fullscreen", label: "Fullscreen", shortcut: "F11", checked: ctx.fullscreen },
      ],
    },
    {
      id: "layout",
      label: "Layout",
      items: [
        { cmd: "selectAll", label: "Select All", shortcut: "Ctrl+A", disabled: !ctx.hasLayout },
        { cmd: "deselectAll", label: "Deselect All", disabled: !ctx.hasSelection },
        { sep: true },
        {
          label: "Groups",
          submenu: [
            { cmd: "groupSel", label: "Group Selection", shortcut: "Ctrl+G", disabled: ctx.selectionCount < 2 },
            { cmd: "ungroupSel", label: "Ungroup", shortcut: "Ctrl+Shift+G", disabled: !ctx.hasActiveGroup },
            { cmd: "renameGroup", label: "Rename Group", disabled: !ctx.hasActiveGroup },
            { sep: true },
          ].concat(
            ctx.groups && ctx.groups.length
              ? ctx.groups.map((g) => ({
                  cmd: "selectGroup",
                  label: g.label,
                  arg: g.id,
                  checked: ctx.activeGroup === g.id,
                }))
              : [{ label: "(no groups yet)", disabled: true }]
          ),
        },
        { sep: true },
        {
          label: "Align",
          disabled: !ctx.hasSelection,
          submenu: [
            { cmd: "alignLeft", label: "Left" },
            { cmd: "alignCenter", label: "Center" },
            { cmd: "alignRight", label: "Right" },
            { cmd: "alignTop", label: "Top" },
            { cmd: "alignMiddle", label: "Middle" },
            { cmd: "alignBottom", label: "Bottom" },
          ],
        },
        {
          label: "Distribute",
          disabled: ctx.selectionCount < 3,
          submenu: [
            { cmd: "distributeH", label: "Horizontally" },
            { cmd: "distributeV", label: "Vertically" },
          ],
        },
        { sep: true },
        { cmd: "front", label: "Bring to Front", shortcut: "Ctrl+Shift+]", disabled: !ctx.hasSelection },
        { cmd: "forward", label: "Bring Forward", shortcut: "Ctrl+]", disabled: !ctx.hasSelection },
        { cmd: "backward", label: "Send Backward", shortcut: "Ctrl+[", disabled: !ctx.hasSelection },
        { cmd: "back", label: "Send to Back", shortcut: "Ctrl+Shift+[", disabled: !ctx.hasSelection },
        { sep: true },
        { cmd: "lockSel", label: "Lock Selection", disabled: !ctx.hasSelection, checked: ctx.selectionLocked },
        { cmd: "hideSel", label: "Hide Selection", disabled: !ctx.hasSelection, checked: ctx.selectionHidden },
      ],
    },
    {
      id: "help",
      label: "Help",
      items: [
        { cmd: "helpGuide", label: "Scrappy GUI Editor Guide" },
        { cmd: "helpKeys", label: "Keyboard Shortcuts" },
        { sep: true },
        { cmd: "helpBug", label: "Report a Bug" },
        { cmd: "helpGithub", label: "GitHub Repository" },
        { sep: true },
        { cmd: "helpAbout", label: "About Scrappy" },
      ],
    },
  ];
}

export function createMenuController({ onCommand }) {
  const bar = document.getElementById("menubar");
  const ctxRoot = document.getElementById("ctx-menu");
  let openMenu = null;
  let onOpenBar = null;

  function hideAll() {
    hideContext();
    closeBar();
  }

  function closeBar() {
    if (!bar) return;
    bar.querySelectorAll(".menu-drop").forEach((el) => el.classList.add("hidden"));
    bar.querySelectorAll(".menu-top.is-open").forEach((el) => el.classList.remove("is-open"));
    openMenu = null;
  }

  function hideContext() {
    if (!ctxRoot) return;
    ctxRoot.classList.add("hidden");
    ctxRoot.innerHTML = "";
  }

  function renderItems(container, items, inBar) {
    container.innerHTML = "";
    for (const item of items) {
      if (item.sep) {
        const sep = document.createElement("div");
        sep.className = "ctx-sep";
        container.appendChild(sep);
        continue;
      }
      if (item.kind === "title") {
        const title = document.createElement("div");
        title.className = "ctx-title";
        title.textContent = item.label;
        container.appendChild(title);
        continue;
      }
      if (item.submenu) {
        const wrap = document.createElement("div");
        wrap.className = "ctx-subwrap";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ctx-row has-sub";
        btn.disabled = !!item.disabled;
        btn.innerHTML = `<span class="ctx-check"></span><span class="ctx-label">${escapeHtml(item.label)}</span><span class="ctx-arrow">▸</span>`;
        const sub = document.createElement("div");
        sub.className = "ctx-menu ctx-sub hidden";
        renderItems(sub, item.submenu, inBar);
        wrap.appendChild(btn);
        wrap.appendChild(sub);
        if (!item.disabled) {
          wrap.addEventListener("mouseenter", () => {
            container.querySelectorAll(".ctx-sub").forEach((el) => el.classList.add("hidden"));
            sub.classList.remove("hidden");
            placeSub(wrap, sub);
          });
          wrap.addEventListener("mouseleave", () => sub.classList.add("hidden"));
        }
        container.appendChild(wrap);
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctx-row";
      btn.disabled = !!item.disabled;
      const check = item.checked ? "✓" : "";
      const shortcut = item.shortcut ? `<span class="ctx-shortcut">${escapeHtml(item.shortcut)}</span>` : "";
      btn.innerHTML = `<span class="ctx-check">${check}</span><span class="ctx-label">${escapeHtml(item.label)}</span>${shortcut}`;
      if (!item.disabled && item.cmd) {
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          hideAll();
          onCommand(item.cmd, item.arg);
        });
      }
      container.appendChild(btn);
    }
  }

  function placeSub(wrap, sub) {
    const rect = wrap.getBoundingClientRect();
    const box = sub.getBoundingClientRect();
    sub.classList.toggle("open-left", rect.right + box.width > window.innerWidth - 8);
  }

  function clamp(el, x, y) {
    el.style.left = "0px";
    el.style.top = "0px";
    el.classList.remove("hidden");
    const rect = el.getBoundingClientRect();
    const pad = 6;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  function showContext(items, x, y) {
    closeBar();
    if (!ctxRoot) return;
    ctxRoot.className = "ctx-menu";
    renderItems(ctxRoot, items, false);
    clamp(ctxRoot, x, y);
  }

  function paintBar(spec) {
    if (!bar) return;
    bar.innerHTML = "";
    for (const menu of spec) {
      const wrap = document.createElement("div");
      wrap.className = "menu-top";
      wrap.dataset.menu = menu.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-btn";
      btn.textContent = menu.label;
      const drop = document.createElement("div");
      drop.className = "ctx-menu menu-drop hidden";
      renderItems(drop, menu.items, true);
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const already = openMenu === menu.id;
        if (already) {
          closeBar();
          return;
        }
        if (onOpenBar) onOpenBar();
        const next = bar.querySelector(`[data-menu="${menu.id}"]`);
        openNamed(next, menu.id);
      });
      btn.addEventListener("mouseenter", () => {
        if (!openMenu || openMenu === menu.id) return;
        if (onOpenBar) onOpenBar();
        const next = bar.querySelector(`[data-menu="${menu.id}"]`);
        openNamed(next, menu.id);
      });
      wrap.appendChild(btn);
      wrap.appendChild(drop);
      bar.appendChild(wrap);
    }
  }

  function openNamed(wrap, id) {
    closeBar();
    if (!wrap) return;
    openMenu = id;
    wrap.classList.add("is-open");
    const drop = wrap.querySelector(".menu-drop");
    if (!drop) return;
    drop.classList.remove("hidden");
    const btn = wrap.querySelector(".menu-btn");
    const r = btn.getBoundingClientRect();
    drop.style.position = "fixed";
    clamp(drop, r.left, r.bottom);
  }

  document.addEventListener("pointerdown", (ev) => {
    if (bar && bar.contains(ev.target)) return;
    if (ctxRoot && ctxRoot.contains(ev.target)) return;
    hideAll();
  });
  window.addEventListener("blur", hideAll);
  window.addEventListener("resize", hideAll);

  return {
    paintBar,
    showContext,
    hideAll,
    hideContext,
    setOnOpenBar(fn) {
      onOpenBar = fn;
    },
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
