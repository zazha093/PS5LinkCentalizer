// Reads projects.json, fetches repo info + latest stable/pre-release from GitHub, writes data.json.
// v4: also stores language, topics, license, forks, issues, homepage, default branch,
//     download counts, asset counts and a short release-notes preview (no extra API calls).
// v7: lists the .elf/.bin files of each release (with SHA-256 from GitHub) and writes
//     payloads.json, a catalog that PS5 Payload Manager can add as a custom source.
// Repos that return 404 are moved from projects.json to offline.json (shown on offline.html).
// Usage: node scripts/update.mjs   (set GITHUB_TOKEN to avoid the 60 req/h anonymous limit)
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const headers = { Accept: "application/vnd.github+json", "User-Agent": "ps5-link-centralizer" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Authors often publish betas/nightlies without ticking "pre-release", so also look at the tag name.
// ponytail: name heuristic, add a per-project override in projects.json if it misfires
const PRE = /alpha|beta|(?<![a-z])(rc|pre|dev|test)|nightly|canary|experimental|-[0-9a-f]{7,}$/i;
const byVersionDesc = new Intl.Collator("en", { numeric: true }).compare;

// Plain-text preview of release notes for the "Latest" view (Markdown/HTML stripped, ~280 chars)
function excerpt(md = "", max = 280) {
  const t = md
    .replace(/```[\s\S]*?```/g, " ")            // code blocks
    .replace(/<[^>]+>/g, " ")                     // HTML tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")         // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")       // links -> text
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, list markers
    .replace(/[*_`~]+/g, "")                      // emphasis
    .replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}
// Notes often start by repeating the release title — drop it so the preview isn't redundant
function dropLead(text, heads) {
  for (const h of heads) if (h && text.toLowerCase().startsWith(h.toLowerCase())) return text.slice(h.length).replace(/^[\s:–—-]+/, "");
  return text;
}
// Payload files attached to a release (.elf / .bin), with the SHA-256 GitHub computes for each asset
const PAYLOAD_EXT = /\.(elf|bin)$/i;
const payloadFiles = r => (r.assets ?? [])
  .filter(a => PAYLOAD_EXT.test(a.name) && (a.state ?? "uploaded") === "uploaded")
  .filter(a => !/ps4/i.test(a.name) || /ps5/i.test(a.name)) // PS4-only builds would fail (or worse) on a PS5
  .slice(0, 8)
  .map(a => ({
    name: a.name,
    url: a.browser_download_url,
    size: a.size ?? 0,
    sha256: /^sha256:[0-9a-f]{64}$/i.test(a.digest ?? "") ? a.digest.slice(7).toLowerCase() : "",
  }));
// Installable archives (.zip) a release carries — what "Install homebrew" downloads and
// extracts in the browser before sending each file to /data/homebrew (see ps5.js).
const ZIP_EXT = /\.zip$/i;
const zipFiles = r => (r.assets ?? [])
  .filter(a => ZIP_EXT.test(a.name) && (a.state ?? "uploaded") === "uploaded")
  .slice(0, 6)
  .map(a => ({
    name: a.name,
    url: a.browser_download_url,
    size: a.size ?? 0,
    sha256: /^sha256:[0-9a-f]{64}$/i.test(a.digest ?? "") ? a.digest.slice(7).toLowerCase() : "",
  }));
const sumDownloads = r => (r.assets ?? []).reduce((n, a) => n + (a.download_count ?? 0), 0);

function fromReleases(releases) {
  let stable = null, pre = null;
  for (const r of releases) {
    if (r.draft) continue;
    const v = {
      tag: r.tag_name, url: r.html_url, date: (r.published_at ?? "").slice(0, 10),
      title: r.name && r.name !== r.tag_name ? r.name : "",
      assets: r.assets?.length ?? 0,
      downloads: sumDownloads(r),
      notes: dropLead(excerpt(r.body ?? ""), [r.name, r.tag_name]),
      files: payloadFiles(r),
      zips: zipFiles(r),
    };
    if (r.prerelease || PRE.test(r.tag_name)) pre ??= v;
    else stable ??= v;
  }
  // only show a pre-release that is newer than the stable one
  if (stable && pre && pre.date < stable.date) pre = null;
  return { stable, pre };
}

// No releases: read tags straight from git (no API quota). Tags carry no date here.
function fromTags(htmlUrl) {
  const out = execFileSync("git", ["ls-remote", "--tags", "--refs", `${htmlUrl}.git`], { encoding: "utf8" });
  const tags = out.split("\n").map(l => l.split("refs/tags/")[1]).filter(t => t && /\d/.test(t));
  tags.sort((a, b) => byVersionDesc(b, a));
  const v = t => t && { tag: t, url: `${htmlUrl}/releases/tag/${encodeURIComponent(t)}`, date: "" };
  const stable = v(tags.find(t => !PRE.test(t)));
  const pre = v(tags.find(t => PRE.test(t)));
  return { stable, pre: pre && (!stable || byVersionDesc(pre.tag, stable.tag) > 0) ? pre : null };
}

const readJson = async (f, fallback) => existsSync(f) ? JSON.parse(await readFile(f, "utf8")) : fallback;
const projects = await readJson("projects.json");
const previous = await readJson("data.json", []);
let offline = await readJson("offline.json", []);
const key = r => r.toLowerCase();
const out = [];
const dead = [];

// Offline repos that are reachable again go back to projects.json (and are processed below)
const revived = [];
for (const o of offline) {
  if (projects.some(p => key(p.repo) === key(o.repo))) continue; // re-added by hand
  if (!(await gh(`/repos/${o.repo}`))) continue;
  console.log(`back online: ${o.repo}`);
  revived.push(o.repo);
  projects.push({ repo: o.repo, ...(o.category && { category: o.category }) });
}

for (const p of projects) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(p.repo ?? "")) throw new Error(`invalid repo: ${JSON.stringify(p)}`);
  const repo = await gh(`/repos/${p.repo}`);
  if (!repo) { console.warn(`dead (404): ${p.repo}`); dead.push(p.repo); continue; }
  const releases = await gh(`/repos/${p.repo}/releases?per_page=30`);
  const { stable, pre } = releases?.length ? fromReleases(releases) : fromTags(repo.html_url);
  // Downloads across the fetched releases (up to 30 newest)
  const downloads = (releases ?? []).filter(r => !r.draft).reduce((n, r) => n + sumDownloads(r), 0);
  out.push({
    name: p.name ?? repo.name,
    url: repo.html_url,
    description: p.description ?? repo.description ?? "",
    category: p.category ?? "",
    stable,
    pre,
    updated: repo.pushed_at.slice(0, 10),
    stars: repo.stargazers_count,
    archived: repo.archived,
    // Extra fields (added in v4; the site works without them)
    language: repo.language ?? "",
    topics: (repo.topics ?? []).slice(0, 6),
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : "",
    forks: repo.forks_count ?? 0,
    issues: repo.open_issues_count ?? 0,
    homepage: /^https:\/\//i.test(repo.homepage ?? "") ? repo.homepage : "",
    branch: repo.default_branch ?? "",
    downloads,
    // Optional per-project install hints (projects.json "install"): a subfolder under
    // /data/homebrew ("dir") and a name fragment to pick one of several release zips ("zip").
    install: (p.install && typeof p.install === "object") ? { dir: String(p.install.dir ?? ""), zip: String(p.install.zip ?? "") } : null,
  });
  console.log(`${p.repo} -> ${stable?.tag ?? "-"} | ${pre?.tag ?? "-"}`);
}

await writeFile("data.json", JSON.stringify(out, null, 2) + "\n");

// ---- payloads.json: catalog for PS5 Payload Manager (Settings → Sources → add URL) ----
// Format: https://github.com/itsPLK/ps5-payload-manager/blob/main/CUSTOM_REPOSITORIES.md
// The PS5 downloads the files straight from GitHub; the SHA-256 lets it verify each download.
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "payload";
// "ftpsrv-ps5_v0.21.elf" -> "ftpsrv-ps5" (drop extension and version-looking tails)
const fileBase = f => f.replace(PAYLOAD_EXT, "").replace(/[-_. ]?v?\d+(?:[._]\d+)+[\w.-]*$/i, "").replace(/[-_. ]+$/, "") || f;
const utf8Cut = (str, bytes) => { // Payload Manager keeps release notes up to 2047 UTF-8 bytes
  const b = Buffer.from(str, "utf8"); if (b.length <= bytes) return str;
  return b.subarray(0, bytes - 3).toString("utf8").replace(/\uFFFD+$/, "") + "…";
};
const catalog = [];
for (const p of out) {
  const owner = p.url.split("/")[3], repoName = p.url.split("/")[4];
  for (const [rel, beta] of [[p.stable, false], [p.pre, true]]) {
    if (!rel?.files?.length) continue;
    for (const f of rel.files) {
      const many = rel.files.length > 1;
      const id = slug(many ? `${repoName}-${fileBase(f.name)}` : repoName) + (beta ? "-beta" : "");
      if (catalog.some(c => c.id === id)) continue;
      catalog.push({
        id,
        name: (many ? `${p.name} · ${fileBase(f.name)}` : p.name) + (beta ? " (beta)" : ""),
        filename: f.name,
        url: f.url,
        version: rel.tag,
        ...(rel.date && { last_update: rel.date }),
        description: p.description || "",
        category: p.category || "Other",
        ...(f.sha256 && { checksum: f.sha256 }),
        author: owner,
        source: `${p.url}/releases`,
        ...(p.branch && { details_url: `https://raw.githubusercontent.com/${owner}/${repoName}/${p.branch}/README.md` }),
        ...(rel.notes && { release_notes: utf8Cut(rel.notes, 2047) }),
      });
    }
  }
}
catalog.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
await writeFile("payloads.json", JSON.stringify({ name: "PS5 Links", payloads: catalog }, null, 2) + "\n");
console.log(`payloads.json: ${catalog.length} payload files`);

