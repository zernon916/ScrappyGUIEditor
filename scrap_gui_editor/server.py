#!/usr/bin/env python3
"""Local-only static server for Scrappy GUI Editor.

Why a backend exists:
The browser cannot list a folder by path or write a timestamped backup next
to an existing .layout file. This process binds to 127.0.0.1 only and never
talks to the network. There is no account, database, or telemetry.
"""

from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import sys
import threading
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8765
ALLOWED_READ = {".layout", ".xml", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".md"}
ALLOWED_TABS_SUFFIX = ".layout.tabs.json"
ALLOWED_GROUPS_SUFFIX = ".layout.groups.json"
ALLOWED_AUTOSAVE_MARK = ".layout.autosave."
ALLOWED_WRITE = {".layout", ".xml", ".png"}


def _is_autosave_name(name: str) -> bool:
    return ALLOWED_AUTOSAVE_MARK in (name or "").lower()


def _allowed_read_file(path: Path) -> bool:
    name = path.name.lower()
    if path.suffix.lower() in ALLOWED_READ:
        return True
    if name.endswith(ALLOWED_TABS_SUFFIX) or name.endswith(ALLOWED_GROUPS_SUFFIX):
        return True
    return _is_autosave_name(name)


def pick_folder(start: str = "", title: str = "Select folder") -> str:
    """Native Windows folder dialog. Runs in a child process so Tk has its own thread."""
    initial = start.strip().strip('"')
    if initial:
        p = Path(initial)
        if p.is_file():
            initial = str(p.parent)
        elif not p.is_dir():
            initial = str(p.parent) if p.parent.is_dir() else ""
    if not initial:
        testing = Path(r"C:\Coding Projects\Testing")
        initial = str(testing) if testing.is_dir() else str(Path.home())
    safe_title = title.replace("\\", " ").replace("'", "")
    script = (
        "import sys, tkinter as tk\n"
        "from tkinter import filedialog\n"
        "root = tk.Tk()\n"
        "root.withdraw()\n"
        "root.wm_attributes('-topmost', 1)\n"
        f"path = filedialog.askdirectory(title='{safe_title}', "
        "initialdir=sys.argv[1] if sys.argv[1] else None)\n"
        "print(path or '')\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", script, initial],
        capture_output=True,
        text=True,
        timeout=300,
        cwd=str(ROOT),
    )
    if result.returncode != 0 and not (result.stdout or "").strip():
        raise RuntimeError((result.stderr or "Folder dialog failed").strip()[:400])
    return (result.stdout or "").strip()


def pick_mod_folder(start: str = "") -> str:
    return pick_folder(start, "Select Scrap Mechanic mod folder (the folder that contains Gui)")


def _list_layouts(folder: Path):
    layouts = []
    if not folder.is_dir():
        return layouts
    for name in sorted(os.listdir(folder), key=str.lower):
        full = folder / name
        if full.is_file() and full.suffix.lower() == ".layout":
            layouts.append({"name": name, "path": str(full)})
    return layouts


def _find_dir(parent: Path, name: str):
    wanted = name.lower()
    if not parent.is_dir():
        return None
    for child in parent.iterdir():
        if child.is_dir() and child.name.lower() == wanted:
            return child
    return None


def _list_pngs(folder: Path):
    files = []
    for dirpath, dirnames, filenames in os.walk(folder):
        dirnames[:] = [d for d in dirnames if d.lower() != "maptiles"]
        for name in filenames:
            if Path(name).suffix.lower() != ".png":
                continue
            full = Path(dirpath) / name
            rel = full.relative_to(folder).as_posix()
            files.append({"name": name, "rel": rel, "path": str(full)})
            if len(files) >= 4000:
                return files
    return files


