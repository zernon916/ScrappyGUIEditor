import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLayout, applyGeometry, serializeDocument } from "../js/layout-parser.js";
import { computeRects } from "../js/renderer.js";

const root = dirname(fileURLToPath(import.meta.url));
const samples = join(root, "..", "samples");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function roundtrip(name) {
  const src = readFileSync(join(samples, name), "utf8");
  const parsed = parseLayout(src);
  assert(parsed.ok, `${name} parse errors: ${parsed.errors.join("; ")}`);
  const out = serializeDocument(parsed.document);
  if (out !== src) {
    writeFileSync(join(root, name + ".got.xml"), out);
    const a = src.split("");
    const b = out.split("");
    let i = 0;
    while (i < a.length && a[i] === b[i]) i += 1;
    throw new Error(`${name} roundtrip mismatch at ${i}\nSRC: ${JSON.stringify(src.slice(i, i + 80))}\nOUT: ${JSON.stringify(out.slice(i, i + 80))}`);
  }
  return parsed;
}

function moveOne(name, widgetName) {
  const src = readFileSync(join(samples, name), "utf8");
  const parsed = parseLayout(src);
  const w = parsed.widgets.find((x) => x.name === widgetName);
  assert(w, `missing ${widgetName}`);
  const before = w.x;
  w.x += 0.01;
  applyGeometry(w);
  const out = serializeDocument(parsed.document);
  assert(out !== src, "expected a change");
  const srcLines = src.split("\n");
  const outLines = out.split("\n");
  assert(srcLines.length === outLines.length, "line count changed");
  let changed = 0;
  for (let i = 0; i < srcLines.length; i++) {
    if (srcLines[i] !== outLines[i]) changed += 1;
  }
  assert(changed === 1, `${name} move changed ${changed} lines, expected 1`);
  w.x = before;
  applyGeometry(w);
  const restored = serializeDocument(parsed.document);
  assert(restored === src, `${name} did not restore after move`);
}

const files = [
  "Rfs_HandheldHack.layout",
  "Rfs_Menu.layout",
  "Rfs_BotRename.layout",
  "Rfs_RechargeBox.layout",
  "Rfs_CraftStation_images.layout",
  "Rfs_CraftStation_pixels.layout",
];

for (const f of files) {
  const parsed = roundtrip(f);
  console.log("OK roundtrip", f, parsed.widgets.length, "widgets");
}

moveOne("Rfs_Menu.layout", "MainPanel");
moveOne("Rfs_HandheldHack.layout", "CloseButton");
console.log("OK single-widget move");

const parsed = parseLayout(readFileSync(join(samples, "Rfs_CraftStation_pixels.layout"), "utf8"));
const cell = parsed.widgets.find((w) => w.name === "Cell0");
assert(cell && cell.posSource === "property", "Cell0 should use Property Position/Size");
assert(cell.x === 16 && cell.w === 64, `Cell0 geom ${cell.x} ${cell.w}`);
const icon = parsed.widgets.find((w) => w.name === "Icon0");
assert(icon && icon.posSource === "position_size", "Icon0 should use position+size");
console.log("OK pixel/property geometry");

{
  const src = readFileSync(join(samples, "Rfs_Menu.layout"), "utf8");
  const parsed = parseLayout(src);
  const w = parsed.widgets.find((x) => x.name === "MainPanel");
  w.w = w.w * 0.5;
  w.h = w.h * 0.5;
  applyGeometry(w);
  const out = serializeDocument(parsed.document);
  const srcLines = src.split("\n");
  const outLines = out.split("\n");
  let changed = 0;
  let line = "";
  for (let i = 0; i < srcLines.length; i++) {
    if (srcLines[i] !== outLines[i]) {
      changed += 1;
      line = outLines[i];
    }
  }
  assert(changed === 1, `resize changed ${changed} lines`);
  assert(line.includes("position_real="), line);
  assert(!line.includes("Caption"), "resize must not touch caption");
  console.log("OK single-widget resize");
}

{
  const parsed = parseLayout(readFileSync(join(samples, "Rfs_Menu.layout"), "utf8"));
  const panel = parsed.widgets.find((x) => x.name === "MainPanel");
  const a = computeRects(parsed.roots, 1920, 1080, "viewport", 1920, 1080);
  const b = computeRects(parsed.roots, 1280, 720, "viewport", 1920, 1080);
  assert(panel.x === 0.28 && panel.w === 0.44, "native values changed after preview");
  const ra = a.rects.get(panel.id);
  const rb = b.rects.get(panel.id);
  assert(Math.abs(ra.w - 1920 * 0.44) < 0.001, "1920 width");
  assert(Math.abs(rb.w - 1280 * 0.44) < 0.001, "1280 width");
  console.log("OK preview resolution does not mutate stored values");
}

console.log("All tests passed.");
