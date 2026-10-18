"use strict";
/* =========================================================
   PS5 Links — ps5.js (beta): send / run payloads on a PS5
   Loaded after app.js and reuses its helpers ($, $$, esc, t, store, toast, copy, cmp, I18N).

   It talks to websrv (github.com/ps5-payload-dev/websrv), which must be
   running on the PS5 (default port 8080). Endpoints used:
     GET  /version                  → is websrv running? (JSON {tag, …})
     GET  /elfldr?elf=<https URL>   → the PS5 downloads the ELF itself, then runs it
     GET  /elfldr?elf=/data/x.elf   → run an ELF that is already on the console
     POST /elfldr  (multipart "elf")→ run an ELF sent from this phone/PC
     GET  /fs/<path>?fmt=json       → list a folder
   websrv replies with "Access-Control-Allow-Origin: *", so this https:// site may
   read the answers. Chrome 142+ shows a one-time "local network access" prompt and
   then allows http:// requests to private IPs such as 192.168.x.x.

   Safety: only private/home-network addresses are accepted, and nothing is ever sent
   to the PS5 without a click and a confirmation dialog.
   ========================================================= */

/* ---------- Translations ---------- */
Object.assign(I18N.en, {
  ps5: "PS5", ps5Title: "Connect to PS5", ps5Beta: "Beta", ps5Ip: "PS5 IP address", ps5Port: "websrv port",
  ps5Test: "Save & test", ps5Testing: "Connecting…", ps5Ok: "Connected · websrv {v}",
  ps5Fail: "Can't reach the PS5. Check that websrv is running, that this device and the PS5 are on the same Wi-Fi, and that this site may access devices on your local network (browser site settings).",
  ps5BadIp: "Enter a home-network IP such as 192.168.1.50 (public addresses are not allowed).", ps5Need: "Set up your PS5 first.",
  ps5Needs: "Needs websrv running on the PS5. Load websrv-ps5.elf once with your usual loader.",
  ps5RunH: "Run a payload", ps5RunUrl: "Link to an .elf file (the PS5 downloads it)", ps5RunUrlBtn: "Run link",
  ps5RunFile: "Send from this device", ps5Browse: "Pick on the PS5", ps5Up: "Up", ps5Empty: "No folders or .elf files here",
  ps5Run: "Run on PS5", ps5RunQ: "Run {f} on the PS5 at {ip}?", ps5RunWarn: "Only run payloads you trust: they get full control of the console.",
  ps5Go: "Run", ps5Cancel: "Cancel", ps5Sending: "Sending to PS5…",
  ps5Sent: "Sent. Watch the PS5 for its notification.", ps5RunFail: "The PS5 refused the payload or could not download it ({s}).",
  ps5PmH: "Payload Manager catalog", ps5PmHint: "In Payload Manager on the PS5, add this URL as a source. You can then pick and run every payload from this list on the console itself, with update checks and SHA-256 verification.",
  ps5Tools: "Open pages on the PS5", ps5UploadHint: "To upload into a folder, use the PS5Links Agent section above, or a file-manager payload from its own page (port 8888).",
  ps5Ios: "iPhone / iPad: Safari blocks this page from talking to the PS5. Use the \"Open pages on the PS5\" links instead.",
  ps5Saved: "Saved",
  agLdrPort: "ELF Loader Port",
  agLdr9021: "Port 9021 (Persistent / websrv)",
  agLdr9020: "Port 9020 (Standard elfldr)",
  agRunDirect: "Send & run .elf directly",
  agDirectSent: "Payload sent directly to port {port}. Watch the PS5 for its notification.",
  runTarget: "Runner engine",
  runMethodAgent9021: "Agent → Port 9021 (Direct)",
  runMethodAgent9020: "Agent → Port 9020 (Direct)",
  runMethodWebsrv: "websrv (Port 8080)",
});
Object.assign(I18N.th, {
  ps5: "PS5", ps5Title: "เชื่อมต่อ PS5", ps5Beta: "ทดลอง", ps5Ip: "IP ของ PS5", ps5Port: "พอร์ต websrv",
  ps5Test: "บันทึกและทดสอบ", ps5Testing: "กำลังเชื่อมต่อ…", ps5Ok: "เชื่อมต่อแล้ว · websrv {v}",
  ps5Fail: "ติดต่อ PS5 ไม่ได้ ตรวจสอบว่ารัน websrv แล้ว, เครื่องนี้กับ PS5 ใช้ Wi-Fi เดียวกัน และอนุญาตให้เว็บนี้เข้าถึงอุปกรณ์ในเครือข่าย (ในการตั้งค่าเว็บไซต์ของเบราว์เซอร์)",
  ps5BadIp: "ใส่ IP ในเครือข่ายบ้าน เช่น 192.168.1.50 (ไม่อนุญาตที่อยู่สาธารณะ)", ps5Need: "ตั้งค่า PS5 ก่อน",
  ps5Needs: "ต้องรัน websrv บน PS5 ก่อน โหลด websrv-ps5.elf หนึ่งครั้งด้วยตัวโหลดที่ใช้ประจำ",
  ps5RunH: "รัน payload", ps5RunUrl: "ลิงก์ไฟล์ .elf (PS5 จะดาวน์โหลดเอง)", ps5RunUrlBtn: "รันลิงก์",
  ps5RunFile: "ส่งไฟล์จากเครื่องนี้", ps5Browse: "เลือกไฟล์ใน PS5", ps5Up: "ขึ้นไป", ps5Empty: "ไม่มีโฟลเดอร์หรือไฟล์ .elf ที่นี่",
  ps5Run: "รันบน PS5", ps5RunQ: "รัน {f} บน PS5 ที่ {ip} ใช่ไหม?", ps5RunWarn: "รันเฉพาะ payload ที่เชื่อถือได้ เพราะมันควบคุมเครื่องได้ทั้งหมด",
  ps5Go: "รัน", ps5Cancel: "ยกเลิก", ps5Sending: "กำลังส่งไป PS5…",
  ps5Sent: "ส่งแล้ว ดูแจ้งเตือนบนหน้าจอ PS5", ps5RunFail: "PS5 ไม่รับ payload หรือดาวน์โหลดไม่สำเร็จ ({s})",
  ps5PmH: "คลัง payload สำหรับ Payload Manager", ps5PmHint: "ใน Payload Manager บน PS5 ให้เพิ่ม URL นี้เป็น Source แล้วจะเลือกและรัน payload ทุกตัวในรายการนี้ได้จากตัวเครื่องเอง พร้อมแจ้งอัปเดตและตรวจ SHA-256",
  ps5Tools: "เปิดหน้าบน PS5", ps5UploadHint: "ถ้าจะอัปโหลดลงโฟลเดอร์ ใช้ส่วน PS5Links Agent ด้านบน หรือเปิดหน้าของ payload จัดการไฟล์ (พอร์ต 8888)",
  ps5Ios: "iPhone / iPad: Safari ไม่ยอมให้หน้านี้คุยกับ PS5 ให้ใช้ลิงก์ \"เปิดหน้าบน PS5\" แทน",
  ps5Saved: "บันทึกแล้ว",
  agLdrPort: "พอร์ต ELF Loader",
  agLdr9021: "พอร์ต 9021 (Persistent / websrv)",
  agLdr9020: "พอร์ต 9020 (Standard elfldr)",
  agRunDirect: "ส่งและรัน .elf โดยตรง",
  agDirectSent: "ส่ง payload เข้าพอร์ต {port} แล้ว ดูแจ้งเตือนบนหน้าจอ PS5",
  runTarget: "ช่องทางรัน",
  runMethodAgent9021: "Agent → พอร์ต 9021 (สตรีมตรง)",
  runMethodAgent9020: "Agent → พอร์ต 9020 (สตรีมตรง)",
  runMethodWebsrv: "websrv (พอร์ต 8080)",
});
applyI18n();

/* ---------- Settings + helpers ---------- */
// ip + websrv port; aport/pin are for PS5Links Agent (the PIN is saved on this device only)
let ps5 = Object.assign({ ip: "", port: 8080, aport: 8686, pin: "", ldrPort: 9021, verify: true }, store.get("ps5", {}));
const PM_PORT = 8084, WFM_PORT = 8888;
const CATALOG_URL = new URL("payloads.json", location.href.replace(/[#?].*$/, "")).href;

// Home-network targets only: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, or name.local
function isLocalHost(h) {
  h = String(h || "").trim().toLowerCase();
  if (h === "localhost" || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/.test(h)) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some(n => n > 255)) return false;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
const validPort = n => Number.isInteger(Number(n)) && n > 0 && n < 65536;
const ps5Ready = () => isLocalHost(ps5.ip) && validPort(ps5.port);
const ps5Url = (port, path = "/") => `http://${ps5.ip}:${port}${path}`;

async function ps5Fetch(path, opts = {}, ms = 8000, port = ps5.port) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    // targetAddressSpace tells Chrome this http:// request is meant for the local network
    // ("loopback" when the page runs on the PS5 itself and talks to 127.0.0.1 or localhost)
    const space = (/^127\./.test(ps5.ip) || ps5.ip === "localhost") ? "loopback" : "local";
    return await fetch(ps5Url(port, path), { ...opts, mode: "cors", cache: "no-store", targetAddressSpace: space, signal: ctl.signal });
  } finally { clearTimeout(timer); }
}
const say5 = (text, kind = "") => { const el = $("ps5-msg"); el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); };
const dot5 = ok => { $("ps5-dot").className = "ps5-dot" + (ok === true ? " on" : ok === false ? " off" : ""); };

/* ---------- Connection test ---------- */
async function ps5Test(quiet) {
  if (!ps5Ready()) { if (!quiet) say5(t("ps5BadIp"), "err"); dot5(); return false; }
  if (!quiet) say5(t("ps5Testing"));
  try {
    const r = await ps5Fetch("/version", {}, 5000);
    if (!r.ok) throw 0;
    let v = ""; try { v = (await r.json()).tag || ""; } catch {}
    if (!quiet) say5(t("ps5Ok", { v }), "ok");
    dot5(true); return true;
  } catch {
    if (!quiet) say5(t("ps5Fail"), "err");
    dot5(false); return false;
  }
}

/* ---------- Run a payload ----------
   target: https URL (PS5 downloads it), absolute PS5 path, or a File/Blob from this device */
async function ps5Run(target) {
  if (!ps5Ready()) { openPs5(); say5(t("ps5Need"), "err"); return; }
  toast(t("ps5Sending"));
  try {
    let r;
    if (target instanceof Blob) {
      const fd = new FormData();
      fd.append("elf", target, target.name || "payload.elf"); // multipart = no CORS preflight
      r = await ps5Fetch("/elfldr", { method: "POST", body: fd }, 60000);
    } else {
      r = await ps5Fetch(`/elfldr?elf=${encodeURIComponent(target)}`, {}, 90000);
    }
    if (!r.ok) throw new Error("HTTP " + r.status);
    if (target instanceof Blob) {
      addHist(target.name || "payload.elf", "upload");
    } else {
      const name = String(target).split("/").pop().split("?")[0] || target;
      addHist(name, String(target).startsWith("http") ? "url" : "console", String(target).startsWith("http") ? { url: target } : { path: target });
    }
    toast(t("ps5Sent")); dot5(true);
  } catch (e) {
    const s = e.name === "AbortError" ? "timeout" : /^HTTP/.test(e.message || "") ? e.message : "network";
    alert(t("ps5RunFail", { s }) + (s === "network" ? "\n\n" + t("ps5Fail") : ""));
    dot5(s === "network" ? false : true);
  }
}

