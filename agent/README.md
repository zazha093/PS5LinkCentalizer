# PS5Links Agent

A small payload that lets the [PS5 Links](https://zazha093.github.io/PS5LinkCentalizer/) site upload files into a folder on the console (for example `/data/homebrew`) and run an ELF from there.

## Use it

1. Run `ps5links-agent.elf` with your usual ELF loader (port 9021). On the site you can also use **PS5 → Run link** with the release URL.
2. The PS5 shows a notification: `PS5Links Agent 0.2.0 · 192.168.x.x:8686 · PIN 123456`.
3. On the site: **PS5 button → Upload to a folder**: type the PIN, tap **Pair**, choose the folder, choose files. `.zip` files are extracted by the phone while sending (tick the box).

The PIN is saved in `/data/ps5links-agent/pin.txt`. Delete that file to get a new PIN on the next start.

## API

| Request | What it does |
| --- | --- |
| `GET /api/info` | version, free space on /data, `auth: true` if the PIN header is right (no PIN needed) |
| `GET /api/ls?path=/data/homebrew` | list a folder |
| `POST /api/mkdir?path=...` | create a folder (and parents) |
| `PUT /api/upload?path=...&offset=N` | write the body at byte N. `offset=0` creates/truncates. Wrong offset → `409 {"size": current}` so the client can resume |
| `POST /api/run?path=...elf&port=9021` | send that ELF to the ELF loader (port 9021 or 9020) |
| `POST /api/run-direct?port=9021&name=...` | stream an uploaded ELF directly to the ELF loader (port 9021 or 9020) without saving to disk |
| `POST /api/rm?path=/data/homebrew/App&recursive=1` | delete a file, or a folder with everything inside it. A top folder (`/data`, `/mnt/usb0`, …) and the folders `/data/homebrew` and `/data/ps5links-agent` themselves are never deleted (`403`), but what is inside them can be; a folder needs `recursive=1` |

All calls except `/api/info` need the header `X-Agent-Pin`. Paths for file operations must be under `/data/`, `/mnt/usbN/` or `/mnt/extN/`; `..` is rejected. Answers carry CORS and `Access-Control-Allow-Private-Network` headers so Chrome's local network access works from the https site.

## Build

- GitHub: the **Build PS5Links Agent** workflow builds it on every change in `agent/`. Push a tag such as `agent-v0.1.0` to publish a release.
- Locally (Linux/WSL): install `clang lld llvm`, unzip the [ps5-payload-sdk](https://github.com/ps5-payload-dev/sdk/releases), then
  `export PS5_PAYLOAD_SDK=/path/to/ps5-payload-sdk && make`
- PC test build: `make -f Makefile.linux && AGENT_ROOT=/tmp/ps5 ./ps5links-agent-linux` (maps `/data/...` to `/tmp/ps5/data/...`).

## Security

- **PIN lock-out:** 5 wrong PINs in a row lock that address out for 60 s (HTTP 429), so guessing the 6 digits is no longer practical. The PIN is compared in constant time.
- **Only the site may talk to it:** requests from a web page must come from `https://zazha093.github.io` (or `http://localhost` / `http://127.0.0.1` for a local copy); others get 403 and no CORS headers. To allow another address, put it on its own line in `/data/ps5links-agent/origins.txt`.
- **Symlinks:** the target folder is resolved on disk and must stay inside `/data`, `/mnt/usbN` or `/mnt/extN`; the last part of a path is opened with `O_NOFOLLOW`.
- **Deleting:** `POST /api/rm` refuses a top folder, is recursive only when `recursive=1` is passed, and unlinks symlinks instead of following them. The site asks you to type the folder name before it calls this.
- At most 24 connections at once.

- Anyone on your Wi-Fi who knows the PIN can write files under `/data` and start ELFs. Use it on a home network only, and stop it (reboot) when you are done.
- The connection is plain HTTP inside your network (no encryption), like FTP and websrv.
