/**
 * Reveals the hero title background top-to-bottom in uneven steps (dot-matrix style).
 */
(function () {
  "use strict";

  /** >1 slows the whole effect (1.2 ≈ 20% slower). */
  var TIMING_SCALE = 1.2;

  /**
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randomBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function init() {
    var el = document.querySelector(".dot-matrix-printer");
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    var progress = 0;
    el.classList.add("dot-matrix-printer--matrix-print");
    el.style.clipPath = "inset(0 0 100% 0)";

    function tick() {
      var step = randomBetween(2, 9) / 100;
      progress = Math.min(1, progress + step);
      var bottomInset = (1 - progress) * 100;
      el.style.clipPath = "inset(0 0 " + bottomInset.toFixed(2) + "% 0)";
      el.style.transform =
        "translateY(" + (randomBetween(-12, 12) / 10).toFixed(1) + "px)";

      if (progress < 1) {
        window.setTimeout(
          tick,
          Math.round(randomBetween(28, 110) * TIMING_SCALE)
        );
      } else {
        el.style.clipPath = "";
        el.style.transform = "";
        el.classList.remove("dot-matrix-printer--matrix-print");
      }
    }

    window.setTimeout(
      tick,
      Math.round(randomBetween(120, 280) * TIMING_SCALE)
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
