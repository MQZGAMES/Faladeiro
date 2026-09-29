/* Efeitos visuais: estrelas, corações, confete, notas, bolhas de sabão. */
F.fx = (() => {
  const cv = document.getElementById('fx');
  const c = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const parts = [], bubbles = [], flights = [];
  let wasDrawing = false;

  const COLORS = ['#FF5A6E', '#FFC23D', '#3DB2FF', '#22C58B', '#9B7BFF', '#FF8A3D', '#FF5DA2'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function add(p) {
    parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 14, rot: 0, vr: 0, drag: 0.98, color: pick(COLORS), alpha: 1 }, p));
  }

  function burst(x, y, o) {
    o = o || {};
    const n = o.n || 14;
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + rnd(-o.spread || -0.6, o.spread || 0.6) : Math.random() * Math.PI * 2;
      const sp = (o.speed || 260) * rnd(0.4, 1.2);
      add({
        type: o.type || 'star', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up != null ? o.up : 120),
        g: o.g != null ? o.g : 500, max: (o.life || 1) * rnd(0.7, 1.3),
        size: (o.size || 14) * rnd(0.6, 1.4), rot: rnd(0, 6), vr: rnd(-6, 6),
        color: o.color || pick(o.colors || COLORS), drag: o.drag != null ? o.drag : 0.98,
      });
    }
  }

  function confetti(n) {
    n = n || 80;
    for (let i = 0; i < n; i++) {
      add({ type: 'confetti', x: rnd(0, W), y: rnd(-H * 0.35, -10), vx: rnd(-40, 40), vy: rnd(90, 200), g: 40,
        max: rnd(3, 4.5), size: rnd(8, 15), rot: rnd(0, 6), vr: rnd(-8, 8), drag: 1, wob: rnd(0, 6) });
    }
  }

  function text(x, y, str, color, size) {
    add({ type: 'text', str, x, y, vy: -45, max: 1.7, size: size || 46, color: color || '#FF4F6A', drag: 1 });
  }

  function floatUp(x, y, type, o) {
    o = o || {};
    add(Object.assign({ type, x, y, vx: rnd(-20, 20), vy: -rnd(50, 90), max: 2.2, size: 24, drag: 1, sway: rnd(0, 6) }, o));
  }

  function flyStar(from, to, dur) {
    return new Promise((res) => {
      flights.push({
        from, to, t: 0, dur: (dur || 800) / 1000, res,
        cx: (from.x + to.x) / 2 + rnd(-90, 90), cy: Math.min(from.y, to.y) - rnd(60, 140),
      });
    });
  }

  /* ---------- bolhas de sabão ---------- */
  function addBubble(x, y, o) {
    o = o || {};
    bubbles.push({
      x, y, r: o.r || rnd(24, 48), vy: o.vy || -rnd(45, 95), vx: o.vx != null ? o.vx : rnd(-25, 25),
      ph: rnd(0, 6), hue: rnd(0, 360), age: 0, grow: o.grow ? 0 : 1,
    });
  }
  function popBubble(i, silent) {
    const b = bubbles[i];
    bubbles.splice(i, 1);
    add({ type: 'ring', x: b.x, y: b.y, size: b.r, max: 0.35, color: `hsl(${b.hue},90%,70%)` });
    burst(b.x, b.y, { type: 'spark', n: 8, speed: 180, g: 0, up: 0, life: 0.45, size: 5, colors: ['#fff', '#BFF0FF', '#FFE3F3'] });
    if (!silent) F.sound.sfx.pop();
    return b;
  }
  function popAt(x, y) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (Math.hypot(b.x - x, b.y - y) < b.r + 22) return popBubble(i);
    }
    return null;
  }
  function bubbleNear(x, y, r) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (Math.hypot(b.x - x, b.y - y) < r + b.r) return i;
    }
    return -1;
  }
  function clearBubbles(popAll) {
    if (popAll) { for (let i = bubbles.length - 1; i >= 0; i--) setTimeout(() => { if (bubbles.length) popBubble(bubbles.length - 1); }, i * 90); }
    else bubbles.length = 0;
  }

  /* ---------- desenho ---------- */
  function starPath(r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }
  function heartPath(s) {
    c.beginPath();
    c.moveTo(0, s * 0.35);
    c.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.5, -s * 1.1, 0, -s * 0.45);
    c.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.1, -s * 0.35, 0, s * 0.35);
    c.closePath();
  }

  function drawPart(p) {
    const k = p.life / p.max;
    c.save();
    c.translate(p.x, p.y);
    switch (p.type) {
      case 'star': {
        c.rotate(p.rot); c.globalAlpha = 1 - k * k;
        starPath(p.size); c.fillStyle = p.color; c.fill();
        c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
        break;
      }
      case 'heart': {
        c.rotate(Math.sin(p.rot) * 0.3); c.globalAlpha = 1 - k * k;
        const s = p.size * (k < 0.15 ? k / 0.15 : 1);
        heartPath(s); c.fillStyle = p.color || '#FF4D6D'; c.fill();
        break;
      }
      case 'confetti': {
        c.rotate(p.rot); c.scale(Math.cos(p.wob + p.life * 8), 1); c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        c.fillStyle = p.color; c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        break;
      }
      case 'spark': {
        c.globalAlpha = 1 - k; c.fillStyle = p.color;
        c.beginPath(); c.arc(0, 0, p.size * (1 - k * 0.5), 0, Math.PI * 2); c.fill();
        break;
      }
      case 'note': case 'zzz': case 'emoji': {
        c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : Math.min(1, k * 6);
        c.rotate(Math.sin(p.life * 3 + (p.sway || 0)) * 0.25);
        c.font = `800 ${p.size * (p.type === 'zzz' ? 0.8 + k : 1)}px 'Baloo 2', system-ui, sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        const str = p.str || (p.type === 'zzz' ? 'z' : pick(['♪', '♫']));
        if (!p.str) p.str = str;
        if (p.type !== 'emoji') { c.lineWidth = 5; c.strokeStyle = '#fff'; c.strokeText(str, 0, 0); c.fillStyle = p.color; }
        c.fillText(str, 0, 0);
        break;
      }
      case 'text': {
        const s = k < 0.18 ? 0.4 + (k / 0.18) * 0.75 : k < 0.3 ? 1.15 - ((k - 0.18) / 0.12) * 0.15 : 1;
        c.scale(s, s); c.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
        c.font = `800 ${p.size}px 'Baloo 2', system-ui, sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineJoin = 'round'; c.lineWidth = 10; c.strokeStyle = '#fff'; c.strokeText(p.str, 0, 0);
        c.fillStyle = p.color; c.fillText(p.str, 0, 0);
        break;
      }
      case 'ring': {
        c.globalAlpha = 1 - k; c.lineWidth = 4 * (1 - k) + 1; c.strokeStyle = p.color;
        c.beginPath(); c.arc(0, 0, p.size * (1 + k * 0.8), 0, Math.PI * 2); c.stroke();
        break;
      }
      case 'drop': {
        c.globalAlpha = 1 - k; c.fillStyle = '#BFE9FF';
        c.beginPath(); c.arc(0, 0, p.size, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'crumb': {
        c.rotate(p.rot); c.globalAlpha = 1 - k * k; c.fillStyle = p.color;
        c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        break;
      }
      case 'wave': {
        c.globalAlpha = 1 - k; c.lineWidth = 4; c.strokeStyle = p.color || '#fff'; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, p.size + k * 26, p.a0 - 0.6, p.a0 + 0.6); c.stroke();
        break;
      }
    }
    c.restore();
  }

  function drawBubble(b) {
    const r = b.r * (b.grow < 1 ? b.grow : 1);
    const wob = 1 + Math.sin(b.ph) * 0.04;
    c.save();
    c.translate(b.x, b.y); c.scale(wob, 2 - wob);
    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.75, `hsla(${b.hue},95%,82%,0.18)`);
    g.addColorStop(0.93, `hsla(${(b.hue + 60) % 360},95%,72%,0.55)`);
    g.addColorStop(1, 'rgba(255,255,255,0.85)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r * 0.7, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.beginPath(); c.arc(r * 0.35, r * 0.4, r * 0.08, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag;
      if (p.type === 'confetti') p.vx += Math.sin(p.life * 3 + p.wob) * 30 * dt;
      if (p.type === 'note' || p.type === 'zzz' || p.type === 'emoji') p.x += Math.sin(p.life * 2.4 + (p.sway || 0)) * 28 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt; b.ph += dt * 3; b.hue = (b.hue + dt * 40) % 360;
      if (b.grow < 1) b.grow = Math.min(1, b.grow + dt * 3);
      b.x += (b.vx + Math.sin(b.ph * 0.7) * 18) * dt; b.y += b.vy * dt;
      if (b.y < -b.r * 2 || b.age > 14) bubbles.splice(i, 1);
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt / f.dur;
      if (f.t >= 1) { flights.splice(i, 1); f.res(); }
    }
  }

  function draw() {
    const any = parts.length || bubbles.length || flights.length;
    if (!any && !wasDrawing) return;
    c.clearRect(0, 0, W, H);
    wasDrawing = !!any;
    for (const b of bubbles) drawBubble(b);
    for (const p of parts) drawPart(p);
    for (const f of flights) {
      const t = f.t < 0 ? 0 : f.t, u = 1 - t;
      const e = t * t * (3 - 2 * t);
      const x = u * u * f.from.x + 2 * u * t * f.cx + t * t * f.to.x;
      const y = u * u * f.from.y + 2 * u * t * f.cy + t * t * f.to.y;
      c.save(); c.translate(x, y); c.rotate(e * 6);
      const s = 18 + 10 * Math.sin(Math.PI * t);
      starPath(s); c.fillStyle = '#FFD23F'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke();
      c.restore();
      if (Math.random() < 0.5) add({ type: 'spark', x, y, max: 0.4, size: 4, color: pick(['#FFE27A', '#fff', '#FFC23D']) });
    }
  }

  return {
    resize, burst, confetti, text, floatUp, flyStar, update, draw,
    addBubble, popAt, bubbleNear, popBubble, clearBubbles,
    get bubbleCount() { return bubbles.length; },
    get count() { return parts.length; },
    get bubbles() { return bubbles; },
    add,
  };
})();
