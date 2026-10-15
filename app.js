"use strict";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const safeUrl = u => (/^https:\/\//i.test(u || "") ? u : "#");
const cmp = new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare;
const REPO = "zazha093/PS5LinkCentalizer";

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("ps5l." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ps5l." + k, JSON.stringify(v)); } catch {} },
};

const ICON = {
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  commit: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

const CAT_COLORS = {
  "HEN": "#f472b6", "HEN (Unofficial)": "#fb7185", "Exploit": "#ef4444", "Payload": "#f97316",
  "Homebrew": "#22c55e", "Emulator": "#a78bfa", "PC Tool": "#38bdf8", "Network": "#2dd4bf",
  "Media": "#eab308", "Dev": "#94a3b8", "Customization": "#e879f9", "Cheats": "#fb923c", "Other": "#8793b5",
};
const catColor = c => {
  if (CAT_COLORS[c]) return CAT_COLORS[c];
  let h = 0; for (const ch of String(c)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 58%)`;
};

const owner = p => (p.url || "").split("/")[3] || "";
const key = p => (p.url || "").toLowerCase();
const latest = p => [p.stable, p.pre].filter(Boolean).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
const isDate = d => !!d && !isNaN(new Date(d));
const days = d => (Date.now() - new Date(d)) / 864e5;
const isFresh = p => { const l = latest(p); return !!l && isDate(l.date) && days(l.date) <= 7; };
const ago = d => {
  if (!isDate(d)) return "date unknown";
  const n = Math.floor(days(d));
  return n <= 0 ? "today" : n === 1 ? "yesterday" : n < 14 ? `${n} days ago` : `${Math.floor(n / 7)} weeks ago`;
};

const SORTS = {
  name: (a, b) => cmp(a.name, b.name),
  stars: (a, b) => (b.stars ?? 0) - (a.stars ?? 0) || cmp(a.name, b.name),
  updated: (a, b) => (b.updated || "").localeCompare(a.updated || "") || cmp(a.name, b.name),
  category: (a, b) => cmp(a.category || "", b.category || "") || cmp(a.name, b.name),
};

let data = [], mine = store.get("mine", []), pins = store.get("pins", []), seen = store.get("seen", {});
let theme = store.get("theme", "auto");
let { cat = "", sort = "name" } = store.get("view", {});
if (!SORTS[sort]) sort = "name";
let tab = ["pinned", "latest"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "projects";
let dataTime = null, editingRepoUrl = null;

$("sort").value = sort;
const all = () => [...data, ...mine.filter(m => !data.some(d => key(d) === key(m)))];
const isMine = p => !data.some(d => key(d) === key(p)) && mine.some(m => key(m) === key(p));
const isPinned = p => pins.includes(key(p));

let toastTimer;
function toast(text) {
  const t = $("toast"); t.textContent = text; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
}

function applyTheme() {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme; else root.dataset.theme = theme;
  $("theme").innerHTML = ICON[theme];
}
$("theme").onclick = () => {
  theme = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
  store.set("theme", theme); applyTheme(); toast(`Theme: ${theme}`);
};
applyTheme();

function card(p) {
  const c = p.category || "Other";
  return `<article class="card" data-k="${esc(key(p))}">
  <div class="head"><div class="id"><a class="name" href="${esc(safeUrl(p.url))}">${esc(p.name)}</a>
    <span class="sub"><span class="author">${esc(owner(p))}</span>${isMine(p) ? '<span class="badge mine">Mine</span>' : ""}</span></div>
    <button class="pin" aria-pressed="${isPinned(p)}" aria-label="Pin">${ICON.star}</button></div>
  ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
  <div class="foot"><span class="stat"><span class="tag" style="--cc:${esc(catColor(c))}">${esc(c)}</span><b>★</b> ${Number(p.stars) || 0}</span>
    <span class="acts">
      <button class="act readme">README</button>
      <button class="act assets">Assets</button>
      <button class="act commits" aria-label="Recent Commits">${ICON.commit}</button>
      ${isMine(p) ? '<button class="act edit">Edit</button><button class="act rm">Remove</button>' : ""}
    </span></div>
</article>`;
}

const chip = (value, label, n) =>
  `<button class="chip" data-c="${esc(value)}" aria-pressed="${value === cat}" style="--cc:${value ? esc(catColor(value)) : "var(--accent)"}">${esc(label)} <span>${n}</span></button>`;
const markChips = () => $("chips").querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === cat));

function drawCats() {
  const list = all(), counts = {};
  for (const p of list) { const c = p.category || "Other"; counts[c] = (counts[c] || 0) + 1; }
  const cats = Object.keys(counts).sort(cmp);
  if (cat && !counts[cat]) cat = "";
  $("chips").innerHTML = chip("", "All", list.length) + cats.map(c => chip(c, c, counts[c])).join("");
  $("add-cat").innerHTML = [...new Set([...cats, "Other"])].map(c => `<option>${esc(c)}</option>`).join("");
}

const matches = (p, words) => {
  const hay = [p.name, owner(p), p.category, p.description].join(" ").toLowerCase();
  return words.every(w => hay.includes(w));
};

function render() {
  const words = $("q").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = all().filter(p => (!cat || (p.category || "Other") === cat) && matches(p, words));
  if (tab === "latest") list = list.filter(latest).sort((a, b) => (latest(b)?.date || "").localeCompare(latest(a)?.date || ""));
  else if (tab === "pinned") list = list.filter(isPinned);
  else list.sort(SORTS[sort]);

  $("title").textContent = { projects: "PS5 Links", pinned: "Pinned", latest: "Latest releases" }[tab];
  $("sort").hidden = tab !== "projects";
  for (const t of ["projects", "pinned", "latest"]) $("t-" + t).setAttribute("aria-current", t === tab ? "page" : "false");
  $("count").textContent = `${list.length} projects`;

  $("rows").innerHTML = list.length ? list.map(p => card(p)).join("") : `<div class="empty"><p>No projects match.</p></div>`;
  if (cat) markChips();
}

/* ---------- README, Assets, Commits Readers ---------- */
const readerDlg = $("modal-reader");
const openReader = (title, extUrl) => {
  $("reader-title").textContent = title;
  $("reader-ext").href = extUrl;
  readerDlg.showModal();
};
$("reader-close").onclick = () => readerDlg.close();
readerDlg.onclick = e => { if (e.target === readerDlg) readerDlg.close(); };

async function fetchReadme(p) {
  const pr = parseRepo(p.url); if (!pr) return;
  openReader(`README · ${pr.o}/${pr.r}`, `https://github.com/${pr.o}/${pr.r}#readme`);
  $("reader-body").innerHTML = "Loading README…";
  $("reader-copy").onclick = () => { navigator.clipboard.writeText($("reader-body").innerText); toast("Copied"); };
  
  for (const branch of ["main", "master"]) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${pr.o}/${pr.r}/${branch}/README.md`);
      if (res.ok) {
        const text = await res.text();
        $("reader-body").innerHTML = `<pre>${esc(text)}</pre>`;
        return;
      }
    } catch {}
  }
  $("reader-body").textContent = "Could not load README.";
}

async function fetchAssets(p) {
  const pr = parseRepo(p.url); if (!pr) return;
  openReader(`Assets · ${pr.o}/${pr.r}`, `https://github.com/${pr.o}/${pr.r}/releases`);
  $("reader-body").innerHTML = "Loading releases & assets…";
  $("reader-copy").onclick = () => {};

  try {
    const res = await fetch(`https://api.github.com/repos/${pr.o}/${pr.r}/releases`, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error();
    const rels = await res.json();
    if (!rels.length || !rels.some(r => r.assets?.length)) {
      $("reader-body").innerHTML = `<div class="empty"><p>No downloadable assets found in releases.</p></div>`;
      return;
    }
    let html = "";
    for (const r of rels) {
      if (!r.assets?.length) continue;
      html += `<h4 style="margin:12px 0 6px; color:var(--accent);">${esc(r.tag_name)}</h4>`;
      for (const a of r.assets) {
        const sizeMb = (a.size / (1024 * 1024)).toFixed(1);
        html += `<div class="asset-item"><div class="asset-row"><strong>${esc(a.name)}</strong><a class="act assets" href="${esc(a.browser_download_url)}">Download</a></div><span style="font-size:12px; color:var(--muted);">Size: ${sizeMb} MB · ${a.download_count} downloads</span></div>`;
      }
    }
    $("reader-body").innerHTML = html;
  } catch {
    $("reader-body").textContent = "Failed to load assets from GitHub API.";
  }
}

async function fetchCommits(p) {
  const pr = parseRepo(p.url); if (!pr) return;
  openReader(`Recent Commits · ${pr.o}/${pr.r}`, `https://github.com/${pr.o}/${pr.r}/commits`);
  $("reader-body").innerHTML = "Loading commits…";
  $("reader-copy").onclick = () => {};

  try {
    const res = await fetch(`https://api.github.com/repos/${pr.o}/${pr.r}/commits?per_page=15`, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error();
    const commits = await res.json();
    if (!commits.length) {
      $("reader-body").innerHTML = `<div class="empty"><p>No commits found.</p></div>`;
      return;
    }
    $("reader-body").innerHTML = commits.map(c => `
      <div class="commit-item">
        <div style="font-weight:600;">${esc(c.commit.message.split('\n')[0])}</div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--muted);">
          <span>${esc(c.author?.login || c.commit.author.name)}</span>
          <a href="${esc(c.html_url)}" target="_blank" style="color:var(--accent);">${esc(c.sha.slice(0, 7))}</a>
        </div>
      </div>
    `).join("");
  } catch {
    $("reader-body").textContent = "Failed to load commits.";
  }
}

/* ---------- Card & Filter Actions ---------- */
$("rows").addEventListener("click", e => {
  const art = e.target.closest(".card"); if (!art) return;
  const p = all().find(x => key(x) === art.dataset.k); if (!p) return;
  if (e.target.closest(".pin")) {
    pins.includes(key(p)) ? pins = pins.filter(k => k !== key(p)) : pins.push(key(p));
    store.set("pins", pins); render();
  } else if (e.target.closest(".readme")) fetchReadme(p);
  else if (e.target.closest(".assets")) fetchAssets(p);
  else if (e.target.closest(".commits")) fetchCommits(p);
  else if (e.target.closest(".edit")) openEditDialog(p);
  else if (e.target.closest(".rm")) {
    if (confirm(`Remove ${p.name}?`)) { mine = mine.filter(m => key(m) !== key(p)); store.set("mine", mine); drawCats(); render(); }
  }
});

$("chips").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  cat = b.dataset.c; store.set("view", { cat, sort }); markChips(); render();
});
$("q").oninput = render;
$("sort").onchange = () => { sort = $("sort").value; store.set("view", { cat, sort }); render(); };
for (const t of ["projects", "pinned", "latest"]) $("t-" + t).onclick = () => {
  tab = t; render(); scrollTo(0, 0);
};

/* ---------- Add / Edit Dialog ---------- */
const parseRepo = s => {
  const m = s.trim().replace(/^https?:\/\//, "").replace(/^(www\.)?github\.com\//, "").match(/^([\w.-]+)\/([\w.-]+)/);
  return m ? { o: m[1], r: m[2].replace(/\.git$/, "") } : null;
};
async function fetchRepo(o, r) {
  const res = await fetch(`https://api.github.com/repos/${o}/${r}`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error("Repository not found or rate limit reached.");
  const j = await res.json();
  return { name: j.name, url: j.html_url, description: j.description || "", stars: j.stargazers_count, fetched: Date.now() };
}

const dlg = $("add");
const say = (t, err) => { $("msg").textContent = t; $("msg").className = "msg" + (err ? " err" : ""); };

$("open-add").onclick = () => {
  editingRepoUrl = null;
  $("dlg-title").textContent = "Add a project";
  $("do-add").textContent = "Add to my list";
  $("repo").value = ""; say(""); dlg.showModal(); $("repo").focus();
};

function openEditDialog(p) {
  editingRepoUrl = key(p);
  $("dlg-title").textContent = `Edit: ${p.name}`;
  $("do-add").textContent = "Save Changes";
  $("repo").value = p.url; // คงลิงก์เดิมไว้แก้ไข ไม่ต้องพิมพ์ใหม่ทั้งหมด
  $("add-cat").value = p.category || "Other";
  say(""); dlg.showModal(); $("repo").focus();
}

dlg.onclick = e => { if (e.target === dlg) dlg.close(); };

$("do-add").onclick = async () => {
  const pr = parseRepo($("repo").value);
  if (!pr) return say("Paste a valid GitHub link.", true);
  $("do-add").disabled = true; say("Fetching GitHub info…");
  try {
    const info = await fetchRepo(pr.o, pr.r);
    const catVal = $("add-cat").value || "Other";
    if (editingRepoUrl) {
      mine = mine.map(m => key(m) === editingRepoUrl ? { ...m, ...info, category: catVal } : m);
      toast("Updated successfully");
    } else {
      if (all().some(p => key(p) === key({ url: info.url }))) throw new Error("Project already exists.");
      mine.push({ ...info, category: catVal });
      toast("Added to my list");
    }
    store.set("mine", mine); drawCats(); render(); dlg.close();
  } catch (err) { say(err.message || "Error connecting to GitHub.", true); }
  $("do-add").disabled = false;
};

$("do-share").onclick = () => {
  const pr = parseRepo($("repo").value);
  if (!pr) return say("Paste a GitHub link first.", true);
  open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent("Add: " + pr.o + "/" + pr.r)}`);
};

/* ---------- Init ---------- */
fetch("data.json").then(r => r.json()).then(d => { data = d; drawCats(); render(); })
  .catch(() => $("rows").innerHTML = `<div class="empty">Could not load data.json.</div>`);