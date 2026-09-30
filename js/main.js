/* Início, toques (vários dedos), laço de animação e ciclo de vida do app. */
(() => {
  const app = document.getElementById('app');
  const startEl = document.getElementById('start');
  const stageEl = document.getElementById('stage');
  let started = false;

  /* ---------- layout: cerca e gramado posicionados pelo corpo do cachorro (igual em qualquer tela) ---------- */
  const dogWrap = document.getElementById('dogWrap');
  function layout() {
    const st = stageEl.getBoundingClientRect();
    const W = dogWrap.offsetWidth, H = dogWrap.offsetHeight;   // tamanho sem as transformações do modo Figuras
    const s = Math.min(W / 452, H / 484);                       // escala do SVG (viewBox 452 x 484, alinhado embaixo)
    const top0 = st.top + dogWrap.offsetTop + H - 484 * s;
    const yAt = (y) => top0 + (y + 4) * s;                      // Y na tela de um ponto do desenho do cachorro
    const root = document.documentElement.style;
    // cerca pisa no chão atrás da cabeça; gramado da frente começa na altura das patas de trás
    const horizon = Math.max(st.top + 150, yAt(95));
    root.setProperty('--horizon', horizon.toFixed(0) + 'px');
    root.setProperty('--ground', Math.max(120, window.innerHeight - yAt(335)).toFixed(0) + 'px');
    F.fx.resize();
    F.ball.resize();
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 300));
  layout();

  // Já baixa as falas enquanto a tela inicial aparece (sem abrir o áudio: no iPhone ele só pode nascer depois do microfone).
  F.voice.init().then(() => F.voice.prefetch(['oi_henrique', 'oi_brincar', 'r_denovo', 'r_uau', 'r_eba', 'r_mais', 'r_risada', 'p_falacomigo', 'b_bola', 't_cocegas']));

  /* ---------- começar (um toque libera som e microfone) ---------- */
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator && !document.hidden) await navigator.wakeLock.request('screen'); } catch (e) { /* ok */ }
  }

  async function begin() {
    if (started) return;
    started = true;
    startEl.classList.add('loading');
    // 1º pede o microfone (ainda dentro do toque); 2º libera o som. No iPhone essa ordem importa.
    const micReq = F.mic.request();
    micReq.catch(() => {});
    if (!F.mic.isApple) F.sound.init();
    if (window.matchMedia('(pointer: coarse)').matches) F.ui.goFullscreen();
    const ok = await F.mic.start(micReq);
    F.ui.micState();
    if (!ok) {
      const iphone = F.mic.isApple
        ? ' No iPhone: toque em "aA" na barra de endereço → Ajustes do Site → Microfone → Permitir, e recarregue.'
        : ' Libere no cadeado ao lado do endereço do site.';
      F.ui.toast('Sem microfone: dá para brincar com toques.' + iphone, 9000);
    }
    requestWakeLock();
    startEl.classList.add('hide');
    setTimeout(() => startEl.remove(), 600);
    layout();
    F.brain.start();
    // Comandos de voz: carrega em segundo plano (uma vez; depois fica guardado no aparelho).
    if (ok) setTimeout(() => F.cmd.init(), 2500);
  }
  startEl.addEventListener('click', begin);

  /* ---------- toques ---------- */
  const drags = new Map();
  const PET_PARTS = /head|ear|mouth|nose|eye/;

  app.addEventListener('pointerdown', (e) => {
    if (!started) return;
    if (e.target.closest('#parent, #start, #gear, #micWarn')) return;
    const x = e.clientX, y = e.clientY;

    const toy = e.target.closest('.toy');
    if (toy) { e.preventDefault(); F.ui.pressFx(toy); F.sound.sfx.pop(); F.brain.pressToy(toy.dataset.toy); return; }

    if (F.fx.popAt(x, y)) { F.brain.bubblePopped(); return; }
    if (!F.ball.dragging && F.ball.hit(x, y)) { F.ball.grab(e.pointerId, x, y); drags.set(e.pointerId, { kind: 'ball' }); return; }

    const food = e.target.closest('.prop.food');
    if (food) {
      const f = F.brain.grabFood(food);
      if (f) drags.set(e.pointerId, { kind: 'food', f, x, y, moved: 0 });
      return;
    }
    if (e.target.closest('.butterfly')) { F.brain.tapButterfly(); return; }
    if (e.target.closest('#card')) { F.brain.tapCard(); return; }

    const part = e.target.closest('[data-part]');
    if (part) {
      drags.set(e.pointerId, { kind: 'dog?', part: part.dataset.part, x0: x, y0: y, x, y, moved: 0 });
      F.fx.burst(x, y, { type: 'spark', n: 6, speed: 120, g: 0, up: 0, life: 0.4, size: 5, colors: ['#fff', '#FFE27A'] });
      if (!F.brain.sleeping) F.dog.lookAt(x, y, 1500);
      return;
    }
    F.brain.tapBackground(x, y);
  });

  app.addEventListener('pointermove', (e) => {
    if (!started) return;
    const d = drags.get(e.pointerId);
    const x = e.clientX, y = e.clientY;
    if (!d) {
      if (e.pointerType === 'mouse' && !F.ui.parentIsOpen && !F.brain.sleeping) F.dog.lookAt(x, y, 1200);
      return;
    }
    if (d.kind === 'ball') F.ball.move(x, y);
    else if (d.kind === 'food') { d.moved += Math.hypot(x - d.x, y - d.y); d.x = x; d.y = y; F.brain.moveFood(d.f, x, y); }
    else if (d.kind === 'dog?') {
      d.moved += Math.hypot(x - d.x, y - d.y); d.x = x; d.y = y;
      if (d.moved > 14) {
        if (PET_PARTS.test(d.part)) { d.kind = 'pet'; F.brain.petStart(); }
        else { d.kind = 'dog'; F.brain.grabDog(d.x0, d.y0); F.brain.dragDog(x, y); }
      }
    } else if (d.kind === 'pet') F.brain.petMove(x, y);
    else if (d.kind === 'dog') F.brain.dragDog(x, y);
  });

  const up = (e) => {
    const d = drags.get(e.pointerId);
    if (!d) return;
    drags.delete(e.pointerId);
    if (d.kind === 'ball') F.ball.release();
    else if (d.kind === 'food') F.brain.releaseFood(d.f, d.moved < 12 && e.type === 'pointerup');
    else if (d.kind === 'dog?') { if (e.type === 'pointerup') F.brain.tapPart(d.part); }
    else if (d.kind === 'pet') F.brain.petEnd();
    else if (d.kind === 'dog') F.brain.releaseDog();
  };
  app.addEventListener('pointerup', up);
  app.addEventListener('pointercancel', up);

  document.getElementById('micWarn').addEventListener('click', async () => {
    const ok = F.mic.enabled ? await F.mic.revive() : await F.mic.start();
    F.ui.micState();
    F.ui.toast(ok ? 'Microfone ligado! 🎤 Fale com o Faladeiro.' : (F.mic.isApple
      ? 'Microfone bloqueado. Toque em "aA" na barra de endereço → Ajustes do Site → Microfone → Permitir.'
      : 'Microfone bloqueado. Libere no cadeado ao lado do endereço do site.'), 6000);
  });

  // iPhone: o sistema pode pausar o áudio (ligação, Siri, tela bloqueada). Qualquer toque retoma;
  // e se o som do microfone parou de chegar, religa.
  let reviving = false;
  const wakeAudio = () => {
    if (!started) return;
    F.sound.ensureRunning();
    if (F.mic.enabled && F.mic.stalled && !reviving) {
      reviving = true;
      F.mic.revive().finally(() => { reviving = false; F.ui.micState(); });
    }
  };
  document.addEventListener('touchend', wakeAudio, true);
  document.addEventListener('click', wakeAudio, true);
  document.addEventListener('pointerdown', wakeAudio, true);
  setInterval(() => { if (started) F.ui.micState(); }, 2000);

  // Sem zoom, menu de toque longo ou gestos do navegador.
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('#parent')) e.preventDefault(); });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  /* ---------- microfone sempre ligado → cérebro ---------- */
  F.mic.on('start', () => F.brain.voiceStart());
  F.mic.on('end', (buf, info) => F.brain.onUtterance(buf, info));
  F.mic.on('cancel', () => F.brain.voiceCancel());
  F.mic.on('level', (v, active, loud) => F.brain.onLevel(v, active, loud));

  /* ---------- laço de animação ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    F.dog.update(dt, now);
    F.ball.update(dt);
    F.fx.update(dt);
    F.fx.draw();
    F.brain.tick(now, dt);
    F.sound.duck(F.voice.speaking);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- sair e voltar para o app ---------- */
  document.addEventListener('visibilitychange', () => {
    if (!started) return;
    if (document.hidden) {
      F.brain.pause();
      F.mic.paused = true;
      F.voice.stop();
      F.sound.stopMusic();
      F.sound.suspend();
    } else {
      F.sound.resume();
      F.mic.paused = false;
      requestWakeLock();
      F.brain.resume();
      setTimeout(() => F.ui.micState(), 3000);
    }
  });

  /* ---------- funcionar offline / instalar na tela inicial ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
