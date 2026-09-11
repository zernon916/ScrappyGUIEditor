/**
 * Export / diff helpers. Serialization itself lives in layout-parser.js
 * so unchanged subtrees keep their original bytes.
 */

import { serializeDocument } from "./layout-parser.js";

export function exportLayoutXml(document) {
  return serializeDocument(document);
}

export function unifiedDiff(original, next, originalName = "original.layout", nextName = "edited.layout") {
  const a = String(original).replace(/\r\n/g, "\n").split("\n");
  const b = String(next).replace(/\r\n/g, "\n").split("\n");
  const lcs = computeLcs(a, b);
  const lines = [`--- ${originalName}`, `+++ ${nextName}`];
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < a.length || j < b.length) {
    if (k < lcs.length && i < a.length && a[i] === lcs[k] && j < b.length && b[j] === lcs[k]) {
      lines.push(" " + a[i]);
      i += 1;
      j += 1;
      k += 1;
    } else if (j < b.length && (k >= lcs.length || b[j] !== lcs[k])) {
      lines.push("+" + b[j]);
      j += 1;
    } else if (i < a.length && (k >= lcs.length || a[i] !== lcs[k])) {
      lines.push("-" + a[i]);
      i += 1;
    } else {
      break;
    }
  }
  const changed = lines.some((l) => l.startsWith("+") || l.startsWith("-"));
  return { text: lines.join("\n"), changed, originalLines: a.length, nextLines: b.length };
}

export function timestampStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    p(date.getMonth() + 1) +
    p(date.getDate()) +
    "-" +
    p(date.getHours()) +
    p(date.getMinutes()) +
    p(date.getSeconds())
  );
}

export function backupName(filePath) {
  const stamp = timestampStamp();
  if (filePath.toLowerCase().endsWith(".layout")) {
    return filePath.slice(0, -7) + "." + stamp + ".bak.layout";
  }
  return filePath + "." + stamp + ".bak";
}

function computeLcs(a, b) {
  const n = a.length;
  const m = b.length;
  if (n * m > 4000000) return greedyLcs(a, b);
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
    else j += 1;
  }
  return out;
}

function greedyLcs(a, b) {
  const set = new Map();
  for (let j = 0; j < b.length; j++) {
    if (!set.has(b[j])) set.set(b[j], []);
    set.get(b[j]).push(j);
  }
  const out = [];
  let last = -1;
  for (const line of a) {
    const idxs = set.get(line);
    if (!idxs) continue;
    const next = idxs.find((x) => x > last);
    if (next == null) continue;
    out.push(line);
    last = next;
  }
  return out;
}
