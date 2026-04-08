import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const srcDir = join(root, "src", "js");
const destDir = join(root, "dist", "js");

if (!existsSync(srcDir)) {
  console.warn("copy-js: папка src/js не найдена — пропуск.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

for (const name of readdirSync(srcDir)) {
  if (!name.endsWith(".js")) continue;
  copyFileSync(join(srcDir, name), join(destDir, name));
}
