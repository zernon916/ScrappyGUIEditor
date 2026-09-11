/**
 * Source-preserving MyGUI 3.2.0 .layout parser.
 * Unknown elements/attributes, comments, and original formatting survive
 * unless a node is actually edited.
 */

let nextWidgetId = 1;

export function resetIds() {
  nextWidgetId = 1;
}

export function parseLayout(xmlText) {
  const errors = [];
  const warnings = [];
  if (xmlText == null || xmlText === "") {
    return { ok: false, errors: ["File is empty."], warnings, document: null, widgets: [], roots: [] };
  }

  let src = xmlText;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

  let doc;
  try {
    const parsed = parseDocument(src);
    doc = parsed.doc;
    errors.push(...parsed.errors);
  } catch (err) {
    return {
      ok: false,
      errors: [`Parse failed: ${err.message}`],
      warnings,
      document: null,
      widgets: [],
      roots: [],
      originalXml: src,
    };
  }

  const mygui = findElement(doc.children, "MyGUI");
  if (!mygui) {
    errors.push("Root <MyGUI> element was not found. This does not look like a Scrap Mechanic .layout file.");
  } else {
    const t = getAttr(mygui, "type");
    if (t && t !== "Layout") {
      warnings.push(`MyGUI type is "${t}", expected "Layout".`);
    }
  }

  resetIds();
  const roots = [];
  if (mygui) {
    for (const child of mygui.children) {
      if (child.kind === "element" && child.name === "Widget") {
        roots.push(buildWidget(child, null, warnings));
      }
    }
  }

  const widgets = [];
  walkWidgets(roots, (w) => widgets.push(w));

  if (!roots.length && mygui) {
    errors.push("No <Widget> elements were found under <MyGUI>.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    document: doc,
    mygui,
    roots,
    widgets,
    originalXml: src,
  };
}

export function walkWidgets(list, fn, parent = null) {
  for (const w of list) {
    fn(w, parent);
    if (w.children.length) walkWidgets(w.children, fn, w);
  }
}

export function getAttr(node, name) {
  if (!node || !node.attrs) return null;
  const a = node.attrs.find((x) => x.name === name);
  return a ? a.value : null;
}

export function setAttr(node, name, value) {
  if (!node.attrs) node.attrs = [];
  const existing = node.attrs.find((x) => x.name === name);
  if (existing) {
    if (existing.value === value) return;
    existing.value = value;
    existing.rawValue = null;
    node.dirty = true;
    return;
  }
  const last = node.attrs[node.attrs.length - 1];
  node.attrs.push({
    name,
    value,
    quote: last?.quote || '"',
    prefix: " ",
    between: "=",
  });
  node.dirty = true;
}

export function getProp(widget, key) {
  const node = widget.propNodes[key];
  if (!node) return null;
  return getAttr(node, "value");
}

export function setProp(widget, key, value) {
  const node = widget.propNodes[key];
  if (node) {
    setAttr(node, "value", value);
    widget.props[key] = value;
    return node;
  }
  const created = insertProperty(widget, key, value);
  widget.propNodes[key] = created;
  widget.props[key] = value;
  return created;
}

export function serializeDocument(doc) {
  return serializeNode(doc);
}

export function formatNumbers(values, originalString) {
  const origParts = originalString != null ? String(originalString).trim().split(/\s+/) : [];
  return values
    .map((v, i) => formatOneNumber(v, origParts[i]))
    .join(" ");
}

export function parseNumbers(str) {
  if (str == null || str === "") return [];
  return String(str)
    .trim()
    .split(/\s+/)
    .filter((p) => p.length)
    .map((p) => Number(p));
}

export function applyGeometry(widget) {
  const fmt = widget.originalPosString || "";
  const sizeFmt = widget.originalSizeString || "";
  if (widget.posSource === "position_real") {
    setAttr(widget.xml, "position_real", formatNumbers([widget.x, widget.y, widget.w, widget.h], fmt));
  } else if (widget.posSource === "position4") {
    setAttr(widget.xml, "position", formatNumbers([widget.x, widget.y, widget.w, widget.h], fmt));
  } else if (widget.posSource === "position_size") {
    setAttr(widget.xml, "position", formatNumbers([widget.x, widget.y], fmt));
    setAttr(widget.xml, "size", formatNumbers([widget.w, widget.h], sizeFmt || "0 0"));
  } else if (widget.posSource === "property") {
    setProp(widget, "Position", formatNumbers([widget.x, widget.y], fmt));
    setProp(widget, "Size", formatNumbers([widget.w, widget.h], sizeFmt || "0 0"));
  } else if (widget.posSource === "none") {
    const parentReal = widget.parent && widget.parent.posSource === "position_real";
    if (parentReal || !widget.parent) {
      setAttr(widget.xml, "position_real", formatNumbers([widget.x, widget.y, widget.w, widget.h], "0 0 0 0"));
      widget.posSource = "position_real";
    } else {
      setAttr(widget.xml, "position", formatNumbers([widget.x, widget.y], "0 0"));
      setAttr(widget.xml, "size", formatNumbers([widget.w, widget.h], "0 0"));
      widget.posSource = "position_size";
    }
  }
}

export function setWidgetName(widget, name) {
  setAttr(widget.xml, "name", name);
  widget.name = name;
}

export function setWidgetType(widget, type) {
  setAttr(widget.xml, "type", type);
  widget.type = type;
}

export function setWidgetAlign(widget, align) {
  if (align == null || align === "") return;
  setAttr(widget.xml, "align", align);
  widget.align = align;
}

export function escapeXmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXmlAttr(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function formatOneNumber(v, sample) {
  if (!Number.isFinite(v)) v = 0;
  if (sample != null && sample !== "" && Number(sample) === v) return sample;
  const rounded = Math.round(v);
  if (Math.abs(v - rounded) < 1e-10) return String(rounded);
  let decimals = 6;
  if (sample && sample.includes(".")) {
    decimals = Math.max(sample.split(".")[1].length, 3);
  }
  let s = v.toFixed(decimals);
  s = s.replace(/(\.\d*?[1-9])0+$/g, "$1").replace(/\.0+$/g, "");
  if (s === "-0") s = "0";
  return s;
}

function findElement(nodes, name) {
  for (const n of nodes) {
    if (n.kind === "element" && n.name === name) return n;
    if (n.kind === "element" && n.children) {
      const inner = findElement(n.children, name);
      if (inner) return inner;
    }
  }
  return null;
}

function parseDocument(src) {
  const errors = [];
  const children = [];
  let i = 0;
  while (i < src.length) {
    const r = parseNode(src, i, errors);
    children.push(r.node);
    i = r.next;
  }
  return {
    doc: {
      kind: "document",
      children,
      dirty: false,
      original: src,
    },
    errors,
  };
}

function parseNode(src, i, errors) {
  if (src.startsWith("<!--", i)) {
    const end = src.indexOf("-->", i + 4);
    if (end < 0) {
      errors.push(`Unterminated comment at index ${i}.`);
      return { node: { kind: "comment", raw: src.slice(i), dirty: false }, next: src.length };
    }
    return { node: { kind: "comment", raw: src.slice(i, end + 3), dirty: false }, next: end + 3 };
  }
  if (src.startsWith("<![CDATA[", i)) {
    const end = src.indexOf("]]>", i + 9);
    if (end < 0) {
      errors.push(`Unterminated CDATA at index ${i}.`);
      return { node: { kind: "cdata", raw: src.slice(i), dirty: false }, next: src.length };
    }
    return { node: { kind: "cdata", raw: src.slice(i, end + 3), dirty: false }, next: end + 3 };
  }
  if (src.startsWith("<?", i)) {
    const end = src.indexOf("?>", i + 2);
    if (end < 0) {
      errors.push(`Unterminated processing instruction at index ${i}.`);
      return { node: { kind: "pi", raw: src.slice(i), dirty: false }, next: src.length };
    }
    return { node: { kind: "pi", raw: src.slice(i, end + 2), dirty: false }, next: end + 2 };
  }
  if (src.startsWith("<!", i)) {
    const end = src.indexOf(">", i + 2);
    if (end < 0) {
      errors.push(`Unterminated declaration at index ${i}.`);
      return { node: { kind: "decl", raw: src.slice(i), dirty: false }, next: src.length };
    }
    return { node: { kind: "decl", raw: src.slice(i, end + 1), dirty: false }, next: end + 1 };
  }
  if (src[i] === "<" && src[i + 1] !== "/") {
    return parseElement(src, i, errors);
  }
  const nextLt = src.indexOf("<", i);
  const end = nextLt < 0 ? src.length : nextLt;
  return { node: { kind: "text", raw: src.slice(i, end), dirty: false }, next: end };
}

function parseElement(src, i, errors) {
  const start = i;
  i += 1;
  const nameStart = i;
  while (i < src.length && /[:A-Za-z0-9_.-]/.test(src[i])) i += 1;
  const name = src.slice(nameStart, i);
  if (!name) {
    errors.push(`Missing element name at index ${start}.`);
  }

  const attrs = [];
  while (i < src.length) {
    const preStart = i;
    while (i < src.length && /[ \t\r\n]/.test(src[i])) i += 1;
    const prefix = src.slice(preStart, i);
    if (i >= src.length) break;
    if (src.startsWith("/>", i) || src[i] === ">") {
      i = preStart;
      break;
    }
    const nStart = i;
    while (i < src.length && /[:A-Za-z0-9_.-]/.test(src[i])) i += 1;
    const attrName = src.slice(nStart, i);
    const eqStart = i;
    while (i < src.length && /[ \t\r\n]/.test(src[i])) i += 1;
    if (src[i] !== "=") {
      errors.push(`Attribute "${attrName}" is missing '=' near index ${i}.`);
      break;
    }
    i += 1;
    while (i < src.length && /[ \t\r\n]/.test(src[i])) i += 1;
    const between = src.slice(eqStart, i);
    const quote = src[i] === "'" || src[i] === '"' ? src[i] : '"';
    if (src[i] === "'" || src[i] === '"') i += 1;
    const vStart = i;
    while (i < src.length && src[i] !== quote) i += 1;
    const rawValue = src.slice(vStart, i);
    if (src[i] === quote) i += 1;
    attrs.push({
      name: attrName,
      value: unescapeXmlAttr(rawValue),
      rawValue,
      quote,
      prefix: prefix || " ",
      between,
    });
  }

  let selfClosing = false;
  let openEnd = "";
  const endStart = i;
  let j = i;
  while (j < src.length && /[ \t\r\n]/.test(src[j])) j += 1;
  if (src.startsWith("/>", j)) {
    selfClosing = true;
    i = j + 2;
    openEnd = src.slice(endStart, i);
  } else if (src[j] === ">") {
    i = j + 1;
    openEnd = src.slice(endStart, i);
  } else {
    errors.push(`Unterminated start tag <${name}> at index ${start}.`);
    openEnd = ">";
  }

  const node = {
    kind: "element",
    name,
    attrs,
    selfClosing,
    openEnd,
    children: [],
    closeRaw: "",
    dirty: false,
  };

  if (selfClosing) return { node, next: i };

  while (i < src.length) {
    if (src.startsWith("</", i)) break;
    const r = parseNode(src, i, errors);
    node.children.push(r.node);
    i = r.next;
  }

  if (src.startsWith("</", i)) {
    const closeStart = i;
    const gt = src.indexOf(">", i);
    if (gt < 0) {
      errors.push(`Unterminated close tag for <${name}>.`);
      node.closeRaw = `</${name}>`;
      i = src.length;
    } else {
      node.closeRaw = src.slice(closeStart, gt + 1);
      i = gt + 1;
    }
  } else {
    errors.push(`Missing close tag for <${name}>.`);
    node.closeRaw = `</${name}>`;
  }

  return { node, next: i };
}

function isTreeDirty(node) {
  if (!node) return false;
  if (node.dirty) return true;
  if (node.children) {
    for (const c of node.children) {
      if (isTreeDirty(c)) return true;
    }
  }
  return false;
}

function serializeNode(node) {
  if (node.kind === "document") {
    return node.children.map(serializeNode).join("");
  }
  if (node.kind === "text" || node.kind === "comment" || node.kind === "pi" || node.kind === "decl" || node.kind === "cdata") {
    return node.raw || "";
  }
  if (node.kind !== "element") return "";

  const open = serializeOpenTag(node);
  if (node.selfClosing) return open;
  const inner = node.children.map(serializeNode).join("");
  return open + inner + (node.closeRaw || `</${node.name}>`);
}

function serializeOpenTag(node) {
  let s = "<" + node.name;
  for (const a of node.attrs || []) {
    const quote = a.quote || '"';
    const encoded = a.rawValue != null && unescapeXmlAttr(a.rawValue) === a.value ? a.rawValue : escapeXmlAttr(a.value);
    if (a.dirtyValue) {
      /* kept for compatibility */
    }
    s += (a.prefix || " ") + a.name + (a.between || "=") + quote + encoded + quote;
  }
  s += node.openEnd || (node.selfClosing ? "/>" : ">");
  return s;
}

export function buildWidget(xml, parent, warnings) {
  const widget = {
    id: "w" + nextWidgetId++,
    xml,
    parent,
    children: [],
    editorHidden: false,
    locked: false,
    collapsed: false,
    name: getAttr(xml, "name") || "",
    type: getAttr(xml, "type") || "",
    skin: getAttr(xml, "skin") || "",
    align: getAttr(xml, "align"),
    layer: getAttr(xml, "layer"),
    extraAttrs: [],
    props: {},
    propNodes: {},
    propOrder: [],
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    posSource: "none",
    originalX: 0,
    originalY: 0,
    originalW: 0,
    originalH: 0,
    originalPosString: "",
    originalSizeString: "",
    visible: true,
    caption: "",
    imageTexture: "",
    imageKeepAspect: null,
    colour: "",
    textColour: "",
    alpha: "",
    textAlign: "",
    fontName: "",
    unknownProps: [],
  };

  const knownAttr = new Set(["type", "skin", "name", "position", "position_real", "size", "align", "layer"]);
  for (const a of xml.attrs || []) {
    if (!knownAttr.has(a.name)) widget.extraAttrs.push({ name: a.name, value: a.value });
  }

  for (const child of xml.children) {
    if (child.kind === "element" && child.name === "Property") {
      const key = getAttr(child, "key");
      const value = getAttr(child, "value");
      if (key != null) {
        widget.props[key] = value;
        widget.propNodes[key] = child;
        widget.propOrder.push(key);
      }
    }
  }

  readGeometry(widget, warnings);
  widget.originalX = widget.x;
  widget.originalY = widget.y;
  widget.originalW = widget.w;
  widget.originalH = widget.h;

  widget.visible = parseBool(widget.props.Visible, true);
  widget.caption = widget.props.Caption || "";
  widget.imageTexture = widget.props.ImageTexture || "";
  if (widget.props.ImageKeepAspect != null) {
    widget.imageKeepAspect = parseBool(widget.props.ImageKeepAspect, false);
  }
  widget.colour = widget.props.Colour || "";
  widget.textColour = widget.props.TextColour || "";
  widget.alpha = widget.props.Alpha || "";
  widget.textAlign = widget.props.TextAlign || "";
  widget.fontName = widget.props.FontName || "";

  const knownProp = new Set([
    "Caption",
    "FontName",
    "FontHeight",
    "TextAlign",
    "TextColour",
    "TextShadow",
    "TextShadowColour",
    "Visible",
    "ImageTexture",
    "ImageKeepAspect",
    "Colour",
    "Alpha",
    "NeedKey",
    "NeedMouse",
    "InheritsAlpha",
    "InheritsPick",
    "WordWrap",
    "ReadOnly",
    "Static",
    "Position",
    "Size",
    "Range",
    "RangePosition",
  ]);
  for (const key of widget.propOrder) {
    if (!knownProp.has(key)) widget.unknownProps.push({ key, value: widget.props[key] });
  }

  for (const child of xml.children) {
    if (child.kind === "element" && child.name === "Widget") {
      widget.children.push(buildWidget(child, widget, warnings));
    }
  }

  return widget;
}

function readGeometry(widget, warnings) {
  const real = getAttr(widget.xml, "position_real");
  const pos = getAttr(widget.xml, "position");
  const size = getAttr(widget.xml, "size");
  const propPos = widget.props.Position;
  const propSize = widget.props.Size;

  if (real != null) {
    const n = parseNumbers(real);
    if (n.length >= 4) {
      widget.x = n[0];
      widget.y = n[1];
      widget.w = n[2];
      widget.h = n[3];
      widget.posSource = "position_real";
      widget.originalPosString = real;
    } else {
      warnings.push(`${widgetLabel(widget)} has position_real="${real}" which is not 4 numbers.`);
    }
    return;
  }

  if (pos != null) {
    const n = parseNumbers(pos);
    if (n.length >= 4) {
      widget.x = n[0];
      widget.y = n[1];
      widget.w = n[2];
      widget.h = n[3];
      widget.posSource = "position4";
      widget.originalPosString = pos;
      return;
    }
    if (n.length >= 2) {
      widget.x = n[0];
      widget.y = n[1];
      widget.posSource = "position_size";
      widget.originalPosString = pos;
      if (size != null) {
        const s = parseNumbers(size);
        if (s.length >= 2) {
          widget.w = s[0];
          widget.h = s[1];
          widget.originalSizeString = size;
        }
      }
      return;
    }
  }

  if (propPos != null || propSize != null) {
    widget.posSource = "property";
    if (propPos != null) {
      const n = parseNumbers(propPos);
      if (n.length >= 2) {
        widget.x = n[0];
        widget.y = n[1];
      }
      if (n.length >= 4) {
        widget.w = n[2];
        widget.h = n[3];
      }
      widget.originalPosString = propPos;
    }
    if (propSize != null) {
      const s = parseNumbers(propSize);
      if (s.length >= 2) {
        widget.w = s[0];
        widget.h = s[1];
      }
      widget.originalSizeString = propSize;
    }
    return;
  }

  widget.posSource = "none";
  widget.w = 1;
  widget.h = 1;
  warnings.push(`${widgetLabel(widget)} has no position/size attributes or Position/Size properties. A placeholder size is used in the editor only.`);
}

function widgetLabel(widget) {
  return widget.name ? `<${widget.type} name="${widget.name}">` : `<${widget.type}>`;
}

function parseBool(value, fallback) {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

function insertProperty(widget, key, value) {
  const xml = widget.xml;
  const indent = inferChildIndent(xml);
  const prop = {
    kind: "element",
    name: "Property",
    attrs: [
      { name: "key", value: key, quote: '"', prefix: " ", between: "=" },
      { name: "value", value, quote: '"', prefix: " ", between: "=" },
    ],
    selfClosing: true,
    openEnd: "/>",
    children: [],
    closeRaw: "",
    dirty: true,
  };

  const textBefore = { kind: "text", raw: indent, dirty: true };
  let insertAt = xml.children.length;
  for (let i = 0; i < xml.children.length; i++) {
    const c = xml.children[i];
    if (c.kind === "element" && c.name === "Widget") {
      insertAt = i;
      break;
    }
  }
  xml.children.splice(insertAt, 0, textBefore, prop);
  xml.dirty = true;
  xml.selfClosing = false;
  if (!xml.closeRaw) xml.closeRaw = `</${xml.name}>`;
  if (!xml.openEnd || xml.openEnd.includes("/")) xml.openEnd = ">";
  widget.propOrder.push(key);
  return prop;
}

function inferChildIndent(xml) {
  for (const c of xml.children) {
    if (c.kind === "text" && /\n/.test(c.raw || "")) {
      const m = c.raw.match(/\n([ \t]+)/);
      if (m) return "\n" + m[1];
    }
  }
  return "\n\t\t";
}

export function cloneXmlNode(node) {
  if (!node) return null;
  if (node.kind !== "element") {
    return { kind: node.kind, raw: node.raw, dirty: true };
  }
  return {
    kind: "element",
    name: node.name,
    attrs: (node.attrs || []).map((a) => ({ ...a, rawValue: a.rawValue })),
    selfClosing: node.selfClosing,
    openEnd: node.openEnd,
    children: (node.children || []).map(cloneXmlNode),
    closeRaw: node.closeRaw,
    dirty: true,
  };
}

export function serializeXml(node) {
  return serializeNode(node);
}

export function extractWidgetXml(parentXml, widgetXml) {
  const kids = parentXml.children || [];
  const i = kids.indexOf(widgetXml);
  if (i < 0) return { index: -1, nodes: [] };
  let start = i;
  if (i > 0 && kids[i - 1].kind === "text" && /^\s*$/.test(kids[i - 1].raw || "")) start = i - 1;
  const nodes = kids.splice(start, i - start + 1);
  parentXml.dirty = true;
  return { index: start, nodes };
}

export function insertXmlNodes(parentXml, index, nodes) {
  if (!parentXml.children) parentXml.children = [];
  const at = Math.max(0, Math.min(index < 0 ? parentXml.children.length : index, parentXml.children.length));
  parentXml.children.splice(at, 0, ...nodes);
  parentXml.dirty = true;
  parentXml.selfClosing = false;
  if (!parentXml.openEnd || String(parentXml.openEnd).includes("/")) parentXml.openEnd = ">";
  if (!parentXml.closeRaw) parentXml.closeRaw = `</${parentXml.name}>`;
}

export function insertWidgetElement(parentXml, widgetXml, beforeXml) {
  const indent = inferChildIndent(parentXml);
  const nodes = [
    { kind: "text", raw: indent, dirty: true },
    widgetXml,
  ];
  if (beforeXml) {
    const kids = parentXml.children || [];
    let at = kids.indexOf(beforeXml);
    if (at < 0) at = kids.length;
    if (at > 0 && kids[at - 1].kind === "text" && /^\s*$/.test(kids[at - 1].raw || "")) at -= 1;
    insertXmlNodes(parentXml, at, nodes);
  } else {
    insertXmlNodes(parentXml, (parentXml.children || []).length, nodes);
  }
}

export function createBlankWidgetXml({
  type = "Widget",
  skin = "PanelEmpty",
  name = "",
  positionReal = "0.1 0.1 0.2 0.15",
  props = {},
} = {}) {
  const children = [];
  const keys = Object.keys(props);
  for (const key of keys) {
    children.push({ kind: "text", raw: "\n\t\t", dirty: true });
    children.push({
      kind: "element",
      name: "Property",
      attrs: [
        { name: "key", value: key, quote: '"', prefix: " ", between: "=" },
        { name: "value", value: String(props[key]), quote: '"', prefix: " ", between: "=" },
      ],
      selfClosing: true,
      openEnd: "/>",
      children: [],
      closeRaw: "",
      dirty: true,
    });
  }
  if (keys.length) children.push({ kind: "text", raw: "\n\t", dirty: true });
  const attrs = [
    { name: "type", value: type, quote: '"', prefix: " ", between: "=" },
    { name: "skin", value: skin, quote: '"', prefix: " ", between: "=" },
    { name: "position_real", value: positionReal, quote: '"', prefix: " ", between: "=" },
  ];
  if (name) attrs.push({ name: "name", value: name, quote: '"', prefix: " ", between: "=" });
  return {
    kind: "element",
    name: "Widget",
    attrs,
    selfClosing: false,
    openEnd: ">",
    children,
    closeRaw: "</Widget>",
    dirty: true,
  };
}

export function createWidget(options, parent = null) {
  return buildWidget(createBlankWidgetXml(options), parent, []);
}

export function reorderWidgetElements(parentXml, orderedWidgetXml) {
  if (!parentXml || !parentXml.children || !orderedWidgetXml.length) return;
  const queue = [...orderedWidgetXml];
  for (let i = 0; i < parentXml.children.length; i++) {
    const n = parentXml.children[i];
    if (n.kind === "element" && n.name === "Widget") {
      const next = queue.shift();
      if (next) parentXml.children[i] = next;
    }
  }
  parentXml.dirty = true;
}

export const KNOWN_WIDGET_TYPES = [
  "Widget",
  "Button",
  "TextBox",
  "EditBox",
  "ImageBox",
  "ProgressBar",
  "ScrollBar",
];

export const SUPPORTED_EDIT_PROPS = [
  "Caption",
  "Visible",
  "ImageTexture",
  "ImageKeepAspect",
  "Colour",
  "TextColour",
  "Alpha",
  "TextAlign",
  "FontName",
];
