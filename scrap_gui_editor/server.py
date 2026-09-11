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
ALLOWED_WRITE = {".layout", ".xml", ".png"}


def pick_mod_folder(start: str = "") -> str:
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
    script = (
        "import sys, tkinter as tk\n"
        "from tkinter import filedialog\n"
        "root = tk.Tk()\n"
        "root.withdraw()\n"
        "root.wm_attributes('-topmost', 1)\n"
        "path = filedialog.askdirectory("
        "title='Select Scrap Mechanic mod folder (the folder that contains Gui)', "
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
        if parsed.path == "/api/pick-mod":
            self._pick_mod(parse_qs(parsed.query))
            return
        if parsed.path == "/api/mod":
            self._open_mod(parse_qs(parsed.query))
            return
        if parsed.path == "/api/list":
            self._list_dir(parse_qs(parsed.query))
            return
        if parsed.path == "/api/file":
            self._read_file(parse_qs(parsed.query))
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        if parsed.path == "/api/save":
            self._save(body)
            return
        self._json(404, {"ok": False, "error": "Unknown endpoint"})

    def _json(self, code: int, payload: dict):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

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
            if gui is None:
                self._json(
                    400,
                    {
                        "ok": False,
                        "error": f"No Gui folder inside {mod}. Open the mod root (the folder that contains Gui).",
                    },
                )
                return
            layouts_dir = _find_dir(gui, "layouts")
            used = "Layouts"
            if layouts_dir is None:
                layouts_dir = _find_dir(gui, "layout")
                used = "Layout"
            if layouts_dir is None:
                self._json(
                    400,
                    {
                        "ok": False,
                        "error": f"No Gui/Layouts folder inside {mod}.",
                    },
                )
                return
            layouts = []
            for name in sorted(os.listdir(layouts_dir), key=str.lower):
                full = layouts_dir / name
                if full.is_file() and full.suffix.lower() == ".layout":
                    layouts.append({"name": name, "path": str(full)})
            images = _list_pngs(gui)
            self._json(
                200,
                {
                    "ok": True,
                    "mod": str(mod),
                    "guiDir": str(gui),
                    "layoutsDir": str(layouts_dir),
                    "layoutsFolderName": used,
                    "layouts": layouts,
                    "images": images,
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
            if path.suffix.lower() not in ALLOWED_READ:
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
            if path.suffix.lower() not in ALLOWED_WRITE:
                raise ValueError("Refusing to write this file type")
            backup_path = None
            if backup and path.exists():
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
