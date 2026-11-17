/* Tink Tink Boom: Dig Survivor - site behaviour. Transform and opacity only. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var still = reduce.matches;
  var raf = window.requestAnimationFrame.bind(window);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- header ---------- */
  var top = $('#top');
  var lastSolid = null;
  function headerState() {
    var solid = window.scrollY > 40;
    if (solid !== lastSolid) { top.classList.toggle('solid', solid); lastSolid = solid; }
  }

  /* ---------- reveals ---------- */
  var revealEls = $$('.rv, .rv-pop');
  if (still || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { ro.observe(el); });
  }

  /* ---------- count-up stats ---------- */
  if (!still && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        co.unobserve(e.target);
        var el = e.target, n = +el.getAttribute('data-count'), t0 = 0;
        el.textContent = '0';
        function step(t) {
          if (!t0) t0 = t;
          var p = Math.min(1, (t - t0) / 1100);
          el.textContent = String(Math.round(n * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf(step);
        }
        setTimeout(function () { raf(step); }, 250);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { co.observe(el); });
  }

  /* ---------- embers ---------- */
  var embers = $('.embers');
  if (embers && !still) {
    var count = window.innerWidth < 720 ? 10 : 18;
    for (var i = 0; i < count; i++) {
      var e = document.createElement('i');
      e.style.left = (Math.random() * 100).toFixed(1) + '%';
      e.style.animationDelay = (-Math.random() * 7).toFixed(2) + 's';
      e.style.animationDuration = (5 + Math.random() * 5).toFixed(2) + 's';
      e.style.setProperty('--dx', ((Math.random() - 0.5) * 140).toFixed(0) + 'px');
      embers.appendChild(e);
    }
  }

  /* ---------- parallax depth layers ---------- */
  var layers = still ? [] : $$('[data-depth]').map(function (el) {
    return { el: el, depth: parseFloat(el.getAttribute('data-depth')) || 0, sec: el.closest('section') };
  });

  /* ---------- screenshot reel ---------- */
  var reel = $('#reel');
  var phones = reel ? $$('.phone', reel) : [];
  var dotsBox = $('#dots');
  var dots = phones.map(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Show screenshot ' + (i + 1) + ' of ' + phones.length);
    b.addEventListener('click', function () { go(i); });
    dotsBox.appendChild(b);
    return b;
  });
  var current = -1;
  function go(i) {
    i = Math.max(0, Math.min(phones.length - 1, i));
    var p = phones[i];
    reel.scrollTo({ left: p.offsetLeft - (reel.clientWidth - p.offsetWidth) / 2, behavior: still ? 'auto' : 'smooth' });
  }
  $$('.arrow').forEach(function (b) {
    b.addEventListener('click', function () { go(Math.max(current, 0) + (+b.getAttribute('data-step'))); });
  });
  function reelState() {
    if (!reel) return;
    var mid = reel.scrollLeft + reel.clientWidth / 2;
    var best = 0, bestD = 1e9;
    for (var i = 0; i < phones.length; i++) {
      var p = phones[i];
      var c = p.offsetLeft + p.offsetWidth / 2;
      var n = (c - mid) / (p.offsetWidth + 20);
      var a = Math.min(1, Math.abs(n));
      if (!still) {
        p.style.setProperty('--k', (1 - a * 0.14).toFixed(3));
        p.style.setProperty('--o', (1 - a * 0.45).toFixed(3));
      }
      if (Math.abs(c - mid) < bestD) { bestD = Math.abs(c - mid); best = i; }
    }
    if (best !== current) {
      if (current >= 0) dots[current].removeAttribute('aria-current');
      dots[best].setAttribute('aria-current', 'true');
      current = best;
    }
  }
  if (reel) {
    var reelTick = false;
    reel.addEventListener('scroll', function () {
      if (reelTick) return; reelTick = true;
      raf(function () { reelTick = false; reelState(); });
    }, { passive: true });
    reel.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(current + 1); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(current - 1); }
    });
  }

  /* ---------- scroll loop ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    raf(function () {
      ticking = false;
      headerState();
      var vh = window.innerHeight;
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i], r = L.sec.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        L.el.style.transform = 'translate3d(0,' + (-r.top * L.depth).toFixed(1) + 'px,0)';
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { onScroll(); reelState(); });
  onScroll();
  // on wide screens start one card in, so the reel is full on both sides
  if (reel && window.innerWidth >= 960) { var p1 = phones[1]; reel.scrollLeft = p1.offsetLeft - (reel.clientWidth - p1.offsetWidth) / 2; }
  reelState();

  /* ---------- hero video, loaded after the page is ready ---------- */
  var video = $('#hero-video');
  function startVideo() {
    if (!video || still) return;
    var c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    var webm = document.createElement('source');
    webm.src = video.getAttribute('data-webm'); webm.type = 'video/webm';
    var mp4 = document.createElement('source');
    mp4.src = video.getAttribute('data-mp4'); mp4.type = 'video/mp4';
    // Safari plays the H.264 MP4 more reliably, so offer it first there
    var safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (safari) { video.appendChild(mp4); video.appendChild(webm); } else { video.appendChild(webm); video.appendChild(mp4); }
    video.preload = 'auto';
    video.addEventListener('playing', function () { video.classList.add('on'); }, { once: true });
    video.load();
    var p = video.play(); if (p && p.catch) p.catch(function () {});
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (x) {
          if (x.isIntersecting) { var q = video.play(); if (q && q.catch) q.catch(function () {}); } else video.pause();
        });
      }, { threshold: 0.05 }).observe(video);
    }
  }
  if (document.readyState === 'complete') setTimeout(startVideo, 400);
  else window.addEventListener('load', function () { setTimeout(startVideo, 400); });

  reduce.addEventListener && reduce.addEventListener('change', function (m) { if (m.matches && video) { video.pause(); video.classList.remove('on'); } });

  /* ---------- dig wall: canvas blocks that crack and burst ---------- */
  var cv = $('#wall');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var box = $('#wall-box'), hint = $('#wall-hint'), oreN = $('#ore-n'), oreEl = $('#ore'), oreLive = $('#ore-live');
  var TYPES = {
    copper: { top: '#ffb35a', face: '#e8731f', dark: '#9a3d0d', fleck: '#ffd98a', ore: 1 },
    slate:  { top: '#d9d6f0', face: '#9d9ac6', dark: '#5d5a88', fleck: '#f1f0fb', ore: 1 },
    gold:   { top: '#fff2a6', face: '#ffc53a', dark: '#b07410', fleck: '#fffbe2', ore: 3 },
    ink:    { top: '#7a68b0', face: '#3d2f68', dark: '#1e1538', fleck: '#b993ff', ore: 2 }
  };
  var W = 0, H = 0, S = 0, cols = 7, rows = 5, dpr = 1, ox = 0, oy = 0;
  var blocks = [], parts = [], rings = [], ore = 0, running = false, visible = false, userHit = false, last = 0;

  function rnd(seed) { var x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function pickType(i) {
    var r = rnd(i * 7.13 + 1.7);
    return r < 0.44 ? 'copper' : r < 0.74 ? 'slate' : r < 0.87 ? 'gold' : 'ink';
  }
  function makeCracks(seed) {
    var paths = [];
    var cx = 0.35 + rnd(seed) * 0.3, cy = 0.35 + rnd(seed + 1) * 0.3;
    for (var k = 0; k < 3; k++) {
      var pts = [[cx, cy]], ang = (k / 3) * Math.PI * 2 + rnd(seed + k * 3) * 1.4, x = cx, y = cy;
      for (var j = 0; j < 4; j++) {
        ang += (rnd(seed + k * 11 + j) - 0.5) * 1.1;
        var len = 0.12 + rnd(seed + k * 5 + j * 2) * 0.12;
        x = Math.max(0.04, Math.min(0.96, x + Math.cos(ang) * len));
        y = Math.max(0.04, Math.min(0.96, y + Math.sin(ang) * len));
        pts.push([x, y]);
      }
      paths.push(pts);
    }
    return paths;
  }
  function build() {
    var rect = cv.getBoundingClientRect();
    var wide = rect.width >= 760;
    var nc = wide ? 12 : 7, nr = 5;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(rect.width * dpr); H = Math.round(rect.height * dpr);
    if (!W || !H) return;
    cv.width = W; cv.height = H;
    if (nc !== cols || !blocks.length) {
      cols = nc; rows = nr; blocks = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var id = r * cols + c;
        blocks.push({ c: c, r: r, type: pickType(id + (wide ? 100 : 0)), hits: 0, alive: true, squash: 0, flash: 0, grow: 1, cracks: makeCracks(id * 3.7 + 5), seed: id });
      }
    }
    S = Math.min(W / cols, H / rows);
    ox = (W - S * cols) / 2; oy = (H - S * rows) / 2;
    draw();
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function drawBlock(b) {
    var g = S * 0.045, x = ox + b.c * S + g, y = oy + b.r * S + g, s = S - g * 2;
    var T = TYPES[b.type];
    var k = b.grow * (1 - b.squash * 0.1);
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2); ctx.scale(k, k); ctx.translate(-s / 2, -s / 2);
    var rad = s * 0.12;
    // body
    rr(0, 0, s, s, rad); ctx.fillStyle = T.dark; ctx.fill();
    rr(0, 0, s, s * 0.9, rad); ctx.fillStyle = T.face; ctx.fill();
    // top bevel
    ctx.save(); rr(0, 0, s, s * 0.9, rad); ctx.clip();
    ctx.fillStyle = T.top; ctx.fillRect(0, 0, s, s * 0.2);
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffffff'; ctx.fillRect(s * 0.08, s * 0.05, s * 0.4, s * 0.05);
    ctx.globalAlpha = 1;
    // flecks
    ctx.fillStyle = T.fleck;
    for (var f = 0; f < 4; f++) {
      var fx = 0.15 + rnd(b.seed * 13 + f) * 0.65, fy = 0.3 + rnd(b.seed * 17 + f) * 0.48, fs = s * (0.06 + rnd(b.seed + f * 7) * 0.06);
      ctx.fillRect(fx * s, fy * s, fs, fs);
      ctx.globalAlpha = 0.35; ctx.fillStyle = T.dark; ctx.fillRect(fx * s, fy * s + fs, fs, fs * 0.35); ctx.globalAlpha = 1; ctx.fillStyle = T.fleck;
    }
    ctx.restore();
    // cracks
    if (b.hits > 0) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var n = b.hits === 1 ? 1 : 3;
      for (var p = 0; p < n; p++) {
        var pts = b.cracks[p];
        if (b.hits >= 2) {
          ctx.strokeStyle = 'rgba(255,170,60,.85)'; ctx.lineWidth = s * 0.07;
          ctx.beginPath(); ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
          for (var q = 1; q < pts.length; q++) ctx.lineTo(pts[q][0] * s, pts[q][1] * s);
          ctx.stroke();
        }
        ctx.strokeStyle = b.hits >= 2 ? '#fff1b8' : 'rgba(20,10,30,.85)';
        ctx.lineWidth = s * (b.hits >= 2 ? 0.025 : 0.035);
        ctx.beginPath(); ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
        for (var q2 = 1; q2 < pts.length; q2++) ctx.lineTo(pts[q2][0] * s, pts[q2][1] * s);
        ctx.stroke();
      }
    }
    if (b.flash > 0) { rr(0, 0, s, s, rad); ctx.fillStyle = 'rgba(255,255,255,' + (b.flash * 0.55).toFixed(3) + ')'; ctx.fill(); }
    ctx.restore();
  }
  function drawHole(b) {
    var g = S * 0.045, x = ox + b.c * S + g, y = oy + b.r * S + g, s = S - g * 2;
    rr(x, y, s, s, s * 0.12); ctx.fillStyle = '#120d1e'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(x + s * 0.3, y + s * 0.6, s * 0.08, s * 0.08);
    ctx.fillRect(x + s * 0.62, y + s * 0.36, s * 0.06, s * 0.06);
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1426'; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < blocks.length; i++) { var b = blocks[i]; if (b.alive) drawBlock(b); else drawHole(b); }
    // particles
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j], a = Math.max(0, Math.min(1, p.life / p.max * 1.6));
      ctx.globalAlpha = a;
      if (p.kind === 'chunk') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c2; ctx.fillRect(-p.s / 2, -p.s / 2 + p.s * 0.18, p.s, p.s * 0.82);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.8);
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
    for (var k = 0; k < rings.length; k++) {
      var R = rings[k], t = 1 - R.life / R.max;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = S * 0.06 * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(R.x, R.y, S * (0.3 + t * 0.9), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function burst(b) {
    var T = TYPES[b.type];
    var cx = ox + (b.c + 0.5) * S, cy = oy + (b.r + 0.5) * S;
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2, sp = S * (2.2 + Math.random() * 4.5);
      parts.push({ kind: 'chunk', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        s: S * (0.1 + Math.random() * 0.16), c: Math.random() < 0.5 ? T.face : T.top, c2: T.dark, life: 1.1, max: 1.1, g: S * 16 });
    }
    for (var j = 0; j < 16; j++) {
      var a2 = Math.random() * Math.PI * 2, sp2 = S * (3 + Math.random() * 7);
      parts.push({ kind: 'spark', x: cx, y: cy, vx: Math.cos(a2) * sp2, vy: Math.sin(a2) * sp2 - S * 2, s: S * (0.02 + Math.random() * 0.035) * 1.4,
        c: j % 3 ? '#ffcf5a' : '#fff4c8', life: 0.55, max: 0.55, g: S * 6 });
    }
    rings.push({ x: cx, y: cy, life: 0.35, max: 0.35 });
  }

  function hit(b) {
    if (!b || !b.alive || b.grow < 1) return;
    b.hits++; b.squash = 1; b.flash = 1;
    if (b.hits >= 3) {
      b.alive = false;
      if (!still) {
        burst(b);
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      }
      ore += TYPES[b.type].ore;
      oreN.textContent = ore;
      oreLive.textContent = 'Block broken. Ore collected: ' + ore;
      if (!still) { oreEl.classList.remove('pop'); void oreEl.offsetWidth; oreEl.classList.add('pop'); }
      setTimeout(function () {
        b.alive = true; b.hits = 0; b.type = pickType(b.seed + ore * 3 + 1);
        b.cracks = makeCracks(b.seed * 3.7 + ore + 9); b.grow = still ? 1 : 0;
        kick();
      }, 3200);
    }
    kick();
  }
  function blockAt(clientX, clientY) {
    var r = cv.getBoundingClientRect();
    var x = (clientX - r.left) * dpr - ox, y = (clientY - r.top) * dpr - oy;
    var c = Math.floor(x / S), rr2 = Math.floor(y / S);
    if (c < 0 || rr2 < 0 || c >= cols || rr2 >= rows) return null;
    return blocks[rr2 * cols + c];
  }
  function userTouch() {
    if (!userHit) { userHit = true; hint.classList.add('gone'); }
  }
  var down = false, lastB = null;
  cv.addEventListener('pointerdown', function (ev) {
    down = true; userTouch();
    lastB = blockAt(ev.clientX, ev.clientY); hit(lastB);
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!down) return;
    var b = blockAt(ev.clientX, ev.clientY);
    if (b && b !== lastB) { lastB = b; hit(b); }
  });
  window.addEventListener('pointerup', function () { down = false; lastB = null; });
  $('#swing').addEventListener('click', function () {
    userTouch();
    var alive = blocks.filter(function (b) { return b.alive && b.grow >= 1; });
    if (!alive.length) return;
    var damaged = alive.filter(function (b) { return b.hits > 0; });
    hit((damaged.length ? damaged : alive)[Math.floor(Math.random() * (damaged.length ? damaged.length : alive.length))]);
  });

  function step(t) {
    var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    var active = false;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.squash > 0) { b.squash = Math.max(0, b.squash - dt * 8); active = true; }
      if (b.flash > 0) { b.flash = Math.max(0, b.flash - dt * 6); active = true; }
      if (b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 3.2); active = true; }
    }
    for (var j = parts.length - 1; j >= 0; j--) {
      var p = parts[j];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(j, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      p.vx *= 0.985;
    }
    for (var k = rings.length - 1; k >= 0; k--) { rings[k].life -= dt; if (rings[k].life <= 0) rings.splice(k, 1); }
    if (parts.length || rings.length) active = true;
    draw();
    if (active && visible) raf(step); else { running = false; last = 0; }
  }
  function kick() {
    if (still) { draw(); return; }
    if (!running) { running = true; last = 0; raf(step); }
  }

  var demoDone = false;
  function demo() {
    if (demoDone || still || userHit) return;
    demoDone = true;
    var b = blocks[Math.floor(rows / 2) * cols + Math.floor(cols / 2)];
    [0, 420, 840].forEach(function (d) { setTimeout(function () { if (!userHit || d === 0) hit(b); }, 700 + d); });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        visible = x.isIntersecting;
        if (visible) { kick(); if (x.intersectionRatio > 0.5) demo(); }
      });
    }, { threshold: [0, 0.55] }).observe(cv);
  } else { visible = true; }
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 120); });
  build();
})();
