#!/usr/bin/env python3
"""Self-test for the PS5Links agent (Linux build; on Windows run it inside WSL).

    make -f Makefile.linux
    python3 test_agent.py                # or: python3 test_agent.py ./ps5links-agent-linux

Starts the agent on a private temp folder (AGENT_ROOT), checks auth, chunked upload + resume,
path / symlink protection, running an ELF, CORS and the PIN lock-out, then prints PASS/FAIL.
Needs only Python 3.8+. Port 18686 must be free; port 9021 is used for a fake ELF loader if free.
"""
import os, shutil, socket, subprocess, sys, tempfile, threading, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "ps5links-agent-linux")
PORT, SITE = 18686, "https://zazha093.github.io"
B = f"http://127.0.0.1:{PORT}"

root, outside = tempfile.mkdtemp(prefix="ps5agent-"), tempfile.mkdtemp(prefix="ps5out-")
os.makedirs(root + "/data/homebrew")
os.symlink(outside, root + "/data/link")                          # folder symlink that points outside
os.symlink(outside + "/dangling.txt", root + "/data/homebrew/dang")  # file symlink that points outside
proc = subprocess.Popen([BIN, str(PORT)], env=dict(os.environ, AGENT_ROOT=root),
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
results = []

def check(name, ok, extra=""):
    results.append(bool(ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"   [{extra}]" if extra and not ok else ""))

def call(method, path, body=None, pin="__PIN__", origin=None):
    h = {}
    if pin == "__PIN__": pin = PIN
    if pin is not None: h["X-Agent-Pin"] = pin
    if origin: h["Origin"] = origin
    req = urllib.request.Request(B + path, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=10) as x: return x.status, x.read(), {k.lower(): v for k, v in x.headers.items()}
    except urllib.error.HTTPError as e: return e.code, e.read(), {k.lower(): v for k, v in e.headers.items()}

try:
    for _ in range(50):                                            # wait until it listens and wrote its PIN
        try: socket.create_connection(("127.0.0.1", PORT), 0.2).close(); break
        except OSError: time.sleep(0.1)
    PIN = open(root + "/data/ps5links-agent/pin.txt").read().strip()

    # --- basics
    s, b, _ = call("GET", "/api/info", pin=None);  check("info without PIN says auth:false", s == 200 and b'"auth":false' in b)
    s, b, _ = call("GET", "/api/info");            check("info with PIN says auth:true", s == 200 and b'"auth":true' in b)
    s, _, _ = call("GET", "/api/ls?path=/data", pin=None); check("api without PIN -> 401", s == 401)

    # --- chunked upload + resume
    data = os.urandom(3 * 1024 * 1024 + 123)
    s, b, _ = call("PUT", "/api/upload?path=/data/homebrew/t.bin&offset=0", data[:1 << 20]); check("upload chunk 1", s == 200)
    s, b, _ = call("PUT", "/api/upload?path=/data/homebrew/t.bin&offset=999", data[1 << 20:2 << 20]); check("wrong offset -> 409 with current size", s == 409 and b'"size":1048576' in b)
    s, b, _ = call("PUT", f"/api/upload?path=/data/homebrew/t.bin&offset={1 << 20}", data[1 << 20:]); check("resume from reported size", s == 200)
    check("file is byte-identical", open(root + "/data/homebrew/t.bin", "rb").read() == data)
    s, b, _ = call("POST", "/api/mkdir?path=/data/homebrew/sub/deeper"); check("mkdir with parents", s == 200 and os.path.isdir(root + "/data/homebrew/sub/deeper"))
    s, b, _ = call("GET", "/api/ls?path=/data/homebrew"); check("ls lists files", s == 200 and b"t.bin" in b)

    # --- path text tricks
    for p in ["/data/../etc/x", "/data/%2e%2e/etc/x", "/data/homebrew/%2e%2e/%2e%2e/x", "/datafoo/x", "/data//x", "/etc/x", "/mnt/usb0/../../x", "/data/homebrew/a%5Cb"]:
        s, _, _ = call("PUT", "/api/upload?path=" + p + "&offset=0", b"x"); check("blocked path " + p, s == 403, s)

    # --- symlinks
    s, _, _ = call("PUT", "/api/upload?path=/data/link/pwned.txt&offset=0", b"escaped")
    check("folder symlink pointing outside is refused", s == 403 and not os.path.exists(outside + "/pwned.txt"), s)
    s, _, _ = call("GET", "/api/ls?path=/data/link"); check("listing through the symlink is refused", s == 403, s)
    s, _, _ = call("PUT", "/api/upload?path=/data/homebrew/dang&offset=0", b"escaped")
    check("file symlink pointing outside is not followed", s != 200 and not os.path.exists(outside + "/dangling.txt"), s)

    # --- run an ELF
    s, b, _ = call("POST", "/api/run?path=/data/homebrew/t.bin"); check("run refuses a non-ELF", s == 400)
    got = []
    try:
        srv = socket.socket(); srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); srv.bind(("127.0.0.1", 9021)); srv.listen(1)
        def loader():
            c, _ = srv.accept(); buf = b""
            while True:
                d = c.recv(65536)
                if not d: break
                buf += d
            got.append(buf)
        t = threading.Thread(target=loader, daemon=True); t.start()
        elf = b"\x7fELF" + os.urandom(5000)
        call("PUT", "/api/upload?path=/data/homebrew/x.elf&offset=0", elf)
        s, b, _ = call("POST", "/api/run?path=/data/homebrew/x.elf"); t.join(3)
        check("run sends the identical ELF to port 9021", s == 200 and got and got[0] == elf)
    except OSError:
        print("SKIP  run test (port 9021 is busy on this computer)")

    # --- CORS / origin
    s, _, h = call("GET", "/api/info", pin=None, origin=SITE);  check("site origin gets its own origin echoed", s == 200 and h.get("access-control-allow-origin") == SITE, h)
    s, _, h = call("GET", "/api/info", pin=None, origin="https://evil.example"); check("other website -> 403, no CORS header", s == 403 and "access-control-allow-origin" not in h, (s, h))
    s, _, h = call("GET", "/api/info", pin=None);               check("no Origin (curl, sim) -> works, no CORS header", s == 200 and "access-control-allow-origin" not in h)
    s, _, h = call("GET", "/api/info", pin=None, origin="http://localhost:8000"); check("local copy of the site is allowed", s == 200 and h.get("access-control-allow-origin") == "http://localhost:8000")
    s, _, h = call("OPTIONS", "/api/upload", pin=None, origin=SITE); check("preflight from the site: 204 + private-network header", s == 204 and h.get("access-control-allow-private-network") == "true" and h.get("access-control-allow-origin") == SITE, (s, h))
    s, _, h = call("OPTIONS", "/api/upload", pin=None, origin="https://evil.example"); check("preflight from another site -> 403", s == 403)

    # --- PIN lock-out (last: it locks 127.0.0.1 for a minute)
    codes = [call("GET", "/api/ls?path=/data", pin="000000")[0] for _ in range(5)]
    check("5 wrong PINs answer 401", codes == [401] * 5, codes)
    s, b, _ = call("GET", "/api/ls?path=/data", pin="000000"); check("6th wrong PIN -> 429 locked out", s == 429, s)
    s, b, _ = call("GET", "/api/ls?path=/data");               check("even the right PIN waits while locked", s == 429, s)
    s, b, _ = call("GET", "/api/info");                        check("info is locked too (not a PIN oracle)", s == 429, s)
finally:
    proc.terminate(); shutil.rmtree(root, ignore_errors=True); shutil.rmtree(outside, ignore_errors=True)

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
