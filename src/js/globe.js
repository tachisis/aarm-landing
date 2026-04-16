(function () {
  var DESKTOP_MQ = "(min-width: 64rem)";
  var figure = document.querySelector(".main-hero-illustration");
  if (!figure) return;

  var img = figure.querySelector("img");
  var canvas = null;
  var ctx = null;
  var animId = null;
  var boundResize = null;
  var ro = null;
  var boundMouseMove = null;
  var boundMouseUp = null;

  function onMediaChange(e) {
    var isDesktop = e.matches !== undefined ? e.matches : e;
    if (isDesktop) {
      boot();
    } else {
      teardown();
    }
  }

  function boot() {
    if (canvas) return; // already running

    canvas = document.createElement("canvas");
    canvas.id = "globe";
    ctx = canvas.getContext("2d");

    if (img) img.style.display = "none";
    figure.appendChild(canvas);

    initState();
    bindEvents();
    resize();
    // If layout/CSS applies after init, re-measure on next frame.
    requestAnimationFrame(resize);
    animId = requestAnimationFrame(render);
  }

  function teardown() {
    if (!canvas) return;

    cancelAnimationFrame(animId);
    animId = null;

    unbindEvents();
    if (ro) {
      ro.disconnect();
      ro = null;
    }

    figure.removeChild(canvas);
    canvas = null;
    ctx = null;

    if (img) img.style.display = "";
  }

  // ============================================
  // SIZING
  // ============================================
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W, H, CX, CY, RADIUS;

  function resize() {
    if (!canvas) return;
    var rect = figure.getBoundingClientRect();
    var figW = rect.width;
    var figH = rect.height;

    // Canvas should follow the figure geometry; positioning is handled by CSS.
    W = figW;
    H = figH;
    RADIUS = Math.min(figW, figH) * 0.36;

    canvas.width = Math.max(1, Math.round(figW * DPR));
    canvas.height = Math.max(1, Math.round(figH * DPR));
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2;
    CY = H / 2;
    rebuildSatellites();
    rebuildDataBlocks();
  }

  // ============================================
  // EARTH TEXTURE DATA
  // ============================================
  var TEX_W = 360;
  var TEX_H = 180;
  var landMap = new Uint8Array(TEX_W * TEX_H);

  function hash(x, y) {
    var h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
  }

  function smoothNoise(x, y) {
    var ix = Math.floor(x),
      iy = Math.floor(y);
    var fx = x - ix,
      fy = y - iy;
    var sx = fx * fx * (3 - 2 * fx);
    var sy = fy * fy * (3 - 2 * fy);
    var n00 = hash(ix, iy),
      n10 = hash(ix + 1, iy);
    var n01 = hash(ix, iy + 1),
      n11 = hash(ix + 1, iy + 1);
    return (
      (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy
    );
  }

  function fbm(x, y) {
    var val = 0,
      amp = 0.5,
      freq = 1;
    for (var i = 0; i < 6; i++) {
      val += amp * smoothNoise(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2.1;
    }
    return val;
  }

  // Pre-compute land map once
  for (var ty = 0; ty < TEX_H; ty++) {
    for (var tx = 0; tx < TEX_W; tx++) {
      var lat = (ty / TEX_H - 0.5) * Math.PI;
      var n = fbm(tx * 0.03 + 5.2, ty * 0.04 + 1.3);
      n += fbm(tx * 0.015 + 8.1, ty * 0.02 + 3.7) * 0.5;
      n *= Math.cos(lat);
      landMap[ty * TEX_W + tx] = n > 0.58 ? 1 : 0;
    }
  }

  // ============================================
  // MUTABLE STATE
  // ============================================
  var rotY, rotX, velY, velX, isDragging, lastMouseX, lastMouseY, lastDragTime;
  var autoRotSpeed = 0.003;
  var satellites, dataBlocks, connectionTargets;
  var blockOpacity, wasRecentlyDragging;

  function initState() {
    rotY = 0;
    rotX = 0.3;
    velY = 0;
    velX = 0;
    isDragging = false;
    lastMouseX = 0;
    lastMouseY = 0;
    lastDragTime = 0;
    satellites = [];
    dataBlocks = [];
    connectionTargets = [];
    blockOpacity = 1;
    wasRecentlyDragging = false;
  }

  // ============================================
  // SATELLITES
  // ============================================
  var satelliteData = [
    { inclination: 0.4, phase: 0, speed: 0.0012, orbitOffset: 55, size: 3 },
    {
      inclination: -0.7,
      phase: 2.1,
      speed: 0.0008,
      orbitOffset: 85,
      size: 2.5,
    },
    { inclination: 1.2, phase: 4.2, speed: 0.0015, orbitOffset: 40, size: 2 },
    { inclination: 0.1, phase: 1.0, speed: 0.001, orbitOffset: 110, size: 2 },
  ];

  function rebuildSatellites() {
    satellites = satelliteData.map(function (s) {
      return {
        inclination: s.inclination,
        phase: s.phase,
        speed: s.speed,
        orbitRadius: RADIUS + s.orbitOffset,
        size: s.size,
        trail: [],
      };
    });
  }

  // ============================================
  // DATA ANNOTATIONS
  // ============================================
  var dataBlockData = [
    {
      angle: -2.3,
      elevation: 0.3,
      distOffset: 95,
      rows: [
        { label: "\u03B2", value: "0.02" },
        { label: "convergence", value: "true" },
      ],
    },
    {
      angle: -0.5,
      elevation: -0.2,
      distOffset: 80,
      rows: [
        { label: "node", value: "n:3b2313" },
        { label: "weight", value: "0.847" },
        { label: "bias", value: "-0.031" },
      ],
    },
    {
      angle: 3.5,
      elevation: 0.1,
      distOffset: 65,
      rows: [
        { label: "P(Z|X)", value: "0.9214" },
        { label: "H(Z)", value: "2.307" },
      ],
    },
    {
      angle: 2.2,
      elevation: -0.5,
      distOffset: 100,
      rows: [
        { label: "cluster", value: "b:3h5" },
        { label: "\u03C3\u00B2", value: "1.4e\u207B\u00B3" },
        { label: "members", value: "2,841" },
        { label: "drift", value: "+0.007/s" },
      ],
    },
    {
      angle: -1.4,
      elevation: 0.6,
      distOffset: 110,
      rows: [
        { label: "\u03BB", value: "0.073" },
        { label: "epoch", value: "14,209" },
        { label: "loss", value: "0.0041" },
      ],
    },
    {
      angle: 0.8,
      elevation: 0.4,
      distOffset: 75,
      rows: [
        { label: "\u2202\u03A9", value: "bounded" },
        { label: "dim", value: "128" },
      ],
    },
    {
      angle: 1.5,
      elevation: -0.7,
      distOffset: 90,
      rows: [
        { label: "emitter", value: "e:09f2" },
        { label: "rate", value: "120/h" },
        { label: "decay", value: "0.93" },
        { label: "active", value: "true" },
      ],
    },
    {
      angle: -3.0,
      elevation: -0.3,
      distOffset: 70,
      rows: [
        { label: "\u03B8", value: "0.731" },
        { label: "\u03C6", value: "4.19" },
        { label: "r\u0302\u00B7n\u0302", value: ">0" },
      ],
    },
  ];

  function rebuildDataBlocks() {
    dataBlocks = dataBlockData.map(function (b) {
      return {
        angle: b.angle,
        elevation: b.elevation,
        dist: RADIUS + b.distOffset,
        rows: b.rows.map(function (r) {
          return { label: r.label, value: r.value, calculating: false };
        }),
      };
    });
    connectionTargets = dataBlocks.map(function (b) {
      return {
        surfaceAngle: b.angle + (Math.random() - 0.5) * 0.4,
        surfaceElev: b.elevation * 0.3,
        surfaceDist: RADIUS * (0.5 + Math.random() * 0.3),
      };
    });
  }

  // Random value generators
  var fakeGenerators = {
    float: function () {
      return (Math.random() * 2 - 0.5).toFixed(4);
    },
    smallFloat: function () {
      return (Math.random() * 0.1).toFixed(4);
    },
    sciNotation: function () {
      return (
        (Math.random() * 9 + 0.1).toFixed(1) +
        "e\u207B" +
        (Math.floor(Math.random() * 5) + 1)
      );
    },
    int: function () {
      return Math.floor(Math.random() * 50000).toLocaleString();
    },
    rate: function () {
      return Math.floor(Math.random() * 500) + "/h";
    },
    nodeId: function () {
      return (
        ["n:", "e:", "b:", "c:"][Math.floor(Math.random() * 4)] +
        Math.random().toString(16).substr(2, 4)
      );
    },
    bool: function () {
      return Math.random() > 0.5 ? "true" : "false";
    },
    dim: function () {
      return String(Math.pow(2, Math.floor(Math.random() * 4) + 5));
    },
    bounded: function () {
      return ["bounded", "unbounded", "periodic", "compact"][
        Math.floor(Math.random() * 4)
      ];
    },
    drift: function () {
      return (
        (Math.random() > 0.5 ? "+" : "-") +
        (Math.random() * 0.05).toFixed(3) +
        "/s"
      );
    },
  };

  var calcChars = "0123456789.+-eabcdef:,/";

  function getGeneratorForLabel(label) {
    if (["\u03B2", "\u03BB", "\u03B8", "\u03C6", "decay"].indexOf(label) !== -1)
      return fakeGenerators.float;
    if (["\u03C3\u00B2", "loss"].indexOf(label) !== -1)
      return fakeGenerators.sciNotation;
    if (["weight", "bias"].indexOf(label) !== -1)
      return fakeGenerators.smallFloat;
    if (["members", "epoch"].indexOf(label) !== -1) return fakeGenerators.int;
    if (label === "rate") return fakeGenerators.rate;
    if (["node", "cluster", "emitter"].indexOf(label) !== -1)
      return fakeGenerators.nodeId;
    if (["convergence", "active"].indexOf(label) !== -1)
      return fakeGenerators.bool;
    if (label === "dim") return fakeGenerators.dim;
    if (label === "\u2202\u03A9") return fakeGenerators.bounded;
    if (label === "drift") return fakeGenerators.drift;
    return fakeGenerators.float;
  }

  function triggerCalculations() {
    dataBlocks.forEach(function (block, bi) {
      block.rows.forEach(function (row, ri) {
        var delay = bi * 120 + ri * 80 + Math.random() * 200;
        var duration = 400 + Math.random() * 600;
        var generator = getGeneratorForLabel(row.label);
        var finalValue = generator();

        setTimeout(function () {
          row.calculating = true;
          var startTime = Date.now();

          function animateCalc() {
            var elapsed = Date.now() - startTime;
            var progress = Math.min(elapsed / duration, 1);

            if (progress < 1) {
              var len = finalValue.length;
              var scrambled = "";
              for (var c = 0; c < len; c++) {
                if (c < Math.floor(progress * len * 1.5)) {
                  scrambled += finalValue[c];
                } else {
                  scrambled +=
                    calcChars[Math.floor(Math.random() * calcChars.length)];
                }
              }
              row.value = scrambled;
              requestAnimationFrame(animateCalc);
            } else {
              row.value = finalValue;
              row.calculating = false;
            }
          }
          animateCalc();
        }, delay);
      });
    });
  }

  // ============================================
  // EVENT BINDING / UNBINDING
  // ============================================
  function onMouseDown(e) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    velY = 0;
    velX = 0;
    lastDragTime = Date.now();
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    var dx = e.clientX - lastMouseX;
    var dy = e.clientY - lastMouseY;
    var now = Date.now();
    var dt = Math.max(now - lastDragTime, 1);

    rotY += dx * 0.005;
    rotX += dy * 0.005;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));

    velY = (dx * 0.005) / (dt / 16);
    velX = (dy * 0.005) / (dt / 16);

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    lastDragTime = now;
  }

  function onMouseUp() {
    isDragging = false;
  }

  function onTouchStart(e) {
    e.preventDefault();
    isDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    velY = 0;
    velX = 0;
    lastDragTime = Date.now();
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!isDragging) return;
    var dx = e.touches[0].clientX - lastMouseX;
    var dy = e.touches[0].clientY - lastMouseY;
    var now = Date.now();
    var dt = Math.max(now - lastDragTime, 1);

    rotY += dx * 0.005;
    rotX += dy * 0.005;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));

    velY = (dx * 0.005) / (dt / 16);
    velX = (dy * 0.005) / (dt / 16);

    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    lastDragTime = now;
  }

  function onTouchEnd() {
    isDragging = false;
  }

  function bindEvents() {
    boundResize = resize;
    boundMouseMove = onMouseMove;
    boundMouseUp = onMouseUp;

    window.addEventListener("resize", boundResize);
    window.addEventListener("mousemove", boundMouseMove);
    window.addEventListener("mouseup", boundMouseUp);

    // Track figure size changes (CSS/layout shifts won't trigger window resize).
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        resize();
      });
      ro.observe(figure);
    } else {
      window.addEventListener("load", resize, { once: true });
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
  }

  function unbindEvents() {
    window.removeEventListener("resize", boundResize);
    window.removeEventListener("mousemove", boundMouseMove);
    window.removeEventListener("mouseup", boundMouseUp);
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  function drawGlobe() {
    var dotSpacing = 4.5;
    var dotSizes = [1, 1.5, 2, 2.8, 3.5];

    for (var sy = -RADIUS; sy <= RADIUS; sy += dotSpacing) {
      for (var sx = -RADIUS; sx <= RADIUS; sx += dotSpacing) {
        var dist = Math.sqrt(sx * sx + sy * sy);
        if (dist > RADIUS) continue;

        var nx = sx / RADIUS;
        var ny = sy / RADIUS;
        var nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

        var cosRY = Math.cos(rotY),
          sinRY = Math.sin(rotY);
        var cosRX = Math.cos(rotX),
          sinRX = Math.sin(rotX);

        var ry = ny * cosRX - nz * sinRX;
        var rz = ny * sinRX + nz * cosRX;
        var rx = nx;

        var fx = rx * cosRY - rz * sinRY;
        var fz = rx * sinRY + rz * cosRY;
        var fy = ry;

        var tlat = Math.asin(Math.max(-1, Math.min(1, fy)));
        var tlon = Math.atan2(fx, fz);

        var texX =
          Math.floor(((tlon + Math.PI) / (Math.PI * 2)) * TEX_W) % TEX_W;
        var texY = Math.floor(((tlat + Math.PI / 2) / Math.PI) * TEX_H);
        texX = Math.max(0, Math.min(TEX_W - 1, texX));
        texY = Math.max(0, Math.min(TEX_H - 1, texY));

        var isLand = landMap[texY * TEX_W + texX];

        var lightX = -0.3,
          lightY = -0.4,
          lightZ = 0.85;
        var lightLen = Math.sqrt(
          lightX * lightX + lightY * lightY + lightZ * lightZ,
        );
        var light = (nx * lightX + ny * lightY + nz * lightZ) / lightLen;
        var shade = Math.max(0, Math.min(1, light));

        var edgeDark = 1 - Math.pow(1 - nz, 3) * 0.5;

        var darkness, opacity;

        if (isLand) {
          darkness = (1 - shade * 0.6) * edgeDark;
          opacity = (0.55 + (1 - shade) * 0.45) * edgeDark;
        } else {
          darkness = (0.5 - shade * 0.35) * edgeDark;
          opacity = (0.12 + (1 - shade) * 0.18) * edgeDark;
          if (hash(Math.floor(sx * 10), Math.floor(sy * 10)) > 0.55) continue;
        }

        if (nz < 0.15) {
          darkness = 0.9;
          opacity = (0.75 * (0.15 - nz)) / 0.15;
        }

        if (opacity < 0.04) continue;

        var sizeIndex = Math.min(
          dotSizes.length - 1,
          Math.floor(darkness * dotSizes.length),
        );
        var dotR = dotSizes[sizeIndex];

        ctx.fillStyle = "rgba(0,0,0," + opacity + ")";
        ctx.beginPath();
        ctx.arc(CX + sx, CY + sy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawOrbits(time) {
    var cosRY = Math.cos(rotY),
      sinRY = Math.sin(rotY);
    var cosRX = Math.cos(rotX),
      sinRX = Math.sin(rotX);

    satellites.forEach(function (sat) {
      var angle = sat.phase + time * sat.speed;
      var inc = sat.inclination;
      var r = sat.orbitRadius;

      ctx.strokeStyle = "rgba(100,95,88,0.12)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();

      var firstPoint = true;
      for (var a = 0; a <= Math.PI * 2 + 0.05; a += 0.03) {
        var ox = r * Math.cos(a);
        var oy = r * Math.sin(a) * Math.cos(inc);
        var oz = r * Math.sin(a) * Math.sin(inc);

        var rx = ox * cosRY - oz * sinRY;
        var rz = ox * sinRY + oz * cosRY;
        var ry = oy;

        var fy = ry * cosRX - rz * sinRX;

        var screenX = CX + rx;
        var screenY = CY + fy;

        if (firstPoint) {
          ctx.moveTo(screenX, screenY);
          firstPoint = false;
        } else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      var sox = r * Math.cos(angle);
      var soy = r * Math.sin(angle) * Math.cos(inc);
      var soz = r * Math.sin(angle) * Math.sin(inc);

      var srx = sox * cosRY - soz * sinRY;
      var srz = sox * sinRY + soz * cosRY;
      var sry = soy;

      var sfy = sry * cosRX - srz * sinRX;
      var sfz = sry * sinRX + srz * cosRX;

      var satX = CX + srx;
      var satY = CY + sfy;
      var satBehind = sfz < 0;

      sat.trail.push({ x: satX, y: satY, behind: satBehind });
      if (sat.trail.length > 50) sat.trail.shift();

      if (sat.trail.length > 2) {
        for (var i = 1; i < sat.trail.length; i++) {
          var t = i / sat.trail.length;
          var behindAlpha = sat.trail[i].behind ? 0.08 : 0.3;
          ctx.strokeStyle = "rgba(60,55,48," + t * behindAlpha + ")";
          ctx.lineWidth = t * 1.5;
          ctx.beginPath();
          ctx.moveTo(sat.trail[i - 1].x, sat.trail[i - 1].y);
          ctx.lineTo(sat.trail[i].x, sat.trail[i].y);
          ctx.stroke();
        }
      }

      var satAlpha = satBehind ? 0.15 : 0.8;
      ctx.fillStyle = "rgba(40,35,30," + satAlpha + ")";
      ctx.beginPath();
      ctx.arc(satX, satY, sat.size, 0, Math.PI * 2);
      ctx.fill();

      if (!satBehind) {
        ctx.fillStyle = "rgba(40,35,30,0.08)";
        ctx.beginPath();
        ctx.arc(satX, satY, sat.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawAnnotations(time) {
    var cosRY = Math.cos(rotY),
      sinRY = Math.sin(rotY);
    var cosRX = Math.cos(rotX),
      sinRX = Math.sin(rotX);

    if (isDragging) {
      blockOpacity = Math.max(0, blockOpacity - 0.06);
      wasRecentlyDragging = true;
    } else {
      if (wasRecentlyDragging) {
        wasRecentlyDragging = false;
        setTimeout(function () {
          triggerCalculations();
        }, 300);
      }
      blockOpacity = Math.min(1, blockOpacity + 0.03);
    }

    if (blockOpacity < 0.01) return;

    var lineHeight = 13;

    dataBlocks.forEach(function (block, bi) {
      var dist = block.dist;
      var elev = block.elevation;

      var px = dist * Math.cos(block.angle) * Math.cos(elev);
      var py = dist * Math.sin(elev);
      var pz = dist * Math.sin(block.angle) * Math.cos(elev);

      var rx = px * cosRY - pz * sinRY;
      var rz = px * sinRY + pz * cosRY;
      var ry = py;

      var fy = ry * cosRX - rz * sinRX;
      var fz = ry * sinRX + rz * cosRX;

      var screenX = CX + rx;
      var screenY = CY + fy;
      var behind = fz < 0;

      var depthAlpha = behind ? 0.06 : 1;
      var alpha = blockOpacity * depthAlpha;

      if (alpha < 0.01) return;

      var wobX = Math.sin(time * 0.0003 + bi * 1.7) * 2;
      var wobY = Math.cos(time * 0.0004 + bi * 2.3) * 1.5;
      var ax = screenX + wobX;
      var ay = screenY + wobY;

      var ct = connectionTargets[bi];
      var cpx =
        ct.surfaceDist * Math.cos(ct.surfaceAngle) * Math.cos(ct.surfaceElev);
      var cpy = ct.surfaceDist * Math.sin(ct.surfaceElev);
      var cpz =
        ct.surfaceDist * Math.sin(ct.surfaceAngle) * Math.cos(ct.surfaceElev);

      var crx = cpx * cosRY - cpz * sinRY;
      var cry = cpy;
      var crz2 = cpx * sinRY + cpz * cosRY;
      var cfy = cry * cosRX - crz2 * sinRX;

      var ttx = CX + crx;
      var tty = CY + cfy;

      ctx.strokeStyle = "rgba(120,115,105," + 0.2 * alpha + ")";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ttx, tty);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(50,45,40," + 0.5 * alpha + ")";
      ctx.beginPath();
      ctx.arc(ax, ay, 2, 0, Math.PI * 2);
      ctx.fill();

      var isRight = rx > 0;
      var labelStartX = isRight ? ax + 10 : ax - 10;

      ctx.font = "9px var(--base-font-mono)";
      ctx.textBaseline = "top";

      block.rows.forEach(function (row, ri) {
        var rowY = ay - (block.rows.length * lineHeight) / 2 + ri * lineHeight;

        var labelText = row.label + ": ";
        var valueText = row.value;
        var labelWidth = ctx.measureText(labelText).width;

        var textX = labelStartX;

        ctx.fillStyle = "rgba(130,125,115," + 0.5 * alpha + ")";
        if (isRight) {
          ctx.textAlign = "left";
          ctx.fillText(labelText, textX, rowY);
        } else {
          ctx.textAlign = "right";
          ctx.fillText(
            labelText,
            textX - ctx.measureText(valueText).width,
            rowY,
          );
        }

        var valueAlpha = row.calculating
          ? 0.3 + Math.sin(Date.now() * 0.02 + ri) * 0.15
          : 0.7;

        ctx.fillStyle = "rgba(50,45,40," + valueAlpha * alpha + ")";
        if (isRight) {
          ctx.textAlign = "left";
          ctx.fillText(valueText, textX + labelWidth, rowY);
        } else {
          ctx.textAlign = "right";
          ctx.fillText(valueText, textX, rowY);
        }
      });
    });

    ctx.textAlign = "left";
  }

  function drawAtmosphere() {
    var gradient = ctx.createRadialGradient(
      CX,
      CY,
      RADIUS * 0.95,
      CX,
      CY,
      RADIUS * 1.15,
    );
    gradient.addColorStop(0, "rgba(240,237,230,0)");
    gradient.addColorStop(0.5, "rgba(200,195,185,0.08)");
    gradient.addColorStop(1, "rgba(240,237,230,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS * 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // ============================================
  // MAIN LOOP
  // ============================================
  function render(time) {
    if (!canvas) return;

    ctx.clearRect(0, 0, W, H);

    if (!isDragging) {
      velY *= 0.95;
      velX *= 0.95;

      if (Math.abs(velY) < 0.0005 && Math.abs(velX) < 0.0005) {
        rotY += autoRotSpeed;
        velY = 0;
        velX = 0;
      } else {
        rotY += velY;
        rotX += velX;
        rotX = Math.max(-1.2, Math.min(1.2, rotX));
      }
    }

    drawAtmosphere();
    drawGlobe();
    drawOrbits(time);
    drawAnnotations(time);

    animId = requestAnimationFrame(render);
  }

  // ============================================
  // INIT — must run after all declarations
  // ============================================
  var mql = window.matchMedia(DESKTOP_MQ);
  mql.addEventListener("change", onMediaChange);
  onMediaChange(mql);
})();
