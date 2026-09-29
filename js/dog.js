/* O cachorrinho: humores, animações, corrida, colo, reação ao som e boca sincronizada com a voz. */
F.dog = (() => {
  const svg = document.getElementById('dog');
  const q = (id) => document.getElementById(id);
  const E = {
    all: q('dAll'), shadow: q('dShadow'), head: q('dHead'),
    earL: q('dEarL'), earR: q('dEarR'), tail: q('dTail'),
    legL: q('dLegL'), legR: q('dLegR'), padL: q('dPadL'), padR: q('dPadR'),
    eyeL: q('dEyeL'), eyeR: q('dEyeR'), browL: q('dBrowL'), browR: q('dBrowR'),
    mouthFill: q('dMouthFill'), mouthLine: q('dMouthLine'), mouthClip: q('dMouthClipPath'),
    tongue: q('dTongue'), hang: q('dTongueHang'), hangFill: q('dTongueFill'), hangLine: q('dTongueLine'), hangGroove: q('dTongueGroove'),
    cheekL: q('dCheekL'), cheekR: q('dCheekR'),
  };

  const KEYS = ['x', 'y', 'rot', 'sx', 'sy', 'headX', 'headY', 'tilt', 'earL', 'earR', 'legL', 'legR',
    'mouth', 'smile', 'brow', 'eyeS', 'blush', 'tailAmp', 'tailSpeed', 'tongue', 'frown'];
  const DEF = {
    x: 0, y: 0, rot: 0, sx: 1, sy: 1, headX: 0, headY: 0, tilt: 0, earL: 0, earR: 0, legL: 0, legR: 0,
    mouth: 0, smile: 1, brow: 0, eyeS: 1, blush: 0.5, tailAmp: 12, tailSpeed: 5, tongue: 0, frown: 0,
  };

  // Orelhas: earL positivo / earR negativo = orelhas para fora (animado).
  const MOODS = {
    idle: {},
    happy: { eye: 'happy', brow: 4, mouth: 0.3, tailAmp: 22, tailSpeed: 14, blush: 0.8 },
    excited: { eyeS: 1.14, brow: 8, mouth: 0.3, tailAmp: 26, tailSpeed: 16, earL: 16, earR: -16, tongue: 0.8, blush: 0.75 },
    listen: { eyeS: 1.14, brow: 11, tilt: 10, earL: 28, earR: 6, smile: 0.85, tailAmp: 14, tailSpeed: 8 },
    surprised: { eyeS: 1.3, brow: 15, mouth: 0.5, smile: 0.1, earL: 22, earR: -22, tailAmp: 5, tailSpeed: 3 },
    love: { eye: 'heart', brow: 4, mouth: 0.22, tailAmp: 24, tailSpeed: 14, blush: 1 },
    laugh: { eye: 'happy', mouth: 0.75, brow: 6, tailAmp: 26, tailSpeed: 18, blush: 1 },
    sleepy: { eye: 'closed', brow: -3, smile: 0.55, tailAmp: 2, tailSpeed: 1.5, tilt: -7, headY: 12, earL: -6, earR: 6, blush: 0.6 },
    hungry: { eyeS: 1.12, brow: 10, mouth: 0.25, tongue: 1, tailAmp: 18, tailSpeed: 12 },
    proud: { eye: 'star', brow: 8, mouth: 0.4, tailAmp: 26, tailSpeed: 16, blush: 0.9 },
    pant: { tongue: 1, mouth: 0.28, tailAmp: 16, tailSpeed: 10 },
    held: { eye: 'happy', mouth: 0.55, brow: 8, earL: 30, earR: -30, tailAmp: 28, tailSpeed: 20, blush: 1 },
    dizzy: { eye: 'dizzy', mouth: 0.35, smile: 0.6, tilt: 8 },
    monster: { eyeS: 1.22, brow: -6, mouth: 0.45, smile: 0.2, earL: 20, earR: -20 },
    angry: { frown: 1, brow: -3, eyeS: 0.95, smile: -0.5, mouth: 0.14, earL: -14, earR: 14, tailAmp: 3, tailSpeed: 3, blush: 1 },
  };

  const cur = Object.assign({}, DEF);
  const tgt = Object.assign({}, DEF);
  let moodName = 'idle', override = null, eyeMode = 'open', renderedEye = '';
  let sleeping = false, dancing = false;
  const anims = [];

  // olhar / piscar
  const gaze = { x: 0, y: 0 }, gazeT = { x: 0, y: 0 };
  let gazeUntil = 0, nextWander = 0, blinkT0 = -1, nextBlink = 1500;

  // movimento no palco (unidades do SVG). posY negativo = para cima.
  let posX = 0, posY = 0, lastPosX = 0, velX = 0;
  let run = null, runPhase = 0, runDir = 1, runAmt = 0;
  let held = null, falling = false, fallV = 0, slideV = 0;
  let hearing = 0, blown = 0, tongueGate = 1;
  let onLand = null;

  function applyTargets() {
    const m = MOODS[moodName] || MOODS.idle;
    const o = override || {};
    for (const k of KEYS) tgt[k] = o[k] != null ? o[k] : (m[k] != null ? m[k] : DEF[k]);
    eyeMode = o.eye || m.eye || 'open';
  }
  function mood(name) { moodName = MOODS[name] ? name : 'idle'; applyTargets(); }
  function pose(o) { override = o ? Object.assign({}, o) : null; applyTargets(); }

  /* ---------- animações pontuais ---------- */
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const bell = (p) => Math.sin(Math.PI * Math.max(0, Math.min(1, p)));
  const hold = (p, a, b) => (p < a ? ease(p / a) : p > b ? ease((1 - p) / (1 - b)) : 1);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const ANIMS = {
    jump: {
      dur: 720, fn(p, o) {
        if (p < 0.18) { const c = bell(p / 0.18); o.sy *= 1 - 0.14 * c; o.sx *= 1 + 0.08 * c; }
        else if (p < 0.82) {
          const h = bell((p - 0.18) / 0.64);
          o.y -= 125 * h; o.sy *= 1 + 0.06 * h; o.sx *= 1 - 0.03 * h;
          o.earL += 30 * h; o.earR -= 30 * h; o.legL += 22 * h; o.legR -= 22 * h; o.tail += 22 * h;
        } else { const c = bell((p - 0.82) / 0.18); o.sy *= 1 - 0.12 * c; o.sx *= 1 + 0.07 * c; }
      },
    },
    hop: { dur: 420, fn(p, o) { const h = bell(p); o.y -= 40 * h; o.sy *= 1 + 0.04 * h; o.earL += 16 * h; o.earR -= 16 * h; } },
    spin: { dur: 1150, fn(p, o) { o.sx *= Math.cos(p * Math.PI * 4); o.y -= 28 * Math.abs(Math.sin(p * Math.PI * 4)); o.tail += 30 * Math.sin(p * 40); o.eye = 'happy'; } },
    shake: {
      dur: 900, fn(p, o) {
        const d = 1 - p, s = Math.sin(p * Math.PI * 14);
        o.rot += 5 * s * d; o.headX += 10 * s * d; o.earL += 36 * s * d; o.earR += 36 * s * d; o.eye = 'happy';
      },
    },
    sneeze: {
      dur: 1050, fn(p, o) {
        if (p < 0.45) { const k = ease(p / 0.45); o.headY -= 12 * k; o.tilt -= 7 * k; o.brow += 10 * k; o.eyeS *= 1 + 0.12 * k; o.mouth = Math.max(o.mouth, 0.25 * k); }
        else { const j = bell(Math.min(1, ((p - 0.45) / 0.55) * 2.2)); o.headY += 18 * j; o.sy *= 1 - 0.08 * j; o.eye = 'closed'; o.mouth = Math.max(o.mouth, 0.65 * j); o.earL += 34 * j; o.earR -= 34 * j; }
      },
    },
    nod: { dur: 700, fn(p, o) { o.headY += 9 * Math.sin(p * Math.PI * 4) * (1 - p * 0.3); } },
    giggle: {
      dur: 1200, fn(p, o) {
        const d = 1 - p * 0.6;
        o.rot += 3.5 * Math.sin(p * 60) * d; o.y -= 6 * Math.abs(Math.sin(p * 30));
        o.eye = 'happy'; o.mouth = Math.max(o.mouth, 0.55 + 0.2 * Math.sin(p * 50));
        o.legL += 24 * bell(p); o.legR -= 24 * bell(p);
      },
    },
    highfive: { dur: 1500, fn(p, o) { const h = hold(p, 0.18, 0.75); o.legR -= 150 * h; o.tilt += 6 * h; if (h > 0.85) o.eye = 'happy'; } },
    wave: { dur: 1700, fn(p, o) { const h = hold(p, 0.15, 0.85); o.legL += h * (128 + 18 * Math.sin(p * Math.PI * 8)); o.tilt -= 5 * h; } },
    earFlap: {
      dur: 1300, fn(p, o) {
        const h = hold(p, 0.1, 0.9), s = Math.sin(p * Math.PI * 18);
        o.earL += h * (30 + 32 * s); o.earR -= h * (30 + 32 * s);
        o.y -= 22 * h + 6 * s * h; o.eye = 'happy'; o.mouth = Math.max(o.mouth, 0.4 * h);
      },
    },
    lick: { dur: 1000, fn(p, o) { const h = hold(p, 0.15, 0.8); o.lick = h; o.eye = 'happy'; o.headY -= 4 * h; } },
    wink: { dur: 750, fn(p, o) { o.winkR = hold(p, 0.2, 0.7); o.smile += 0.3; o.tilt += 7 * bell(p); } },
    chew: {
      dur: 1500, fn(p, o) {
        const c = Math.abs(Math.sin(p * Math.PI * 6));
        o.mouth = Math.max(o.mouth, 0.06 + 0.3 * c); o.cheek = 1 + 0.3 * (1 - c) * hold(p, 0.1, 0.9);
        o.eye = 'happy'; o.headY += 3 * c; o.tongue = 0;
      },
    },
    yawn: {
      dur: 2200, fn(p, o) {
        const h = hold(p, 0.35, 0.7);
        o.mouth = Math.max(o.mouth, 0.95 * h); o.eye = 'closed'; o.headY -= 8 * h; o.tilt -= 6 * h; o.sy *= 1 + 0.04 * h; o.brow -= 2 * h; o.tongue = 0;
      },
    },
    burp: { dur: 750, fn(p, o) { const j = bell(Math.min(1, p * 1.6)); o.cheek = 1 + 0.4 * j; o.mouth = Math.max(o.mouth, 0.35 * j); o.eyeS *= 1 + 0.15 * j; o.headY -= 5 * j; } },
    snap: { dur: 420, fn(p, o) { const h = bell(p); o.headY -= 14 * h; o.mouth = Math.max(o.mouth, 0.75 * h); o.eyeS *= 1 + 0.1 * h; o.tongue = 0; } },
    surprise: { dur: 650, fn(p, o) { const h = bell(p); o.y -= 32 * h; o.eyeS *= 1 + 0.25 * h; o.brow += 10 * h; o.earL += 40 * h; o.earR -= 40 * h; } },
    wiggle: { dur: 800, fn(p, o) { o.rot += 6 * Math.sin(p * Math.PI * 6) * (1 - p); } },
    tilt: { dur: 1400, fn(p, o) { const h = hold(p, 0.2, 0.75); o.tilt += 12 * h; o.brow += 6 * h; } },
    earTwitch: { dur: 380, fn(p, o) { o.earR -= 18 * bell(p) * Math.abs(Math.sin(p * Math.PI * 3)); } },
    earPerk: { dur: 500, fn(p, o) { const h = bell(p); o.earL += 18 * h; o.headY -= 4 * h; } },
    stretch: {
      dur: 1600, fn(p, o) {
        const h = hold(p, 0.3, 0.7);
        o.sy *= 1 + 0.08 * h; o.sx *= 1 - 0.03 * h; o.legL += 40 * h; o.legR -= 40 * h;
        o.eye = 'closed'; o.mouth = Math.max(o.mouth, 0.6 * h); o.earL += 20 * h; o.earR -= 20 * h; o.tongue = 0;
      },
    },
    kiss: { dur: 900, fn(p, o) { const h = hold(p, 0.2, 0.7); o.headY -= 10 * h; o.eye = 'closed'; o.smile -= 0.7 * h; o.pucker = h; o.blush = 1; o.tongue = 0; } },
    bark: {
      dur: 760, fn(p, o) {
        const h = Math.max(bell(p / 0.42), bell((p - 0.46) / 0.42));
        o.headY -= 14 * h; o.tilt -= 5 * h; o.earL += 26 * h; o.earR -= 26 * h; o.eyeS *= 1 + 0.08 * h;
        o.mouth = Math.max(o.mouth, 0.7 * h); o.sy *= 1 + 0.03 * h; o.tongue = 0;
      },
    },
    land: {
      dur: 460, fn(p, o) { const c = bell(p); o.sy *= 1 - 0.2 * c; o.sx *= 1 + 0.12 * c; o.earL += 34 * c; o.earR -= 34 * c; o.eye = 'happy'; },
    },
    sniff: {
      dur: 1100, fn(p, o) { const h = hold(p, 0.2, 0.8); o.headY += 12 * h; o.tilt += 4 * Math.sin(p * 45) * h; o.eyeS *= 1 - 0.1 * h; },
    },
    scratch: {
      dur: 1300, fn(p, o) { const h = hold(p, 0.15, 0.85); o.legR -= h * (118 + 14 * Math.sin(p * 70)); o.tilt += 12 * h; o.eye = 'happy'; o.tongue = 1; },
    },
    peek: {
      dur: 900, fn(p, o) { const h = hold(p, 0.25, 0.75); o.earL += 30 * h; o.earR -= 30 * h; o.eyeS *= 1 + 0.2 * h; },
    },
    // cambalhota: gira 360° em torno do centro do corpo
    roll: {
      dur: 1150, fn(p, o) {
        const th = ease(p) * Math.PI * 2;
        o.rot += (th * 180) / Math.PI;
        o.x -= 160 * Math.sin(th);
        o.y -= 160 * (1 - Math.cos(th)) + 50 * bell(p);
        o.eye = 'happy'; o.earL += 30 * bell(p); o.earR -= 30 * bell(p); o.tongue = 0;
      },
    },
    sit: {
      dur: 1300, fn(p, o) {
        const h = hold(p, 0.2, 0.8);
        o.sy *= 1 - 0.09 * h; o.sx *= 1 + 0.05 * h; o.headY -= 8 * h;
        o.legL -= 8 * h; o.legR += 8 * h; if (h > 0.5) o.eye = 'happy';
      },
    },
    hug: {
      dur: 1800, fn(p, o) {
        const h = hold(p, 0.2, 0.8);
        o.legL -= 48 * h; o.legR += 48 * h; o.rot += 3 * Math.sin(p * 18) * h;
        o.eye = 'closed'; o.blush = 1; o.smile = 1.2; o.headY += 6 * h; o.tilt += 6 * h;
      },
    },
    growl: {
      dur: 1500, fn(p, o) { const h = hold(p, 0.1, 0.85); o.headX += 4 * Math.sin(p * 70) * h; o.rot += 1.5 * Math.sin(p * 55) * h; o.y += 6 * h; },
    },
    come: {
      dur: 1700, fn(p, o) {
        const h = hold(p, 0.25, 0.8);
        o.sx *= 1 + 0.14 * h; o.sy *= 1 + 0.14 * h; o.y -= 20 * bell(Math.min(1, p * 3));
        o.eye = h > 0.5 ? 'heart' : o.eye; o.tail += 25 * Math.sin(p * 40);
      },
    },
  };

  function play(name, opts) {
    const def = ANIMS[name];
    if (!def) return Promise.resolve();
    return new Promise((res) => anims.push({ def, name, t0: performance.now(), dur: (opts && opts.dur) || def.dur, res }));
  }
  function playing(name) { return anims.some((a) => a.name === name); }
  function stopAnims() { anims.splice(0).forEach((a) => a.res()); }

  /* ---------- coordenadas ---------- */
  function svgCTM() { return svg.getScreenCTM(); }
  function pt(el, x, y) {
    const m = el.getScreenCTM();
    if (!m) return { x: innerWidth / 2, y: innerHeight / 2 };
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }
  function scale() { const m = svgCTM(); return m ? m.a : 1; }
  function toSvg(sx, sy) { const m = svgCTM(); if (!m) return { x: 0, y: 0 }; return { x: (sx - m.e) / m.a, y: (sy - m.f) / m.d }; }
  // Converte um X da tela na posição do cachorro (posX).
  function toPosX(sx) { const m = svgCTM(); return m ? (sx - (m.a * 200 + m.e)) / m.a : 0; }
  const screenX = () => pt(svg, 200 + posX, 0).x;
  const groundY = () => pt(svg, 0, 462).y;
  const mouthPoint = () => pt(E.head, 200, 238);
  const headPoint = () => pt(E.head, 200, 150);
  const headTop = () => pt(E.head, 200, 70);
  const nosePoint = () => pt(E.head, 200, 200);
  const earPoint = () => pt(E.head, 60, 150);
  const bellyPoint = () => pt(E.all, 200, 390);
  const pawPoint = () => pt(E.legR, 237, 440);
  const halfWidth = () => { const r = svg.getBoundingClientRect(); return r.width / 2 / scale(); };

  /* ---------- olhar ---------- */
  function lookAt(x, y, ms) {
    const c = pt(E.head, 200, 160);
    const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy) || 1;
    const m = Math.min(1, d / 140);
    gazeT.x = (dx / d) * m; gazeT.y = (dy / d) * m;
    gazeUntil = performance.now() + (ms || 2500);
  }
  function lookAtEl(el, ms) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    lookAt(r.left + r.width / 2, r.top + r.height / 2, ms || 4000);
  }
  function lookAtChild(ms) { gazeT.x = 0; gazeT.y = 0.35; gazeUntil = performance.now() + (ms || 2500); }

  /* ---------- movimento ---------- */
  function runTo(x, speed) {
    return new Promise((res) => {
      if (run && run.res) run.res();
      run = { target: x, speed: speed || 650, res };
    });
  }
  function steer(x, speed) {
    if (!run) run = { target: x, speed: speed || 650, res: null };
    else { run.target = x; if (speed) run.speed = speed; }
  }
  function stopRun() { if (run && run.res) run.res(); run = null; }

  function grab(sx, sy) {
    const u = toSvg(sx, sy);
    stopRun(); falling = false;
    held = { ox: u.x - posX, oy: u.y - posY, tx: posX, ty: posY - 24 };
  }
  function drag(sx, sy) {
    if (!held) return;
    const u = toSvg(sx, sy), lim = halfWidth() + 40;
    held.tx = clamp(u.x - held.ox, -lim, lim);
    held.ty = clamp(u.y - held.oy - 24, -900, 0);
  }
  function release() {
    if (!held) return;
    held = null;
    slideV = clamp(velX, -900, 900);
    if (posY < -3) { falling = true; fallV = 0; } else landed(0);
  }
  function landed(v) {
    const k = Math.min(1, v / 1400);
    play('land', { dur: 360 + 260 * k });
    if (onLand) onLand(k);
  }

  function moveUpdate(dt) {
    if (held) {
      const k = 1 - Math.exp(-dt * 18);
      posX += (held.tx - posX) * k; posY += (held.ty - posY) * k;
    } else if (falling) {
      fallV += 2800 * dt; posY += fallV * dt;
      posX += slideV * dt; slideV *= Math.pow(0.08, dt);
      if (posY >= 0) { posY = 0; falling = false; const v = fallV; fallV = 0; landed(v); }
    } else if (run) {
      const dx = run.target - posX;
      posX += Math.sign(dx) * Math.min(Math.abs(dx), run.speed * dt);
      if (Math.abs(dx) > 0.5) runDir = Math.sign(dx);
      if (Math.abs(run.target - posX) < 1) { const r = run; run = null; if (r.res) r.res(); }
    }
    velX = (posX - lastPosX) / Math.max(dt, 1e-3);
    lastPosX = posX;
  }

  /* ---------- reação ao som da criança (ao vivo) ---------- */
  function hear(active, loud) {
    if (active) hearing = Math.min(1, hearing + 0.3);
    if (loud) blown = Math.min(1, blown + 0.35);
  }

  function setSleep(v) { sleeping = v; }
  function setDance(v) { dancing = v; }

  /* ---------- boca ---------- */
  function mouthPaths(open, smile) {
    const cx = 200, cy = 228;
    const W = 24 + 9 * open - 4 * (1 - smile);
    const lift = 5 * smile, dip = 9 * smile + 2;
    const top = `M${cx - W},${cy - lift} Q${cx - W / 2},${cy + dip} ${cx},${cy} Q${cx + W / 2},${cy + dip} ${cx + W},${cy - lift}`;
    if (open < 0.04) return { line: top, fill: null, D: 0, W };
    const D = 6 + 56 * open;
    const fill = `${top} C${cx + W * 1.05},${cy + D} ${cx - W * 1.05},${cy + D} ${cx - W},${cy - lift} Z`;
    return { line: top, fill, D, W };
  }

  /* ---------- quadro a quadro ---------- */
  let lastMouth = '', lastHang = '';
  function update(dt, tms) {
    const t = tms / 1000;
    const k = 1 - Math.exp(-dt * 12), ky = 1 - Math.exp(-dt * 7);
    for (const key of KEYS) cur[key] += (tgt[key] - cur[key]) * (key === 'y' ? ky : k);
    moveUpdate(dt);

    const o = Object.assign({}, cur);
    o.eye = null; o.tail = 0; o.cheek = 1; o.lick = 0; o.winkR = 0; o.pucker = 0;

    // respirar e abanar o rabo
    const br = sleeping ? 0.9 : 2.3;
    o.sy *= 1 + 0.013 * Math.sin(t * br); o.sx *= 1 - 0.006 * Math.sin(t * br);
    o.headY += 1.6 * Math.sin(t * br - 0.6);
    o.tail = o.tailAmp * Math.sin(t * o.tailSpeed);

    // escutando a criança: orelha em pé, olhos grandes, inclina a cabeça
    hearing *= Math.exp(-dt * 2.2); blown *= Math.exp(-dt * 2.6);
    if (hearing > 0.01 && !sleeping) {
      o.earL += 26 * hearing; o.earR -= 6 * hearing; o.eyeS *= 1 + 0.12 * hearing; o.brow += 8 * hearing;
      o.tilt += 9 * hearing; o.headY -= 5 * hearing; o.tail *= 1 + hearing;
    }
    if (blown > 0.01) { // barulho alto: orelhas voando para trás
      const w = Math.sin(t * 38);
      o.rot -= 5 * blown; o.earL += (55 + 12 * w) * blown; o.earR -= (55 + 12 * w) * blown;
      o.headX += 3 * w * blown; o.brow += 10 * blown; o.mouth = Math.max(o.mouth, 0.35 * blown);
      if (blown > 0.45) o.eye = 'happy';
    }

    // correndo
    const moving = !held && !falling && Math.abs(velX) > 30;
    runAmt += ((moving ? 1 : 0) - runAmt) * (1 - Math.exp(-dt * 10));
    if (runAmt > 0.01) {
      runPhase += dt * 15;
      const s = Math.sin(runPhase), c = Math.abs(Math.sin(runPhase));
      o.y -= 26 * c * runAmt; o.rot += runDir * 7 * runAmt; o.tilt += runDir * 5 * runAmt;
      o.legL += 36 * s * runAmt; o.legR += 36 * s * runAmt;
      o.earL += (22 + 18 * s) * runAmt; o.earR -= (22 + 18 * s) * runAmt;
      o.tail += 25 * Math.sin(runPhase * 2) * runAmt;
      o.sy *= 1 + 0.05 * (c - 0.5) * runAmt;
      o.headX += runDir * 6 * runAmt;
      gazeT.x = runDir * 0.8 * runAmt + gazeT.x * (1 - runAmt);
    }

    // no colo: balança, perninhas soltas
    if (held) {
      const sw = clamp(-velX * 0.018, -24, 24);
      o.rot += sw; o.legL += 20 + 12 * Math.sin(t * 9); o.legR -= 20 + 12 * Math.sin(t * 9 + 1.3);
      o.sy *= 1.04; o.tail += 30 * Math.sin(t * 20);
    }

    // dança no ritmo da música
    if (dancing) {
      const b = F.sound.beat();
      if (b != null) {
        const bounce = Math.abs(Math.sin(Math.PI * b));
        const bar = Math.floor(b / 4) % 4, env = hold((b % 4) / 4, 0.08, 0.92);
        o.y -= 18 * bounce; o.sy *= 1 + 0.05 * (bounce - 0.5);
        o.tail += 20 * Math.sin(Math.PI * b * 2);
        if (bar === 0) { o.rot += 8 * Math.sin(Math.PI * b) * env; o.tilt -= 8 * Math.sin(Math.PI * b) * env; }
        else if (bar === 1) { o.legL += (110 + 25 * Math.sin(Math.PI * b * 2)) * env; o.legR -= (110 + 25 * Math.sin(Math.PI * b * 2 + Math.PI)) * env; o.earL += 30 * env; o.earR -= 30 * env; o.eye = 'happy'; }
        else if (bar === 2) { o.x += 24 * Math.sin(Math.PI * b / 2) * env; o.headX += 10 * Math.sin(Math.PI * b) * env; o.legL += 40 * bounce * env; }
        else { const s = Math.sin(Math.PI * b * 2); o.earL += (30 + 30 * s) * env; o.earR -= (30 + 30 * s) * env; o.eye = 'happy'; o.mouth = Math.max(o.mouth, 0.45 * env); o.rot += 4 * s * env; }
      }
    }

    // animações pontuais
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      const p = (tms - a.t0) / a.dur;
      if (p >= 1) { anims.splice(i, 1); a.res(); continue; }
      a.def.fn(Math.max(0, p), o);
    }

    // boca falando (acompanha o volume real da voz)
    let talk = 0;
    const talkingNow = F.sound.isTalking() || F.voice.speaking;
    if (F.sound.isTalking()) talk = Math.min(1, F.sound.voiceLevel() * 7);
    else if (F.voice.speaking) talk = 0.2 + 0.4 * Math.abs(Math.sin(t * 13.5));
    tongueGate += ((talkingNow ? 0 : 1) - tongueGate) * (1 - Math.exp(-dt * 14));
    o.tongue *= tongueGate;
    if (talk > 0.02) {
      o.mouth = Math.max(o.mouth, talk);
      o.headY -= talk * 5; o.sy *= 1 + talk * 0.035;
      o.earL += talk * 8; o.earR -= talk * 8;
      if (o.eye === 'closed' && !sleeping) o.eye = null;
    }

    // piscar
    let blink = 1;
    if (tms > nextBlink && blinkT0 < 0) blinkT0 = tms;
    if (blinkT0 >= 0) {
      const p = (tms - blinkT0) / 150;
      if (p >= 1) { blinkT0 = -1; nextBlink = tms + (Math.random() < 0.15 ? 220 : 1800 + Math.random() * 3500); }
      else blink = 1 - bell(p) * 0.92;
    }

    // olhar
    if (tms > gazeUntil && tms > nextWander && runAmt < 0.1) {
      if (Math.random() < 0.5) { gazeT.x = 0; gazeT.y = 0.25; }
      else { gazeT.x = (Math.random() - 0.5) * 0.9; gazeT.y = (Math.random() - 0.5) * 0.6; }
      nextWander = tms + 1400 + Math.random() * 2600;
    }
    const kg = 1 - Math.exp(-dt * 14);
    gaze.x += (gazeT.x - gaze.x) * kg; gaze.y += (gazeT.y - gaze.y) * kg;
    o.headX += gaze.x * 6; o.tilt += gaze.x * 3;

    o.x += posX; o.y += posY;
    render(o, blink);
  }

  function render(o, blink) {
    E.all.setAttribute('transform', `translate(${200 + o.x} ${460 + o.y}) rotate(${o.rot}) scale(${o.sx} ${o.sy}) translate(-200 -460)`);
    const lift = Math.max(0, -o.y);
    const ss = Math.max(0.35, 1 - lift / 300);
    E.shadow.setAttribute('transform', `translate(${200 + o.x} 463) scale(${ss * Math.max(0.3, Math.abs(o.sx))} ${ss}) translate(-200 -463)`);
    E.shadow.setAttribute('opacity', (0.2 * ss).toFixed(3));

    E.head.setAttribute('transform', `translate(${o.headX} ${o.headY}) rotate(${o.tilt} 200 280)`);
    E.earL.setAttribute('transform', `rotate(${o.earL} 110 92)`);
    E.earR.setAttribute('transform', `rotate(${o.earR} 290 92)`);
    E.tail.setAttribute('transform', `rotate(${o.tail} 266 424)`);
    E.legL.setAttribute('transform', `rotate(${o.legL} 165 376)`);
    E.legR.setAttribute('transform', `rotate(${o.legR} 235 376)`);
    E.padL.setAttribute('opacity', clamp((Math.abs(o.legL) - 70) / 40, 0, 1).toFixed(2));
    E.padR.setAttribute('opacity', clamp((Math.abs(o.legR) - 70) / 40, 0, 1).toFixed(2));

    const eye = o.eye || eyeMode;
    if (eye !== renderedEye) { svg.setAttribute('data-eye', eye); renderedEye = eye; }
    const gx = gaze.x * 7, gy = gaze.y * 6;
    const fr = clamp(o.frown, 0, 1);
    const bl = (eye === 'open' ? blink : 1) * (1 - 0.22 * fr), es = o.eyeS;
    E.eyeL.setAttribute('transform', `translate(${148 + gx} ${160 + gy}) scale(${es} ${es * bl})`);
    E.eyeR.setAttribute('transform', `translate(${252 + gx} ${160 + gy}) scale(${es} ${es * bl * (1 - o.winkR * 0.92)})`);

    // sobrancelhas (com "bravo": pontas de dentro para baixo)
    E.browL.setAttribute('transform', `translate(0 ${-o.brow + 8 * fr}) rotate(${-o.brow * 0.4 + 24 * fr} 145 118)`);
    E.browR.setAttribute('transform', `translate(0 ${-o.brow + 8 * fr}) rotate(${o.brow * 0.4 - 24 * fr} 255 118)`);

    const ck = o.cheek;
    E.cheekL.setAttribute('transform', `translate(120 214) scale(${ck}) translate(-120 -214)`);
    E.cheekR.setAttribute('transform', `translate(280 214) scale(${ck}) translate(-280 -214)`);
    const blush = clamp(o.blush, 0.15, 1);
    E.cheekL.setAttribute('opacity', (blush * 0.75).toFixed(2));
    E.cheekR.setAttribute('opacity', (blush * 0.75).toFixed(2));

    // boca + língua (a língua sai de dentro da boca, sem sobrepor nem piscar)
    const tAmt = clamp(Math.max(o.tongue, o.lick), 0, 1);
    let open = clamp(o.mouth, 0, 1);
    if (tAmt > 0.04) open = Math.max(open, 0.2 + 0.1 * tAmt);
    const smile = clamp(o.smile, -0.5, 1.3);
    const key = open.toFixed(3) + '|' + smile.toFixed(2) + '|' + o.pucker.toFixed(2);
    let m = null;
    if (key !== lastMouth) {
      lastMouth = key;
      if (o.pucker > 0.05) {
        const r = 7 + 3 * o.pucker;
        E.mouthLine.setAttribute('d', `M${200 - r},232 a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`);
        E.mouthFill.style.display = 'none';
        E.tongue.style.display = 'none';
      } else {
        m = mouthPaths(open, smile);
        E.mouthLine.setAttribute('d', m.line);
        if (m.fill) {
          E.mouthFill.style.display = '';
          E.mouthFill.setAttribute('d', m.fill);
          E.mouthClip.setAttribute('d', m.fill);
          E.tongue.style.display = '';
          E.tongue.setAttribute('cy', (228 + m.D * 0.72).toFixed(1));
          E.tongue.setAttribute('rx', (m.W * 0.72).toFixed(1));
          E.tongue.setAttribute('ry', (m.D * 0.4 + 2).toFixed(1));
        } else {
          E.mouthFill.style.display = 'none';
          E.tongue.style.display = 'none';
        }
      }
    }
    const showHang = tAmt > 0.04 && o.pucker <= 0.05;
    const hk = showHang ? open.toFixed(3) + '|' + tAmt.toFixed(2) + '|' + o.lick.toFixed(2) : 'off';
    if (hk !== lastHang) {
      lastHang = hk;
      if (!showHang) E.hang.style.display = 'none';
      else {
        const D = 6 + 56 * open;
        const w = 11 + 3 * tAmt;
        const yTop = 228 + D * 0.4;
        const yBot = 228 + D + 3 + 22 * tAmt + 16 * o.lick;
        const r = Math.min(w, (yBot - yTop) / 2);
        const body = `M${200 - w},${yTop} L${200 - w},${yBot - r} Q${200 - w},${yBot} 200,${yBot} Q${200 + w},${yBot} ${200 + w},${yBot - r} L${200 + w},${yTop}`;
        E.hangFill.setAttribute('d', body + ' Z');
        E.hangLine.setAttribute('d', body);
        E.hangGroove.setAttribute('d', yBot - yTop > 22 ? `M200,${yTop + 8} L200,${yBot - 9}` : 'M0,0');
        E.hang.style.display = '';
      }
    }
  }

  applyTargets();

  return {
    update, mood, pose, play, playing, stopAnims, lookAt, lookAtEl, lookAtChild, setSleep, setDance, hear,
    runTo, steer, stopRun, grab, drag, release, toPosX,
    mouthPoint, headPoint, headTop, nosePoint, earPoint, bellyPoint, pawPoint, scale, screenX, groundY, halfWidth, svg,
    set onLand(f) { onLand = f; },
    get moodName() { return moodName; },
    get posX() { return posX; },
    get isHeld() { return !!held; },
    get isFalling() { return falling; },
    get isRunning() { return !!run; },
  };
})();
