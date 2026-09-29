/* Bola com física: a criança arrasta e joga (ou só toca para chutar). */
F.ball = (() => {
  const props = document.getElementById('props');
  const B = { state: 'none', x: 0, y: 0, vx: 0, vy: 0, r: 32, rot: 0, rest: false, side: 1 };
  const G = 2300;
  let el = null, drag = null, samples = [];
  let onEvent = () => {};

  function floorY() { return F.dog.groundY() - B.r * 0.85; }

  function ensure() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'prop ball';
    el.innerHTML = '<span class="in">⚽</span>';
    props.appendChild(el);
    resize();
  }
  function resize() {
    if (!el) return;
    const S = F.ui.stageRect();
    B.r = Math.max(26, Math.min(44, S.width * 0.088));
    el.style.width = el.style.height = 2 * B.r + 'px';
    el.querySelector('.in').style.fontSize = (B.r * 1.95).toFixed(0) + 'px';
  }

  function spawn(x, y, vx, vy) {
    ensure();
    Object.assign(B, { state: 'free', x, y, vx: vx || 0, vy: vy || 0, rest: false });
    render();
  }
  function remove() { if (el) el.remove(); el = null; B.state = 'none'; drag = null; }

  function update(dt) {
    if (!el) return;
    if (B.state === 'free') {
      const fl = floorY();
      B.vy += G * dt; B.x += B.vx * dt; B.y += B.vy * dt;
      if (B.y >= fl) {
        B.y = fl;
        if (B.vy > 240) { const v = B.vy; B.vy = -B.vy * 0.55; B.vx *= 0.86; onEvent('bounce', Math.min(1, v / 1500)); }
        else { B.vy = 0; B.vx *= Math.pow(0.3, dt); }
      }
      B.rest = B.y >= fl - 0.5 && Math.abs(B.vy) < 1 && Math.abs(B.vx) < 14;
      B.rot += ((B.vx * dt) / B.r) * 57.3;
      if (B.x < -B.r * 2.5 || B.x > innerWidth + B.r * 2.5) {
        B.side = B.x < 0 ? -1 : 1; B.state = 'gone'; onEvent('gone', B.side);
      }
    } else if (B.state === 'mouth') {
      const m = F.dog.mouthPoint(), s = F.dog.scale();
      B.x = m.x; B.y = m.y + 16 * s;
    }
    render();
  }

  function render() {
    if (!el) return;
    el.style.transform = `translate(${(B.x - B.r).toFixed(1)}px,${(B.y - B.r).toFixed(1)}px) rotate(${B.rot.toFixed(1)}deg)`;
    el.style.visibility = B.state === 'gone' ? 'hidden' : '';
  }

  function hit(x, y) {
    return !!el && (B.state === 'free' || B.state === 'mouth') && Math.hypot(x - B.x, y - B.y) < B.r + 28;
  }

  function grab(id, x, y) {
    const from = B.state;
    B.state = 'held';
    drag = { id, ox: B.x - x, oy: B.y - y, t0: performance.now(), moved: 0, lx: x, ly: y };
    samples = [{ t: performance.now(), x, y }];
    el.classList.add('grabbed');
    onEvent('grab', from);
  }
  function move(x, y) {
    if (!drag) return;
    drag.moved += Math.hypot(x - drag.lx, y - drag.ly);
    drag.lx = x; drag.ly = y;
    B.x = x + drag.ox; B.y = Math.min(floorY(), y + drag.oy);
    const t = performance.now();
    samples.push({ t, x, y });
    while (samples.length > 2 && t - samples[0].t > 90) samples.shift();
  }
  function release() {
    if (!drag) return;
    const d = drag; drag = null;
    el.classList.remove('grabbed');
    const t = performance.now();
    B.state = 'free';
    if (d.moved < 14 && t - d.t0 < 400) { // só um toque: chuta para cima
      B.vx = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 300);
      B.vy = -950 - Math.random() * 300;
      onEvent('throw', 'tap');
      return;
    }
    const a = samples[0], b = samples[samples.length - 1];
    const dt = Math.max(16, b.t - a.t) / 1000;
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const sp = Math.hypot(vx, vy), max = 2600;
    if (sp > max) { vx *= max / sp; vy *= max / sp; }
    B.vx = vx; B.vy = vy;
    onEvent(sp > 240 ? 'throw' : 'drop', 'drag');
  }

  function attachMouth() { ensure(); B.state = 'mouth'; B.vx = B.vy = 0; }
  function launch(vx, vy) { if (!el) return; B.state = 'free'; B.vx = vx; B.vy = vy; }

  return {
    B, spawn, remove, update, hit, grab, move, release, attachMouth, launch, floorY, resize,
    set onEvent(f) { onEvent = f || (() => {}); },
    get active() { return !!el; },
    get dragging() { return !!drag; },
  };
})();
