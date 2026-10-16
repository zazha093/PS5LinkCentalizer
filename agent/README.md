# PS5Links Agent

A small payload that lets the [PS5 Links](https://zazha093.github.io/PS5LinkCentalizer/) site upload files into a folder on the console (for example `/data/homebrew`) and run an ELF from there.

## Use it

1. Run `ps5links-agent.elf` with your usual ELF loader (port 9021). On the site you can also use **PS5 → Run link** with the release URL.
2. The PS5 shows a notification: `PS5Links Agent 0.1.0 · 192.168.x.x:8686 · PIN 123456`.
3. On the site: **PS5 button → Upload to a folder**: type the PIN, tap **Pair**, choose the folder, choose files. `.zip` files are extracted by the phone while sending (tick the box).

The PIN is saved in `/data/ps5links-agent/pin.txt`. Delete that file to get a new PIN on the next start.

## API

| Request | What it does |
| --- | --- |
| `GET /api/info` | version, free space on /data, `auth: true` if the PIN header is right (no PIN needed) |
| `GET /api/ls?path=/data/homebrew` | list a folder |
| `POST /api/mkdir?path=...` | create a folder (and parents) |
| `PUT /api/upload?path=...&offset=N` | write the body at byte N. `offset=0` creates/truncates. Wrong offset → `409 {"size": current}` so the client can resume |
| `POST /api/run?path=...elf` | send that ELF to `127.0.0.1:9021` |

All calls except `/api/info` need the header `X-Agent-Pin`. Paths must be under `/data/`, `/mnt/usbN/` or `/mnt/extN/`; `..` is rejected. Answers carry CORS and `Access-Control-Allow-Private-Network` headers so Chrome's local network access works from the https site.

## Build

- GitHub: the **Build PS5Links Agent** workflow builds it on every change in `agent/`. Push a tag such as `agent-v0.1.0` to publish a release.
- Locally (Linux/WSL): install `clang lld llvm`, unzip the [ps5-payload-sdk](https://github.com/ps5-payload-dev/sdk/releases), then
  `export PS5_PAYLOAD_SDK=/path/to/ps5-payload-sdk && make`
- PC test build: `make -f Makefile.linux && AGENT_ROOT=/tmp/ps5 ./ps5links-agent-linux` (maps `/data/...` to `/tmp/ps5/data/...`).

## Security

- Anyone on your Wi-Fi who knows the PIN can write files under `/data` and start ELFs. Use it on a home network only, and stop it (reboot) when you are done.
- The connection is plain HTTP inside your network (no encryption), like FTP and websrv.
