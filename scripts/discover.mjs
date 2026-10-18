// Looks on GitHub for new / recently updated PS5 payload & homebrew repos and writes discover.json.
// Skips repos already in projects.json / offline.json / discover-ignore.json.
// Usage: node scripts/discover.mjs   (GITHUB_TOKEN recommended: search is limited to 10 req/min without it)
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const WINDOW_DAYS = Number(process.env.WINDOW_DAYS) || 30; // how far back "pushed" may be
const MAX_ITEMS = 300;
const MAX_LOOKUPS = Number(process.env.MAX_LOOKUPS) || 80; // release lookups per run
const token = process.env.GITHUB_TOKEN;
const headers = { Accept: "application/vnd.github+json", "User-Agent": "ps5-link-centralizer", ...(token && { Authorization: `Bearer ${token}` }) };
const pause = token ? 2200 : 6500;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readText = f => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
const clean = s => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();

// undefined = request failed (rate limit etc.), null = not found
async function gh(path) {
  try {
    const res = await fetch("https://api.github.com" + path, { headers });
    if (res.status === 404) return null;
    if (!res.ok) { console.warn(`GitHub ${res.status} for ${path}`); return undefined; }
    return await res.json();
  } catch (e) { console.warn("fetch failed:", path, e.message); return undefined; }
}

const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
const QUERIES = [
  "topic:ps5-payload", "topic:ps5-homebrew", "topic:ps5-jailbreak", "topic:ps5-exploit",
  "topic:ps5-payload-sdk", "topic:ps5-hen", "topic:etahen", "topic:ps5",
  "ps5 payload in:name,description", "ps5 homebrew in:name,description", "ps5 elf in:name,description",
  "ps5 jailbreak in:name,description", "prospero ps5 in:name,description", "ps5-payload-sdk in:readme",
].map(q => `${q} pushed:>=${since} fork:false archived:false`);
const RELEVANT = /ps5|prospero|playstation ?5|etahen|ps5-?payload/i;
// must look like homebrew / payload / tooling, not "PS5 news" or store pages
const HOMEBREW = /payload|homebrew|jailbreak|\belf\b|etahen|\bhen\b|exploit|kstuff|sdk|prospero|\bjb\b|\bpkg\b|\bplm\b|elfldr|\blua\b|ps5-?tools?|dump/i;
// SEO / scam-bait repos: a year plus a click-bait word ("... Guide 2026", "Free ... 2026"), or giveaway words
const BAIT_YEAR = /\b20[2-3]\d\b/, BAIT_WORD = /guide|best|top|studio|leaks?|leaderboards?|early|free|ultimate|fastest|no slow|unlocker/i;
const BAIT_ALONE = /\b(free|crack(ed)?|keygen|generator|giveaway)\b/i;
const isBait = t => BAIT_ALONE.test(t) || (BAIT_YEAR.test(t) && BAIT_WORD.test(t));
let baitCount = 0;

// ---- what we must not suggest again
const tracked = new Set();
for (const f of ["projects.json", "offline.json"]) {
  const t = readText(f);
  for (const m of t.matchAll(/github\.com\/([\w.-]+\/[\w.-]+)/g)) tracked.add(m[1].toLowerCase());
  for (const m of t.matchAll(/"repo"\s*:\s*"([^"]+)"/g)) tracked.add(m[1].toLowerCase());
}
const ignore = new Set(readJson("discover-ignore.json", []).map(s => String(s).toLowerCase()));
if (process.env.GITHUB_REPOSITORY) tracked.add(process.env.GITHUB_REPOSITORY.toLowerCase());
const skip = full => { const k = full.toLowerCase(); return tracked.has(k) || ignore.has(k) || ignore.has(k.split("/")[0] + "/*"); };

// ---- search
const found = new Map();
let okQueries = 0;
for (const q of QUERIES) {
  const r = await gh(`/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=100`);
  if (r === undefined) { await sleep(pause * 2); continue; }
  okQueries++;
  for (const x of r?.items || []) {
    if (x.fork || x.archived || x.disabled || x.private || !x.size || skip(x.full_name)) continue;
    const text = `${x.name} ${x.description || ""} ${(x.topics || []).join(" ")}`;
    if (!RELEVANT.test(text) || !HOMEBREW.test(text)) continue;
    if (isBait(`${x.name} ${x.description || ""}`)) { baitCount++; continue; }
    found.set(x.full_name, x);
  }
  await sleep(pause);
}
if (!okQueries) { console.error("Every search failed (rate limit?). Keeping the old discover.json."); process.exit(1); }

// ---- merge with the previous run (keeps first_seen and cached release info)
const old = readJson("discover.json", { items: [] });
const oldMap = new Map((old.items || []).map(i => [i.repo, i]));
const now = new Date().toISOString();
const items = [...found.values()].map(x => {
  const o = oldMap.get(x.full_name);
  const it = {
    repo: x.full_name,
    description: clean(x.description).slice(0, 220),
    stars: x.stargazers_count || 0,
    language: clean(x.language),
    topics: (x.topics || []).slice(0, 8).map(clean),
    license: x.license?.spdx_id && x.license.spdx_id !== "NOASSERTION" ? x.license.spdx_id : "",
    created: x.created_at,
    pushed: x.pushed_at,
    first_seen: o?.first_seen || now,
  };
  // lots of stars on a very new repo is usually bought: show it, but flagged
  if (it.stars >= 500 && Date.now() - Date.parse(it.created) < 90 * 864e5) it.warn = "stars";
  if (o && o.pushed === it.pushed && "release" in o) it.release = o.release;
  return it;
}).sort((a, b) => b.pushed.localeCompare(a.pushed)).slice(0, MAX_ITEMS);

// ---- latest release for the most recently pushed ones
let lookups = 0;
for (const it of items) {
  if ("release" in it) continue;
  if (lookups++ >= MAX_LOOKUPS) break;
  const rel = await gh(`/repos/${it.repo}/releases/latest`);
  if (rel === undefined) break;
  it.release = rel ? {
    tag: clean(rel.tag_name).slice(0, 60), date: rel.published_at, url: rel.html_url,
    assets: (rel.assets || []).map(a => clean(a.name).slice(0, 80)).slice(0, 12),
  } : null;
  await sleep(250);
}

// ---- write only when something changed
if (JSON.stringify(items) === JSON.stringify(old.items)) { console.log(`No changes. (${baitCount} click-bait repos skipped)`); process.exit(0); }
const out = `{"updated":${JSON.stringify(now)},"window_days":${WINDOW_DAYS},"items":[\n${items.map(i => JSON.stringify(i)).join(",\n")}\n]}\n`;
writeFileSync("discover.json", out);

const fresh = items.filter(i => !oldMap.has(i.repo));
const md = `### Discover: ${items.length} repos, ${fresh.length} new to the list\n` + fresh.slice(0, 30).map(i => `- [${i.repo}](https://github.com/${i.repo}) ★${i.stars} — ${i.description}`).join("\n") + "\n";
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