/* ---------- Confirmation dialog ---------- */
const fmtMB = n => (n ? ` · ${(n / 1048576).toFixed(2)} MB` : "");
function askRun(files, label, preferredMethod) {
  if (!ps5Ready()) { openPs5(); say5(t("ps5Need"), "err"); return; }
  if (!files?.length) return;
  $("runq-t").textContent = t("ps5RunQ", { f: label, ip: ps5.ip });
  $("runq-files").innerHTML = files.map((f, i) => `<label class="runq-f">
      <input type="radio" name="runf" value="${i}"${i ? "" : " checked"}>
      <span><strong>${esc(f.name)}</strong>${esc(fmtMB(f.size))}${f.sha256 ? `<br><code title="SHA-256">sha256 ${esc(f.sha256.slice(0, 16))}…</code>` : ""}</span></label>`).join("");

  const hasFile = files.some(f => f.file || f instanceof Blob);
  const opt = $("runq-opt");
  if (opt) {
    opt.hidden = !hasFile;
    if (hasFile) {
      const def = preferredMethod || (ps5.pin ? (ps5.ldrPort === 9020 ? "agent-9020" : "agent-9021") : "websrv");
      $("runq-method").value = def;
    }
  }

  // SHA-256 checking only makes sense for links: the file is downloaded here first, so the
  // bytes we verify are exactly the bytes the console gets. Local files are checked elsewhere.
  const checkable = files.some(f => f.sha256 && f.url);
  $("runq-verify").hidden = !checkable;
  if (checkable) $("runq-vf").checked = ps5.verify !== false;
  $("runq-vmsg").textContent = "";

  $("runq-go").onclick = async () => {
    const i = Number($("runq").querySelector("input[name=runf]:checked")?.value || 0);
    const method = $("runq-method")?.value || "websrv";
    const f = files[i];
    const wantVerify = checkable && $("runq-vf").checked && f.sha256 && f.url;
    $("runq").close();
    if (f.file && method.startsWith("agent")) return void await agentRunDirect(f.file, method === "agent-9020" ? 9020 : 9021);
    if (wantVerify) return void await runVerified(f);
    ps5Run(f.file || f.url || f.path);
  };
  $("runq").showModal();
}
// Download the link here, compare it with the hash GitHub published, then send those exact
// bytes to the console. A payload that does not match never runs unless the user insists.
async function runVerified(f) {
  toast(t("verifyChecking", { n: f.name }));
  let blob;
  try { blob = await fetchBlob(f.url); }
  catch { alert(t("ps5RunFail", { s: "network" }) + "\n\n" + t("ps5Fail")); return; }
  const got = await sha256Hex(blob);
  if (!got) return ps5Run(f.url);                    // no WebCrypto (plain http page): fall back
  if (got !== String(f.sha256).toLowerCase()) {
    if (!confirm(t("verifyAsk", { n: f.name, g: got.slice(0, 16), e: String(f.sha256).slice(0, 16) }))) return;
  } else toast(t("verifyOk", { n: f.name }));
  await sendBlob(blob, f.name);
}
window.askRun = askRun; // used by app.js (cards + Assets list)

/* ---------- Folder browser (websrv /fs JSON) ----------
   Lists folders and every file. .elf/.bin files can be run, text files can be
   edited in the browser, and anything can be downloaded to this device. */
let fsPath = "/data";
const FOLDER = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const fsEnc = p => p.split("/").map(encodeURIComponent).join("/");
// Extensions the built-in editor can open safely (everything else is download-only)
const TEXT_EXT = /\.(txt|json|ini|cfg|conf|log|md|xml|yml|yaml|lua|js|mjs|sh|bat|properties|toml|csv|list|env)$/i;
const fileIcon = n => TEXT_EXT.test(n) ? ICON.book : /\.(elf|bin)$/i.test(n) ? ICON.play : /\.zip$/i.test(n) ? ICON.box : ICON.dl;
async function ps5Browse(path = fsPath) {
  const box = $("ps5-fs");
  box.hidden = false;
  box.innerHTML = `<p class="loading">${esc(t("loading"))}</p>`;
  try {
    const r = await ps5Fetch(`/fs${fsEnc(path)}${path.endsWith("/") ? "" : "/"}?fmt=json`, {}, 8000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    let list;
    try { list = JSON.parse(await r.text()); } catch { throw new Error("bad JSON (a file name may contain quotes)"); }
    fsPath = path;
    const items = list
      .filter(x => x && x.name !== "." && x.name !== "..")
      .sort((a, b) => (a.mode === "d" ? 0 : 1) - (b.mode === "d" ? 0 : 1) || cmp(a.name, b.name));
    const parent = path.replace(/\/[^/]+\/?$/, "") || "/";
    const files = items.filter(x => x.mode !== "d");
    const bytes = files.reduce((s, x) => s + (Number(x.size) || 0), 0);
    let free = "";
    try { const j = await agent("/api/info", {}, 5000); if (j?.free) free = t("fsFree", { n: fmtSize(j.free) }); } catch {}
    let html = `<div class="fs-bar"><code class="fs-path">${esc(path)}</code>
      <span class="fs-meta">${esc(t("fsTotal", { n: files.length, s: fmtSize(bytes) }))}${free ? " · " + esc(free) : ""}</span>
      ${path !== "/" ? `<button class="btn small" data-fs="${esc(parent)}">↑ ${esc(t("ps5Up"))}</button>` : ""}
      <button class="btn small" data-fs-mk type="button">${esc(t("fsNewFolder"))}</button>
      <button class="btn small" data-fs-up type="button">${esc(t("fsUpload"))}</button></div>`;
    html += items.length ? items.map(x => {
      const full = (path === "/" ? "" : path.replace(/\/$/, "")) + "/" + x.name;
      const size = Number(x.size) || 0;
      const del = `<button class="act rm" data-fs-del="${esc(full)}" data-fs-name="${esc(x.name)}">${esc(t("fsDelete"))}</button>`;
      if (x.mode === "d") return `<div class="fs-row">${FOLDER}<button class="fs-name as-link" data-fs="${esc(full)}" type="button">${esc(x.name)}</button><span class="fs-size">${esc(t("fsDir"))}</span><span class="fs-acts">${del}</span></div>`;
      return `<div class="fs-row">${fileIcon(x.name)}<span class="fs-name">${esc(x.name)}</span><span class="fs-size">${esc(fmtSize(size))}</span>
        <span class="fs-acts">
        ${/\.(elf|bin)$/i.test(x.name) ? `<button class="act run" data-fs-run="${esc(full)}" data-size="${size}" title="${esc(t("ps5Run"))}" aria-label="${esc(t("ps5Run"))}">${ICON.play}</button>` : ""}
        ${TEXT_EXT.test(x.name) ? `<button class="act copy" data-fs-edit="${esc(full)}" data-size="${size}" title="${esc(t("fileEdit"))}" aria-label="${esc(t("fileEdit"))}">${ICON.pen}</button>` : ""}
        <button class="act copy" data-fs-dl="${esc(full)}" title="${esc(t("fileDownload"))}" aria-label="${esc(t("fileDownload"))}">${ICON.dl}</button>
        ${del}
        </span></div>`;
    }).join("") : `<p class="hint">${esc(t("ps5Empty"))}</p>`;
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = `<p class="msg err">${esc(e.message === "Failed to fetch" || e.name === "TypeError" ? t("ps5Fail") : e.message)}</p>`;
  }
}

/* ---------- Dialog ---------- */
function syncPs5Links() {
  const ok = ps5Ready();
  for (const [id, port, path] of [["ps5-l-websrv", ps5.port, "/"], ["ps5-l-elfldr", ps5.port, "/elfldr"], ["ps5-l-pm", PM_PORT, "/"], ["ps5-l-wfm", WFM_PORT, "/"]]) {
    const a = $(id); a.href = ok ? ps5Url(port, path) : "#"; a.classList.toggle("disabled", !ok);
    a.querySelector("small").textContent = ok ? `${ps5.ip}:${port}` : "—";
  }
}
function openPs5() {
  $("ps5-ip").value = ps5.ip; $("ps5-port").value = ps5.port;
  $("ps5-cat").textContent = CATALOG_URL;
  $("ps5-fs").hidden = true; say5(ps5Ready() ? "" : t("ps5Needs"));
  $("ps5-ios").hidden = !/iPad|iPhone|iPod/.test(navigator.userAgent);
  syncPs5Links();
  agentOnOpen();
  $("ps5").showModal();
  if (ps5Ready()) ps5Test();
}
function savePs5() {
  const ip = $("ps5-ip").value.trim(), port = Number($("ps5-port").value) || 8080;
  if (!isLocalHost(ip) || !validPort(port)) { say5(t("ps5BadIp"), "err"); return false; }
  ps5 = { ...ps5, ip, port }; store.set("ps5", ps5); syncPs5Links(); return true;
}

$("open-ps5").onclick = openPs5;
$("ps5-test").onclick = () => { if (savePs5()) ps5Test(); };
$("ps5-ip").addEventListener("keydown", e => { if (e.key === "Enter") $("ps5-test").click(); });
$("ps5-browse").onclick = () => { if (savePs5()) ps5Browse(); };
$("ps5-run-url").onclick = () => {
  const u = $("ps5-url").value.trim();
  if (!/^https?:\/\/\S+$/i.test(u)) { say5("https://…/payload.elf", "err"); return; }
  if (savePs5()) askRun([{ name: u.split("/").pop().split("?")[0] || u, url: u }], u.split("/").pop().split("?")[0]);
};
$("ps5-file").onchange = e => {
  const f = e.target.files[0]; e.target.value = "";
  if (f && savePs5()) {
    const def = ps5.pin ? (ps5.ldrPort === 9020 ? "agent-9020" : "agent-9021") : "websrv";
    askRun([{ name: f.name, size: f.size, file: f }], f.name, def);
  }
};
$("ps5-fs").addEventListener("click", e => {
  const del = e.target.closest("[data-fs-del]"); if (del) return void fsRemove(del.dataset.fsDel, del.dataset.fsName);
  const up = e.target.closest("[data-fs-up]"); if (up) return void $("fs-files").click();
  const mk = e.target.closest("[data-fs-mk]"); if (mk) return void fsMkdir();
  const d = e.target.closest("[data-fs]"); if (d) return ps5Browse(d.dataset.fs);
  const ed = e.target.closest("[data-fs-edit]"); if (ed) return void openEditor(ed.dataset.fsEdit, Number(ed.dataset.size) || 0);
  const dl = e.target.closest("[data-fs-dl]"); if (dl) return void downloadFromPs5(dl.dataset.fsDl);
  const f = e.target.closest("[data-fs-run]");
  if (f) askRun([{ name: f.dataset.fsRun.split("/").pop(), size: Number(f.dataset.size), path: f.dataset.fsRun }], f.dataset.fsRun);
});
// Files picked with "Upload here" go into the folder that is currently browsed
$("fs-files").onchange = e => {
  const files = [...e.target.files]; e.target.value = "";
  if (files.length) agentSend(files, fsPath);
};
$("ps5-copy-cat").onclick = () => copy(CATALOG_URL);
$$("#ps5 a.disabled, #ps5 .tool").forEach(a => a.addEventListener("click", e => { if (a.classList.contains("disabled")) e.preventDefault(); }));

// Quietly check on load so the header dot shows whether the PS5 is reachable.
// Skipped when not set up; with Chrome this may show the one-time local network prompt.
if (ps5Ready() && store.get("ps5auto", true)) setTimeout(() => ps5Test(true), 1200);

/* =========================================================
   PS5Links Agent (agent/agent.c): upload into a folder
     GET  /api/info                 → version, free space, "auth" when the PIN is right
     GET  /api/ls?path=             → folder listing
     PUT  /api/upload?path=&offset= → write a chunk (8 MB) at an offset; 409 → resume
     POST /api/run?path=            → hand an ELF to the ELF loader (port 9021)
   Every call except /api/info sends the pairing PIN in the X-Agent-Pin header.
   .zip files are extracted here in the browser (fflate) and sent file by file,
   so the PS5 needs no unzip code.
   ========================================================= */
Object.assign(I18N.en, {
  agH: "Upload to a folder (PS5Links Agent)", agPin: "PIN shown on the PS5", agPort: "Agent port", agPair: "Pair",
  agPaired: "Paired · agent {v} · {free} free", agBadPin: "Agent found, but the PIN is wrong. Check the PS5 notification.",
  agNoAgent: "Agent not reachable. Run ps5links-agent.elf on the PS5 (it shows a PIN when it starts).",
  agDest: "Folder on the PS5", agPickDir: "Choose", agUseDir: "Use this folder", agUnzip: "Extract .zip files while sending",
  agSend: "Choose files and send", agReading: "Reading {f}…", agConfirm: "Send {n} file(s), {mb} MB, to:\n{d}",
  agSending: "{i}/{n} · {f} · {p}%", agDone: "Done: {n} file(s) in {d}", agFail: "Upload stopped: {e}", agCancelled: "Cancelled",
  agRunQ: "Run {f} on the PS5?", agNeedPair: "Pair with the agent first (PIN).", agBadZip: "Could not read {f} as a zip file.",
});
Object.assign(I18N.th, {
  agH: "อัปโหลดลงโฟลเดอร์ (PS5Links Agent)", agPin: "PIN ที่ขึ้นบน PS5", agPort: "พอร์ต Agent", agPair: "จับคู่",
  agPaired: "จับคู่แล้ว · agent {v} · ว่าง {free}", agBadPin: "เจอ Agent แล้วแต่ PIN ไม่ถูก ดูแจ้งเตือนบน PS5",
  agNoAgent: "ติดต่อ Agent ไม่ได้ ให้รัน ps5links-agent.elf บน PS5 ก่อน (จะขึ้น PIN ตอนเริ่ม)",
  agDest: "โฟลเดอร์ปลายทางบน PS5", agPickDir: "เลือก", agUseDir: "ใช้โฟลเดอร์นี้", agUnzip: "แตกไฟล์ .zip ระหว่างส่ง",
  agSend: "เลือกไฟล์แล้วส่ง", agReading: "กำลังอ่าน {f}…", agConfirm: "ส่ง {n} ไฟล์ ({mb} MB) ไปที่:\n{d}",
  agSending: "{i}/{n} · {f} · {p}%", agDone: "เสร็จแล้ว: {n} ไฟล์ ใน {d}", agFail: "การอัปโหลดหยุด: {e}", agCancelled: "ยกเลิกแล้ว",
  agRunQ: "รัน {f} บน PS5 ใช่ไหม?", agNeedPair: "จับคู่กับ Agent ก่อน (ใส่ PIN)", agBadZip: "อ่าน {f} เป็นไฟล์ zip ไม่ได้",
});
applyI18n();

/* ---------- Agent helpers ---------- */
const FFLATE = ["https://cdn.jsdelivr.net/npm/fflate@0.8.3/umd/index.js", "sha384-ETfVLWAUsU3zp3SpnQsPDbAyrF6jYv2w8aNYo6KtY2JuyxXhzYLOL7e0ATbLSIHP"];
let fflateReady;
const loadFflate = () => fflateReady ??= new Promise((ok, no) => {
  const s = Object.assign(document.createElement("script"), { src: FFLATE[0], integrity: FFLATE[1], crossOrigin: "anonymous", onload: () => ok(window.fflate), onerror: no });
  document.head.append(s);
});
const sayAg = (text, kind = "") => { const el = $("ag-msg"); el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); };
const fmtSize = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : (n / 1048576).toFixed(1) + " MB";
const qp = path => "?path=" + encodeURIComponent(path);

