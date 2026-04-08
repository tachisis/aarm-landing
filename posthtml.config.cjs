const path = require("path");
const inlineSvg = require("posthtml-inline-svg");

module.exports = {
  plugins: [
    require("posthtml-include")({
      root: path.join(__dirname, "src"),
      encoding: "utf-8",
    }),
    // Short markup: <icon src="svg/name.svg" class="..."></icon> → inline <svg>
    inlineSvg({
      cwd: path.join(__dirname, "src"),
      tag: "icon",
      attr: "src",
      // SVGO 1.x (bundled with posthtml-inline-svg): no plugins = leave markup as authored
      svgo: { plugins: [] },
    }),
  ],
};
