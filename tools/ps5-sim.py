#!/usr/bin/env python3
"""PS5 simulator for testing the PS5 Links site without a console (Windows / Linux / macOS).

Pretends to be, on this computer:
  - websrv            on port 8080  (/version, /elfldr, /fs/...?fmt=json)
  - PS5Links Agent    on port 8686  (/api/info, /api/ls, /api/mkdir, /api/upload, /api/run)
Files go into ./ps5-sim-root/data/... next to where you start it. Nothing is executed:
"run" requests are only printed.

Usage:   python ps5-sim.py            (needs Python 3.8+, no extra packages)
Then on the phone (same Wi-Fi): open the PS5 Links site → PS5 button →
IP = this computer's IP (shown below), websrv port 8080, Agent port 8686, PIN shown below.
Windows: allow Python through the firewall for *private* networks when asked.
"""
import json, os, random, socket, sys, threading, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath("ps5-sim-root")
PIN = "%06d" % random.randint(0, 999999)
os.makedirs(os.path.join(ROOT, "data", "homebrew"), exist_ok=True)


def real(p):
    """Map a PS5 path (/data/...) into ROOT, refusing anything that escapes it."""
    full = os.path.abspath(os.path.join(ROOT, p.lstrip("/")))
    if not full.startswith(ROOT):
        raise PermissionError(p)
    return full


def path_ok(p):
    parts = p.split("/")
    return (p.startswith("/data") or p.startswith("/mnt/usb") or p.startswith("/mnt/ext")) \
        and ".." not in parts and "." not in parts[1:] and "\\" not in p and len(p) < 1024


class Base(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"[{self.server.server_port}] {self.command} {urllib.parse.unquote(self.path)}")

    def send(self, code, obj=None, ctype="application/json"):
        body = b"" if obj is None else (obj if isinstance(obj, bytes) else json.dumps(obj).encode())
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Agent-Pin")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def do_OPTIONS(self):
        self.send(204)

    def q(self):
        u = urllib.parse.urlsplit(self.path)
        return u.path, dict(urllib.parse.parse_qsl(u.query))


class Websrv(Base):
    """The subset of websrv used by the site."""

    def do_GET(self):
        path, q = self.q()
        if path == "/version":
            return self.send(200, {"tag": "sim"})
        if path == "/elfldr" and "elf" in q:
            print(f"   -> would run on the PS5: {q['elf']}")
            return self.send(200, b"", "text/plain")
        if path.startswith("/fs/") and q.get("fmt") == "json":
            try:
                d = real(urllib.parse.unquote(path[3:]))
                out = [{"name": ".", "mode": "d"}]
                for n in sorted(os.listdir(d)):
                    st = os.stat(os.path.join(d, n))
                    out.append({"name": n, "mode": "d" if os.path.isdir(os.path.join(d, n)) else "-",
                                "size": st.st_size, "mtime": int(st.st_mtime)})
                return self.send(200, out)
            except (OSError, PermissionError):
                return self.send(404, {"error": "not found"})
        self.send(200, b"websrv simulator\n", "text/plain")

    def do_POST(self):
        path, _ = self.q()
        data = self.body()
        if path == "/elfldr":
            print(f"   -> would run an uploaded ELF ({len(data)} bytes, multipart)")
            return self.send(200, b"", "text/plain")
        self.send(404, {"error": "unknown"})


class Agent(Base):
    """Same API as agent/agent.c."""

    def guard(self):
        path, q = self.q()
        if self.headers.get("X-Agent-Pin") != PIN:
            self.send(401, {"error": "wrong or missing PIN"}); return None
        p = q.get("path", "").rstrip("/")
        if not path_ok(p):
            self.send(403, {"error": "path must be under /data/, /mnt/usbN/ or /mnt/extN/ without .."}); return None
        return path, q, p

    def do_GET(self):
        path, q = self.q()
        if path == "/api/info":
            return self.send(200, {"name": "PS5Links Agent", "version": "sim", "elfldr": 9021,
                                   "auth": self.headers.get("X-Agent-Pin") == PIN, "free": 100 * 1024 ** 3})
        if path == "/":
            return self.send(200, b"PS5Links Agent simulator\n", "text/plain")
        g = self.guard()
        if not g: return
        _, _, p = g
        if path == "/api/ls":
            try:
                d = real(p)
                return self.send(200, [{"name": n, "dir": os.path.isdir(os.path.join(d, n)),
                                        "size": os.path.getsize(os.path.join(d, n)),
                                        "mtime": int(os.path.getmtime(os.path.join(d, n)))} for n in sorted(os.listdir(d))])
            except OSError as e:
                return self.send(404, {"error": str(e)})
        self.send(404, {"error": "unknown endpoint"})

    def do_POST(self):
        g = self.guard()
        if not g: return
        path, _, p = g
        self.body()
        if path == "/api/mkdir":
            os.makedirs(real(p), exist_ok=True)
            return self.send(200, {"ok": True})
        if path == "/api/run":
            try:
                with open(real(p), "rb") as f:
                    if f.read(4) != b"\x7fELF":
                        return self.send(400, {"error": "not an ELF file"})
            except OSError as e:
                return self.send(404, {"error": str(e)})
            print(f"   -> would send {p} to the ELF loader (port 9021)")
            return self.send(200, {"ok": True})
        self.send(404, {"error": "unknown endpoint"})

    def do_PUT(self):
        g = self.guard()
        if not g: return
        path, q, p = g
        if path != "/api/upload":
            self.body(); return self.send(404, {"error": "unknown endpoint"})
        offset = int(q.get("offset", "0") or 0)
        data = self.body()
        f = real(p)
        os.makedirs(os.path.dirname(f), exist_ok=True)
        size = os.path.getsize(f) if os.path.exists(f) else 0
        if offset and size != offset:
            return self.send(409, {"error": "offset mismatch", "size": size})
        with open(f, "r+b" if offset else "wb") as out:
            out.seek(offset)
            out.write(data)
        self.send(200, {"ok": True, "size": os.path.getsize(f)})


def my_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.168.1.1", 9))  # no packet is sent; just picks the LAN interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    servers = [ThreadingHTTPServer(("0.0.0.0", 8080), Websrv), ThreadingHTTPServer(("0.0.0.0", 8686), Agent)]
    for s in servers[1:]:
        threading.Thread(target=s.serve_forever, daemon=True).start()
    print("PS5 simulator running")
    print(f"  IP:   {my_ip()}   websrv port 8080   agent port 8686")
    print(f"  PIN:  {PIN}")
    print(f"  Files: {ROOT}")
    print("Ctrl+C to stop")
    try:
        servers[0].serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
