(function () {
  document.documentElement.classList.add("js");

  var wrap = document.getElementById("site-header");
  var overlay = document.getElementById("site-header-overlay");
  var nav = document.getElementById("site-header-nav");
  var bar = wrap && wrap.querySelector(".site-header-bar");

  if (!wrap || !overlay || !nav || !bar) return;

  var burger = document.createElement("button");
  burger.className = "burger";
  burger.id = "site-header-burger";
  burger.type = "button";
  burger.setAttribute("aria-expanded", "false");
  burger.setAttribute("aria-controls", "site-header-nav");
  burger.setAttribute("aria-label", "Open menu");
  burger.innerHTML = "<span></span><span></span><span></span>";
  bar.appendChild(burger);

  var main = document.querySelector("main");
  var footer = document.querySelector("footer");
  var lastFocus = null;
  var desktopMq = window.matchMedia("(min-width: 64rem)");

  function isOpen() {
    return wrap.getAttribute("data-open") === "true";
  }

  function setOpen(open) {
    wrap.setAttribute("data-open", open ? "true" : "false");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");

    document.documentElement.classList.toggle("nav-menu-open", open);

    if (main) {
      if (open) main.setAttribute("inert", "");
      else main.removeAttribute("inert");
    }
    if (footer) {
      if (open) footer.setAttribute("inert", "");
      else footer.removeAttribute("inert");
    }

    if (open) {
      lastFocus = document.activeElement;
      var firstLink = nav.querySelector("a");
      if (firstLink) firstLink.focus({ preventScroll: true });
    } else if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function close() {
    if (isOpen()) setOpen(false);
  }

  burger.addEventListener("click", function (e) {
    e.preventDefault();
    if (desktopMq.matches) return;
    setOpen(!isOpen());
  });

  overlay.addEventListener("click", function () {
    close();
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      close();
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  desktopMq.addEventListener("change", function () {
    if (desktopMq.matches) close();
  });
})();
