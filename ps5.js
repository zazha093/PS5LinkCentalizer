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
});
applyI18n();

/* ---------- Settings + helpers ---------- */
// ip + websrv port; aport/pin are for PS5Links Agent (the PIN is saved on this device only)
let ps5 = Object.assign({ ip: "", port: 8080, aport: 8686, pin: "" }, store.get("ps5", {}));
const PM_PORT = 8084, WFM_PORT = 8888;
const CATALOG_URL = new URL("payloads.json", location.href.replace(/[#?].*$/, "")).href;

// Home-network targets only: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, or name.local
function isLocalHost(h) {
  h = String(h || "").trim().toLowerCase();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.local$/.test(h)) return true;
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
    // ("loopback" when the page runs on the PS5 itself and talks to 127.0.0.1)
    const space = /^127\./.test(ps5.ip) ? "loopback" : "local";
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
    toast(t("ps5Sent")); dot5(true);
  } catch (e) {
    const s = e.name === "AbortError" ? "timeout" : /^HTTP/.test(e.message || "") ? e.message : "network";
    alert(t("ps5RunFail", { s }) + (s === "network" ? "\n\n" + t("ps5Fail") : ""));
    dot5(s === "network" ? false : true);
  }
}

/* ---------- Confirmation dialog ---------- */
const fmtMB = n => (n ? ` · ${(n / 1048576).toFixed(2)} MB` : "");
function askRun(files, label) {
  if (!ps5Ready()) { openPs5(); say5(t("ps5Need"), "err"); return; }
  if (!files?.length) return;
  $("runq-t").textContent = t("ps5RunQ", { f: label, ip: ps5.ip });
  $("runq-files").innerHTML = files.map((f, i) => `<label class="runq-f">
      <input type="radio" name="runf" value="${i}"${i ? "" : " checked"}>
      <span><strong>${esc(f.name)}</strong>${esc(fmtMB(f.size))}${f.sha256 ? `<br><code title="SHA-256">sha256 ${esc(f.sha256.slice(0, 16))}…</code>` : ""}</span></label>`).join("");
  $("runq-go").onclick = () => {
    const i = Number($("runq").querySelector("input[name=runf]:checked")?.value || 0);
    $("runq").close();
    const f = files[i];
    ps5Run(f.file || f.url || f.path);
  };
  $("runq").showModal();
}
window.askRun = askRun; // used by app.js (cards + Assets list)

/* ---------- Folder browser (websrv /fs JSON) ---------- */
let fsPath = "/data";
const FOLDER = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const fsEnc = p => p.split("/").map(encodeURIComponent).join("/");
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
      .filter(x => x && x.name !== "." && x.name !== ".." && (x.mode === "d" || /\.(elf|bin)$/i.test(x.name)))
      .sort((a, b) => (a.mode === "d" ? 0 : 1) - (b.mode === "d" ? 0 : 1) || cmp(a.name, b.name));
    const parent = path.replace(/\/[^/]+\/?$/, "") || "/";
    let html = `<div class="fs-bar"><code class="fs-path">${esc(path)}</code>${path !== "/" ? `<button class="btn small" data-fs="${esc(parent)}">↑ ${esc(t("ps5Up"))}</button>` : ""}</div>`;
    html += items.length ? items.map(x => {
      const full = (path === "/" ? "" : path.replace(/\/$/, "")) + "/" + x.name;
      return x.mode === "d"
        ? `<button class="fs-i" data-fs="${esc(full)}">${FOLDER} ${esc(x.name)}</button>`
        : `<button class="fs-i file" data-fs-run="${esc(full)}" data-size="${Number(x.size) || 0}">${ICON.play} ${esc(x.name)}<span>${esc(fmtMB(x.size).replace(" · ", ""))}</span></button>`;
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
  if (f && savePs5()) askRun([{ name: f.name, size: f.size, file: f }], f.name);
};
$("ps5-fs").addEventListener("click", e => {
  const d = e.target.closest("[data-fs]"); if (d) return ps5Browse(d.dataset.fs);
  const f = e.target.closest("[data-fs-run]");
  if (f) askRun([{ name: f.dataset.fsRun.split("/").pop(), size: Number(f.dataset.size), path: f.dataset.fsRun }], f.dataset.fsRun);
});
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
  if (!savePs5()) return false;
  if (!validPort(aport)) { sayAg(t("ps5BadIp"), "err"); return false; }
  ps5 = { ...ps5, pin, aport }; store.set("ps5", ps5); return true;
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

async function buildPlan(files, dest, unzip) {
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
    // A zip with one top folder ("MyApp/...") goes straight into dest; otherwise into dest/<zip name>
    const tops = new Set(names.map(x => x.parts[0]));
    const isDir = x => x.n.endsWith("/");
    const oneTop = tops.size === 1 && names.every(x => isDir(x) || x.parts.length > 1);
    const root = oneTop ? dest : `${dest}/${f.name.replace(/\.zip$/i, "")}`;
    for (const x of names) {
      const path = `${root}/${x.parts.join("/")}`;
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

async function agentSend(files) {
  if (!saveAgent()) return;
  if (!ps5.pin) { sayAg(t("agNeedPair"), "err"); return; }
  const dest = $("ag-dest").value.trim().replace(/\/+$/, "");
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
  try { await agent("/api/run" + qp(path), { method: "POST" }, 30000); toast(t("ps5Sent")); }
  catch (e) { alert(t("ps5RunFail", { s: e.status ? e.message : "network" })); }
}

/* ---------- Agent events ---------- */
$("ag-pair").onclick = () => agentPair();
$("ag-pin").addEventListener("keydown", e => { if (e.key === "Enter") agentPair(); });
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
  $("ag-fs").hidden = true; sayAg("");
  if (ps5Ready() && ps5.pin) agentPair(true);
}