// A repo listed again in projects.json and alive is no longer offline
const alive = new Set(projects.filter(p => !dead.includes(p.repo)).map(p => key(p.repo)));
offline = offline.filter(o => !alive.has(key(o.repo)));

if (dead.length) {
  const today = new Date().toISOString().slice(0, 10);
  for (const r of dead) {
    const p = projects.find(p => p.repo === r);
    const last = previous.find(d => key(d.url) === key(`https://github.com/${r}`)) ?? {};
    offline.push({
      repo: r,
      name: p.name ?? last.name ?? r.split("/")[1],
      description: p.description ?? last.description ?? "",
      category: p.category ?? last.category ?? "",
      lastVersion: (last.stable ?? last.pre)?.tag ?? "",
      offlineSince: today,
    });
  }
}
if (dead.length || revived.length) {
  // One entry per line, same layout as the hand-edited file
  const kept = projects.filter(p => !dead.includes(p.repo));
  const w = Math.max(...kept.map(p => p.repo.length));
  const line = p => {
    const rest = Object.entries(p).filter(([k]) => k !== "repo").map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return `  { "repo": ${JSON.stringify(p.repo)}` + (rest.length ? `,${" ".repeat(w - p.repo.length)} ${rest.join(", ")}` : "") + " }";
  };
  await writeFile("projects.json", "[\n" + kept.map(line).join(",\n") + "\n]\n");
}
await writeFile("offline.json", JSON.stringify(offline, null, 2) + "\n");
