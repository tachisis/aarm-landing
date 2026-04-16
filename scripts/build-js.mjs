import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import esbuild from "esbuild";

const root = process.cwd();
const srcDir = join(root, "src", "js");
const destDir = join(root, "dist", "js");

if (!existsSync(srcDir)) {
  console.warn("build-js: папка src/js не найдена — пропуск.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

const entryPoints = readdirSync(srcDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => join(srcDir, name));

if (entryPoints.length === 0) {
  console.warn("build-js: нет .js файлов в src/js — пропуск.");
  process.exit(0);
}

await esbuild.build({
  entryPoints,
  outdir: destDir,
  bundle: false,
  minify: true,
  sourcemap: false,
  target: ["es2019"],
});

