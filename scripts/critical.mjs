import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import Critters from "critters";

const cwd = process.cwd();
const distRoot = join(cwd, "dist");

const pages = [
  { html: "index.html", css: "css/index.css" },
  { html: "work-and-ethic.html", css: "css/work-and-ethic.css" },
  { html: "the-giants.html", css: "css/the-giants.css" },
  { html: "non-jobs.html", css: "css/non-jobs.css" },
  { html: "jobs.html", css: "css/jobs.css" },
  { html: "talk-to-us.html", css: "css/talk-to-us.css" },
  { html: "404.html", css: "css/404.css" },
];

async function inlineCriticalForPage(page) {
  const htmlPath = join(distRoot, page.html);

  // Ensure files exist early with readable error messages.
  const inputHtml = readFileSync(htmlPath, "utf8");

  const critters = new Critters({
    path: distRoot,
    preload: false,
    noscriptFallback: false,
    pruneSource: false,
    compress: true,
  });

  const outputHtml = await critters.process(inputHtml);
  // Inlined CSS keeps css/-relative urls (../images); the page sits one level up.
  writeFileSync(htmlPath, outputHtml.replace(/url\((["']?)\.\.\//g, "url($1"));
}

async function main() {
  for (const page of pages) {
    // Run sequentially to keep Puppeteer usage stable.
    await inlineCriticalForPage(page);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

