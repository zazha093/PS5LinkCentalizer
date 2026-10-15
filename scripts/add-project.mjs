// Adds a project to projects.json from a GitHub issue body:
//   repo: owner/name
//   category: Homebrew
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
if (!repo) finish(false, "Could not find a `repo: owner/name` line in this issue.");

const text = readFileSync("projects.json", "utf8");
const list = JSON.parse(text);
if (list.some(p => p.repo.toLowerCase() === repo.toLowerCase())) finish(false, `\`${repo}\` is already in the list.`);

const head = text.slice(0, text.lastIndexOf("]")).trimEnd();
writeFileSync("projects.json", `${head},\n  { "repo": "${repo}", "category": "${category}" }\n]\n`);
JSON.parse(readFileSync("projects.json", "utf8")); // sanity check
finish(true, `Added \`${repo}\` under **${category}**. The site updates in about a minute.`);
