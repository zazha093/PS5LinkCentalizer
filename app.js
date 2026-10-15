/* =========================================================
   PS5 Links — app.js
   - Loads data.json (made by the bot) and draws the cards
   - "My list", pins, seen releases, theme and filters are saved
     in localStorage under "ps5l." (same keys as before)
   - Any text from data.json or GitHub is escaped with esc()
     before it goes into innerHTML, and links must be https://
   ========================================================= */
"use strict";

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const safeUrl = u => (/^https:\/\//i.test(u || "") ? u : "#"); // blocks javascript:, data: etc.
const cmp = new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare;
const REPO = "zazha093/PS5LinkCentalizer"; // where "Submit to the shared list" opens an issue

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("ps5l." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ps5l." + k, JSON.stringify(v)); } catch {} },
};

const ICON = {
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

/* ---------- category colours (unknown categories get a stable colour from their name) ---------- */
const CAT_COLORS = {
  "HEN": "#f472b6", "HEN (Unofficial)": "#fb7185", "Exploit": "#ef4444", "Payload": "#f97316",
  "Homebrew": "#22c55e", "Emulator": "#a78bfa", "PC Tool": "#38bdf8", "Network": "#2dd4bf",
  "Media": "#eab308", "Dev": "#94a3b8", "Customization": "#e879f9", "Cheats": "#fb923c", "Other": "#8793b5",
};
const catColor = c => {
  if (CAT_COLORS[c]) return CAT_COLORS[c];
  let h = 0;
  for (const ch of String(c)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 58%)`;
};

/* ---------- project helpers ---------- */
const owner = p => (p.url || "").split("/")[3] || "";
const key = p => (p.url || "").toLowerCase();
const latest = p => [p.stable, p.pre].filter(Boolean).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
const relKey = p => { const l = latest(p); return l ? `${l.tag}|${l.date}` : ""; };
// Date used for sorting; falls back to "updated" when a release has no date (e.g. pegasus-dl)
const relDate = p => { const l = latest(p); return l ? l.date || p.updated || "" : ""; };
const isDate = d => !!d && !isNaN(new Date(d));
const days = d => (Date.now() - new Date(d)) / 864e5;
const isFresh = p => { const l = latest(p); return !!l && isDate(l.date) && days(l.date) <= 7; };

// "3 days ago" for date-only strings like 2026-10-15
const ago = d => {
  if (!isDate(d)) return "date unknown"; // fixes the old "NaN years ago"
  const n = Math.floor(days(d));
  return n <= 0 ? "today" : n === 1 ? "yesterday" : n < 14 ? `${n} days ago`
    : n < 60 ? `${Math.floor(n / 7)} weeks ago` : n < 730 ? `${Math.floor(n / 30)} months ago`
    : `${Math.floor(n / 365)} years ago`;
};
// "2 h ago" for real timestamps (when data.json was last published)
const agoTime = t => {
  const m = Math.round((Date.now() - t) / 6e4);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : ago(t);
};

const SORTS = {
  name: (a, b) => cmp(a.name, b.name),
  stars: (a, b) => (b.stars ?? 0) - (a.stars ?? 0) || cmp(a.name, b.name),
  updated: (a, b) => (b.updated || "").localeCompare(a.updated || "") || cmp(a.name, b.name),
  category: (a, b) => cmp(a.category || "", b.category || "") || cmp(a.name, b.name),
};

/* ---------- state ---------- */
let data = [], mine = store.get("mine", []), pins = store.get("pins", []), seen = store.get("seen", {});
let theme = store.get("theme", "auto");
let { cat = "", sort = "name" } = store.get("view", {});
if (!SORTS[sort]) sort = "name";
let tab = ["pinned", "latest"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "projects";
let dataTime = null; // when data.json was last published (from the server's Last-Modified header)
const saveView = () => store.set("view", { cat, sort });
$("sort").value = sort;

const all = () => [...data, ...mine.filter(m => !data.some(d => key(d) === key(m)))];
const isMine = p => !data.some(d => key(d) === key(p)) && mine.some(m => key(m) === key(p));
const isPinned = p => pins.includes(key(p));
const unseen = p => isPinned(p) && relKey(p) !== "" && seen[key(p)] !== relKey(p);
const markSeen = p => { if (isPinned(p)) { seen[key(p)] = relKey(p); store.set("seen", seen); } };
const pin = p => { if (!isPinned(p)) { pins.push(key(p)); seen[key(p)] = relKey(p); } store.set("pins", pins); store.set("seen", seen); };
const unpin = p => { pins = pins.filter(k => k !== key(p)); delete seen[key(p)]; store.set("pins", pins); store.set("seen", seen); };

/* ---------- toast ---------- */
let toastTimer;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
}

/* ---------- theme (auto → dark → light) ---------- */
const THEMES = ["auto", "dark", "light"];
if (!THEMES.includes(theme)) theme = "auto";
function applyTheme() {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme; else root.dataset.theme = theme;
  // Keep the phone's status-bar colour in sync with the chosen theme
  const [mDark, mLight] = document.querySelectorAll('meta[name="theme-color"]');
  mDark.content = theme === "light" ? "#f3f6fc" : "#050a18";
  mLight.content = theme === "dark" ? "#050a18" : "#f3f6fc";
  $("theme").innerHTML = ICON[theme];
  $("theme").setAttribute("aria-label", `Theme: ${theme}. Tap to change`);
}
$("theme").onclick = () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  store.set("theme", theme);
  applyTheme();
  toast(`Theme: ${theme}`);
};
applyTheme();

/* ---------- drawing ---------- */
const relBtn = (v, cls, label) => v ? `<a class="act ${cls}" href="${esc(safeUrl(v.url))}">${label} ${esc(v.tag)}</a>` : "";

function card(p) {
  const l = latest(p), up = unseen(p), c = p.category || "Other";
  const badges = (up ? '<span class="badge upd">Updated</span>' : isFresh(p) ? '<span class="badge new">New</span>' : "")
    + (p.archived ? '<span class="badge old">Archived</span>' : "")
    + (isMine(p) ? '<span class="badge mine">Mine</span>' : "");
  const when = l
    ? `<p class="when ${l === p.stable ? "stable" : "beta"}"><i></i>${l === p.stable ? "Stable" : "Beta"} ${esc(l.tag)} · ${ago(l.date)}</p>`
    : `<p class="when none"><i></i>No releases yet${isDate(p.updated) ? ` · active ${ago(p.updated)}` : ""}</p>`;

  return `<article class="card${up ? " upd" : ""}" data-k="${esc(key(p))}">
  <div class="head"><div class="id"><a class="name" href="${esc(safeUrl(p.url))}">${esc(p.name)}</a>
    <span class="sub"><span class="author">${esc(owner(p))}</span>${badges}</span></div>
    <button class="pin" aria-pressed="${isPinned(p)}" aria-label="${isPinned(p) ? "Unpin" : "Pin"} ${esc(p.name)}">${ICON.star}</button></div>
  ${when}
  ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
  <div class="foot"><span class="stat"><span class="tag" style="--cc:${esc(catColor(c))}">${esc(c)}</span><b>★</b> ${Number(p.stars) || 0}</span>
    <span class="acts">${relBtn(p.stable, "stable", "Stable")}${relBtn(p.pre, "beta", "Beta")}<a class="act repo" href="${esc(safeUrl(p.url))}">Repo</a><button class="act share" aria-label="Share ${esc(p.name)}">${ICON.share}</button>${isMine(p) ? '<button class="act rm">Remove</button>' : ""}</span></div>
</article>`;
}

const chip = (value, label, n) =>
  `<button class="chip" data-c="${esc(value)}" aria-pressed="${value === cat}" style="--cc:${value ? esc(catColor(value)) : "var(--accent)"}">${esc(label)} <span>${n}</span></button>`;
const markChips = () => $("chips").querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === cat));

function drawCats() {
  const list = all(), counts = {};
  for (const p of list) { const c = p.category || "Other"; counts[c] = (counts[c] || 0) + 1; }
  const cats = Object.keys(counts).sort(cmp);
  if (cat && !counts[cat]) cat = ""; // saved category no longer exists
  $("chips").innerHTML = chip("", "All", list.length) + cats.map(c => chip(c, c, counts[c])).join("");
  $("add-cat").innerHTML = [...new Set([...cats, "Other"])].map(c => `<option>${esc(c)}</option>`).join("");
  $("add-cat").value = "Other";
}

function drawSummary() {
  const list = all();
  const parts = [`${list.length} projects`, `${list.filter(isFresh).length} new releases this week`];
  if (dataTime) parts.push(`data refreshed ${agoTime(dataTime)}`);
  $("summary").textContent = parts.join(" · ");
}

// Every search word must appear somewhere (name, author, category, description or tag)
const matches = (p, words) => {
  const hay = [p.name, owner(p), p.category, p.description, p.stable?.tag, p.pre?.tag].join(" ").toLowerCase();
  return words.every(w => hay.includes(w));
};

function render() {
  const n = all().filter(unseen).length;
  $("pc").hidden = !n; $("pc").textContent = n;
  document.title = (n ? `(${n}) ` : "") + "PS5 Links";

  const words = $("q").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = all().filter(p => (!cat || (p.category || "Other") === cat) && matches(p, words));

  if (tab === "latest") list = list.filter(latest).sort((a, b) => relDate(b).localeCompare(relDate(a)) || cmp(a.name, b.name));
  else if (tab === "pinned") list = list.filter(isPinned).sort((a, b) => unseen(b) - unseen(a) || cmp(a.name, b.name));
  else list.sort(SORTS[sort]);

  $("title").textContent = { projects: "PS5 Links", pinned: "Pinned", latest: "Latest releases" }[tab];
  $("sort").hidden = tab !== "projects";
  $("seen").hidden = !(tab === "pinned" && n);
  for (const t of ["projects", "pinned", "latest"]) $("t-" + t).setAttribute("aria-current", t === tab ? "page" : "false");
  $("count").textContent = `${list.length} projects`;
  drawSummary();

  $("rows").innerHTML = list.length ? list.map(p => card(p)).join("")
    : tab === "pinned" && !pins.length ? `<div class="empty"><p>Nothing pinned yet.<br>Tap the star on a project to follow its releases.</p></div>`
    : `<div class="empty"><p>No projects match.</p><button id="reset">Clear filters</button></div>`;
  if ($("reset")) $("reset").onclick = () => { $("q").value = ""; cat = ""; saveView(); markChips(); render(); };
}

/* ---------- share (phone share sheet, or copy the link) ---------- */
async function shareProject(p) {
  const l = latest(p), url = safeUrl(p.url);
  if (navigator.share) {
    try { await navigator.share({ title: p.name, text: l ? `${p.name} ${l.tag}` : p.name, url }); } catch {} // user cancelled
    return;
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied"); }
  catch { prompt("Copy this link:", url); }
}

/* ---------- card actions (pin, share, remove, mark seen when opening a release) ---------- */
$("rows").addEventListener("click", e => {
  const art = e.target.closest(".card"); if (!art) return;
  const p = all().find(x => key(x) === art.dataset.k); if (!p) return;
  if (e.target.closest(".pin")) { isPinned(p) ? unpin(p) : pin(p); render(); }
  else if (e.target.closest(".share")) shareProject(p);
  else if (e.target.closest(".rm")) {
    if (confirm(`Remove ${p.name} from your list?`)) {
      mine = mine.filter(m => key(m) !== key(p)); store.set("mine", mine); unpin(p); drawCats(); render();
    }
  } else if (e.target.closest("a") && unseen(p)) { markSeen(p); setTimeout(render, 300); }
});
$("seen").onclick = () => { all().filter(unseen).forEach(markSeen); render(); };

/* ---------- filters and tabs ---------- */
$("chips").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  cat = b.dataset.c; saveView(); markChips(); render();
  b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
});
$("q").oninput = render;
$("sort").onchange = () => { sort = $("sort").value; saveView(); render(); };
for (const t of ["projects", "pinned", "latest"]) $("t-" + t).onclick = () => {
  if (tab === t) return scrollTo({ top: 0, behavior: "smooth" });
  tab = t; history.replaceState(null, "", t === "projects" ? location.pathname : "#" + t); render(); scrollTo(0, 0);
};

/* ---------- add a project ---------- */
const parseRepo = s => {
  const m = s.trim().replace(/^https?:\/\//, "").replace(/^(www\.)?github\.com\//, "").match(/^([\w.-]+)\/([\w.-]+)/);
  return m ? { o: m[1], r: m[2].replace(/\.git$/, "") } : null;
};
async function fetchRepo(o, r) {
  // Public GitHub API, no token: limited to 60 requests/hour per IP
  const gh = u => fetch("https://api.github.com/" + u, { headers: { Accept: "application/vnd.github+json" } });
  const res = await gh(`repos/${o}/${r}`);
  if (res.status === 404) throw new Error("Repository not found. Check the link.");
  if (res.status === 403 || res.status === 429) throw new Error("GitHub rate limit reached. Try again in a few minutes.");
  if (!res.ok) throw new Error(`GitHub error ${res.status}.`);
  const j = await res.json(), rr = await gh(`repos/${j.full_name}/releases?per_page=15`);
  const rels = (rr.ok ? await rr.json() : []).filter(x => !x.draft);
  const f = x => x && { tag: x.tag_name, url: x.html_url, date: (x.published_at || x.created_at || "").slice(0, 10) };
  const stable = f(rels.find(x => !x.prerelease)) || null, pre0 = f(rels.find(x => x.prerelease));
  return { name: j.name, url: j.html_url, description: j.description || "", stars: j.stargazers_count, archived: j.archived,
    updated: (j.pushed_at || "").slice(0, 10),
    stable, pre: pre0 && (!stable || pre0.date > stable.date) ? pre0 : null, fetched: Date.now() };
}
const say = (t, err) => { $("msg").textContent = t; $("msg").className = "msg" + (err ? " err" : ""); };
const dlg = $("add");
$("open-add").onclick = () => { say(""); dlg.showModal(); $("repo").focus(); };
dlg.onclick = e => { if (e.target === dlg) dlg.close(); };

$("do-add").onclick = async () => {
  const pr = parseRepo($("repo").value);
  if (!pr) return say("Paste a GitHub link, like github.com/owner/name.", true);
  const url = `https://github.com/${pr.o}/${pr.r}`.toLowerCase(), have = all().find(p => key(p) === url);
  if (have) { pin(have); drawCats(); render(); dlg.close(); toast("Already listed, pinned it"); return; }
  $("do-add").disabled = true; say("Checking GitHub…");
  try {
    mine.push({ ...(await fetchRepo(pr.o, pr.r)), category: $("add-cat").value || "Other" });
    store.set("mine", mine); pin(mine[mine.length - 1]);
    $("repo").value = ""; drawCats(); render(); dlg.close(); toast("Added to my list");
  } catch (err) { say(err.message || "Could not reach GitHub.", true); }
  $("do-add").disabled = false;
};
$("do-share").onclick = () => {
  const pr = parseRepo($("repo").value);
  if (!pr) return say("Paste a GitHub link, like github.com/owner/name.", true);
  const name = `${pr.o}/${pr.r}`;
  open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent("Add project: " + name)}&body=${encodeURIComponent(`repo: ${name}\ncategory: ${$("add-cat").value}`)}`);
  say("GitHub opened. Tap “Submit new issue” to finish.");
};

// Keep my own repos fresh (each at most every 3 hours, max 10 per visit to save API quota)
async function refreshMine() {
  const stale = mine.filter(m => Date.now() - (m.fetched || 0) > 3 * 36e5).slice(0, 10);
  if (!stale.length) return;
  await Promise.all(stale.map(async m => {
    try { const [, , , o, r] = m.url.split("/"); Object.assign(m, await fetchRepo(o, r), { category: m.category }); } catch {}
  }));
  store.set("mine", mine); render();
}

/* ---------- start ---------- */
fetch("data.json", { cache: "no-cache" }) // always ask the server for the newest copy
  .then(r => {
    if (!r.ok) throw new Error(r.status);
    const lm = r.headers.get("last-modified");
    if (lm && isDate(lm)) dataTime = new Date(lm);
    return r.json();
  })
  .then(d => {
    data = Array.isArray(d) ? d : [];
    drawCats(); render(); refreshMine();
    $("chips").querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  })
  .catch(() => { $("rows").innerHTML = `<div class="empty">Could not load data.json. Check your connection and reload.</div>`; });