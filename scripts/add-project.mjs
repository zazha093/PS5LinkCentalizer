// Adds a project to projects.json from a GitHub issue body:
//   repo: owner/name
//   category: Homebrew
//   name: My nice name        (optional, max 80 chars)
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const body = process.env.ISSUE_BODY || "";
const finish = (added, msg) => {
  writeFileSync("msg.txt", msg);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `added=${added}\n`);
  console.log(msg);
  process.exit(0);
};

const repo = body.match(/^repo:\s*([\w.-]+\/[\w.-]+)\s*$/mi)?.[1];
const category = body.match(/^category:\s*([\w .()+&-]{1,30}?)\s*$/mi)?.[1] || "Other";
// Optional display name: plain text only, written with JSON.stringify so quotes can't break the file
const name = body.match(/^name:\s*(.{1,80}?)\s*$/mi)?.[1]?.replace(/[<>`\u0000-\u001f]/g, "").trim();
if (!repo) finish(false, "Could not find a `repo: owner/name` line in this issue.");

const text = readFileSync("projects.json", "utf8");
const list = JSON.parse(text);
if (list.some(p => p.repo.toLowerCase() === repo.toLowerCase())) finish(false, `\`${repo}\` is already in the list.`);

const head = text.slice(0, text.lastIndexOf("]")).trimEnd();
const entry = { repo, ...(name && { name }), category };
const line = Object.entries(entry).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ");
writeFileSync("projects.json", `${head},\n  { ${line} }\n]\n`);
JSON.parse(readFileSync("projects.json", "utf8")); // sanity check
finish(true, `Added \`${repo}\`${name ? ` as **${name}**` : ""} under **${category}**. The site updates in about a minute.`);
