# PS5 Links

Link hub for the PS5 jailbreak scene.

## Add a project

1. Edit [`projects.json`](projects.json) (you can do it right on GitHub with the ✏️ button).
2. Add a line:
   ```json
   { "repo": "owner/repository", "category": "Payload" }
   ```
   Optional fields: `name` and `description` (override the GitHub ones), `category`.
3. Open a Pull Request. A bot checks it (valid JSON, `owner/name` format, known fields, duplicates, repo exists) and replies in a comment with what to fix; the comment updates on every push.

Don't edit `data.json`, `offline.json` or `payloads.json`, they are generated automatically.

You can also open an issue titled `Add project: owner/name` with the lines `repo: owner/name`, `category: Payload` and, optionally, `name: Display name`.

## How it works

- `.github/workflows/update.yml` runs every 3h (and when `projects.json` changes), fetches the latest stable version and the latest beta/pre-release (if newer) of each repo, and commits `data.json`.
- Pre-release = flagged as such on GitHub **or** tag containing `alpha`, `beta`, `rc`, `nightly`, `dev`, `pre`, `test`, `experimental`, or a trailing commit hash.
- Repos without releases: uses tags (`git ls-remote`), sorted by version.
- Dead repos (404): the PR check flags them. On the scheduled run they are moved from `projects.json` to `offline.json`, keeping their last known info, and listed on `offline.html`. Every run also re-checks `offline.json`: a repo that is reachable again goes back to `projects.json` with its category.
- For each release the script also stores the `.elf`/`.bin` files (`files`: name, url, size, SHA-256 from GitHub) and writes [`payloads.json`](payloads.json), a catalog for [PS5 Payload Manager](https://github.com/itsPLK/ps5-payload-manager) (add `https://zazha093.github.io/PS5LinkCentalizer/payloads.json` as a custom source). PS4-only builds are skipped.
- Local: `node scripts/update.mjs` (Node 22+). Set `GITHUB_TOKEN` to avoid the 60 req/h limit.

## PS5 Remote (beta)

The console button in the header opens **Connect to PS5**. It talks to [websrv](https://github.com/ps5-payload-dev/websrv) running on the console (port 8080):

| Action | Request |
| --- | --- |
| Test connection | `GET /version` |
| Run a release `.elf` (the PS5 downloads it from GitHub) | `GET /elfldr?elf=<https url>` |
| Run an `.elf` already on the PS5 (folder browser) | `GET /elfldr?elf=/data/...` |
| Send an `.elf` from the phone/PC | `POST /elfldr` (multipart field `elf`) |
| Browse folders | `GET /fs/<path>/?fmt=json` |

- Works in Chrome/Edge 142+ (desktop and Android). The browser asks once for permission to access devices on your local network. Safari on iPhone/iPad blocks it; use the "Open pages on the PS5" links instead.
- Only home-network addresses (192.168.x.x, 10.x.x.x, 172.16–31.x.x, 127.x, *.local) are accepted, and every run asks for confirmation.
- Uploading files into a chosen folder: run [PS5Links Agent](agent/README.md) (port 8686, PIN pairing). `.zip` files can be extracted by the phone while sending.
- No console nearby? `python tools/ps5-sim.py` on a PC pretends to be websrv + the agent, so you can test the whole flow from a phone.
- websrv has no password: anyone on the same network can run code on the console while it is loaded.

## Disclaimer

PS5LinkCentalizer is only a link index. Its sole purpose is to make PS5 scene projects easier to find by gathering them in one place.

- The maintainers of this repository are **not affiliated** with, and do not develop, endorse, host, or distribute, any of the listed projects. All projects belong to their respective authors.
- Listed projects are provided by third parties **as is**. We make no guarantees about their safety, legality, or fitness for any purpose, and we are **not responsible** for any damage, data loss, banned accounts, bricked consoles, or other consequences of using them.
- Using homebrew or jailbreak software may violate the terms of service of your console or account and the laws of your jurisdiction. You use any listed project entirely at your own risk.
- If you are the author of a listed project and want it removed, open an issue.

## AI usage

This hub was built with the help of AI (Claude Code). I used it to speed up production and because I'm not very familiar with GitHub Actions and the GitHub API. All code was reviewed and is maintained by me; issues and PRs with improvements are welcome.

## License

[MIT](LICENSE)
