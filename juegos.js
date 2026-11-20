/* Zona de juegos de VikGrafic: "Viborita de Tinta" y "Bloques CMYK" */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const overlay = $("gameOverlay");
  if (!overlay) return;

  const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
  const nextCanvas = $("nextCanvas"), nctx = nextCanvas.getContext("2d");
  const ui = {
    title: $("gameTitle"), score: $("gScore"), best: $("gBest"), extra: $("gExtra"), extraLabel: $("gExtraLabel"),
    nextBox: $("gNextBox"), stage: $("gStage"), board: $("gBoard"),
    start: $("gStart"), startTitle: $("gStartTitle"), startText: $("gStartText"), play: $("gPlay"),
    over: $("gOver"), final: $("gFinal"), record: $("gRecord"), overBest: $("gOverBest"), again: $("gAgain"), share: $("gShare"),
    sound: $("gSound"), pause: $("gPause"), close: $("gClose"), ctrlSnake: $("ctrlSnake"), ctrlBlocks: $("ctrlBlocks")
  };

  const COL = { c: "#00c8ff", m: "#ff2e93", y: "#ffd60a", gold: "#f6c453", blue: "#6a5cff", green: "#2ee88a", red: "#ff5a36" };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Utilidades ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
  };
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const mix = (a, b, k) => { const p = hexRgb(a), q = hexRgb(b); return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(",")})`; };
  const shade = (h, amt) => { const t = amt < 0 ? "#000000" : "#ffffff"; return mix(h, t, Math.abs(amt)); };
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  }

  // ---------- Sonido (sintetizado, sin archivos) ----------
  const snd = {
    on: store.get("vg-sonido", "1") === "1", ac: null,
    tone(f1, f2, dur, type = "square", vol = .05, delay = 0) {
      if (!this.on) return;
      try {
        this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
        const ac = this.ac; if (ac.state === "suspended") ac.resume();
        const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + .02);
      } catch (e) {}
    },
    eat() { this.tone(520, 900, .09); },
    star() { [660, 880, 1320].forEach((f, i) => this.tone(f, f * 1.02, .12, "triangle", .07, i * .07)); },
    move() { this.tone(260, 240, .03, "square", .018); },
    rotate() { this.tone(480, 640, .05, "triangle", .04); },
    lock() { this.tone(170, 110, .07, "triangle", .07); },
    clear(n) { for (let i = 0; i <= n; i++) this.tone(500 + i * 160, 900 + i * 220, .12, "square", .045, i * .06); },
    level() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, .1, "triangle", .06, i * .08)); },
    over() { this.tone(440, 70, .7, "sawtooth", .06); }
  };

  // ---------- Efectos: partículas, textos flotantes, temblor ----------
  let parts = [], floats = [], shake = 0;
  function burst(x, y, color, n = 14, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 3) * power;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, decay: .016 + Math.random() * .02, size: 2 + Math.random() * 3, color });
    }
  }
  const floatText = (x, y, text, color = "#fff", size = 20) => floats.push({ x, y, text, color, size, life: 1 });
  function updateFx(dt) {
    const k = dt / 16.67;
    parts = parts.filter(p => { p.x += p.vx * k; p.y += p.vy * k; p.vy += .08 * k; p.life -= p.decay * k; return p.life > 0; });
    floats = floats.filter(f => { f.y -= .55 * k; f.life -= .016 * k; return f.life > 0; });
    shake = Math.max(0, shake - .45 * k);
  }
  function drawFx(c, W) {
    c.save(); c.globalCompositeOperation = "lighter";
    for (const p of parts) { c.globalAlpha = p.life; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * p.life + .5, 0, 7); c.fill(); }
    c.restore();
    c.save(); c.textAlign = "center"; c.textBaseline = "middle";
    for (const f of floats) {
      c.globalAlpha = Math.min(1, f.life * 1.6);
      c.font = `700 ${f.size}px Oswald, Impact, sans-serif`;
      const w = c.measureText(f.text).width;
      if (w > W - 12) c.font = `700 ${f.size * (W - 12) / w}px Oswald, Impact, sans-serif`;
      const x = Math.min(Math.max(f.x, Math.min(w, W - 12) / 2 + 6), W - Math.min(w, W - 12) / 2 - 6);
      c.lineWidth = 4; c.strokeStyle = "rgba(5,11,25,.85)"; c.strokeText(f.text, x, f.y);
      c.shadowColor = f.color; c.shadowBlur = 14; c.fillStyle = f.color; c.fillText(f.text, x, f.y);
    }
    c.restore();
  }

  // ---------- Dibujos compartidos ----------
  function drawBoardBg(c, cols, rows, s) {
    c.fillStyle = "#070f22"; c.fillRect(0, 0, cols * s, rows * s);
    c.fillStyle = "rgba(255,255,255,.06)"; // puntitos de trama de imprenta
    const r = Math.max(1, s * .06);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { c.beginPath(); c.arc(x * s + s / 2, y * s + s / 2, r, 0, 7); c.fill(); }
  }
  function tile(c, x, y, s, color, alpha = 1, glow = false) {
    const pad = Math.max(1, s * .06), r = s * .22;
    c.save(); c.globalAlpha = alpha;
    if (glow) { c.shadowColor = color; c.shadowBlur = s * .5; }
    const g = c.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, shade(color, .35)); g.addColorStop(1, shade(color, -.28));
    c.fillStyle = g; rr(c, x + pad, y + pad, s - pad * 2, s - pad * 2, r); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "rgba(255,255,255,.38)"; rr(c, x + pad * 2.4, y + pad * 2.2, s - pad * 4.8, s * .2, r * .6); c.fill();
    c.fillStyle = "rgba(255,255,255,.2)"; c.beginPath(); c.arc(x + s * .68, y + s * .66, s * .08, 0, 7); c.fill();
    c.restore();
  }
  function drawDrop(c, x, y, r, color) {
    c.save(); c.shadowColor = color; c.shadowBlur = r * 2.2;
    const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, shade(color, .45)); g.addColorStop(1, color);
    c.fillStyle = g; c.beginPath();
    c.moveTo(x, y - r * 1.5);
    c.bezierCurveTo(x + r * 1.15, y - r * .2, x + r, y + r, x, y + r);
    c.bezierCurveTo(x - r, y + r, x - r * 1.15, y - r * .2, x, y - r * 1.5);
    c.fill(); c.shadowBlur = 0;
    c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.arc(x - r * .35, y + r * .05, r * .2, 0, 7); c.fill();
    c.restore();
  }
  function drawStar(c, x, y, r, rot, color) {
    c.save(); c.translate(x, y); c.rotate(rot); c.shadowColor = color; c.shadowBlur = r * 1.6; c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rad = i % 2 ? r * .45 : r; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    c.closePath(); c.fill(); c.restore();
  }

  // =========================================================
  //  VIBORITA DE TINTA
  // =========================================================
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const INK = [COL.c, COL.m, COL.y];
  const BODY = [COL.c, COL.m, COL.y, COL.gold];
  const bodyColor = (i, t) => { const p = (i * .18 + t / 900) % BODY.length, a = Math.floor(p); return mix(BODY[a], BODY[(a + 1) % BODY.length], p - a); };

  const Snake = {
    key: "viborita", title: "Viborita de Tinta", cols: 17, rows: 17, maxCell: 34, extraLabel: "Largo", next: false,
    help: "Deslizá el dedo (o usá las flechas) para moverte. Comé las gotas de tinta y atrapá la estrella dorada antes de que desaparezca. ¡No te muerdas la cola!",
    reset() {
      const cy = this.rows >> 1;
      this.body = [{ x: 5, y: cy }, { x: 4, y: cy }, { x: 3, y: cy }];
      this.dir = [1, 0]; this.queue = []; this.acc = 0; this.speed = 160; this.score = 0; this.eaten = 0; this.t = 0;
      this.star = null; this.food = null; this.food = this.spawn();
    },
    free(x, y) {
      return !this.body.some(p => p.x === x && p.y === y) &&
        !(this.food && this.food.x === x && this.food.y === y) && !(this.star && this.star.x === x && this.star.y === y);
    },
    spawn() {
      let x, y, i = 0;
      do { x = Math.random() * this.cols | 0; y = Math.random() * this.rows | 0; } while (!this.free(x, y) && ++i < 500);
      return { x, y, color: INK[Math.random() * INK.length | 0] };
    },
    input(a) {
      const d = DIRS[a]; if (!d) return;
      const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
      if ((d[0] === -last[0] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return;
      if (this.queue.length < 3) this.queue.push(d);
    },
    update(dt) {
      this.t += dt;
      if (this.star && (this.star.life -= dt) <= 0) this.star = null;
      this.acc += dt;
      while (this.acc >= this.speed && state === "playing") { this.acc -= this.speed; this.step(); }
    },
    step() {
      if (this.queue.length) this.dir = this.queue.shift();
      const h = this.body[0], s = this.cell;
      const nx = (h.x + this.dir[0] + this.cols) % this.cols, ny = (h.y + this.dir[1] + this.rows) % this.rows;
      const eatFood = nx === this.food.x && ny === this.food.y;
      const eatStar = !!this.star && nx === this.star.x && ny === this.star.y;
      const body = eatFood || eatStar ? this.body : this.body.slice(0, -1);
      if (body.some(p => p.x === nx && p.y === ny)) return gameOver();
      this.body.unshift({ x: nx, y: ny });
      const cx = nx * s + s / 2, cy = ny * s + s / 2;
      if (eatFood) {
        this.score += 10; this.eaten++;
        burst(cx, cy, this.food.color, 18); floatText(cx, cy - s * .7, "+10", this.food.color);
        snd.eat(); buzz(12);
        this.speed = Math.max(70, this.speed - 3);
        this.food = this.spawn();
        if (this.eaten % 5 === 0 && !this.star) this.star = Object.assign(this.spawn(), { life: 6000, max: 6000 });
        if (this.eaten % 10 === 0) floatText(this.cols * s / 2, this.rows * s / 2, "¡IMPARABLE!", COL.c, 26);
      } else if (eatStar) {
        this.score += 50;
        burst(cx, cy, COL.gold, 36, 1.4); floatText(cx, cy - s * .7, "+50 ★", COL.gold, 24);
        snd.star(); buzz([20, 40, 20]); shake = 6; this.star = null;
      } else this.body.pop();
      hud();
    },
    extra() { return this.body.length; },
    draw(c) {
      const s = this.cell, t = this.t;
      drawBoardBg(c, this.cols, this.rows, s);
      const f = this.food;
      drawDrop(c, f.x * s + s / 2, f.y * s + s / 2 + s * .08, s * .3 * (1 + Math.sin(t / 160) * .12), f.color);
      if (this.star) {
        const st = this.star, cx = st.x * s + s / 2, cy = st.y * s + s / 2;
        if (!(st.life < 1500 && Math.floor(t / 120) % 2)) drawStar(c, cx, cy, s * .42, t / 400, COL.gold);
        c.save(); c.strokeStyle = COL.gold; c.globalAlpha = .75; c.lineWidth = 2;
        c.beginPath(); c.arc(cx, cy, s * .62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * st.life / st.max); c.stroke(); c.restore();
      }
      const n = this.body.length;
      c.save(); c.lineCap = "round";
      for (let i = n - 1; i >= 0; i--) {
        const p = this.body[i], col = bodyColor(i, t), px = p.x * s + s / 2, py = p.y * s + s / 2;
        const r = s * (i === 0 ? .46 : Math.max(.28, .42 - i / n * .14));
        c.shadowColor = col; c.shadowBlur = s * .45; c.fillStyle = col; c.strokeStyle = col;
        if (i > 0) {
          const q = this.body[i - 1];
          if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) === 1) {
            c.lineWidth = r * 2; c.beginPath(); c.moveTo(px, py); c.lineTo(q.x * s + s / 2, q.y * s + s / 2); c.stroke();
          }
        }
        c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
      }
      c.restore();
      // ojitos
      const h = this.body[0], hx = h.x * s + s / 2, hy = h.y * s + s / 2, dx = this.dir[0], dy = this.dir[1];
      for (const k of [-1, 1]) {
        const ex = hx + dx * s * .12 - dy * s * .2 * k, ey = hy + dy * s * .12 + dx * s * .2 * k;
        c.fillStyle = "#fff"; c.beginPath(); c.arc(ex, ey, s * .13, 0, 7); c.fill();
        c.fillStyle = "#070f22"; c.beginPath(); c.arc(ex + dx * s * .05, ey + dy * s * .05, s * .065, 0, 7); c.fill();
      }
    }
  };

  // =========================================================
  //  BLOQUES CMYK
  // =========================================================
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  const PCOL = { I: COL.m, O: COL.gold, T: COL.c, S: COL.y, Z: COL.blue, J: COL.green, L: COL.red };
  const rotate = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
  const eachCell = (m, fn) => m.forEach((row, r) => row.forEach((v, c) => { if (v) fn(r, c); }));
  const CLEAR_MS = 320;

  const Blocks = {
    key: "bloques", title: "Bloques CMYK", cols: 10, rows: 20, maxCell: 32, extraLabel: "Líneas", next: true,
    help: "Tocá para girar, deslizá para mover y deslizá rápido hacia abajo para soltar la pieza. Completá filas para imprimirlas. En la compu: flechas y barra espaciadora.",
    reset() {
      this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
      this.bag = []; this.nextType = this.take(); this.score = 0; this.lines = 0; this.level = 1;
      this.acc = 0; this.lockT = 0; this.clearing = null; this.t = 0; this.spawn();
    },
    take() { if (!this.bag.length) this.bag = shuffle(Object.keys(SHAPES)); return this.bag.pop(); },
    spawn() {
      this.type = this.nextType; this.nextType = this.take();
      this.m = SHAPES[this.type].map(r => r.slice());
      this.x = (this.cols - this.m[0].length) >> 1; this.y = this.type === "I" ? -1 : 0; this.lockT = 0; this.acc = 0;
      drawNext();
      if (this.hit(this.m, this.x, this.y)) gameOver();
    },
    hit(m, x, y) {
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const gx = x + c, gy = y + r;
        if (gx < 0 || gx >= this.cols || gy >= this.rows) return true;
        if (gy >= 0 && this.grid[gy][gx]) return true;
      }
      return false;
    },
    input(a) {
      if (this.clearing || state !== "playing") return;
      if (a === "left" || a === "right") {
        const dx = a === "left" ? -1 : 1;
        if (!this.hit(this.m, this.x + dx, this.y)) { this.x += dx; this.lockT = 0; snd.move(); }
      } else if (a === "rotate" || a === "up") {
        const m = rotate(this.m);
        for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
          if (!this.hit(m, this.x + kx, this.y + ky)) { this.m = m; this.x += kx; this.y += ky; this.lockT = 0; snd.rotate(); break; }
        }
      } else if (a === "down") {
        if (!this.hit(this.m, this.x, this.y + 1)) { this.y++; this.score += 1; this.acc = 0; hud(); }
      } else if (a === "drop") {
        let n = 0;
        while (!this.hit(this.m, this.x, this.y + 1)) { this.y++; n++; }
        this.score += n * 2; if (n > 2) shake = 4;
        this.lock();
      }
    },
    update(dt) {
      this.t += dt;
      if (this.clearing) { if ((this.clearing.t -= dt) <= 0) this.finishClear(); return; }
      if (this.hit(this.m, this.x, this.y + 1)) { if ((this.lockT += dt) > 450) this.lock(); return; }
      this.acc += dt;
      if (this.acc >= Math.max(80, 750 - (this.level - 1) * 65)) { this.acc = 0; this.y++; }
    },
    lock() {
      const s = this.cell, col = PCOL[this.type];
      let overTop = false;
      eachCell(this.m, (r, c) => { const gy = this.y + r; if (gy < 0) overTop = true; else this.grid[gy][this.x + c] = col; });
      snd.lock();
      if (overTop) { hud(); return gameOver(); }
      eachCell(this.m, (r, c) => burst((this.x + c) * s + s / 2, (this.y + r) * s + s, col, 2, .6));
      const full = [];
      this.grid.forEach((row, y) => { if (row.every(Boolean)) full.push(y); });
      if (full.length) {
        const n = full.length, pts = [0, 100, 300, 500, 800][n] * this.level, W = this.cols * s, y0 = full[0] * s;
        this.score += pts; this.clearing = { rows: full, t: CLEAR_MS };
        full.forEach(y => this.grid[y].forEach((cc, x) => burst(x * s + s / 2, y * s + s / 2, cc, 5, 1.3)));
        if (n === 4) { floatText(W / 2, y0 - 10, "¡IMPRESIÓN", COL.gold, 26); floatText(W / 2, y0 + 20, "PERFECTA!", COL.gold, 26); }
        else floatText(W / 2, y0, ["", "¡LÍNEA!", "¡DOBLE!", "¡TRIPLE!"][n], "#fff", 24);
        floatText(W / 2, y0 + (n === 4 ? 50 : 30), "+" + pts, COL.y, 18);
        snd.clear(n); buzz(n >= 3 ? [30, 40, 30] : 25); shake = 3 + n * 2;
      } else this.spawn();
      hud();
    },
    finishClear() {
      const rows = this.clearing.rows; this.clearing = null;
      rows.forEach(y => { this.grid.splice(y, 1); this.grid.unshift(Array(this.cols).fill(null)); });
      const before = this.level;
      this.lines += rows.length; this.level = 1 + Math.floor(this.lines / 10);
      if (this.level > before) { floatText(this.cols * this.cell / 2, this.rows * this.cell / 2, "¡NIVEL " + this.level + "!", COL.c, 30); snd.level(); }
      this.spawn(); hud();
    },
    extra() { return this.lines; },
    ghostY() { let y = this.y; while (!this.hit(this.m, this.x, y + 1)) y++; return y; },
    draw(c) {
      const s = this.cell;
      drawBoardBg(c, this.cols, this.rows, s);
      this.grid.forEach((row, y) => row.forEach((col, x) => { if (col) tile(c, x * s, y * s, s, col); }));
      if (this.clearing) {
        c.save(); c.globalAlpha = this.clearing.t / CLEAR_MS; c.fillStyle = "#fff"; c.shadowColor = "#fff"; c.shadowBlur = 24;
        this.clearing.rows.forEach(y => c.fillRect(0, y * s, this.cols * s, s)); c.restore();
        return;
      }
      if (!this.m) return;
      const col = PCOL[this.type], gy = this.ghostY();
      c.save(); c.strokeStyle = col; c.globalAlpha = .5; c.lineWidth = 2; c.setLineDash([4, 3]);
      eachCell(this.m, (r, cc) => { if (gy + r >= 0) { rr(c, (this.x + cc) * s + 3, (gy + r) * s + 3, s - 6, s - 6, s * .2); c.stroke(); } });
      c.restore();
      eachCell(this.m, (r, cc) => { if (this.y + r >= 0) tile(c, (this.x + cc) * s, (this.y + r) * s, s, col, 1, true); });
    }
  };

  function drawNext() {
    const d = Math.min(2, window.devicePixelRatio || 1), size = 40;
    nextCanvas.width = size * d; nextCanvas.height = size * d;
    nctx.setTransform(d, 0, 0, d, 0, 0);
    if (game !== Blocks || !Blocks.nextType) return;
    const cells = []; eachCell(SHAPES[Blocks.nextType], (r, c) => cells.push([c, r]));
    const xs = cells.map(p => p[0]), ys = cells.map(p => p[1]), minX = Math.min(...xs), minY = Math.min(...ys);
    const s = 9, w = (Math.max(...xs) - minX + 1) * s, h = (Math.max(...ys) - minY + 1) * s;
    cells.forEach(([x, y]) => tile(nctx, (size - w) / 2 + (x - minX) * s, (size - h) / 2 + (y - minY) * s, s, PCOL[Blocks.nextType], 1, true));
  }

  // =========================================================
  //  Motor común
  // =========================================================
  const GAMES = { viborita: Snake, bloques: Blocks };
  let game = null, state = "idle", raf = 0, last = 0, dpr = 1;

  const best = () => +store.get("vg-record-" + game.key, "0") || 0;
  function hud() {
    ui.score.textContent = game.score;
    ui.best.textContent = Math.max(best(), game.score);
    ui.extra.textContent = game.extra();
  }
  function fit() {
    if (!game) return;
    const W = ui.stage.clientWidth - 8, H = ui.stage.clientHeight - 8;
    const s = Math.max(8, Math.min(game.maxCell, Math.floor(Math.min(W / game.cols, H / game.rows))));
    game.cell = s; dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = game.cols * s * dpr; canvas.height = game.rows * s * dpr;
    canvas.style.width = game.cols * s + "px"; canvas.style.height = game.rows * s + "px";
    drawNext(); render();
  }
  function render() {
    if (!game || !game.cell) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (shake > 0 && !reduceMotion) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    game.draw(ctx);
    drawFx(ctx, game.cols * game.cell);
    ctx.restore();
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    const t = performance.now(), dt = Math.min(50, t - (last || t)); last = t;
    if (state === "playing") game.update(dt);
    updateFx(dt); render();
  }

  function showPanel(which) { ui.start.hidden = which !== "start"; ui.over.hidden = which !== "over"; }
  function ready(title, text, btn) {
    ui.startTitle.textContent = title; ui.startText.textContent = text; ui.play.innerHTML = btn; showPanel("start");
  }
  function setPauseIcon() { ui.pause.innerHTML = state === "paused" ? '<i class="bi bi-play-fill"></i>' : '<i class="bi bi-pause-fill"></i>'; }

  function track(name, params) { try { if (window.gtag) window.gtag("event", name, params); } catch (e) {} }

  function open(key) {
    game = GAMES[key]; if (!game) return;
    track("juego_abrir", { juego: game.title });
    ui.title.textContent = game.title; ui.extraLabel.textContent = game.extraLabel;
    ui.nextBox.hidden = !game.next;
    ui.ctrlSnake.hidden = game !== Snake; ui.ctrlBlocks.hidden = game !== Blocks;
    overlay.hidden = false; document.body.classList.add("game-open");
    parts = []; floats = []; shake = 0;
    game.reset(); state = "ready"; hud(); setPauseIcon();
    ready(game.title, game.help, '<i class="bi bi-play-fill me-1"></i>¡Jugar!');
    fit(); requestAnimationFrame(fit);
    cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(loop);
    if (!(history.state && history.state.juego)) history.pushState({ juego: key }, "");
  }
  function close(fromHistory) {
    if (overlay.hidden) return;
    state = "idle"; cancelAnimationFrame(raf);
    overlay.hidden = true; document.body.classList.remove("game-open");
    refreshRecords();
    if (!fromHistory && history.state && history.state.juego) history.back();
  }
  function start() {
    if (state === "playing" || state === "idle") return;
    if (state === "over") { parts = []; floats = []; game.reset(); hud(); }
    if (state !== "paused") track("juego_iniciar", { juego: game.title });
    state = "playing"; showPanel(); setPauseIcon();
    snd.tone(1, 1, .01, "sine", .0001); // habilita el audio en iPhone
  }
  function pause() {
    if (state !== "playing") return;
    state = "paused"; setPauseIcon();
    ready("En pausa", "Tomate un respiro. Cuando quieras, seguimos.", '<i class="bi bi-play-fill me-1"></i>Continuar');
  }
  function gameOver() {
    if (state === "over") return;
    state = "over"; snd.over(); buzz([60, 50, 60]); shake = 8;
    const prev = best(), sc = game.score, rec = sc > prev && sc > 0;
    if (rec) store.set("vg-record-" + game.key, sc);
    track("juego_fin", { juego: game.title, puntos: sc, record: rec ? "si" : "no" });
    ui.final.textContent = sc; ui.record.hidden = !rec; ui.overBest.textContent = Math.max(prev, sc);
    const url = location.href.split("#")[0];
    const msg = `¡Hice ${sc} puntos en ${game.title} de VikGrafic! 🎮 ¿Me superás? ${url}`;
    ui.share.href = "https://wa.me/?text=" + encodeURIComponent(msg);
    hud();
    setTimeout(() => { if (state === "over") showPanel("over"); }, 700);
  }

  // ---------- Controles ----------
  ui.start.addEventListener("click", () => start());
  ui.again.addEventListener("click", () => start());
  ui.close.addEventListener("click", () => close());
  ui.pause.addEventListener("click", () => { if (state === "playing") pause(); else if (state === "paused") start(); });
  function paintSound() { ui.sound.innerHTML = snd.on ? '<i class="bi bi-volume-up-fill"></i>' : '<i class="bi bi-volume-mute-fill"></i>'; }
  ui.sound.addEventListener("click", () => { snd.on = !snd.on; store.set("vg-sonido", snd.on ? "1" : "0"); paintSound(); });
  paintSound();

  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", " ": "drop" };
  document.addEventListener("keydown", e => {
    if (overlay.hidden) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "p" || e.key === "P") { if (state === "playing") pause(); else if (state === "paused") start(); return; }
    if (e.key === "Enter") { e.preventDefault(); if (state !== "playing") start(); return; }
    const a = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!a) return;
    e.preventDefault();
    if (state === "ready" || state === "paused") start();
    if (state === "playing") game.input(a === "up" && game === Blocks ? "rotate" : a);
  });

  // Gestos sobre el tablero
  let tp = null;
  ui.board.addEventListener("pointerdown", e => {
    if (e.target.closest(".g-panel") || state !== "playing") return;
    tp = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    try { ui.board.setPointerCapture(e.pointerId); } catch (err) {}
  });
  ui.board.addEventListener("pointermove", e => {
    if (!tp || state !== "playing") return;
    const dx = e.clientX - tp.x, dy = e.clientY - tp.y, s = game.cell;
    if (game === Snake) {
      const th = Math.max(16, s * .7);
      if (Math.abs(dx) > th || Math.abs(dy) > th) {
        game.input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
        tp.x = e.clientX; tp.y = e.clientY; tp.moved = true;
      }
    } else {
      if (Math.abs(dx) >= s) {
        const n = Math.trunc(dx / s);
        for (let i = 0; i < Math.abs(n); i++) game.input(n > 0 ? "right" : "left");
        tp.x += n * s; tp.moved = true;
      }
      if (dy >= s * 1.2) {
        const n = Math.trunc(dy / (s * 1.2));
        for (let i = 0; i < n; i++) game.input("down");
        tp.y += n * s * 1.2; tp.moved = true;
      }
    }
  });
  const endTouch = e => {
    if (!tp) return;
    const dt = performance.now() - tp.t, ty = e.clientY - tp.sy, tx = e.clientX - tp.sx;
    if (game === Blocks && state === "playing" && e.type === "pointerup") {
      if (dt < 260 && ty > 50 && ty > Math.abs(tx) * 1.5) game.input("drop");
      else if (!tp.moved && dt < 300) game.input("rotate");
    }
    tp = null;
  };
  ui.board.addEventListener("pointerup", endTouch);
  ui.board.addEventListener("pointercancel", endTouch);

  // Botones en pantalla (mantener apretado repite)
  overlay.querySelectorAll("[data-act]").forEach(b => {
    let timer = 0, rep = 0;
    const stop = () => { clearTimeout(timer); clearInterval(rep); };
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (state === "ready" || state === "paused") start();
      if (state !== "playing") return;
      const a = b.dataset.act; game.input(a);
      if (b.hasAttribute("data-repeat")) {
        stop();
        timer = setTimeout(() => { rep = setInterval(() => { if (state === "playing") game.input(a); else stop(); }, 65); }, 190);
      }
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, stop));
    b.addEventListener("contextmenu", e => e.preventDefault());
  });

  window.addEventListener("resize", () => { if (!overlay.hidden) fit(); });
  window.addEventListener("popstate", () => close(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  // Abrir juegos desde la página
  document.querySelectorAll("[data-juego]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); open(el.dataset.juego); }));
  function refreshRecords() {
    document.querySelectorAll("[data-record]").forEach(el => { el.textContent = store.get("vg-record-" + el.dataset.record, "0"); });
  }
  refreshRecords();

  // =========================================================
  //  Vistas previas animadas en las tarjetas
  // =========================================================
  (function previews() {
    const sv = $("pvViborita"), bv = $("pvBloques");
    if (!sv || !bv) return;

    const ps = Object.create(Snake);
    Object.assign(ps, { cols: 14, rows: 10, t: 0, star: null, food: { x: 7, y: 5, color: COL.m } });
    const path = [];
    for (let x = 2; x <= 11; x++) path.push({ x, y: 2 });
    for (let y = 3; y <= 7; y++) path.push({ x: 11, y });
    for (let x = 10; x >= 2; x--) path.push({ x, y: 7 });
    for (let y = 6; y >= 3; y--) path.push({ x: 2, y });
    let head = 10;
    const setBody = () => {
      ps.body = []; for (let i = 0; i < 10; i++) ps.body.push(path[(head - i + path.length) % path.length]);
      ps.dir = [ps.body[0].x - ps.body[1].x, ps.body[0].y - ps.body[1].y];
    };
    setBody();

    const pb = Object.create(Blocks);
    const rows = ["..........", "..........", "L.......OO", "LL..SS.ZOO", "IIIISS.ZZJ", "TTT.OOJJJJ", "ZTLLOOSS.J"];
    Object.assign(pb, { cols: 10, rows: rows.length, t: 0, clearing: null });
    pb.grid = rows.map(r => r.split("").map(ch => ch === "." ? null : PCOL[ch]));
    const seq = ["T", "J", "S", "O", "L", "Z", "I"]; let si = 0;
    const newPiece = () => { pb.type = seq[si++ % seq.length]; pb.m = SHAPES[pb.type].map(r => r.slice()); if (si % 2) pb.m = rotate(pb.m); pb.x = 1 + (Math.random() * (pb.cols - 1 - pb.m[0].length) | 0); pb.y = -2; };
    newPiece();

    const items = [
      { cv: sv, obj: ps, ms: 130, acc: 0, step() { head = (head + 1) % path.length; setBody(); } },
      { cv: bv, obj: pb, ms: 240, acc: 0, step() { if (pb.hit(pb.m, pb.x, pb.y + 1)) newPiece(); else pb.y++; } }
    ];
    items.forEach(it => { it.cv.style.aspectRatio = it.obj.cols + " / " + it.obj.rows; });
    const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; };

    let lt = 0;
    function frame() {
      requestAnimationFrame(frame);
      const t = performance.now(), dt = Math.min(50, t - (lt || t)); lt = t;
      if (!overlay.hidden) return;
      for (const it of items) {
        if (!onScreen(it.cv)) continue;
        const w = it.cv.clientWidth; if (!w) continue;
        const d = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * d);
        if (it.cv.width !== W) { it.cv.width = W; it.cv.height = Math.round(w * it.obj.rows / it.obj.cols * d); }
        it.obj.cell = w / it.obj.cols; it.obj.t += dt;
        if (!reduceMotion && (it.acc += dt) > it.ms) { it.acc = 0; it.step(); }
        const c = it.cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0); it.obj.draw(c);
      }
    }
    requestAnimationFrame(frame);
  })();
})();
