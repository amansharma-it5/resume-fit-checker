import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter((file) => file && file !== "pnpm-lock.yaml");
const patterns = [/sb_secret_[A-Za-z0-9_-]{20,}/, /service_role[=:][^\s]{20,}/i, /gsk_[A-Za-z0-9]{20,}/];
const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (patterns.some((pattern) => pattern.test(content))) findings.push(file);
}
if (findings.length) {
  console.error(`Potential secrets found in: ${findings.join(", ")}`);
  process.exit(1);
}
console.log(`No known secret patterns found in ${files.length} repository files.`);
