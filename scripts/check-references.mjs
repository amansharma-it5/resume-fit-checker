import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const roots = ["index.html", "src", "netlify/functions"];
const files = [];
async function walk(path) {
  const stat = await import("node:fs/promises").then((fs) => fs.stat(path));
  if (stat.isDirectory()) for (const name of await readdir(path)) await walk(join(path, name));
  else files.push(path);
}
for (const root of roots) await walk(resolve(root));
const pattern = /(?:src|href)=["'](\/[A-Za-z0-9_./-]+)["']/g;
for (const file of files.filter((path) => [".html", ".tsx", ".ts", ".js", ".mjs"].includes(extname(path)))) {
  const content = await readFile(file, "utf8");
  let match;
  while ((match = pattern.exec(content))) {
    if (match[1].startsWith("/.netlify/") || !extname(match[1])) continue;
    await access(resolve(match[1].slice(1)));
  }
}
console.log(`Checked local references in ${files.length} files.`);