def _safe_path(raw: str) -> Path:
    if not raw:
        raise ValueError("Missing path")
    path = Path(raw)
    if not path.is_absolute():
        path = (ROOT / path).resolve()
    else:
        path = path.resolve()
    return path


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[local] " + (fmt % args) + "\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/pick-folder":
            self._pick_folder(parse_qs(parsed.query))
            return
        if parsed.path == "/api/pick-mod":
            self._pick_mod(parse_qs(parsed.query))
            return
        if parsed.path == "/api/mod":
            self._open_mod(parse_qs(parsed.query))
            return
        if parsed.path == "/api/layouts":
            self._list_layout_dir(parse_qs(parsed.query))
            return
        if parsed.path == "/api/list":
            self._list_dir(parse_qs(parsed.query))
            return
        if parsed.path == "/api/file":
            self._read_file(parse_qs(parsed.query))
            return
        if parsed.path == "/api/watch":
            self._watch(parse_qs(parsed.query))
            return
        if parsed.path == "/api/reveal":
            self._reveal(parse_qs(parsed.query))
            return
        if parsed.path == "/api/backups":
            self._backups(parse_qs(parsed.query))
            return
        if parsed.path == "/api/autosaves":
            self._autosaves(parse_qs(parsed.query))
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        if parsed.path == "/api/save":
            self._save(body)
            return
        if parsed.path == "/api/autosave":
            self._autosave(body)
            return
        self._json(404, {"ok": False, "error": "Unknown endpoint"})

    def _json(self, code: int, payload: dict):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _pick_folder(self, qs):
        start = (qs.get("start") or [""])[0].strip()
        title = (qs.get("title") or ["Select folder"])[0].strip() or "Select folder"
        try:
            chosen = pick_folder(start, title)
            if not chosen:
                self._json(200, {"ok": True, "cancelled": True, "path": None})
                return
            self._json(200, {"ok": True, "cancelled": False, "path": chosen})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _list_layout_dir(self, qs):
        try:
            folder = _safe_path((qs.get("path") or [""])[0])
            if not folder.is_dir():
                self._json(400, {"ok": False, "error": f"Not a folder: {folder}"})
                return
            self._json(200, {"ok": True, "path": str(folder), "layouts": _list_layouts(folder)})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _pick_mod(self, qs):
        start = (qs.get("start") or [""])[0].strip()
        try:
            chosen = pick_mod_folder(start)
            if not chosen:
                self._json(200, {"ok": True, "cancelled": True, "path": None})
                return
            self._json(200, {"ok": True, "cancelled": False, "path": chosen})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _open_mod(self, qs):
        try:
            mod = _safe_path((qs.get("path") or [""])[0])
            if not mod.is_dir():
                self._json(400, {"ok": False, "error": f"Not a folder: {mod}"})
                return
            gui = _find_dir(mod, "gui")
            menu = _find_dir(gui, "menu") if gui else None
            layouts_dir = _find_dir(menu, "layouts") if menu else None
            images_dir = None
            if menu:
                images_dir = _find_dir(menu, "images") or _find_dir(menu, "image")
            warnings = []
            if gui is None:
                warnings.append("No Gui folder in this mod. Use the Layouts folder and Images folder buttons.")
            elif menu is None:
                warnings.append("No Gui/Menu folder. Default is Gui/Menu/Layouts and Gui/Menu/Images. Use the folder buttons if yours is different.")
            else:
                if layouts_dir is None:
                    warnings.append("No Gui/Menu/Layouts folder. Use Layouts folder… to pick yours.")
                if images_dir is None:
                    warnings.append("No Gui/Menu/Images (or Image) folder. Use Images folder… to pick yours.")
            layouts = _list_layouts(layouts_dir) if layouts_dir else []
            images = _list_pngs(images_dir) if images_dir else []
            self._json(
                200,
                {
                    "ok": True,
                    "mod": str(mod),
                    "guiDir": str(gui) if gui else None,
                    "menuDir": str(menu) if menu else None,
                    "layoutsDir": str(layouts_dir) if layouts_dir else None,
                    "imagesDir": str(images_dir) if images_dir else None,
                    "layoutsFolderName": "Menu/Layouts",
                    "layouts": layouts,
                    "images": images,
                    "warnings": warnings,
                },
            )
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _list_dir(self, qs):
        try:
            folder = _safe_path((qs.get("path") or [""])[0])
            if not folder.is_dir():
                self._json(400, {"ok": False, "error": f"Not a folder: {folder}"})
                return
            files = []
            for dirpath, dirnames, filenames in os.walk(folder):
                dirnames[:] = [d for d in dirnames if d.lower() != "maptiles"]
                for name in filenames:
                    ext = Path(name).suffix.lower()
                    if ext != ".png":
                        continue
                    full = Path(dirpath) / name
                    rel = full.relative_to(folder).as_posix()
                    files.append({"name": name, "rel": rel, "path": str(full)})
                    if len(files) >= 4000:
                        break
                if len(files) >= 4000:
                    break
            self._json(200, {"ok": True, "files": files, "root": str(folder)})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _read_file(self, qs):
        try:
            path = _safe_path((qs.get("path") or [""])[0])
            if not _allowed_read_file(path):
                self._json(403, {"ok": False, "error": "File type not allowed"})
                return
            if not path.is_file():
                self._json(404, {"ok": False, "error": "File not found"})
                return
            data = path.read_bytes()
            mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _save(self, body: bytes):
        try:
            payload = json.loads(body.decode("utf-8"))
            path = _safe_path(payload.get("path") or "")
            content = payload.get("content")
            backup = bool(payload.get("backup"))
            if content is None:
                raise ValueError("Missing content")
            name = path.name.lower()
            groups_write = name.endswith(ALLOWED_GROUPS_SUFFIX)
            if path.suffix.lower() not in ALLOWED_WRITE and not groups_write:
                raise ValueError("Refusing to write this file type")
            backup_path = None
            if backup and path.exists() and not groups_write:
                stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                backup_path = path.with_name(path.stem + "." + stamp + ".bak" + path.suffix)
                backup_path.write_bytes(path.read_bytes())
            path.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(content, str):
                path.write_bytes(content.encode("utf-8"))
            else:
                path.write_bytes(content)
            self._json(200, {"ok": True, "path": str(path), "backup": str(backup_path) if backup_path else None})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _watch(self, qs):
        try:
            layout_raw = (qs.get("layout") or [""])[0].strip()
            images_raw = (qs.get("images") or [""])[0].strip()
            layout = None
            if layout_raw:
                p = _safe_path(layout_raw)
                if p.is_file():
                    st = p.stat()
                    layout = {"path": str(p), "exists": True, "mtime": st.st_mtime, "size": st.st_size}
                else:
                    layout = {"path": str(p), "exists": False, "mtime": 0, "size": 0}
            images = _images_stamp(_safe_path(images_raw) if images_raw else None)
            self._json(200, {"ok": True, "layout": layout, "images": images})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _reveal(self, qs):
        try:
            path = _safe_path((qs.get("path") or [""])[0])
            if not path.exists():
                self._json(404, {"ok": False, "error": "Path not found"})
                return
            if path.is_file() and path.suffix.lower() not in ALLOWED_READ:
                self._json(403, {"ok": False, "error": "File type not allowed"})
                return
            target = str(path.resolve())
            subprocess.Popen(['explorer', '/select,' + target])
            self._json(200, {"ok": True, "path": target})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _backups(self, qs):
        try:
            path = _safe_path((qs.get("path") or [""])[0])
            parent = path.parent if path.suffix else path
            if not parent.is_dir():
                self._json(400, {"ok": False, "error": "Folder not found"})
                return
            stem = path.stem if path.suffix else ""
            found = []
            for name in os.listdir(parent):
                lower = name.lower()
                if ".bak.layout" not in lower:
                    continue
                if stem and not lower.startswith(stem.lower() + "."):
                    continue
                full = parent / name
                if not full.is_file():
                    continue
                st = full.stat()
                found.append({"name": name, "path": str(full), "mtime": st.st_mtime, "size": st.st_size})
            found.sort(key=lambda x: x["mtime"], reverse=True)
            self._json(200, {"ok": True, "backups": found})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _autosaves(self, qs):
        try:
            path = _safe_path((qs.get("path") or [""])[0])
            parent = path.parent
            if not parent.is_dir():
                self._json(400, {"ok": False, "error": "Folder not found"})
                return
            prefix = path.name + ".autosave."
            found = []
            for name in os.listdir(parent):
                if not name.startswith(prefix):
                    continue
                full = parent / name
                if not full.is_file():
                    continue
                st = full.stat()
                found.append({"name": name, "path": str(full), "mtime": st.st_mtime, "size": st.st_size})
            found.sort(key=lambda x: x["mtime"], reverse=True)
            self._json(200, {"ok": True, "autosaves": found})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _autosave(self, body: bytes):
        try:
            payload = json.loads(body.decode("utf-8"))
            layout = _safe_path(payload.get("path") or "")
            content = payload.get("content")
            keep = int(payload.get("keep") or 4)
            keep = max(1, min(10, keep))
            if content is None:
                raise ValueError("Missing content")
            if layout.suffix.lower() != ".layout":
                raise ValueError("Autosave only next to a .layout file")
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            dest = layout.with_name(layout.name + ".autosave." + stamp)
            extra = 2
            while dest.exists():
                dest = layout.with_name(layout.name + ".autosave." + stamp + "-" + str(extra))
                extra += 1
            if isinstance(content, str):
                dest.write_bytes(content.encode("utf-8"))
            else:
                dest.write_bytes(content)
            prefix = layout.name + ".autosave."
            found = []
            for name in os.listdir(layout.parent):
                if name.startswith(prefix):
                    full = layout.parent / name
                    if full.is_file():
                        found.append(full)
            found.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            removed = []
            for old in found[keep:]:
                try:
                    old.unlink()
                    removed.append(old.name)
                except OSError:
                    pass
            self._json(200, {"ok": True, "path": str(dest), "pruned": removed})
        except Exception as exc:
            self._json(400, {"ok": False, "error": str(exc)})


def _images_stamp(folder):
    if folder is None or not folder.is_dir():
        return {"mtime": 0, "count": 0}
    latest = 0.0
    count = 0
    for dirpath, dirnames, filenames in os.walk(folder):
        dirnames[:] = [d for d in dirnames if d.lower() != "maptiles"]
        for name in filenames:
            if Path(name).suffix.lower() != ".png":
                continue
            full = Path(dirpath) / name
            try:
                st = full.stat()
            except OSError:
                continue
            if st.st_mtime > latest:
                latest = st.st_mtime
            count += 1
            if count >= 4000:
                return {"mtime": latest, "count": count}
    return {"mtime": latest, "count": count}


def main():
    port = PORT
    httpd = None
    last_err = None
    for candidate in range(PORT, PORT + 10):
        try:
            httpd = ThreadingHTTPServer((HOST, candidate), Handler)
            port = candidate
            break
        except OSError as exc:
            last_err = exc
    if httpd is None:
        raise SystemExit(f"Could not bind {HOST}:{PORT}: {last_err}")

    url = f"http://{HOST}:{port}/index.html"
    print("Scrappy GUI Editor", flush=True)
    print(f"Local only: {url}", flush=True)
    print("Stop with Ctrl+C", flush=True)
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