// One agent request; throws Error(message) with the agent's {"error"} text when not OK
async function agent(path, opts = {}, ms = 15000) {
  const headers = { ...(opts.headers || {}), "X-Agent-Pin": ps5.pin };
  const r = await ps5Fetch(path, { ...opts, headers }, ms, ps5.aport);
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j?.error || "HTTP " + r.status); e.status = r.status; e.body = j; throw e; }
  return j;
}

function saveAgent() {
  const pin = $("ag-pin").value.trim(), aport = Number($("ag-port").value) || 8686;
  const ldrPort = Number($("ag-ldr-port")?.value) || 9021;
  if (!savePs5()) return false;
  if (!validPort(aport)) { sayAg(t("ps5BadIp"), "err"); return false; }
  ps5 = { ...ps5, pin, aport, ldrPort }; store.set("ps5", ps5); return true;
}

async function agentPair(quiet) {
  if (!saveAgent()) return false;
  if (!quiet) sayAg(t("ps5Testing"));
  try {
    const j = await agent("/api/info", {}, 5000);
    if (!j?.auth) { sayAg(t("agBadPin"), "err"); return false; }
    sayAg(t("agPaired", { v: j.version, free: fmtSize(j.free || 0) }), "ok");
    return true;
  } catch { sayAg(t("agNoAgent"), "err"); return false; }
}

/* ---------- Agent folder picker (folders only) ---------- */
async function agentBrowse(path) {
  const box = $("ag-fs");
  box.hidden = false;
  box.innerHTML = `<p class="loading">${esc(t("loading"))}</p>`;
  try {
    const list = await agent("/api/ls" + qp(path), {}, 8000);
    const dirs = list.filter(x => x.dir).sort((a, b) => cmp(a.name, b.name));
    const parent = path.replace(/\/[^/]+$/, "") || "/data";
    let html = `<div class="fs-bar"><code class="fs-path">${esc(path)}</code>` +
      (path !== "/data" ? `<button class="btn small" data-ag-dir="${esc(parent)}">↑ ${esc(t("ps5Up"))}</button>` : "") + `</div>`;
    html += `<button class="btn small primary" data-ag-use="${esc(path)}">${esc(t("agUseDir"))}</button>`;
    for (const d of dirs) {
      const full = path + "/" + d.name;
      html += `<button class="fs-i" data-ag-dir="${esc(full)}">${FOLDER} ${esc(d.name)}</button>`;
    }
    if (!dirs.length) html += `<p class="hint">${esc(t("ps5Empty"))}</p>`;
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = `<p class="msg err">${esc(e.status === 401 ? t("agBadPin") : e.status ? e.message : t("agNoAgent"))}</p>`;
  }
}

/* ---------- Build the upload list (extracts .zip files in the browser) ---------- */
// Clean a path inside a zip: drop empty/"." parts; entries with ".." are skipped (zip-slip guard)
const cleanParts = name => {
  const parts = name.replace(/\\/g, "/").split("/").filter(p => p && p !== ".");
  return parts.includes("..") ? [] : parts;
};
const unzipAsync = (fflate, bytes) => new Promise((ok, no) => fflate.unzip(bytes, (err, out) => (err ? no(err) : ok(out))));

async function buildPlan(files, dest, unzip, opts = {}) {
  const items = [], dirs = [];
  for (const f of files) {
    if (!(unzip && /\.zip$/i.test(f.name))) { items.push({ path: `${dest}/${f.name}`, data: f, size: f.size }); continue; }
    $("ag-ptext").textContent = t("agReading", { f: f.name });
    let entries;
    try {
      const fflate = await loadFflate();
      entries = await unzipAsync(fflate, new Uint8Array(await f.arrayBuffer()));
    } catch { throw new Error(t("agBadZip", { f: f.name })); }
    const names = Object.keys(entries).map(n => ({ n, parts: cleanParts(n) })).filter(x => x.parts.length);
    // A zip with one wrapper folder ("MyApp/...") keeps that name and lands in dest/MyApp;
    // a flat zip lands in dest/<zip name> so two archives never mix in the same folder.
    const tops = [...new Set(names.map(x => x.parts[0]))];
    const isDir = x => x.n.endsWith("/");
    const oneTop = tops.length === 1 && names.every(x => isDir(x) || x.parts.length > 1);
    // opts.root = an explicit app folder (projects.json "install.dir"); the wrapper folder is
    // then dropped so the files do not end up one level too deep.
    const root = opts.root || (oneTop ? dest : `${dest}/${f.name.replace(/\.zip$/i, "")}`);
    const drop = opts.root && oneTop ? 1 : 0;
    for (const x of names) {
      const parts = drop ? x.parts.slice(drop) : x.parts;
      if (!parts.length) continue;
      const path = `${root}/${parts.join("/")}`;
      if (isDir(x)) dirs.push(path);
      else items.push({ path, data: entries[x.n], size: entries[x.n].length });
    }
  }
  return { items, dirs };
}

/* ---------- Send the list in 8 MB chunks (resumes after a dropped chunk) ---------- */
const CHUNK = 8 * 1024 * 1024;
let agCancel = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function putFile(item, onBytes) {
  let offset = 0, tries = 0;
  do {
    if (agCancel) throw new Error(t("agCancelled"));
    const end = Math.min(offset + CHUNK, item.size);
    const body = item.data instanceof Blob ? item.data.slice(offset, end) : item.data.subarray(offset, end);
    try {
      const j = await agent(`/api/upload${qp(item.path)}&offset=${offset}`, { method: "PUT", body }, 120000);
      onBytes(j.size - offset);
      offset = j.size;
      tries = 0;
    } catch (e) {
      if (e.status === 409 && Number.isFinite(e.body?.size)) { offset = e.body.size; continue; } // resume
      if (e.status || ++tries > 3) throw e; // agent said no (PIN, path, disk) or network down 3 times
      await sleep(1500 * tries);
    }
  } while (offset < item.size);
}

async function agentSend(files, destOverride) {
  if (!saveAgent()) return;
  if (!ps5.pin) { sayAg(t("agNeedPair"), "err"); return; }
  const dest = String(destOverride || $("ag-dest").value).trim().replace(/\/+$/, "");
  const prog = $("ag-prog"), bar = $("ag-bar"), txt = $("ag-ptext");
  $("ag-done").hidden = true;
  prog.hidden = false; bar.value = 0; agCancel = false;
  try {
    const plan = await buildPlan(files, dest, $("ag-unzip").checked);
    const total = plan.items.reduce((s, x) => s + x.size, 0);
    if (!confirm(t("agConfirm", { n: plan.items.length, mb: (total / 1048576).toFixed(1), d: dest }))) { prog.hidden = true; return; }
    for (const d of plan.dirs) await agent("/api/mkdir" + qp(d), { method: "POST" });
    let sent = 0;
    for (const [i, item] of plan.items.entries()) {
      const show = () => {
        bar.value = total ? sent / total : 1;
        txt.textContent = t("agSending", { i: i + 1, n: plan.items.length, f: item.path.split("/").pop(), p: Math.round(bar.value * 100) });
      };
      show();
      await putFile(item, n => { sent += n; show(); });
    }
    bar.value = 1;
    prog.hidden = true;
    showDone(plan.items, dest);
  } catch (e) {
    txt.textContent = t("agFail", { e: e.status === 401 ? t("agBadPin") : e instanceof TypeError || e.name === "AbortError" ? t("agNoAgent") : e.message });
  }
}

