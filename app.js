"use strict";
/* =========================================================
   PS5 Links — app.js (v4)
   Plain JavaScript, no build step. Reads data.json (made by
   scripts/update.mjs) and keeps personal data in localStorage.
   ========================================================= */

/* ---------- Small helpers ---------- */
const $ = id => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
// Escape text before putting it into innerHTML (prevents XSS from repo names/descriptions)
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// Only allow https links (blocks javascript: and other schemes)
const safeUrl = u => (/^https:\/\//i.test(u || "") ? u : "#");
const cmp = new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare;
const REPO = "zazha093/PS5LinkCentalizer";

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("ps5l." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ps5l." + k, JSON.stringify(v)); } catch {} },
};

/* ---------- Translations (English / Thai) ---------- */
const I18N = {
  en: {
    searchPh: "Search projects, authors, tags", whatsNew: "What's new", theme: "Theme", settings: "Settings", add: "Add",
    categories: "Categories", all: "All", projects: "Projects", pinned: "Pinned", latest: "Latest", offline: "Offline",
    markSeen: "Mark all seen", sName: "Name A–Z", sStars: "Most starred", sRelease: "Latest release", sUpdated: "Recently updated", sCategory: "Group by category",
    disclaimerH: "Disclaimer:", disclaimer: "this is only a link index. Not affiliated with, and not responsible for, any listed project.",
    addTitle: "Add a project", editTitle: "Edit", addMine: "Add to my list", saveChanges: "Save changes", addShared: "Submit to the shared list",
    addHint: "My list checks GitHub live and is saved on this device only.",
    language: "Language", auto: "Auto", dark: "Dark", light: "Light", avatars: "Author avatars", on: "On", off: "Off",
    backup: "Backup (my list + pins)", export: "Export file", import: "Import file", reset: "Clear all data on this device",
    privacy: "Everything is stored in your browser only. GitHub receives requests when you open README, Assets, Commits or avatars.",
    statProjects: "Projects tracked", statFresh: "Releases this week", statActive: "Active (3 days)", statNew: "New for you",
    latestTitle: "Latest releases", noMatch: "No projects match.", pinnedEmpty: "Tap the star on any project to pin it here.", clearFilters: "Clear filters",
    readme: "README", assets: "Assets", commits: "Recent commits", copyLink: "Copy link", edit: "Edit", remove: "Remove",
    mine: "Mine", isNew: "NEW", updated: "Updated", archived: "Archived", stable: "Stable", pre: "Pre",
    today: "today", yesterday: "yesterday", daysAgo: "{n} days ago", weeksAgo: "{n} weeks ago", monthsAgo: "{n} months ago", dateUnknown: "date unknown",
    loading: "Loading…", noReadme: "Could not load README.", noAssets: "No releases with downloadable files yet.", failAssets: "Failed to load releases from GitHub.",
    noCommits: "No commits found.", failCommits: "Failed to load commits.", rateLimit: "GitHub rate limit reached. Try again after {t}.",
    copied: "Copied", validLink: "Paste a valid GitHub link.", pasteFirst: "Paste a GitHub link first.", fetching: "Fetching GitHub info…",
    notFound: "Repository not found.", exists: "Project already exists.", updatedOk: "Updated", addedOk: "Added to my list",
    removeQ: "Remove {n}?", dataUpdated: "Data updated {t}", loadFail: "Could not load data.json.", imported: "Backup restored", importFail: "That file is not a valid backup.",
    resetQ: "Delete your list, pins and settings on this device?", themeIs: "Theme: {t}", downloads: "downloads", download: "Download",
    notes: "Release notes", noRelease: "No release yet", openGithub: "Open on GitHub", colProject: "Project", colCategory: "Category",
    colRelease: "Release", colReleased: "Released", colUpdated: "Last push", colStars: "Stars", shareHint: "Opens a GitHub issue for the site owner to review.",
    fRepo: "GitHub link", fName: "Display name", fNamePh: "Leave empty to use the GitHub name", fDesc: "Description", fDescPh: "Leave empty to use the GitHub description", fCat: "Category",
    revert: "Restore original", reverted: "Restored original", edited: "Edited", editHintShared: "Changes are saved on this device only. The shared list is not changed.",
    sDownloads: "Most downloaded", colDownloads: "Downloads", colLang: "Language", statDownloads: "Total downloads", forks: "forks", issues: "issues", website: "Website",
  },
  th: {
    searchPh: "ค้นหาโปรเจกต์ ผู้สร้าง หรือหมวด", whatsNew: "อัปเดตใหม่", theme: "ธีม", settings: "ตั้งค่า", add: "เพิ่ม",
    categories: "หมวดหมู่", all: "ทั้งหมด", projects: "โปรเจกต์", pinned: "ปักหมุด", latest: "ล่าสุด", offline: "ออฟไลน์",
    markSeen: "ทำเครื่องหมายว่าดูแล้ว", sName: "ชื่อ A–Z", sStars: "ดาวมากสุด", sRelease: "รีลีสล่าสุด", sUpdated: "อัปเดตล่าสุด", sCategory: "จัดกลุ่มตามหมวด",
    disclaimerH: "ข้อจำกัดความรับผิดชอบ:", disclaimer: "เว็บนี้เป็นเพียงดัชนีลิงก์ ไม่มีส่วนเกี่ยวข้องและไม่รับผิดชอบต่อโปรเจกต์ใดที่แสดงไว้",
    addTitle: "เพิ่มโปรเจกต์", editTitle: "แก้ไข", addMine: "เพิ่มในรายการของฉัน", saveChanges: "บันทึก", addShared: "เสนอเข้ารายการกลาง",
    addHint: "รายการของฉันดึงข้อมูลจาก GitHub สดๆ และบันทึกไว้ในเครื่องนี้เท่านั้น",
    language: "ภาษา", auto: "อัตโนมัติ", dark: "มืด", light: "สว่าง", avatars: "รูปโปรไฟล์ผู้สร้าง", on: "เปิด", off: "ปิด",
    backup: "สำรองข้อมูล (รายการของฉัน + ปักหมุด)", export: "ส่งออกไฟล์", import: "นำเข้าไฟล์", reset: "ล้างข้อมูลทั้งหมดในเครื่องนี้",
    privacy: "ข้อมูลทั้งหมดเก็บในเบราว์เซอร์ของคุณเท่านั้น GitHub จะได้รับคำขอเมื่อเปิด README, Assets, Commits หรือรูปโปรไฟล์",
    statProjects: "โปรเจกต์ทั้งหมด", statFresh: "รีลีสสัปดาห์นี้", statActive: "เคลื่อนไหว 3 วัน", statNew: "ใหม่สำหรับคุณ",
    latestTitle: "รีลีสล่าสุด", noMatch: "ไม่พบโปรเจกต์ที่ตรงกัน", pinnedEmpty: "แตะดาวที่โปรเจกต์เพื่อปักหมุดไว้ที่นี่", clearFilters: "ล้างตัวกรอง",
    readme: "README", assets: "ไฟล์", commits: "คอมมิตล่าสุด", copyLink: "คัดลอกลิงก์", edit: "แก้ไข", remove: "ลบ",
    mine: "ของฉัน", isNew: "ใหม่", updated: "อัปเดต", archived: "เก็บถาวร", stable: "เสถียร", pre: "ทดสอบ",
    today: "วันนี้", yesterday: "เมื่อวาน", daysAgo: "{n} วันก่อน", weeksAgo: "{n} สัปดาห์ก่อน", monthsAgo: "{n} เดือนก่อน", dateUnknown: "ไม่ทราบวันที่",
    loading: "กำลังโหลด…", noReadme: "โหลด README ไม่ได้", noAssets: "ยังไม่มีรีลีสที่มีไฟล์ให้ดาวน์โหลด", failAssets: "โหลดรีลีสจาก GitHub ไม่สำเร็จ",
    noCommits: "ไม่พบคอมมิต", failCommits: "โหลดคอมมิตไม่สำเร็จ", rateLimit: "ใช้ GitHub เกินโควตาแล้ว ลองใหม่หลัง {t}",
    copied: "คัดลอกแล้ว", validLink: "กรุณาวางลิงก์ GitHub ที่ถูกต้อง", pasteFirst: "กรุณาวางลิงก์ GitHub ก่อน", fetching: "กำลังดึงข้อมูลจาก GitHub…",
    notFound: "ไม่พบ repository นี้", exists: "มีโปรเจกต์นี้อยู่แล้ว", updatedOk: "อัปเดตแล้ว", addedOk: "เพิ่มในรายการของฉันแล้ว",
    removeQ: "ลบ {n} ใช่ไหม?", dataUpdated: "ข้อมูลอัปเดต {t}", loadFail: "โหลด data.json ไม่ได้", imported: "กู้คืนข้อมูลแล้ว", importFail: "ไฟล์นี้ไม่ใช่ไฟล์สำรองที่ถูกต้อง",
    resetQ: "ลบรายการ ปักหมุด และการตั้งค่าทั้งหมดในเครื่องนี้ใช่ไหม?", themeIs: "ธีม: {t}", downloads: "ดาวน์โหลด", download: "ดาวน์โหลด",
    notes: "รายละเอียดรีลีส", noRelease: "ยังไม่มีรีลีส", openGithub: "เปิดใน GitHub", colProject: "โปรเจกต์", colCategory: "หมวด",
    colRelease: "รีลีส", colReleased: "วันที่รีลีส", colUpdated: "push ล่าสุด", colStars: "ดาว", shareHint: "จะเปิด GitHub issue ให้เจ้าของเว็บตรวจสอบ",
    fRepo: "ลิงก์ GitHub", fName: "ชื่อที่แสดง", fNamePh: "เว้นว่างเพื่อใช้ชื่อจาก GitHub", fDesc: "คำอธิบาย", fDescPh: "เว้นว่างเพื่อใช้คำอธิบายจาก GitHub", fCat: "หมวดหมู่",
    revert: "คืนค่าเดิม", reverted: "คืนค่าเดิมแล้ว", edited: "แก้ไขแล้ว", editHintShared: "การแก้ไขจะบันทึกในเครื่องนี้เท่านั้น ไม่กระทบรายการกลาง",
    sDownloads: "ดาวน์โหลดมากสุด", colDownloads: "ดาวน์โหลด", colLang: "ภาษา", statDownloads: "ยอดดาวน์โหลดรวม", forks: "fork", issues: "issue", website: "เว็บไซต์",
  },
};
let lang = store.get("lang", (navigator.language || "").toLowerCase().startsWith("th") ? "th" : "en");
if (!I18N[lang]) lang = "en";
const t = (k, vars = {}) => (I18N[lang][k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");

function applyI18n() {
  document.documentElement.lang = lang;
  $$("[data-i18n]").forEach(el => (el.textContent = t(el.dataset.i18n)));
  $$("[data-i18n-ph]").forEach(el => (el.placeholder = t(el.dataset.i18nPh)));
  $$("[data-i18n-al]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAl)));
}

/* ---------- Icons ---------- */
const ICON = {
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  commit: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="m21 8-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

/* ---------- Category colours ---------- */
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
const catOf = p => p.category || "Other";

/* ---------- Project helpers ---------- */
const owner = p => (p.url || "").split("/")[3] || "";
const key = p => (p.url || "").toLowerCase();
// Newest of stable / pre-release
const latest = p => [p.stable, p.pre].filter(Boolean).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
const isDate = d => !!d && !isNaN(new Date(d));
const days = d => (Date.now() - new Date(d)) / 864e5;
const isFresh = p => { const l = latest(p); return !!l && isDate(l.date) && days(l.date) <= 7; };
const isActive = p => isDate(p.updated) && days(p.updated) <= 3;
function ago(d) {
  if (!isDate(d)) return t("dateUnknown");
  const n = Math.floor(days(d));
  if (n <= 0) return t("today");
  if (n === 1) return t("yesterday");
  if (n < 14) return t("daysAgo", { n });
  if (n < 60) return t("weeksAgo", { n: Math.floor(n / 7) });
  return t("monthsAgo", { n: Math.floor(n / 30) });
}
const fmtNum = n => new Intl.NumberFormat(lang === "th" ? "th-TH" : "en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);
const LANG_COLORS = { C: "#555555", "C++": "#f34b7d", "C#": "#178600", JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Rust: "#dea584", Go: "#00ADD8", HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051", Assembly: "#6E4C13", Java: "#b07219", Kotlin: "#A97BFF", Lua: "#000080", Makefile: "#427819", Batchfile: "#C1F12E", PowerShell: "#012456", Dart: "#00B4AB", Swift: "#F05138" };
const langColor = l => LANG_COLORS[l] || "var(--muted)";
const fmtDate = d => (isDate(d) ? new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

const SORTS = {
  name: (a, b) => cmp(a.name, b.name),
  stars: (a, b) => (b.stars ?? 0) - (a.stars ?? 0) || cmp(a.name, b.name),
  release: (a, b) => (latest(b)?.date || "").localeCompare(latest(a)?.date || "") || cmp(a.name, b.name),
  updated: (a, b) => (b.updated || "").localeCompare(a.updated || "") || cmp(a.name, b.name),
  category: (a, b) => cmp(catOf(a), catOf(b)) || cmp(a.name, b.name),
  downloads: (a, b) => (b.downloads ?? 0) - (a.downloads ?? 0) || cmp(a.name, b.name),
};

/* ---------- State (persisted per device) ---------- */
let data = [], mine = store.get("mine", []), pins = store.get("pins", []);
// Local edits to shared projects: { repoKey: { name?, description?, category? } } — this device only
let over = store.get("over", {});
let seen = store.get("seen2", null);              // { repoKey: lastSeenTag } — null means first visit
let theme = store.get("theme", "auto");
let avatars = store.get("avatars", true);
let { cat = "", sort = "name", view = "grid" } = store.get("view", {});
if (!SORTS[sort]) sort = "name";
if (!["grid", "list", "table"].includes(view)) view = "grid";
const TABS = ["projects", "pinned", "latest"];
let tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "projects";
let editingKey = null;

const saveView = () => store.set("view", { cat, sort, view });
// Shared project + this device's edits on top (original kept in _orig for "Restore original")
const withEdits = p => (over[key(p)] ? { ...p, ...over[key(p)], _orig: p, _edited: true } : p);
const all = () => [...data.map(withEdits), ...mine.filter(m => !data.some(d => key(d) === key(m)))];
const isMine = p => !data.some(d => key(d) === key(p)) && mine.some(m => key(m) === key(p));
const isPinned = p => pins.includes(key(p));
// "Unseen" = the newest tag differs from the one this device last saw (or the project is new to the list)
const isUnseen = p => !!seen && !isMine(p) && !!latest(p) && seen[key(p)] !== latest(p).tag;
const unseenList = () => data.filter(isUnseen);
function markSeen(list) {
  seen = seen || {};
  for (const p of list) if (latest(p)) seen[key(p)] = latest(p).tag;
  store.set("seen2", seen);
}

/* ---------- Toast + clipboard ---------- */
let toastTimer;
function toast(text) {
  const el = $("toast"); el.textContent = text; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { // Fallback for older browsers (e.g. console browsers without the Clipboard API)
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  toast(t("copied"));
}

/* ---------- Theme ---------- */
function applyTheme() {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme; else root.dataset.theme = theme;
  $("theme").innerHTML = ICON[theme];
  $$("#set-theme button").forEach(b => b.setAttribute("aria-pressed", b.dataset.th === theme));
}
$("theme").onclick = () => {
  theme = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
  store.set("theme", theme); applyTheme(); toast(t("themeIs", { t: t(theme) }));
};

/* ---------- Rendering: pieces ---------- */
function avatar(p) {
  const o = owner(p);
  if (!avatars || !o) return `<span class="av ph" style="--cc:${esc(catColor(catOf(p)))}" aria-hidden="true">${esc((o || p.name || "?")[0].toUpperCase())}</span>`;
  return `<img class="av" src="https://github.com/${encodeURIComponent(o)}.png?size=80" alt="" loading="lazy" width="38" height="38" data-ph="${esc((o[0] || "?").toUpperCase())}">`;
}

function badges(p) {
  const b = [];
  if (p.stable) b.push(`<a class="badge stable" href="${esc(safeUrl(p.stable.url))}" title="${esc(t("stable"))} · ${esc(fmtDate(p.stable.date))}">${esc(p.stable.tag)}</a>`);
  if (p.pre) b.push(`<a class="badge pre" href="${esc(safeUrl(p.pre.url))}" title="${esc(t("pre"))} · ${esc(fmtDate(p.pre.date))}">${esc(t("pre"))} ${esc(p.pre.tag)}</a>`);
  if (isUnseen(p) || isFresh(p)) b.push(`<span class="badge new">${esc(t("isNew"))}</span>`);
  else if (isActive(p)) b.push(`<span class="badge upd">${esc(t("updated"))}</span>`);
  if (p.archived) b.push(`<span class="badge arch">${esc(t("archived"))}</span>`);
  if (isMine(p)) b.push(`<span class="badge mine">${esc(t("mine"))}</span>`);
  else if (p._edited) b.push(`<span class="badge mine">${ICON.pen}${esc(t("edited"))}</span>`);
  return b.length ? `<div class="badges">${b.join("")}</div>` : "";
}

function actions(p, compact) {
  return `<span class="acts">
    <button class="act readme" data-a="readme">${compact ? ICON.book : ICON.book + esc(t("readme"))}</button>
    <button class="act assets" data-a="assets">${compact ? ICON.box : ICON.box + esc(t("assets"))}${!compact && latest(p)?.assets ? `<span class="act-n">${latest(p).assets}</span>` : ""}</button>
    <button class="act commits" data-a="commits" aria-label="${esc(t("commits"))}" title="${esc(t("commits"))}">${ICON.commit}</button>
    <button class="act copy" data-a="copy" aria-label="${esc(t("copyLink"))}" title="${esc(t("copyLink"))}">${ICON.link}</button>
    ${compact ? `<button class="act copy" data-a="edit" aria-label="${esc(t("edit"))}" title="${esc(t("edit"))}">${ICON.pen}</button>` : ""}
    ${isMine(p) ? `<button class="act rm" data-a="rm">${esc(t("remove"))}</button>` : ""}
  </span>`;
}

function card(p) {
  const c = catOf(p), l = latest(p);
  return `<article class="card${isUnseen(p) ? " unseen" : ""}" data-k="${esc(key(p))}">
  <div class="head"><div class="id">${avatar(p)}<div class="id-t">
      <a class="name" href="${esc(safeUrl(p.url))}" title="${esc(p.name)}">${esc(p.name)}</a>
      <span class="author">${esc(owner(p))}${l ? ` · ${esc(ago(l.date))}` : ""}</span></div></div>
    <span class="head-acts"><button class="pin edit-ic" data-a="edit" aria-label="${esc(t("edit"))}" title="${esc(t("edit"))}">${ICON.pen}</button><button class="pin" data-a="pin" aria-pressed="${isPinned(p)}" aria-label="${esc(t("pinned"))}">${ICON.star}</button></span></div>
  ${badges(p)}
  ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
  ${tab === "latest" && l?.notes ? `<div class="notes-pv"><strong>${esc(l.title || l.tag)}</strong><p>${esc(l.notes)}</p></div>` : ""}
  ${metaLine(p)}
  <div class="foot"><span class="stat"><span class="tag" style="--cc:${esc(catColor(c))}">${esc(c)}</span><span title="${esc(t("colStars"))}"><b>★</b> ${fmtNum(p.stars)}</span>${p.downloads ? `<span title="${esc(t("colDownloads"))}">↓ ${fmtNum(p.downloads)}</span>` : ""}</span>
    ${actions(p, false)}</div>
</article>`;
}

// Language · license · forks · topics (only shown when update.mjs provided them)
function metaLine(p) {
  const bits = [];
  if (p.language) bits.push(`<span class="lang" style="--lc:${esc(langColor(p.language))}">${esc(p.language)}</span>`);
  if (p.license) bits.push(`<span>${esc(p.license)}</span>`);
  if (p.forks) bits.push(`<span>${fmtNum(p.forks)} ${esc(t("forks"))}</span>`);
  if (p.homepage) bits.push(`<a class="hp" href="${esc(safeUrl(p.homepage))}">${esc(t("website"))} ↗</a>`);
  const topics = (p.topics || []).slice(0, 4).map(x => `<button class="topic" data-a="topic" data-topic="${esc(x)}">#${esc(x)}</button>`).join("");
  return bits.length || topics ? `<div class="meta-line">${bits.join("")}${topics}</div>` : "";
}

function table(list) {
  const rows = list.map(p => {
    const c = catOf(p), l = latest(p);
    return `<tr data-k="${esc(key(p))}">
      <td><div class="id">${avatar(p)}<div class="id-t"><a class="name" href="${esc(safeUrl(p.url))}">${esc(p.name)}</a><span class="author">${esc(owner(p))}</span></div></div></td>
      <td><span class="tag" style="--cc:${esc(catColor(c))}">${esc(c)}</span></td>
      <td>${badges(p) || `<span class="num">${esc(t("noRelease"))}</span>`}</td>
      <td class="num">${l ? esc(ago(l.date)) : "—"}</td>
      <td class="num">${esc(ago(p.updated))}</td>
      <td class="num">${p.language ? `<span class="lang" style="--lc:${esc(langColor(p.language))}">${esc(p.language)}</span>` : "—"}</td>
      <td class="num">★ ${fmtNum(p.stars)}</td>
      <td class="num">${p.downloads ? "↓ " + fmtNum(p.downloads) : "—"}</td>
      <td><button class="pin" data-a="pin" aria-pressed="${isPinned(p)}" aria-label="${esc(t("pinned"))}">${ICON.star}</button></td>
      <td>${actions(p, true)}</td></tr>`;
  }).join("");
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    <th>${esc(t("colProject"))}</th><th>${esc(t("colCategory"))}</th><th>${esc(t("colRelease"))}</th><th>${esc(t("colReleased"))}</th>
    <th>${esc(t("colUpdated"))}</th><th>${esc(t("colLang"))}</th><th>${esc(t("colStars"))}</th><th>${esc(t("colDownloads"))}</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- Rendering: categories, stats, list ---------- */
function drawCats() {
  const list = all(), counts = {};
  for (const p of list) counts[catOf(p)] = (counts[catOf(p)] || 0) + 1;
  const cats = Object.keys(counts).sort(cmp);
  if (cat && !counts[cat]) cat = "";
  const chip = (v, label, n) => `<button class="chip" data-c="${esc(v)}" aria-pressed="${v === cat}" style="--cc:${v ? esc(catColor(v)) : "var(--accent)"}">${esc(label)} <span>${n}</span></button>`;
  const side = (v, label, n) => `<button class="side-cat" data-c="${esc(v)}" aria-pressed="${v === cat}" style="--cc:${v ? esc(catColor(v)) : "var(--accent)"}"><span>${esc(label)}</span><span class="n">${n}</span></button>`;
  $("chips").innerHTML = chip("", t("all"), list.length) + cats.map(c => chip(c, c, counts[c])).join("");
  $("side-cats").innerHTML = side("", t("all"), list.length) + cats.map(c => side(c, c, counts[c])).join("");
  $("cat-n").textContent = `(${cats.length})`;
  $("add-cat").innerHTML = [...new Set([...cats, "Other"])].map(c => `<option>${esc(c)}</option>`).join("");
}
const markCats = () => $$(".chip, .side-cat").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === cat));

function drawStats() {
  const list = all(), un = unseenList().length;
  const s = [
    { k: "statProjects", v: list.length, go: "projects" },
    { k: "statFresh", v: list.filter(isFresh).length, go: "latest", c: "var(--stable)" },
    { k: "statActive", v: list.filter(isActive).length, go: "updated", c: "var(--accent)" },
    { k: "statNew", v: un, go: "latest", c: "var(--beta)" },
  ];
  const dl = list.reduce((n, p) => n + (Number(p.downloads) || 0), 0);
  if (dl) s.push({ k: "statDownloads", v: fmtNum(dl), go: "downloads", c: "var(--star)" });
  $("stats").style.setProperty("--n", s.length);
  $("stats").innerHTML = s.map(x => `<button class="stat-card" data-go="${x.go}" ${x.c ? `style="--sc:${x.c}"` : ""}><p>${esc(t(x.k))}</p><b>${x.v}</b></button>`).join("");
  // Badges on bell + tabs
  const pc = pins.length;
  for (const [id, n] of [["pc", pc], ["lc", un], ["bell-n", un]]) { $(id).textContent = n; $(id).hidden = !n; }
  $("pc2").textContent = pc || ""; $("lc2").textContent = un || "";
}

const matches = (p, words) => {
  const hay = [p.name, owner(p), p.category, p.description, p.stable?.tag, p.pre?.tag, p.language, ...(p.topics || [])].join(" ").toLowerCase();
  return words.every(w => hay.includes(w));
};

function render() {
  const words = $("q").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = all().filter(p => (!cat || catOf(p) === cat) && matches(p, words));

  if (tab === "latest") list = list.filter(latest).sort(SORTS.release);
  else if (tab === "pinned") list = list.filter(isPinned).sort(SORTS[sort]);
  else list.sort(SORTS[sort]);

  // Toolbar state
  $("title").textContent = { projects: "PS5 Links", pinned: t("pinned"), latest: t("latestTitle") }[tab];
  $("sort").hidden = tab === "latest";
  $("seen").hidden = !(tab === "latest" && unseenList().length);
  $$("[data-tab]").forEach(b => {
    b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false");
    b.setAttribute("aria-pressed", b.dataset.tab === tab);
  });
  $$("[data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === view));
  $("count").textContent = `${list.length} ${t("projects")}`;

  const rows = $("rows");
  rows.className = "cards " + (view === "table" ? "list" : view);
  if (!list.length) {
    const msg = tab === "pinned" && !words.length && !cat ? t("pinnedEmpty") : t("noMatch");
    const btn = words.length || cat ? `<button class="btn primary" data-a="clear">${esc(t("clearFilters"))}</button>` : "";
    rows.innerHTML = `<div class="empty"><p>${esc(msg)}</p>${btn}</div>`;
    return;
  }
  if (view === "table") { rows.innerHTML = table(list); return; }

  // Insert section headings: by day on "Latest", by category when grouping
  let html = "", last = null;
  for (const p of list) {
    if (tab === "latest") {
      const d = ago(latest(p).date);
      if (d !== last) { html += `<h2 class="day-h">${esc(d)}</h2>`; last = d; }
    } else if (sort === "category" && !cat) {
      const c = catOf(p);
      if (c !== last) {
        const n = list.filter(x => catOf(x) === c).length;
        html += `<h2 class="group-h" style="--cc:${esc(catColor(c))}">${esc(c)} <span>(${n})</span></h2>`; last = c;
      }
    }
    html += card(p);
  }
  rows.innerHTML = html;
}
const refresh = () => { drawStats(); render(); };

/* ---------- GitHub API with a small session cache ----------
   Anonymous GitHub API = 60 requests/hour per IP. Caching for
   10 minutes means re-opening the same panel costs nothing. */
async function gh(path) {
  const ck = "ps5l.gh:" + path;
  try { const c = JSON.parse(sessionStorage.getItem(ck)); if (c && Date.now() - c.t < 6e5) return c.v; } catch {}
  const res = await fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json" } });
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = new Date(Number(res.headers.get("x-ratelimit-reset")) * 1000);
    throw new Error(t("rateLimit", { t: reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
  }
  if (res.status === 404) throw Object.assign(new Error(t("notFound")), { status: 404 });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const v = await res.json();
  try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), v })); } catch {}
  return v;
}

/* ---------- Markdown (loaded only when first needed) ----------
   marked = Markdown → HTML, DOMPurify = removes scripts/unsafe HTML.
   Versions are pinned and checked with Subresource Integrity. */
const LIBS = [
  ["https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js", "sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi"],
  ["https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js", "sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a"],
];
let mdReady;
const loadMd = () => mdReady ??= Promise.all(LIBS.map(([src, integrity]) => new Promise((ok, no) => {
  const s = Object.assign(document.createElement("script"), { src, integrity, crossOrigin: "anonymous", onload: ok, onerror: no });
  document.head.append(s);
}))).catch(e => { mdReady = null; throw e; });

// Render markdown safely; fix relative links/images so they point at the repo
async function mdToHtml(text, pr) {
  try { await loadMd(); } catch { return `<pre>${esc(text)}</pre>`; } // offline/CDN blocked → plain text
  const clean = window.DOMPurify.sanitize(window.marked.parse(text, { gfm: true }));
  const tpl = document.createElement("template"); tpl.innerHTML = clean;
  if (pr) {
    const raw = `https://raw.githubusercontent.com/${pr.o}/${pr.r}/HEAD/`, blob = `https://github.com/${pr.o}/${pr.r}/blob/HEAD/`;
    for (const img of tpl.content.querySelectorAll("img[src]")) {
      const s = img.getAttribute("src");
      try { img.src = /^https?:/i.test(s) ? s.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//, "https://raw.githubusercontent.com/$1/") : new URL(s, raw).href; } catch {}
      img.loading = "lazy";
    }
    for (const a of tpl.content.querySelectorAll("a[href]")) {
      const h = a.getAttribute("href");
      if (!h.startsWith("#") && !/^[a-z]+:/i.test(h)) { try { a.href = new URL(h, blob).href; } catch {} }
      a.rel = "noopener noreferrer";
    }
  }
  const div = document.createElement("div"); div.className = "md"; div.append(tpl.content);
  return div.outerHTML;
}

/* ---------- Reader dialog (README / Assets / Commits) ---------- */
const readerDlg = $("modal-reader");
let copyText = "";
function openReader(title, sub, extUrl) {
  $("reader-title").textContent = title;
  $("reader-sub").textContent = sub;
  $("reader-ext").href = extUrl;
  copyText = extUrl;
  $("reader-body").innerHTML = `<p class="loading">${esc(t("loading"))}</p>`;
  readerDlg.showModal();
  $("reader-body").scrollTop = 0;
}
$("reader-copy").onclick = () => copyText && copy(copyText);
const failBox = (msg) => `<div class="empty"><p class="err">${esc(msg)}</p></div>`;

async function showReadme(p) {
  const pr = parseRepo(p.url); if (!pr) return;
  openReader(`README · ${pr.o}/${pr.r}`, p.description || "", `https://github.com/${pr.o}/${pr.r}#readme`);
  // raw.githubusercontent.com does not use the API quota; HEAD = default branch
  let text = null;
  for (const f of ["README.md", "readme.md", "Readme.md", "README.MD", "README"]) {
    try { const r = await fetch(`https://raw.githubusercontent.com/${pr.o}/${pr.r}/${encodeURIComponent(p.branch || "HEAD")}/${f}`); if (r.ok) { text = await r.text(); break; } } catch {}
  }
  if (text == null) { $("reader-body").innerHTML = failBox(t("noReadme")); return; }
  copyText = text; // copy button copies the markdown
  $("reader-body").innerHTML = await mdToHtml(text, pr);
}

async function showAssets(p) {
  const pr = parseRepo(p.url); if (!pr) return;
  openReader(`${t("assets")} · ${pr.o}/${pr.r}`, latest(p) ? `${latest(p).tag} · ${fmtDate(latest(p).date)}` : "", `https://github.com/${pr.o}/${pr.r}/releases`);
  markSeen([p]); refresh();
  try {
    const rels = (await gh(`/repos/${pr.o}/${pr.r}/releases?per_page=10`)).filter(r => !r.draft);
    if (!rels.length) { $("reader-body").innerHTML = failBox(t("noAssets")); return; }
    let html = "";
    for (const [i, r] of rels.entries()) {
      const date = (r.published_at || "").slice(0, 10);
      html += `<section class="rel"><div class="rel-h"><h4>${esc(r.name || r.tag_name)}</h4>
        <a class="badge ${r.prerelease ? "pre" : "stable"}" href="${esc(safeUrl(r.html_url))}">${esc(r.tag_name)}</a>
        <span class="asset-meta">${esc(fmtDate(date))} · ${esc(ago(date))}</span></div>`;
      if (r.body?.trim()) html += `<details class="notes"${i === 0 ? " open" : ""}><summary>${esc(t("notes"))}</summary>${await mdToHtml(r.body.slice(0, 20000), pr)}</details>`;
      for (const a of r.assets || []) {
        html += `<div class="asset-item"><div class="asset-row"><strong>${esc(a.name)}</strong>
          <span class="acts"><button class="act copy" data-copy="${esc(a.browser_download_url)}" aria-label="${esc(t("copyLink"))}">${ICON.link}</button>
          <a class="act assets" href="${esc(safeUrl(a.browser_download_url))}">${ICON.dl}${esc(t("download"))}</a></span></div>
          <span class="asset-meta">${(a.size / 1048576).toFixed(1)} MB · ${Number(a.download_count).toLocaleString()} ${esc(t("downloads"))}</span></div>`;
      }
      html += `</section>`;
    }
    $("reader-body").innerHTML = html;
  } catch (e) { $("reader-body").innerHTML = failBox(e.message || t("failAssets")); }
}

async function showCommits(p) {
  const pr = parseRepo(p.url); if (!pr) return;
  openReader(`${t("commits")} · ${pr.o}/${pr.r}`, `${t("colUpdated")}: ${ago(p.updated)}`, `https://github.com/${pr.o}/${pr.r}/commits`);
  try {
    const commits = await gh(`/repos/${pr.o}/${pr.r}/commits?per_page=15`);
    if (!commits.length) { $("reader-body").innerHTML = failBox(t("noCommits")); return; }
    $("reader-body").innerHTML = commits.map(c => `<div class="commit-item">
        <div style="font-weight:600">${esc(c.commit.message.split("\n")[0])}</div>
        <div class="asset-row asset-meta"><span>${esc(c.author?.login || c.commit.author?.name || "")} · ${esc(ago(c.commit.author?.date))}</span>
        <a class="mono" href="${esc(safeUrl(c.html_url))}" style="color:var(--accent)">${esc(c.sha.slice(0, 7))}</a></div></div>`).join("");
  } catch (e) { $("reader-body").innerHTML = failBox(e.message || t("failCommits")); }
}
// Copy buttons inside the reader (asset download links)
$("reader-body").addEventListener("click", e => { const b = e.target.closest("[data-copy]"); if (b) copy(b.dataset.copy); });

/* ---------- Events: cards, filters, tabs, view ---------- */
$("rows").addEventListener("click", e => {
  const btn = e.target.closest("[data-a]"); if (!btn) return;
  if (btn.dataset.a === "clear") { $("q").value = ""; cat = ""; saveView(); markCats(); render(); return; }
  if (btn.dataset.a === "topic") { $("q").value = btn.dataset.topic; render(); scrollTo(0, 0); return; }
  const el = btn.closest("[data-k]"); if (!el) return;
  const p = all().find(x => key(x) === el.dataset.k); if (!p) return;
  switch (btn.dataset.a) {
    case "pin":
      pins = isPinned(p) ? pins.filter(k => k !== key(p)) : [...pins, key(p)];
      store.set("pins", pins); refresh(); break;
    case "readme": showReadme(p); break;
    case "assets": showAssets(p); break;
    case "commits": showCommits(p); break;
    case "copy": copy(p.url); break;
    case "edit": openEditDialog(p); break;
    case "rm":
      if (confirm(t("removeQ", { n: p.name }))) { mine = mine.filter(m => key(m) !== key(p)); store.set("mine", mine); drawCats(); refresh(); }
  }
});
// Broken avatar → coloured letter placeholder (error events don't bubble, so capture)
$("rows").addEventListener("error", e => {
  const img = e.target;
  if (img.tagName === "IMG" && img.classList.contains("av")) img.replaceWith(Object.assign(document.createElement("span"), { className: "av ph", textContent: img.dataset.ph || "?" }));
}, true);

const pickCat = e => { const b = e.target.closest("[data-c]"); if (!b) return; cat = b.dataset.c; saveView(); markCats(); render(); };
$("chips").addEventListener("click", pickCat);
$("side-cats").addEventListener("click", pickCat);
$("q").oninput = render;
$("sort").onchange = () => { sort = $("sort").value; saveView(); render(); };
$$("[data-view]").forEach(b => (b.onclick = () => { view = b.dataset.view; saveView(); render(); }));

function setTab(next) {
  tab = next;
  history.replaceState(null, "", next === "projects" ? location.pathname + location.search : "#" + next);
  render(); scrollTo(0, 0);
}
$$("button[data-tab]").forEach(b => (b.onclick = () => setTab(b.dataset.tab)));
$("bell").onclick = () => setTab("latest");
$("stats").addEventListener("click", e => {
  const b = e.target.closest("[data-go]"); if (!b) return;
  if (b.dataset.go === "updated" || b.dataset.go === "downloads") { sort = b.dataset.go; $("sort").value = sort; saveView(); setTab("projects"); }
  else setTab(b.dataset.go);
});
$("seen").onclick = () => { markSeen(data); refresh(); };

// Keyboard: "/" focuses search, Esc clears it
addEventListener("keydown", e => {
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) { e.preventDefault(); $("q").focus(); }
  else if (e.key === "Escape" && document.activeElement === $("q")) { $("q").value = ""; render(); }
});

/* ---------- Dialog helpers ---------- */
$$("dialog").forEach(d => {
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
});

/* ---------- Add / Edit ---------- */
const parseRepo = s => {
  const m = String(s || "").trim().replace(/^https?:\/\//, "").replace(/^(www\.)?github\.com\//, "").match(/^([\w.-]+)\/([\w.-]+)/);
  return m ? { o: m[1], r: m[2].replace(/\.git$/, "") } : null;
};
async function fetchRepo(o, r) {
  const j = await gh(`/repos/${o}/${r}`);
  return {
    name: j.name, ghName: j.name, url: j.html_url, description: j.description || "", ghDesc: j.description || "",
    stars: j.stargazers_count, updated: (j.pushed_at || "").slice(0, 10), archived: !!j.archived,
    language: j.language || "", topics: (j.topics || []).slice(0, 6), branch: j.default_branch || "", fetched: Date.now(),
  };
}
const dlg = $("add");
const say = (text, err) => { $("msg").textContent = text; $("msg").className = "msg" + (err ? " err" : ""); };
const clip = (s, n) => String(s || "").trim().slice(0, n);
let editing = null; // null = adding; otherwise { k, shared, p }

function openDialog(mode, p) {
  editing = mode === "add" ? null : { k: key(p), shared: !isMine(p), p };
  const shared = !!editing?.shared;
  $("dlg-title").textContent = editing ? `${t("editTitle")}: ${p.name}` : t("addTitle");
  $("do-add").textContent = editing ? t("saveChanges") : t("addMine");
  // Pre-fill with the current values so nothing has to be retyped
  $("repo").value = editing ? p.url : "";
  $("repo").readOnly = shared;                 // a shared project's link comes from projects.json
  $("f-name").value = editing ? p.name : "";
  $("f-desc").value = editing ? p.description || "" : "";
  $("add-cat").value = editing ? catOf(p) : "Other";
  $("do-share").hidden = shared;
  $("do-revert").hidden = !(shared && p._edited);
  say(shared ? t("editHintShared") : "");
  dlg.showModal();
  const f = editing ? $("f-name") : $("repo");
  f.focus(); if (editing) f.select();
}
$("open-add").onclick = () => openDialog("add");
const openEditDialog = p => openDialog("edit", p);

$("do-add").onclick = async () => {
  const name = clip($("f-name").value, 80), description = clip($("f-desc").value, 400);
  const category = $("add-cat").value || "Other";

  // 1) Shared project → store only what differs from the original, on this device
  if (editing?.shared) {
    const orig = data.find(d => key(d) === editing.k); if (!orig) return dlg.close();
    const o = {};
    if (name && name !== orig.name) o.name = name;
    if (description !== (orig.description || "") && description) o.description = description;
    if (category !== catOf(orig)) o.category = category;
    if (Object.keys(o).length) over[editing.k] = o; else delete over[editing.k];
    store.set("over", over); drawCats(); refresh(); dlg.close(); toast(t("updatedOk"));
    return;
  }

  // 2) My own list → add new, or edit (re-fetch from GitHub only if the link changed)
  const pr = parseRepo($("repo").value);
  if (!pr) return say(t("validLink"), true);
  const old = editing ? mine.find(m => key(m) === editing.k) : null;
  const sameRepo = old && parseRepo(old.url)?.o.toLowerCase() === pr.o.toLowerCase() && parseRepo(old.url)?.r.toLowerCase() === pr.r.toLowerCase();
  $("do-add").disabled = true;
  try {
    let info = old;
    if (!sameRepo) { say(t("fetching")); info = await fetchRepo(pr.o, pr.r); }
    if (!editing || !sameRepo) { if (all().some(p => key(p) === key(info) && key(p) !== editing?.k)) throw new Error(t("exists")); }
    const ghName = info.ghName || info.name, ghDesc = info.ghDesc ?? info.description ?? "";
    // Typed name wins; empty → GitHub name. If the link changed but the name was left as before, use the new repo's name.
    const keepOldName = editing && !sameRepo && name === old.name;
    const item = { ...info, ghName, ghDesc, category,
      name: name && !keepOldName ? name : ghName,
      description: description && !(editing && !sameRepo && description === old.description) ? description : ghDesc };
    if (editing) {
      mine = mine.map(m => (key(m) === editing.k ? item : m));
      if (editing.k !== key(item)) pins = pins.map(k => (k === editing.k ? key(item) : k));
      toast(t("updatedOk"));
    } else { mine.push(item); toast(t("addedOk")); }
    store.set("mine", mine); store.set("pins", pins); drawCats(); refresh(); dlg.close();
  } catch (err) { say(err.message, true); }
  $("do-add").disabled = false;
};
$("do-revert").onclick = () => {
  if (!editing) return;
  delete over[editing.k]; store.set("over", over); drawCats(); refresh(); dlg.close(); toast(t("reverted"));
};
// FIX: the GitHub workflow only reacts to titles starting with "Add project:" and
// reads "repo:" / "category:" lines from the body — the old "Add: ..." title never matched.
$("do-share").onclick = () => {
  const pr = parseRepo($("repo").value);
  if (!pr) return say(t("pasteFirst"), true);
  const repo = `${pr.o}/${pr.r}`, category = $("add-cat").value || "Other";
  const q = new URLSearchParams({ title: `Add project: ${repo}`, body: `repo: ${repo}\ncategory: ${category}\n` });
  open(`https://github.com/${REPO}/issues/new?${q}`);
  say(t("shareHint"));
};

/* ---------- Settings: language, theme, avatars, backup ---------- */
$("open-settings").onclick = () => { syncSettings(); $("settings").showModal(); };
function syncSettings() {
  $$("#set-lang button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  $$("#set-av button").forEach(b => b.setAttribute("aria-pressed", String(avatars) === (b.dataset.av === "1" ? "true" : "false")));
  applyTheme();
}
$("set-lang").onclick = e => { const b = e.target.closest("[data-lang]"); if (!b) return; lang = b.dataset.lang; store.set("lang", lang); applyI18n(); drawCats(); refresh(); syncSettings(); };
$("set-theme").onclick = e => { const b = e.target.closest("[data-th]"); if (!b) return; theme = b.dataset.th; store.set("theme", theme); applyTheme(); };
$("set-av").onclick = e => { const b = e.target.closest("[data-av]"); if (!b) return; avatars = b.dataset.av === "1"; store.set("avatars", avatars); syncSettings(); render(); };

$("do-export").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "ps5links", v: 2, mine, pins, over }, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "ps5links-backup.json", target: "_self" });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("do-import").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== "ps5links" || !Array.isArray(j.mine) || !Array.isArray(j.pins)) throw 0;
    // Keep only well-formed GitHub entries from the file (never trust imported data)
    mine = j.mine.filter(m => m && typeof m.name === "string" && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/i.test(m.url || ""))
      .map(m => ({ name: clip(m.name, 80), ghName: clip(m.ghName || m.name, 100), url: m.url, description: clip(m.description, 400), ghDesc: clip(m.ghDesc ?? m.description, 400), category: clip(m.category || "Other", 30) || "Other", stars: Number(m.stars) || 0, updated: String(m.updated || "").slice(0, 10) }));
    pins = j.pins.filter(k => typeof k === "string");
    // Local edits: keep only text fields, trimmed to sane lengths
    over = {};
    for (const [k, v] of Object.entries(j.over && typeof j.over === "object" ? j.over : {})) {
      if (!/^https:\/\/github\.com\//.test(k) || !v || typeof v !== "object") continue;
      const o = {};
      if (typeof v.name === "string" && v.name.trim()) o.name = clip(v.name, 80);
      if (typeof v.description === "string" && v.description.trim()) o.description = clip(v.description, 400);
      if (typeof v.category === "string" && v.category.trim()) o.category = clip(v.category, 30);
      if (Object.keys(o).length) over[k] = o;
    }
    store.set("mine", mine); store.set("pins", pins); store.set("over", over); drawCats(); refresh(); toast(t("imported"));
  } catch { toast(t("importFail")); }
};
$("do-reset").onclick = () => {
  if (!confirm(t("resetQ"))) return;
  Object.keys(localStorage).filter(k => k.startsWith("ps5l.")).forEach(k => localStorage.removeItem(k));
  location.reload();
};

/* ---------- Back to top ---------- */
addEventListener("scroll", () => { $("totop").hidden = scrollY < 700; }, { passive: true });
$("totop").onclick = () => scrollTo({ top: 0, behavior: "smooth" });

/* ---------- Init ---------- */
applyI18n(); applyTheme();
$("sort").value = sort;
fetch("data.json", { cache: "no-cache" })
  .then(r => { const lm = r.headers.get("last-modified"); if (lm) $("updated-at").textContent = t("dataUpdated", { t: ago(lm) }); return r.json(); })
  .then(d => {
    data = Array.isArray(d) ? d : [];
    if (!seen) markSeen(data); // first visit: nothing counts as "new for you" yet
    drawCats(); refresh();
  })
  .catch(() => ($("rows").innerHTML = `<div class="empty">${esc(t("loadFail"))}</div>`));
