/**
 * Typewriter-style cycling through words; shared prefix with the next word is kept (not erased).
 */
(function () {
  "use strict";

  var WORDS = ["stohactih", "stochastic", "stohactih", "tohcastich"];

  var TYPE_MS = 90;
  var DELETE_MS = 75;
  var HOLD_MS = 2200;

  /**
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function longestCommonPrefixLength(a, b) {
    var n = Math.min(a.length, b.length);
    var i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) {
      i += 1;
    }
    return i;
  }

  /**
   * @param {HTMLElement} el
   */
  function run(el) {
    var wordIndex = 0;
    var displayed = "";

    function schedule(next, delay) {
      window.setTimeout(next, delay);
    }

    function step() {
      var target = WORDS[wordIndex % WORDS.length];

      if (displayed === target) {
        schedule(function () {
          wordIndex += 1;
          step();
        }, HOLD_MS);
        return;
      }

      var prefix = longestCommonPrefixLength(displayed, target);
      var delay;

      if (displayed.length > prefix) {
        displayed = displayed.slice(0, displayed.length - 1);
        delay = DELETE_MS;
      } else {
        displayed = target.slice(0, displayed.length + 1);
        delay = TYPE_MS;
      }

      el.textContent = displayed;
      schedule(step, delay);
    }

    step();
  }

  function init() {
    var el = document.getElementById("main-hero-correction-word");
    if (!el) return;
    run(el);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
