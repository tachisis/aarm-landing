import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import process from "node:process";
import sharp from "sharp";
import { optimize as svgoOptimize } from "svgo";

const cwd = process.cwd();
const assetsRoot = join(cwd, "assets");
const distRoot = join(cwd, "dist");

const RASTER_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

/**
 * Walk directory tree; yields absolute file paths (not directories).
 */
async function* walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function writeRasterIfSmaller(src, dest, applyEncoder) {
  const input = readFileSync(src);
  const before = input.length;
  const probe = sharp(input, { failOn: "truncated" });
  const meta = await probe.metadata();

  if (meta.format === "gif" || (meta.pages && meta.pages > 1)) {
    copyFileSync(src, dest);
    return;
  }

  const out = await applyEncoder(
    sharp(input, { failOn: "truncated" }),
  ).toBuffer();

  if (out.length <= before) {
    writeFileSync(dest, out);
  } else {
    copyFileSync(src, dest);
  }
}

async function optimizeRaster(src, dest, ext) {
  try {
    if (ext === ".jpg" || ext === ".jpeg") {
      await writeRasterIfSmaller(src, dest, (img) =>
        img.jpeg({ quality: 85, mozjpeg: true }),
      );
      return;
    }
    if (ext === ".png") {
      await writeRasterIfSmaller(src, dest, (img) =>
        img.png({ compressionLevel: 9, effort: 10 }),
      );
      return;
    }
    if (ext === ".webp") {
      await writeRasterIfSmaller(src, dest, (img) =>
        img.webp({ quality: 82, effort: 6 }),
      );
      return;
    }
    if (ext === ".avif") {
      await writeRasterIfSmaller(src, dest, (img) =>
        img.avif({ quality: 60, effort: 6 }),
      );
      return;
    }
  } catch {
    // Corrupt or unsupported for sharp — keep original bytes.
  }
  copyFileSync(src, dest);
}

function optimizeSvg(src, dest) {
  try {
    const input = readFileSync(src, "utf8");
    const before = Buffer.byteLength(input, "utf8");
    const result = svgoOptimize(input, { path: src, multipass: true });
    if (result.error) {
      copyFileSync(src, dest);
      return;
    }
    const data = result.data;
    if (Buffer.byteLength(data, "utf8") <= before) {
      writeFileSync(dest, data, "utf8");
    } else {
      copyFileSync(src, dest);
    }
  } catch {
    copyFileSync(src, dest);
  }
}

async function processFile(absSrc, relFromAssets) {
  const dest = join(distRoot, relFromAssets);
  mkdirSync(dirname(dest), { recursive: true });

  const ext = extname(absSrc).toLowerCase();

  if (ext === ".gif" || ext === ".ico") {
    copyFileSync(absSrc, dest);
    return;
  }

  if (RASTER_EXT.has(ext)) {
    await optimizeRaster(absSrc, dest, ext);
    return;
  }

  if (ext === ".svg") {
    optimizeSvg(absSrc, dest);
    return;
  }

  copyFileSync(absSrc, dest);
}

async function main() {
  if (!existsSync(assetsRoot)) {
    console.warn("copy-assets: папка assets/ не найдена — пропуск.");
    return;
  }

  mkdirSync(distRoot, { recursive: true });

  for await (const absFile of walkFiles(assetsRoot)) {
    const rel = relative(assetsRoot, absFile);
    await processFile(absFile, rel);
  }
}

await main();
