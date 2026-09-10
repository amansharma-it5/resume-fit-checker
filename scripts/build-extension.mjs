import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

rmSync("dist-extension", { recursive: true, force: true });
execFileSync(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "build", "-c", "extension.vite.config.ts"], {
  stdio: "inherit",
});
mkdirSync("dist-extension", { recursive: true });
for (const file of ["manifest.json", "background.js", "popup.html", "popup.css", "popup.js"])
  cpSync(`extension/${file}`, `dist-extension/${file}`);