// After an upload: summary + "run" buttons for any .elf that was sent
function showDone(items, dest) {
  const box = $("ag-done");
  const elfs = items.filter(x => /\.elf$/i.test(x.path));
  box.innerHTML = `<p class="msg ok">${esc(t("agDone", { n: items.length, d: dest }))}</p>` +
    elfs.map(x => `<button class="fs-i file" data-ag-run="${esc(x.path)}">${ICON.play} ${esc(x.path.replace(dest + "/", ""))}</button>`).join("");
  box.hidden = false;
  toast(t("agDone", { n: items.length, d: dest }));
}

async function agentRun(path) {
  if (!confirm(t("agRunQ", { f: path }) + "\n\n" + t("ps5RunWarn"))) return;
  const port = ps5.ldrPort || 9021;
  try { await agent(`/api/run${qp(path)}&port=${port}`, { method: "POST" }, 30000); toast(t("ps5Sent")); addHist(path.split("/").pop() || path, "console", { path }); }
  catch (e) { alert(t("ps5RunFail", { s: e.status ? e.message : "network" })); }
}

async function agentRunDirect(file, targetPort = ps5.ldrPort || 9021) {
  if (!saveAgent()) return false;
  if (!ps5.pin) { sayAg(t("agNeedPair"), "err"); return false; }
  toast(t("ps5Sending"));
  try {
    const name = encodeURIComponent(file.name || "payload.elf");
    await agent(`/api/run-direct?port=${targetPort}&name=${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file
    }, 60000);
    toast(t("agDirectSent", { port: targetPort }));
    addHist(file.name || "payload.elf", "stream");
    return true;
  } catch (e) {
    const s = e.status === 401 ? t("agBadPin") : e.status ? e.message : (e.name === "AbortError" ? "timeout" : "network");
    alert(t("ps5RunFail", { s }) + (s === "network" ? "\n\n" + t("ps5Fail") : ""));
    return false;
  }
}

/* ---------- Agent events ---------- */
$("ag-pair").onclick = () => agentPair();
$("ag-pin").addEventListener("keydown", e => { if (e.key === "Enter") agentPair(); });
if ($("ag-ldr-port")) $("ag-ldr-port").onchange = () => saveAgent();
if ($("ag-run-file")) $("ag-run-file").onchange = e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  if (!saveAgent()) return;
  if (!ps5.pin) { sayAg(t("agNeedPair"), "err"); return; }
  const port = Number($("ag-ldr-port")?.value) || ps5.ldrPort || 9021;
  askRun([{ name: f.name, size: f.size, file: f }], f.name, `agent-${port}`);
};
$("ag-browse").onclick = () => { if (saveAgent()) agentBrowse($("ag-dest").value.trim().replace(/\/+$/, "") || "/data/homebrew"); };
$("ag-fs").addEventListener("click", e => {
  const d = e.target.closest("[data-ag-dir]"); if (d) return agentBrowse(d.dataset.agDir);
  const u = e.target.closest("[data-ag-use]"); if (u) { $("ag-dest").value = u.dataset.agUse; $("ag-fs").hidden = true; }
});
$("ag-files").onchange = e => { const files = [...e.target.files]; e.target.value = ""; if (files.length) agentSend(files); };
$("ag-cancel").onclick = () => { agCancel = true; };
$("ag-done").addEventListener("click", e => { const b = e.target.closest("[data-ag-run]"); if (b) agentRun(b.dataset.agRun); });
// Fill the agent fields whenever the PS5 dialog opens (called from openPs5)
function agentOnOpen() {
  $("ag-pin").value = ps5.pin || ""; $("ag-port").value = ps5.aport || 8686;
  if ($("ag-ldr-port")) $("ag-ldr-port").value = String(ps5.ldrPort || 9021);
  $("ag-fs").hidden = true; sayAg("");
  if (ps5Ready() && ps5.pin) agentPair(true);
}

/* =========================================================
   v9 · Text editor, SHA-256 checking, payload library and run queue

   All of this is front-end only — no new agent endpoints:
     read a file    GET  /fs/<path>              (websrv, port 8080)
     write a file   PUT  /api/upload?offset=0    (PS5Links Agent: truncates and rewrites)
     run a Blob     POST /api/run-direct         (agent) or POST /elfldr (websrv)
   ========================================================= */
Object.assign(I18N.en, {
  fileEdit: "Edit", fileDownload: "Download", verifyRun: "Check SHA-256 before running",
  verifyChecking: "Downloading {n} to check it…", verifyOk: "SHA-256 matches: {n}",
  verifyAsk: "{n} does NOT match the published SHA-256.\n\nExpected: {e}…\nGot:      {g}…\n\nRun it anyway? That can happen when a release file was replaced, but treat it as a warning.",
  edFormat: "Tidy", edSave: "Save", edSaving: "Saving…", edSaved: "Saved ({n})",
  edLoaded: "{n} chars · {l} lines · UTF-8", edTooBig: "This file is too big to edit ({n}). Download it instead.",
  edLoadFail: "Could not read the file: {e}", edSaveFail: "Could not save: {e}",
  edNeedPair: "Pair with PS5Links Agent (PIN) before saving.",
  edFormatted: "JSON formatted", edInvalid: "Invalid JSON: {e}", edTidied: "Trailing spaces trimmed",
  libTitle: "Payload library & run queue", libSaved: "Saved on this device", libAdd: "Save",
  libAddUrl: "Add a payload from a link", libHint: "Payloads are kept in this browser only. Nothing is uploaded anywhere.",
  libEmpty: "Nothing saved yet. Use the save button next to a release file, or paste a link above.",
  libStoring: "Downloading {n}…", libStored: "Saved {n} on this device", libFail: "Could not save: {e}",
  libRemoved: "Removed", libQueue: "Add to run queue", libDl: "Download to this device",
  libHashMismatch: "{n} does not match the published SHA-256 ({e}… vs {g}…), so it was not saved.",
  verifyH: "Check SHA-256 before running",
  verifyHint: "Downloads the payload in this browser first and compares it with the hash GitHub published. Safer, but it uses more data.",
  qH: "Run queue", qDelay: "Pause between payloads (seconds)", qRun: "Run queue", qSave: "Save as preset",
  qClear: "Clear queue", qEmpty: "The queue is empty. Add payloads from the library below.",
  qRunning: "Running {i}/{n}: {f}", qDone: "Queue finished ({n})", qFail: "Stopped at {f}",
  qPresetName: "Preset name", qPresetSaved: "Preset saved", qPresets: "Presets",
});
Object.assign(I18N.th, {
  fileEdit: "แก้ไข", fileDownload: "ดาวน์โหลด", verifyRun: "ตรวจ SHA-256 ก่อนรัน",
  verifyChecking: "กำลังดาวน์โหลด {n} เพื่อตรวจสอบ…", verifyOk: "SHA-256 ตรงกัน: {n}",
  verifyAsk: "{n} ไม่ตรงกับ SHA-256 ที่ประกาศไว้\n\nที่คาดไว้: {e}…\nที่ได้:     {g}…\n\nยังจะรันต่อไหม? อาจเกิดจากการแทนไฟล์รีลีส แต่ให้ถือเป็นคำเตือน",
  edFormat: "จัดรูปแบบ", edSave: "บันทึก", edSaving: "กำลังบันทึก…", edSaved: "บันทึกแล้ว ({n})",
  edLoaded: "{n} ตัวอักษร · {l} บรรทัด · UTF-8", edTooBig: "ไฟล์ใหญ่เกินกว่าจะแก้ไข ({n}) ให้ดาวน์โหลดแทน",
  edLoadFail: "อ่านไฟล์ไม่ได้: {e}", edSaveFail: "บันทึกไม่ได้: {e}",
  edNeedPair: "ต้องจับคู่กับ PS5Links Agent (PIN) ก่อนจึงจะบันทึกได้",
  edFormatted: "จัดรูปแบบ JSON แล้ว", edInvalid: "JSON ไม่ถูกต้อง: {e}", edTidied: "ตัดช่องว่างท้ายบรรทัดแล้ว",
  libTitle: "คลัง payload และชุดรัน", libSaved: "เก็บไว้ในเครื่องนี้", libAdd: "เก็บ",
  libAddUrl: "เพิ่ม payload จากลิงก์", libHint: "payload เก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ได้อัปโหลดไปที่ไหน",
  libEmpty: "ยังไม่มีอะไรในคลัง ใช้ปุ่มเก็บข้างไฟล์รีลีส หรือวางลิงก์ด้านบน",
  libStoring: "กำลังดาวน์โหลด {n}…", libStored: "เก็บ {n} ไว้ในเครื่องแล้ว", libFail: "เก็บไม่ได้: {e}",
  libRemoved: "ลบแล้ว", libQueue: "เพิ่มเข้าชุดรัน", libDl: "ดาวน์โหลดลงเครื่องนี้",
  libHashMismatch: "{n} ไม่ตรงกับ SHA-256 ที่ประกาศไว้ ({e}… vs {g}…) จึงไม่บันทึก",
  verifyH: "ตรวจ SHA-256 ก่อนรัน",
  verifyHint: "ดาวน์โหลด payload มาที่เบราว์เซอร์นี้ก่อน แล้วเทียบกับค่า hash ที่ GitHub ประกาศไว้ ปลอดภัยขึ้นแต่ใช้ข้อมูลมากขึ้น",
  qH: "ชุดรัน", qDelay: "หน่วงระหว่าง payload (วินาที)", qRun: "รันทั้งชุด", qSave: "บันทึกเป็นพรีเซต",
  qClear: "ล้างชุดรัน", qEmpty: "ชุดรันว่างอยู่ เพิ่ม payload จากคลังด้านล่าง",
  qRunning: "กำลังรัน {i}/{n}: {f}", qDone: "รันครบชุดแล้ว ({n})", qFail: "หยุดที่ {f}",
  qPresetName: "ชื่อพรีเซต", qPresetSaved: "บันทึกพรีเซตแล้ว", qPresets: "พรีเซต",
});
applyI18n();

/* ---------- Shared helpers ---------- */
// SHA-256 of a Blob as hex ("" when WebCrypto is unavailable, e.g. on a plain http page)
async function sha256Hex(blob) {
  if (!globalThis.crypto?.subtle) return "";
  const d = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// Plain download from an https link (GitHub release assets send Access-Control-Allow-Origin *)
async function fetchBlob(url) {
  const r = await fetch(url, { cache: "no-store", mode: "cors" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.blob();
}
// Read a file from the console through websrv's /fs (no PIN needed)
async function readPs5File(path) {
  const r = await ps5Fetch("/fs" + fsEnc(path), {}, 60000);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.blob();
}
// Send a Blob to the console: the agent streams it straight into the ELF loader when it is
// paired, otherwise websrv takes a multipart POST. Returns true when the console accepted it.
async function sendBlob(blob, name) {
  const label = name || "payload.elf";
  if (ps5.pin) {
    try {
      await agent(`/api/run-direct?port=${ps5.ldrPort || 9021}&name=${encodeURIComponent(label)}`,
        { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob }, 300000);
      toast(t("ps5Sent")); addHist(label, "stream"); return true;
    } catch (e) {
      if (e.status) { alert(t("ps5RunFail", { s: e.status === 401 ? t("agBadPin") : e.message })); return false; }
      // agent not reachable -> fall through to websrv
    }
  }
  try {
    const fd = new FormData();
    fd.append("elf", blob, label);
    const r = await ps5Fetch("/elfldr", { method: "POST", body: fd }, 300000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    addHist(label, "upload");
    toast(t("ps5Sent")); return true;
  } catch (e) {
    const s = e.name === "AbortError" ? "timeout" : /^HTTP/.test(e.message || "") ? e.message : "network";
    alert(t("ps5RunFail", { s }) + (s === "network" ? "\n\n" + t("ps5Fail") : ""));
    return false;
  }
}
function saveBlobToDevice(blob, name) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name || "payload.elf", target: "_self" });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
// Pull a file off the console and hand it to the browser's download list
async function downloadFromPs5(path) {
  try {
    toast(t("loading"));
    saveBlobToDevice(await readPs5File(path), path.split("/").pop());
  } catch (e) {
    alert(t("edLoadFail", { e: e.message === "Failed to fetch" ? t("ps5Fail") : e.message }));
  }
}

/* =========================================================
   Text editor: read through websrv /fs, write through the agent
   Writing replaces the file in place (offset=0 truncates), so a dropped
   connection can leave a half-written file — keep a copy of anything vital.
   ========================================================= */
const ED_MAX = 2 * 1024 * 1024;
let edPath = "", edOriginal = "";
const sayEd = (text, kind = "") => { const el = $("ed-msg"); el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); };

async function openEditor(path, size) {
  if (size > ED_MAX) return alert(t("edTooBig", { n: fmtSize(size) }));
  edPath = path; edOriginal = "";
  $("ed-title").textContent = path.split("/").pop();
  $("ed-sub").textContent = path;
  $("ed-text").value = "";
  sayEd(t("loading"));
  $("editor").showModal();
  try {
    const blob = await readPs5File(path);
    if (blob.size > ED_MAX) throw new Error(t("edTooBig", { n: fmtSize(blob.size) }));
    const text = await blob.text();
    edOriginal = text;
    $("ed-text").value = text;
    sayEd(t("edLoaded", { n: text.length, l: text.split("\n").length }));
  } catch (e) {
    sayEd(t("edLoadFail", { e: e.message === "Failed to fetch" ? t("ps5Fail") : e.message }), "err");
  }
}
$("ed-text").addEventListener("input", () => {
  $("ed-title").textContent = (edPath.split("/").pop() || "file") + ($("ed-text").value !== edOriginal ? " •" : "");
});
$("ed-format").onclick = () => {
  const text = $("ed-text").value;
  if (/\.json$/i.test(edPath) || /^\s*[[{]/.test(text)) {
    try {
      $("ed-text").value = JSON.stringify(JSON.parse(text), null, 2) + "\n";
      sayEd(t("edFormatted"), "ok");
    } catch (e) { sayEd(t("edInvalid", { e: e.message }), "err"); }
    return;
  }
  $("ed-text").value = text.split("\n").map(l => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n*$/, "\n");
  sayEd(t("edTidied"), "ok");
};
$("ed-save").onclick = async () => {
  if (!ps5.pin) return sayEd(t("edNeedPair"), "err");
  const text = $("ed-text").value;
  $("ed-save").disabled = true;
  sayEd(t("edSaving"));
  try {
    const body = new TextEncoder().encode(text);
    const j = await agent(`/api/upload${qp(edPath)}&offset=0`, {
      method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body,
    }, 60000);
    edOriginal = text;
    $("ed-title").textContent = edPath.split("/").pop();
    const msg = t("edSaved", { n: fmtSize(j?.size ?? body.length) });
    sayEd(msg, "ok"); toast(msg);
  } catch (e) {
    sayEd(t("edSaveFail", { e: e.status === 401 ? t("agBadPin") : e.status ? e.message : t("agNoAgent") }), "err");
  }
  $("ed-save").disabled = false;
};

/* =========================================================
   Payload library (IndexedDB): keep .elf files on this device so they
   can be sent again without downloading them from GitHub a second time
   ========================================================= */
const DB_NAME = "ps5links", DB_STORE = "payloads";
let dbPromise;
function openDb() {
  return dbPromise ??= new Promise((ok, no) => {
    if (!globalThis.indexedDB) return no(new Error("IndexedDB is not available in this browser"));
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => {
      const d = rq.result;
      if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE, { keyPath: "key" });
    };
    rq.onsuccess = () => ok(rq.result);
    rq.onerror = () => no(rq.error);
  });
}
// Run one IndexedDB request inside a fresh transaction and resolve when it commits
function idb(mode, fn) {
  return openDb().then(d => new Promise((ok, no) => {
    const tx = d.transaction(DB_STORE, mode);
    const rq = fn(tx.objectStore(DB_STORE));
    tx.oncomplete = () => ok(rq ? rq.result : undefined);
    tx.onerror = () => no(tx.error);
    tx.onabort = () => no(tx.error);
  }));
}
const libAll = () => idb("readonly", s => s.getAll()).catch(() => []);
const libGet = k => idb("readonly", s => s.get(k)).catch(() => null);
const libPut = r => idb("readwrite", s => s.put(r));
const libDel = k => idb("readwrite", s => s.delete(k));
const libKey = o => String(o.sha256 || o.url || "").toLowerCase();
const sayQ = (text, kind = "") => { const el = $("q-msg"); el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); };

// Download a link once, check it against the published hash, then keep it locally
async function savePayload({ url, name, size = 0, sha256 = "" }) {
  if (!/^https:\/\//i.test(url || "")) return toast(t("validLink"));
  const label = name || url.split("/").pop() || url;
  try {
    sayQ(t("libStoring", { n: label }));
    const blob = await fetchBlob(url);
    let hash = String(sha256 || "").toLowerCase();
    const got = await sha256Hex(blob);
    if (hash && got && got !== hash) {
      const m = t("libHashMismatch", { n: label, e: hash.slice(0, 16), g: got.slice(0, 16) });
      sayQ(m, "err"); alert(m);
      return false;
    }
    hash = hash || got;
    await libPut({ key: libKey({ sha256: hash, url }), name: label, url, size: blob.size, sha256: hash, blob, added: Date.now() });
    sayQ(t("libStored", { n: label }), "ok");
    toast(t("libStored", { n: label }));
    if ($("library").open) drawLib();
    return true;
  } catch (e) {
    const m = t("libFail", { e: e.message === "Failed to fetch" ? t("ps5Fail") : e.message || "network" });
    sayQ(m, "err"); toast(m);
    return false;
  }
}
window.savePayload = savePayload;   // used by the Assets list in app.js

/* =========================================================
   Run queue + presets
   ========================================================= */
let queue = store.get("queue", []);          // [{ key, name, url, size, sha256 }]
let presets = store.get("presets", []);      // [{ name, delay, items: [...] }]
const saveQueue = () => store.set("queue", queue);

function drawQueue() {
  $("q-list").innerHTML = queue.length ? queue.map((it, i) => `<div class="lib-i">
      <span class="lib-n"><b>${i + 1}. ${esc(it.name)}</b><span class="asset-meta">${esc(fmtSize(it.size || 0))}</span></span>
      <span class="acts">
        <button class="act copy" data-q-up="${i}" aria-label="move up">↑</button>
        <button class="act copy" data-q-down="${i}" aria-label="move down">↓</button>
        <button class="act rm" data-q-del="${i}">${esc(t("remove"))}</button>
      </span></div>`).join("") : `<p class="hint">${esc(t("qEmpty"))}</p>`;
}
function drawPresets() {
  $("q-presets").innerHTML = presets.length
    ? `<p class="set-h">${esc(t("qPresets"))}</p>` + presets.map((p, i) => `<div class="lib-i">
        <span class="lib-n"><b>${esc(p.name)}</b><span class="asset-meta">${p.items.length} · ${Number(p.delay) || 0}s</span></span>
        <span class="acts">
          <button class="act run" data-p-run="${i}" title="${esc(t("qRun"))}" aria-label="${esc(t("qRun"))}">${ICON.play}</button>
          <button class="act rm" data-p-del="${i}">${esc(t("remove"))}</button>
        </span></div>`).join("")
    : "";
}
async function drawLib() {
  const isFav = k => favs.includes(k);
  const list = (await libAll()).sort((a, b) => (isFav(b.key) ? 1 : 0) - (isFav(a.key) ? 1 : 0) || cmp(a.name || "", b.name || ""));
  $("lib-list").innerHTML = list.length ? list.map(r => `<div class="lib-i">
      <button class="act star${isFav(r.key) ? " on" : ""}" data-lib-fav="${esc(r.key)}" title="${esc(t(isFav(r.key) ? "favDel" : "favAdd"))}" aria-label="${esc(t(isFav(r.key) ? "favDel" : "favAdd"))}">${ICON.star}</button>
      <span class="lib-n"><b>${esc(r.name)}</b><span class="asset-meta">${esc(fmtSize(r.size))}${r.sha256 ? ` · sha256 ${esc(String(r.sha256).slice(0, 10))}…` : ""}</span></span>
      <span class="acts">
        <button class="act run" data-lib-run="${esc(r.key)}" title="${esc(t("ps5Run"))}" aria-label="${esc(t("ps5Run"))}">${ICON.play}</button>
        <button class="act copy" data-lib-q="${esc(r.key)}" title="${esc(t("libQueue"))}" aria-label="${esc(t("libQueue"))}">${ICON.box}</button>
        <button class="act copy" data-lib-dl="${esc(r.key)}" title="${esc(t("libDl"))}" aria-label="${esc(t("libDl"))}">${ICON.dl}</button>
        <button class="act rm" data-lib-del="${esc(r.key)}">${esc(t("remove"))}</button>
      </span></div>`).join("") : `<p class="hint">${esc(t("libEmpty"))}</p>`;
  drawQueue(); drawPresets(); drawHist();
}

// Send every item in order, reusing the local copy when there is one
async function runQueue(items = queue) {
  if (!items.length) return sayQ(t("qEmpty"), "err");
  if (!ps5Ready()) { openPs5(); say5(t("ps5Need"), "err"); return; }
  const delay = Math.max(0, Math.min(300, Number($("q-delay").value) || 0)) * 1000;
  for (const [i, it] of items.entries()) {
    sayQ(t("qRunning", { i: i + 1, n: items.length, f: it.name }), "ok");
    let blob = (await libGet(it.key))?.blob;
    if (!blob) {
      try { blob = await fetchBlob(it.url); }
      catch { return sayQ(t("qFail", { f: it.name }), "err"); }
      const got = await sha256Hex(blob);
      if (it.sha256 && got && got !== String(it.sha256).toLowerCase()) return sayQ(t("qFail", { f: it.name }), "err");
      await libPut({ key: it.key, name: it.name, url: it.url, size: blob.size, sha256: got || it.sha256 || "", blob, added: Date.now() }).catch(() => {});
    }
    if (!(await sendBlob(blob, it.name))) return sayQ(t("qFail", { f: it.name }), "err");
    if (i < items.length - 1 && delay) await sleep(delay);
  }
  sayQ(t("qDone", { n: items.length }), "ok");
  drawLib();
}

/* ---------- Library dialog events ---------- */
$("open-lib").onclick = () => {
  $("q-delay").value = String(store.get("qd", 3));
  sayQ("");
  drawLib();
  $("library").showModal();
};
$("q-delay").onchange = () => store.set("qd", Math.max(0, Math.min(300, Number($("q-delay").value) || 0)));
$("lib-add").onclick = async () => {
  const url = $("lib-url").value.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) return toast(t("validLink"));
  $("lib-add").disabled = true;
  await savePayload({ url, name: url.split("/").pop().split("?")[0] });
  $("lib-add").disabled = false;
  $("lib-url").value = "";
};
$("q-run").onclick = () => runQueue();
$("q-clear").onclick = () => { queue = []; saveQueue(); drawQueue(); sayQ(""); };
$("q-save").onclick = () => {
  if (!queue.length) return sayQ(t("qEmpty"), "err");
  const name = prompt(t("qPresetName"), `${queue.length} payloads`);
  if (!name) return;
  const clean = name.slice(0, 60);
  presets = [...presets.filter(p => p.name !== clean), { name: clean, delay: Number($("q-delay").value) || 0, items: queue.map(x => ({ ...x })) }];
  store.set("presets", presets);
  drawPresets();
  toast(t("qPresetSaved"));
};
$("library").addEventListener("click", async e => {
  const run = e.target.closest("[data-lib-run]");
  if (run) {
    const r = await libGet(run.dataset.libRun);
    if (r) askRun([{ name: r.name, size: r.size, file: r.blob }], r.name, ps5.pin ? (ps5.ldrPort === 9020 ? "agent-9020" : "agent-9021") : "websrv");
    return;
  }
  const q = e.target.closest("[data-lib-q]");
  if (q) {
    const r = await libGet(q.dataset.libQ);
    if (r && !queue.some(x => x.key === r.key)) {
      queue = [...queue, { key: r.key, name: r.name, url: r.url, size: r.size, sha256: r.sha256 || "" }];
      saveQueue(); drawQueue(); sayQ(t("libQueue"), "ok");
    }
    return;
  }
  const dl = e.target.closest("[data-lib-dl]");
  if (dl) { const r = await libGet(dl.dataset.libDl); if (r) saveBlobToDevice(r.blob, r.name); return; }
  const fav = e.target.closest("[data-lib-fav]");
  if (fav) { toggleFav(fav.dataset.libFav); drawLib(); return; }
  const del = e.target.closest("[data-lib-del]");
  if (del) { await libDel(del.dataset.libDel); toast(t("libRemoved")); drawLib(); return; }
  const up = e.target.closest("[data-q-up]");
  if (up) { const i = Number(up.dataset.qUp); if (i > 0) { [queue[i - 1], queue[i]] = [queue[i], queue[i - 1]]; saveQueue(); drawQueue(); } return; }
  const dn = e.target.closest("[data-q-down]");
  if (dn) { const i = Number(dn.dataset.qDown); if (i < queue.length - 1) { [queue[i + 1], queue[i]] = [queue[i], queue[i + 1]]; saveQueue(); drawQueue(); } return; }
  const qd = e.target.closest("[data-q-del]");
  if (qd) { queue.splice(Number(qd.dataset.qDel), 1); saveQueue(); drawQueue(); return; }
  const pr = e.target.closest("[data-p-run]");
  if (pr) {
    const p = presets[Number(pr.dataset.pRun)];
    if (p) { $("q-delay").value = String(p.delay || 0); store.set("qd", p.delay || 0); runQueue(p.items); }
    return;
  }
  const pd = e.target.closest("[data-p-del]");
  if (pd) { presets.splice(Number(pd.dataset.pDel), 1); store.set("presets", presets); drawPresets(); }
});

/* ---------- SHA-256 setting (Settings dialog, wired by app.js) ---------- */
function syncPs5Settings() {
  const on = ps5.verify !== false;
  $$("#set-verify button").forEach(b => b.setAttribute("aria-pressed", String(on) === (b.dataset.verify === "1" ? "true" : "false")));
}
window.syncPs5Settings = syncPs5Settings;
$("set-verify").onclick = e => {
  const b = e.target.closest("[data-verify]"); if (!b) return;
  ps5 = { ...ps5, verify: b.dataset.verify === "1" };
  store.set("ps5", ps5);
  syncPs5Settings();
};

/* =========================================================
   v10 · Install a release archive, or save it as a file
   Everything runs in this browser: the .zip is downloaded from
   GitHub, its SHA-256 is checked, and the bytes are then either
   extracted into a folder on the PS5 (Install) or written as a
   plain file (Save). The console needs no download/unzip code.
   ========================================================= */
Object.assign(I18N.en, {
  inH: "Install or download", inZips: "Release archive", inMode: "Action",
  inModeApp: "Install (extract)", inModeFile: "Save the .zip", inSaveBtn: "Save",
  inNoZip: "This project has no .zip release yet.",
  inDownload: "Downloading {f}…", inExtract: "Extracting {f}…", inMkdir: "Creating folders…",
  inSave: "Saving {f}…", inDone: "Installed {n} file(s) in {d}", inSaved: "Saved {f}",
  inFail: "Failed: {e}", inFree: "{n} free on the console",
  inDestUsed: "“{d}” already holds {n} folder(s). Files with the same name are replaced.",
  inKindApp: "PS5 app", inKindOther: "Other",
  inOtherHint: "Desktop builds and source bundles do not belong in /data/homebrew — save them as a file instead.",
  inOpenDir: "Open the folder",
});
Object.assign(I18N.th, {
  inH: "ติดตั้งหรือดาวน์โหลด", inZips: "ไฟล์เก็บถาวรของรีลีส", inMode: "จะทำอะไร",
  inModeApp: "ติดตั้ง (แตกไฟล์)", inModeFile: "บันทึกเป็นไฟล์ .zip", inSaveBtn: "บันทึก",
  inNoZip: "โปรเจกต์นี้ยังไม่มีรีลีส .zip",
  inDownload: "กำลังดาวน์โหลด {f}…", inExtract: "กำลังแตกไฟล์ {f}…", inMkdir: "กำลังสร้างโฟลเดอร์…",
  inSave: "กำลังบันทึก {f}…", inDone: "ติดตั้ง {n} ไฟล์ ใน {d}", inSaved: "บันทึก {f} แล้ว",
  inFail: "ไม่สำเร็จ: {e}", inFree: "ว่างบนเครื่อง {n}",
  inDestUsed: "“{d}” มีโฟลเดอร์อยู่แล้ว {n} โฟลเดอร์ ไฟล์ชื่อซ้ำจะถูกแทนที่",
  inKindApp: "แอป PS5", inKindOther: "อื่นๆ",
  inOtherHint: "ไฟล์สำหรับ PC หรือซอร์สโค้ดไม่ควรอยู่ใน /data/homebrew — บันทึกเป็นไฟล์แทน",
  inOpenDir: "เปิดโฟลเดอร์",
});
applyI18n();

const IN_DEST = "inDest", IN_DL = "inDestFile";
let inZips = [], inZip = null, inProj = null, inCancel = false, inMode = "app";
const sayIn = (text, kind = "") => { const el = $("in-msg"); el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); };
const inStep = (key, vars = {}) => { $("in-step").textContent = t(key, vars); };
const hasApp = () => inZips.some(z => z.kind === "app");

/* Every zip the newest releases carry (newest first), apps before desktop/source builds */
function allZips(p) {
  const seen = new Set(), out = [];
  for (const r of [latest(p), p.stable, p.pre].filter(Boolean)) {
    for (const z of r.zips || []) {
      if (!/^https:\/\//i.test(z.url) || seen.has(z.url)) continue;
      seen.add(z.url);
      out.push({ ...z, kind: p.install?.kind || z.kind || "app", tag: r.tag });
    }
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "app" ? -1 : 1));
}
// "install.zip" from projects.json picks one archive when a release carries several
function pickZip(p, zips) {
  if (!zips.length) return null;
  const pref = (p.install?.zip || "").toLowerCase();
  return (pref && zips.find(z => z.name.toLowerCase().includes(pref))) || zips.find(z => z.kind === "app") || zips[0];
}
// Archive name without extension and version tail: "App-1.2.3.zip" -> "App"
const zipBase = n => n.replace(/\.zip$/i, "").replace(/[-_. ]?v?\d+(?:[._]\d+)*.*$/i, "").replace(/[-_. ]+$/, "") || n.replace(/\.zip$/i, "");
const cleanDir = s => String(s).replace(/[^\w.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");

// Folder that really received the files: buildPlan keeps the archive's own wrapper folder
function appRootOf(items, dest) {
  const rel = items.map(x => x.path.slice(dest.length + 1));
  const firsts = [...new Set(rel.map(r => r.split("/")[0]))];
  return firsts.length === 1 && rel.some(r => r.includes("/")) ? `${dest}/${firsts[0]}` : dest;
}

// Destination for the current mode (remembered per mode)
function inDestValue() {
  const fallback = inMode === "app" ? "/data/homebrew" : "/data/downloads";
  return store.get(inMode === "app" ? IN_DEST : IN_DL) || fallback;
}
function inApplyMode() {
  if (inMode === "app" && !hasApp()) inMode = "file";
  $("in-mode").hidden = !hasApp();
  $$("#in-mode button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.inmode === inMode)));
  $("in-dest").value = inDestValue();
  for (const r of $$("#in-zips input[name=inz]")) r.closest("label").classList.toggle("dim", inMode === "app" && inZips[Number(r.value)]?.kind !== "app");
  $("in-hint").textContent = inMode === "app" ? "" : t("inOtherHint");
  $("in-go").textContent = t(inMode === "app" ? "install" : "inSaveBtn");
}
async function inRefreshFree() {
  try { const j = await agent("/api/info", {}, 5000); $("in-free").textContent = j?.free ? t("inFree", { n: fmtSize(j.free) }) : ""; }
  catch { $("in-free").textContent = ""; }
}
// Warn when the destination folder already has content (files with the same name get replaced)
async function inCheckDest() {
  const warn = $("in-warn");
  warn.hidden = true;
  if (inMode !== "app") return;
  const dest = inDestValue().replace(/\/+$/, "");
  try {
    const list = await agent("/api/ls" + qp(dest), {}, 6000);
    if (list.length) { warn.textContent = t("inDestUsed", { d: dest, n: list.filter(x => x.dir).length }); warn.hidden = false; }
  } catch { /* the folder does not exist yet */ }
}

async function installProject(p) {
  if (!ps5Ready()) { openPs5(); say5(t("ps5Need"), "err"); return; }
  if (!ps5.pin) { openPs5(); sayAg(t("agNeedPair"), "err"); return; }
  inProj = p;
  inZips = allZips(p);
  if (!inZips.length) return toast(t("inNoZip"));
  inZip = pickZip(p, inZips);
  inMode = inZip.kind === "app" ? "app" : "file";
  $("in-title").textContent = `${t("inH")}: ${p.name}`;
  $("in-sub").textContent = `${inZip.name} · ${fmtSize(inZip.size || 0)}${inZip.sha256 ? ` · sha256 ${inZip.sha256.slice(0, 12)}…` : ""}`;
  $("in-zips").innerHTML = `<p class="set-h">${esc(t("inZips"))}</p>` + inZips.map((z, i) =>
    `<label class="runq-f"><input type="radio" name="inz" value="${i}"${z.url === inZip.url ? " checked" : ""}>
      <span><strong>${esc(z.name)}</strong> <span class="kind kind-${z.kind}">${esc(t(z.kind === "app" ? "inKindApp" : "inKindOther"))}</span>
      <br><code>${esc(fmtSize(z.size || 0))}${z.tag ? ` · ${esc(z.tag)}` : ""}${z.sha256 ? ` · sha256 ${esc(z.sha256.slice(0, 10))}…` : ""}</code></span></label>`).join("");
  sayIn(""); $("in-step").textContent = ""; $("in-prog").hidden = true; $("in-done").hidden = true;
  inApplyMode();
  $("install").showModal();
  inRefreshFree();
  inCheckDest().catch(() => {});
}

async function doInstall() {
  if (!ps5.pin) return sayIn(t("agNeedPair"), "err");
  const sel = $("in-zips").querySelector("input[name=inz]:checked");
  if (sel) inZip = inZips[Number(sel.value)] || inZip;
  if (!inZip) return sayIn(t("inNoZip"), "err");
  const dest = $("in-dest").value.trim().replace(/\/+$/, "") || (inMode === "app" ? "/data/homebrew" : "/data/downloads");
  store.set(inMode === "app" ? IN_DEST : IN_DL, dest);
  inCancel = false; sayIn("");
  $("in-prog").hidden = false; $("in-bar").value = 0; $("in-done").hidden = true; $("in-warn").hidden = true;
  $("in-go").disabled = true;
  try {
    inStep("inDownload", { f: inZip.name });
    let blob;
    try { blob = await fetchBlob(inZip.url); }
    catch (e) { throw new Error(/^HTTP/.test(e.message || "") ? e.message : "network"); }
    if (inZip.sha256 && ps5.verify !== false) {
      const got = await sha256Hex(blob);
      if (got && got !== String(inZip.sha256).toLowerCase() &&
          !confirm(t("verifyAsk", { n: inZip.name, g: got.slice(0, 16), e: String(inZip.sha256).slice(0, 16) }))) {
        sayIn(t("agCancelled")); $("in-prog").hidden = true; return;
      }
    }
    if (inMode === "file") {                        // keep the archive exactly as published
      inStep("inSave", { f: inZip.name });
      await agent(`/api/upload${qp(dest + "/" + inZip.name)}&offset=0`, { method: "PUT", body: blob }, 300000);
      $("in-bar").value = 1; $("in-prog").hidden = true;
      inDoneBox(`<p class="msg ok">${esc(t("inSaved", { f: inZip.name }))} · ${esc(dest)}</p>`, dest);
      toast(t("inSaved", { f: inZip.name }));
      return;
    }
    inStep("inExtract", { f: inZip.name });
    const dir = inProj?.install?.dir ? cleanDir(inProj.install.dir) : "";
    const plan = await buildPlan([new File([blob], inZip.name)], dest, true, dir ? { root: `${dest}/${dir}` } : {});
    inStep("inMkdir");
    for (const d of plan.dirs) await agent("/api/mkdir" + qp(d), { method: "POST" });
    const total = plan.items.reduce((s, x) => s + x.size, 0);
    let sent = 0;
    for (const [i, item] of plan.items.entries()) {
      const show = () => { $("in-bar").value = total ? sent / total : 1; inStep("agSending", { i: i + 1, n: plan.items.length, f: item.path.split("/").pop(), p: Math.round($("in-bar").value * 100) }); };
      show();
      await putFile(item, n => { sent += n; show(); });
    }
    const root = appRootOf(plan.items, dest);
    rememberRoot(dest);
    // A small manifest beside the files: the Installed list reads it back from the console
    try {
      const m = {
        app: "ps5links", name: inProj?.name || root.split("/").pop(), repo: inProj?.url || "",
        tag: inZip.tag || "", zip: inZip.name, sha256: inZip.sha256 || "",
        files: plan.items.length, bytes: total, at: new Date().toISOString(),
      };
      await agent(`/api/upload${qp(root + "/.ps5links.json")}&offset=0`,
        { method: "PUT", body: new TextEncoder().encode(JSON.stringify(m, null, 2)) }, 30000);
    } catch { /* not fatal: the files themselves are in place */ }
    $("in-bar").value = 1; $("in-prog").hidden = true;
    inDoneBox(`<p class="msg ok">${esc(t("inDone", { n: plan.items.length, d: root }))}</p>`, root, plan.items);
    toast(t("inDone", { n: plan.items.length, d: root }));
  } catch (e) {
    $("in-prog").hidden = true;
    if (inCancel) sayIn(t("agCancelled"));
    else {
      const reason = e.status === 401 ? t("agBadPin") : e.status ? e.message : (e.name === "AbortError" ? "timeout" : e.message || "network");
      sayIn(t("inFail", { e: reason }), "err");
    }
  } finally {
    $("in-go").disabled = false;
  }
}

// Summary + shortcuts for whatever landed on the console
function inDoneBox(html, dest, items = []) {
  const box = $("in-done");
  const elfs = items.filter(x => /\.elf$/i.test(x.path));
  box.innerHTML = html +
    `<button class="btn small" data-in-open="${esc(dest)}">${esc(t("inOpenDir"))}</button>` +
    elfs.map(x => `<button class="fs-i file" data-in-run="${esc(x.path)}">${ICON.play} ${esc(x.path.replace(dest + "/", ""))}</button>`).join("");
  box.hidden = false;
}

$("in-go").onclick = () => doInstall();
$("in-cancel").onclick = () => { inCancel = true; };
$("in-mode").addEventListener("click", e => {
  const b = e.target.closest("[data-inmode]");
  if (!b) return;
  inMode = b.dataset.inmode;
  inApplyMode();
  inCheckDest().catch(() => {});
});
$("in-zips").addEventListener("change", e => {
  const r = e.target.closest("input[name=inz]");
  if (!r) return;
  inZip = inZips[Number(r.value)] || inZip;
  if (inZip.kind !== "app" && inMode === "app") inMode = "file";
  $("in-sub").textContent = `${inZip.name} · ${fmtSize(inZip.size || 0)}${inZip.sha256 ? ` · sha256 ${inZip.sha256.slice(0, 12)}…` : ""}`;
  inApplyMode();
  inCheckDest().catch(() => {});
});
$("in-dest").addEventListener("change", () => inCheckDest().catch(() => {}));
$("in-done").addEventListener("click", e => {
  const run = e.target.closest("[data-in-run]");
  if (run) return agentRun(run.dataset.inRun);
  const open = e.target.closest("[data-in-open]");
  if (open) { $("install").close(); openPs5(); ps5Browse(open.dataset.inOpen); }
});
window.installProject = installProject;

/* =========================================================
   v10 · Installed homebrew manager
   Lists the folders under the install destination through the agent,
   reads back the .ps5links.json written at install time, says when
   GitHub has a newer release, and can delete a folder again — the
   delete asks for the folder name first and needs POST /api/rm
   (ps5links-agent.elf 0.2.0 or newer).
   ========================================================= */
Object.assign(I18N.en, {
  v10H: "Installed homebrew", v10Open: "Folders under the install destination on the PS5.",
  v10Empty: "Nothing found yet. Use the Install button on a project card.",
  v10Unmanaged: "not installed by PS5 Links", v10Checking: "Reading the console…",
  v10UpToDate: "up to date", v10Update: "Update", v10Newer: "newer release: {t}",
  v10Delete: "Delete", v10Refresh: "Refresh", v10OpenDir: "Open folder",
  v10Forget: "Forget extra folders", v10Forgot: "Removed the remembered folders",
  v10Hint: "Deleting asks for the folder name first. It needs ps5links-agent.elf 0.2.0 or newer.",
  v10TypeName: "Type the folder name “{n}” to delete it for good:",
  v10NameMismatch: "The name did not match — nothing was deleted.",
  v10RmOld: "this agent has no delete command. Update ps5links-agent.elf to 0.2.0 or newer.",
  v10RmFail: "Could not delete: {e}", v10NoPair: "Pair with the agent first (PIN).",
  v10Bytes: "{n} installed", v10At: "installed {d}", v10Repo: "project",
  v10Deleted: "Deleted {d}", v10UpdateQ: "Update {n} on the PS5 now?",
  v10NeedsPin: "Pair with the agent (PIN) to manage installed homebrew.",
});
Object.assign(I18N.th, {
  v10H: "จัดการสิ่งที่ติดตั้งไว้", v10Open: "โฟลเดอร์ใต้ปลายทางที่ติดตั้งบน PS5",
  v10Empty: "ยังไม่พบอะไร ใช้ปุ่มติดตั้งบนการ์ดโปรเจกต์ได้เลย",
  v10Unmanaged: "ไม่ได้ติดตั้งผ่าน PS5 Links", v10Checking: "กำลังอ่านข้อมูลจากเครื่อง…",
  v10UpToDate: "เป็นเวอร์ชันล่าสุด", v10Update: "อัปเดต", v10Newer: "มีรีลีสใหม่: {t}",
  v10Delete: "ลบ", v10Refresh: "รีเฟรช", v10OpenDir: "เปิดโฟลเดอร์",
  v10Forget: "ลืมโฟลเดอร์ที่จำไว้", v10Forgot: "ลบโฟลเดอร์ที่จำไว้แล้ว",
  v10Hint: "การลบจะให้พิมพ์ชื่อโฟลเดอร์ก่อน และต้องใช้ ps5links-agent.elf 0.2.0 ขึ้นไป",
  v10TypeName: "พิมพ์ชื่อโฟลเดอร์ “{n}” เพื่อยืนยันการลบถาวร:",
  v10NameMismatch: "ชื่อไม่ตรง — ยังไม่ได้ลบอะไร",
  v10RmOld: "agent รุ่นนี้ยังไม่มีคำสั่งลบ ให้อัปเดต ps5links-agent.elf เป็น 0.2.0 ขึ้นไป",
  v10RmFail: "ลบไม่ได้: {e}", v10NoPair: "จับคู่กับ agent ก่อน (ใส่ PIN)",
  v10Bytes: "ติดตั้งไว้ {n}", v10At: "ติดตั้ง {d}", v10Repo: "โปรเจกต์",
  v10Deleted: "ลบ {d} แล้ว", v10UpdateQ: "อัปเดต {n} บน PS5 เดี๋ยวนี้ไหม?",
  v10NeedsPin: "จับคู่กับ agent (PIN) ก่อนจึงจะจัดการรายการติดตั้งได้",
});
applyI18n();

const INST_EXTRA = "instRoots";
// Destinations we ever installed into: the current one plus the ones remembered here
const instRoots = () => [...new Set([store.get(IN_DEST) || "/data/homebrew", ...(store.get(INST_EXTRA, []) || [])])];
function rememberRoot(dest) {
  const d = String(dest || "").replace(/\/+$/, "");
  if (!d || d === "/data/homebrew") return;
  store.set(INST_EXTRA, [...new Set([...(store.get(INST_EXTRA, []) || []), d])]);
}
const sayInst = (text, kind = "") => { const el = $("inst-msg"); el.textContent = text; el.className = "msg" + (kind ? " " + kind : ""); };

// One /api/ls per root, then the .ps5links.json we wrote at install time (websrv /fs)
async function scanInstalled() {
  const out = [];
  for (const root of instRoots()) {
    let list;
    try { list = await agent("/api/ls" + qp(root), {}, 9000); } catch { continue; }
    for (const d of list.filter(x => x.dir)) {
      const path = `${root}/${d.name}`;
      let man = null;
      try {
        const r = await ps5Fetch("/fs" + fsEnc(path + "/.ps5links.json"), {}, 8000);
        if (r.ok) man = JSON.parse((await r.text()).replace(/^\uFEFF/, ""));
      } catch { /* no manifest: an unmanaged folder */ }
      out.push({ root, path, name: d.name, man, mtime: d.mtime });
    }
  }
  return out;
}

async function drawInstalled() {
  if (!ps5.pin) return sayInst(t("v10NeedsPin"), "err");
  const box = $("inst-list");
  box.innerHTML = `<p class="loading">${esc(t("v10Checking"))}</p>`;
  sayInst("");
  let list;
  try { list = await scanInstalled(); }
  catch (e) { box.innerHTML = `<p class="msg err">${esc(e.status === 401 ? t("agBadPin") : t("agNoAgent"))}</p>`; return; }
  if (!list.length) { box.innerHTML = `<p class="hint">${esc(t("v10Empty"))}</p>`; return; }
  box.innerHTML = list.sort((a, b) => cmp(a.name, b.name)).map(x => {
    const p = x.man?.repo ? data.find(d => key(d) === String(x.man.repo).toLowerCase()) : null;
    const tag = p ? latest(p)?.tag || "" : "";
    const newer = !!(tag && x.man?.tag && tag !== x.man.tag);
    const bits = [x.man?.tag ? `v ${x.man.tag}` : "", x.man?.bytes ? t("v10Bytes", { n: fmtSize(x.man.bytes) }) : "",
      x.man?.at ? t("v10At", { d: String(x.man.at).slice(0, 10) }) : ""].filter(Boolean).map(esc).join(" · ");
    return `<div class="lib-i inst-i">
      <span class="lib-n"><b>${esc(x.man?.name || x.name)}</b>
        <span class="asset-meta">${esc(x.path)}</span>
        <span class="asset-meta">${x.man ? bits : esc(t("v10Unmanaged"))}</span>
        <span class="asset-meta">${newer ? esc(t("v10Newer", { t: tag })) : x.man ? esc(t("v10UpToDate")) : ""}</span>
        ${x.man?.repo ? `<a class="hp" href="${esc(safeUrl(x.man.repo))}">${esc(t("v10Repo"))} ↗</a>` : ""}</span>
      <span class="acts">
        ${newer ? `<button class="act install" data-inst-up="${esc(x.path)}" data-inst-repo="${esc(x.man.repo)}" title="${esc(t("v10Update"))}" aria-label="${esc(t("v10Update"))}">${ICON.install}</button>` : ""}
        <button class="act copy" data-inst-open="${esc(x.path)}" title="${esc(t("v10OpenDir"))}" aria-label="${esc(t("v10OpenDir"))}">${FOLDER}</button>
        <button class="act rm" data-inst-del="${esc(x.path)}" data-inst-name="${esc(x.name)}">${esc(t("v10Delete"))}</button>
      </span></div>`;
  }).join("");
}

// Delete with a typed confirmation: the folder name has to be entered exactly
async function removeInstalled(path, name) {
  const typed = prompt(t("v10TypeName", { n: name }), "");
  if (typed === null) return;
  if (typed.trim() !== name) return toast(t("v10NameMismatch"));
  sayInst(t("loading"));
  try {
    await agent(`/api/rm${qp(path)}&recursive=1`, { method: "POST" }, 120000);
    toast(t("v10Deleted", { d: path }));
    drawInstalled();
  } catch (e) {
    sayInst(t("v10RmFail", { e: e.status === 404 ? t("v10RmOld") : e.status ? e.message : "network" }), "err");
  }
}

// Update in place: the archive is written into the folder that is already there
async function updateInstalled(path, repo) {
  const p = data.find(d => key(d) === String(repo).toLowerCase());
  if (!p) return sayInst(t("inNoZip"), "err");
  inProj = p; inZips = allZips(p); inZip = pickZip(p, inZips);
  if (!inZip) return sayInst(t("inNoZip"), "err");
  if (!confirm(t("v10UpdateQ", { n: p.name }))) return;
  $("inst-list").innerHTML = `<p class="loading">${esc(t("v10Checking"))}</p>`;
  try {
    sayInst(t("inDownload", { f: inZip.name }));
    let blob;
    try { blob = await fetchBlob(inZip.url); }
    catch (e) { throw new Error(/^HTTP/.test(e.message || "") ? e.message : "network"); }
    if (inZip.sha256 && ps5.verify !== false) {
      const got = await sha256Hex(blob);
      if (got && got !== String(inZip.sha256).toLowerCase() &&
          !confirm(t("verifyAsk", { n: inZip.name, g: got.slice(0, 16), e: String(inZip.sha256).slice(0, 16) })))
        return sayInst(t("agCancelled"));
    }
    sayInst(t("inExtract", { f: inZip.name }));
    const plan = await buildPlan([new File([blob], inZip.name)], path, true, { root: path });
    for (const d of plan.dirs) await agent("/api/mkdir" + qp(d), { method: "POST" });
    const total = plan.items.reduce((s, x) => s + x.size, 0);
    let sent = 0;
    for (const [i, item] of plan.items.entries()) {
      sayInst(t("agSending", { i: i + 1, n: plan.items.length, f: item.path.split("/").pop(), p: total ? Math.round(sent / total * 100) : 100 }));
      await putFile(item, n => { sent += n; });
    }
    const m = { app: "ps5links", name: p.name, repo: p.url, tag: inZip.tag || "", zip: inZip.name, sha256: inZip.sha256 || "", files: plan.items.length, bytes: total, at: new Date().toISOString() };
    try { await agent(`/api/upload${qp(path + "/.ps5links.json")}&offset=0`, { method: "PUT", body: new TextEncoder().encode(JSON.stringify(m, null, 2)) }, 30000); } catch {}
    toast(t("inDone", { n: plan.items.length, d: path }));
    drawInstalled();
  } catch (e) {
    sayInst(t("inFail", { e: e.status === 401 ? t("agBadPin") : e.status ? e.message : "network" }), "err");
  }
}

$("open-inst").onclick = () => { sayInst(""); $("installed").showModal(); drawInstalled(); };
$("inst-refresh").onclick = () => drawInstalled();
$("inst-forget").onclick = () => { store.set(INST_EXTRA, []); toast(t("v10Forgot")); drawInstalled(); };
$("inst-list").addEventListener("click", async e => {
  const del = e.target.closest("[data-inst-del]");
  if (del) return void await removeInstalled(del.dataset.instDel, del.dataset.instName);
  const open = e.target.closest("[data-inst-open]");
  if (open) { $("installed").close(); openPs5(); ps5Browse(open.dataset.instOpen); return; }
  const up = e.target.closest("[data-inst-up]");
  if (up) await updateInstalled(up.dataset.instUp, up.dataset.instRepo);
});
window.openInstalled = () => { sayInst(""); $("installed").showModal(); drawInstalled(); };

/* =========================================================
   v11 · File manager extras + payload manager
   Free space and folder size in the PS5 folder browser, deleting and
   creating folders (needs agent 0.2.0), uploading straight into the
   folder being browsed, and favourites + a run history for payloads.
   ========================================================= */
Object.assign(I18N.en, {
  fsTotal: "{n} file(s) · {s}", fsFree: "{n} free", fsDir: "folder",
  fsUpload: "Upload here", fsNewFolder: "New folder", fsMade: "Folder created",
  fsDelete: "Delete", fsNeedName: "Enter a folder name (letters, digits, . _ -)",
  favAdd: "Add to favourites", favDel: "Remove from favourites",
  histH: "Recent runs", histEmpty: "Nothing run from this browser yet.",
  histClear: "Clear history", histAgain: "Run again", histNoData: "No payload kept for this entry — save it in the library first.",
});
Object.assign(I18N.th, {
  fsTotal: "{n} ไฟล์ · {s}", fsFree: "ว่าง {n}", fsDir: "โฟลเดอร์",
  fsUpload: "อัปโหลดที่นี่", fsNewFolder: "สร้างโฟลเดอร์", fsMade: "สร้างโฟลเดอร์แล้ว",
  fsDelete: "ลบ", fsNeedName: "ใส่ชื่อโฟลเดอร์ (ตัวอักษร ตัวเลข . _ -)",
  favAdd: "เพิ่มในรายการโปรด", favDel: "เอาออกจากรายการโปรด",
  histH: "รันล่าสุด", histEmpty: "ยังไม่เคยรันจากเบราว์เซอร์นี้",
  histClear: "ล้างประวัติ", histAgain: "รันอีกครั้ง", histNoData: "ยังไม่มีข้อมูล payload ของรายการนี้ — เก็บไว้ในคลังก่อน",
});
applyI18n();

let favs = store.get("favs", []);
let hist = store.get("hist", []);
const toggleFav = k => { favs = favs.includes(k) ? favs.filter(x => x !== k) : [...favs, k]; store.set("favs", favs); };
// Keep the 20 most recent runs, one line per payload name
function addHist(name, how = "run", opts = {}) {
  hist = [{ name, how, path: opts.path || "", url: opts.url || "", key: opts.key || "", at: Date.now() }, ...hist.filter(h => h.name !== name)].slice(0, 20);
  store.set("hist", hist);
}
function drawHist() {
  const box = $("hist-list");
  if (!box) return;
  box.innerHTML = hist.length ? hist.map((h, i) => `<div class="lib-i">
      <span class="lib-n"><b>${esc(h.name)}</b><span class="asset-meta">${esc(ago(new Date(h.at).toISOString().slice(0, 10)))} · ${esc(h.how)}</span></span>
      <span class="acts"><button class="act run" data-hist-run="${i}" title="${esc(t("histAgain"))}" aria-label="${esc(t("histAgain"))}">${ICON.play}</button></span></div>`).join("")
    : `<p class="hint">${esc(t("histEmpty"))}</p>`;
}
async function histRun(i) {
  const h = hist[i];
  if (!h) return;
  if (h.key) { const r = await libGet(h.key); if (r) return askRun([{ name: r.name, size: r.size, file: r.blob }], r.name, ps5.pin ? (ps5.ldrPort === 9020 ? "agent-9020" : "agent-9021") : "websrv"); }
  if (h.path) return askRun([{ name: h.name, path: h.path }], h.path);
  if (h.url) return askRun([{ name: h.name, url: h.url }], h.name);
  toast(t("histNoData"));
}

/* ---------- Folder actions (need the agent) ---------- */
async function fsMkdir() {
  if (!ps5.pin) return toast(t("v10NeedsPin"));
  const name = prompt(t("fsNewFolder"), "");
  if (name === null) return;
  const clean = name.trim().replace(/[^\w.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  if (!clean) return toast(t("fsNeedName"));
  try {
    await agent("/api/mkdir" + qp(`${fsPath.replace(/\/$/, "")}/${clean}`), { method: "POST" }, 15000);
    toast(t("fsMade"));
    ps5Browse(fsPath);
  } catch (e) { alert(t("v10RmFail", { e: e.status === 401 ? t("agBadPin") : e.status ? e.message : "network" })); }
}
async function fsRemove(path, name) {
  if (!ps5.pin) return toast(t("v10NeedsPin"));
  const typed = prompt(t("v10TypeName", { n: name }), "");
  if (typed === null) return;
  if (typed.trim() !== name) return toast(t("v10NameMismatch"));
  try {
    await agent(`/api/rm${qp(path)}&recursive=1`, { method: "POST" }, 120000);
    toast(t("v10Deleted", { d: path }));
    ps5Browse(fsPath);
  } catch (e) { alert(t("v10RmFail", { e: e.status === 404 ? t("v10RmOld") : e.status ? e.message : "network" })); }
}

$("hist-list").addEventListener("click", e => {
  const b = e.target.closest("[data-hist-run]");
  if (b) histRun(Number(b.dataset.histRun));
});
$("hist-clear").onclick = () => { hist = []; store.set("hist", hist); drawHist(); };
