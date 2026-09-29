/* Interface: cartão de figuras, bandeja de brinquedos, objetos soltos, avisos e área dos pais. */
F.ui = (() => {
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), stage = $('#stage');
  const card = $('#card');
  const props = $('#props');
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- figura ---------- */
  const PALETTE = [['#FFC94D', '#D69A12'], ['#4DBBFF', '#1E86C9'], ['#FF6BB0', '#D13A80'], ['#2ED39A', '#139E6E'], ['#A58BFF', '#6F4FE0'], ['#FF9A4D', '#D96A1C']];
  let palIdx = 0, sylTimer = null;
  function showCard(o) {
    const pal = PALETTE[palIdx++ % PALETTE.length];
    card.style.setProperty('--cc', pal[0]); card.style.setProperty('--cd', pal[1]);
    card.querySelector('.emoji').textContent = o.emoji;
    const syl = o.syl || [o.word];
    card.querySelector('.word').innerHTML = syl.map((s, i) => `<span class="syl" data-i="${i}">${esc(s)}</span>`).join('<span class="dash">-</span>');
    card.classList.remove('good', 'wiggle', 'out', 'listen');
    stage.classList.add('cardmode');
    card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  }
  async function cardOut() {
    clearInterval(sylTimer);
    card.classList.add('out');
    await wait(300);
    card.classList.remove('show', 'good', 'wiggle', 'out', 'listen');
  }
  function cardMode(on) {
    stage.classList.toggle('cardmode', on);
    if (!on) { clearInterval(sylTimer); card.classList.remove('show', 'good', 'wiggle', 'out', 'listen'); }
  }
  const cardGood = () => { card.classList.remove('wiggle', 'listen'); card.classList.add('good'); };
  const cardListen = (on) => card.classList.toggle('listen', on);
  function cardWiggle() { card.classList.remove('wiggle'); void card.offsetWidth; card.classList.add('wiggle'); }
  function runSyl(ms) {
    clearInterval(sylTimer);
    const els = [...card.querySelectorAll('.syl')];
    let i = 0;
    const step = () => { els.forEach((e, j) => e.classList.toggle('hl', j === i)); if (i >= els.length) clearInterval(sylTimer); i++; };
    step();
    sylTimer = setInterval(step, ms || 420);
  }
  function cardCenter() { const r = card.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.38 }; }

  /* ---------- brinquedos ---------- */
  const toys = [...document.querySelectorAll('#tray .toy')];
  const toyEl = (name) => toys.find((b) => b.dataset.toy === name);
  function setActive(name) { toys.forEach((b) => b.classList.toggle('on', b.dataset.toy === name)); }
  function attract(name) {
    const b = name ? toyEl(name) : toys[Math.floor(Math.random() * toys.length)];
    if (!b) return;
    b.classList.remove('attract'); void b.offsetWidth; b.classList.add('attract');
    setTimeout(() => b.classList.remove('attract'), 2000);
  }
  function pressFx(btn) { btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 140); }
  function toyCenter(name) { const r = toyEl(name).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* ---------- clima ---------- */
  const night = (on) => app.classList.toggle('night', on);
  const party = (on) => app.classList.toggle('party', on);

  /* ---------- aviso (só para os pais) ---------- */
  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 3500);
  }
  function micState() { $('#micWarn').hidden = F.mic.enabled; }

  // Legenda discreta do comando entendido (ajuda os pais a saber que ele obedeceu).
  let heardTimer = null;
  function heard(text) {
    const h = $('#heard');
    h.textContent = '🗣️ ' + text;
    h.classList.remove('show'); void h.offsetWidth; h.classList.add('show');
    clearTimeout(heardTimer);
    heardTimer = setTimeout(() => h.classList.remove('show'), 1800);
  }

  /* ---------- objetos soltos ---------- */
  function setPos(el, x, y, s, r) {
    el._x = x; el._y = y;
    el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s == null ? 1 : s}) rotate(${r || 0}deg)`;
  }
  function prop(content, x, y, size, cls) {
    const el = document.createElement('div');
    el.className = 'prop ' + (cls || '');
    el.innerHTML = `<span class="in" style="font-size:${size || 80}px">${content}</span>`;
    props.appendChild(el);
    setPos(el, x, y, 1, 0);
    return el;
  }
  function tween(el, to, dur, o) {
    o = o || {};
    const from = { x: el._x, y: el._y };
    const s0 = o.s0 == null ? 1 : o.s0, s1 = o.s1 == null ? s0 : o.s1;
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => {
        if (!el.isConnected || el._stopTween) { res(); return; }
        const p = Math.min(1, (now - t0) / dur);
        const e = o.ease ? o.ease(p) : p;
        const tx = typeof to === 'function' ? to() : to;
        const x = from.x + (tx.x - from.x) * e;
        let y = from.y + (tx.y - from.y) * e;
        if (o.arc) y += o.arc * Math.sin(Math.PI * p);
        setPos(el, x, y, s0 + (s1 - s0) * e, (o.rot || 0) * p);
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  const stageRect = () => stage.getBoundingClientRect();

  /* ---------- tela inicial ---------- */
  const COLS = ['#FF5A6E', '#FF9A4D', '#FFC23D', '#2ED39A', '#3DB2FF', '#A58BFF', '#FF6BB0', '#FF9A4D', '#2ED39A'];
  $('#start .title').innerHTML = 'Faladeiro'.split('').map((ch, i) => `<span style="--i:${i};--lc:${COLS[i % COLS.length]}">${ch}</span>`).join('');

  /* ---------- área dos pais (segurar a engrenagem) ---------- */
  const parent = $('#parent');
  const gear = $('#gear');
  let holdTimer = null;
  gear.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    gear.classList.add('holding');
    holdTimer = setTimeout(() => { gear.classList.remove('holding'); holdTimer = null; openParent(); }, 1500);
  });
  const cancelHold = () => {
    if (holdTimer) toast('Área dos pais: segure o botão por 2 segundos.');
    clearTimeout(holdTimer); holdTimer = null; gear.classList.remove('holding');
  };
  gear.addEventListener('pointerup', (e) => { e.stopPropagation(); cancelHold(); });
  gear.addEventListener('pointerleave', () => { clearTimeout(holdTimer); holdTimer = null; gear.classList.remove('holding'); });
  gear.addEventListener('pointercancel', () => { clearTimeout(holdTimer); holdTimer = null; gear.classList.remove('holding'); });

  const P = {
    sens: $('#pSens'), echoPitch: $('#pEchoPitch'), voiceRate: $('#pVoiceRate'),
    callbacks: $('#pCallbacks'), butterfly: $('#pButterfly'), sfx: $('#pSfx'), music: $('#pMusic'),
    meter: $('#pMeter'), meterTh: $('#pMeterTh'), cmd: $('#pCmd'), cmdStrict: $('#pCmdStrict'),
  };

  /* ----- comandos de voz ----- */
  $('#cmdList').innerHTML = F.cmd.LIST.map((c) =>
    `<tr><td>“${esc(c.say)}”</td><td>${esc(c.does)} <button type="button" data-cmd="${c.id}" aria-label="Testar">▶</button></td></tr>`).join('');
  $('#cmdList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (!b) return;
    closeParent();
    setTimeout(() => F.brain.runCommand(b.dataset.cmd), 350);
  });
  function cmdStatus() {
    const st = F.cmd.state, p = Math.round(F.cmd.progress * 100);
    const txt = {
      off: 'Desligado.',
      loading: p < 100 ? `Baixando o reconhecedor de voz… ${p}%` : 'Preparando o reconhecedor de voz…',
      ready: '✅ Pronto! Fale um comando perto do celular.',
      error: '⚠️ Não foi possível carregar agora. Tente de novo mais tarde (precisa de internet na primeira vez).',
      unsupported: '⚠️ Este navegador não suporta comandos de voz. Use o Chrome.',
    }[st] || '';
    const bar = st === 'loading' ? `<span class="bar"><i style="width:${Math.max(3, p)}%"></i></span>` : '';
    $('#cmdStatus').innerHTML = esc(txt) + bar;
    const l = F.cmd.last;
    $('#cmdLast').textContent = l ? `Último que ele ouviu: “${l.text}” (${Math.round(l.conf * 100)}% de certeza${l.id ? '' : ', não é comando'})` : '';
  }
  F.cmd.onChange(() => { if (!parent.hidden) cmdStatus(); });
  P.cmd.addEventListener('change', () => {
    F.store.s.commands = P.cmd.checked; F.store.save();
    if (P.cmd.checked) F.cmd.init(); else F.cmd.disable();
    cmdStatus();
  });
  let meterRaf = 0;

  function fillStats() {
    const st = F.store.stats;
    $('#stToday').textContent = st.days[F.store.today()] || 0;
    $('#stTotal').textContent = st.total;
    const w = Object.entries(st.words).sort((a, b) => b[1] - a[1]);
    $('#stWordsN').textContent = w.length;
    $('#stWords').innerHTML = w.length
      ? w.map(([k, n]) => `<span>${esc(k)} · ${n}</span>`).join('')
      : '<em>Ainda nenhuma. Toque no livro 📖 para ver figuras.</em>';
  }

  function openParent() {
    const s = F.store.s;
    if (F.brain) F.brain.parentOpen(true);
    P.sens.value = s.sensitivity; P.echoPitch.value = s.echoPitch; P.voiceRate.value = s.voiceRate;
    P.callbacks.checked = s.callbacks; P.butterfly.checked = s.butterfly;
    P.sfx.value = s.sfxVolume; P.music.value = s.musicVolume;
    P.cmd.checked = s.commands; P.cmdStrict.value = 1.1 - s.cmdStrict;
    fillStats(); cmdStatus();
    parent.hidden = false;
    const tick = () => {
      if (parent.hidden) return;
      const th = F.mic.threshold, rms = F.mic.rms;
      const sc = (v) => Math.min(100, (Math.sqrt(v) / Math.sqrt(0.25)) * 100);
      P.meter.style.width = sc(rms).toFixed(1) + '%';
      P.meter.style.background = rms > th ? '#2ED39A' : '#9FD9C4';
      P.meterTh.style.left = sc(th).toFixed(1) + '%';
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
  }
  function closeParent() {
    F.store.save();
    parent.hidden = true;
    cancelAnimationFrame(meterRaf);
    if (F.brain) F.brain.parentOpen(false);
  }

  function bindRange(el, key, after) {
    el.addEventListener('input', () => { F.store.s[key] = parseFloat(el.value); F.store.save(); if (after) after(); });
  }
  bindRange(P.sens, 'sensitivity');
  bindRange(P.echoPitch, 'echoPitch');
  bindRange(P.voiceRate, 'voiceRate');
  P.cmdStrict.addEventListener('input', () => { F.store.s.cmdStrict = Math.round((1.1 - parseFloat(P.cmdStrict.value)) * 100) / 100; F.store.save(); });
  bindRange(P.sfx, 'sfxVolume', () => F.sound.applyVolumes());
  bindRange(P.music, 'musicVolume', () => F.sound.applyVolumes());
  P.callbacks.addEventListener('change', () => { F.store.s.callbacks = P.callbacks.checked; F.store.save(); });
  P.butterfly.addEventListener('change', () => { F.store.s.butterfly = P.butterfly.checked; F.store.save(); });
  $('#pClose').addEventListener('click', closeParent);
  parent.addEventListener('pointerdown', (e) => { if (e.target === parent) closeParent(); });
  $('#pFull').addEventListener('click', () => goFullscreen());
  $('#pMic').addEventListener('click', async () => {
    const ok = await F.mic.start();
    micState();
    toast(ok ? 'Microfone ligado! 🎤' : 'O navegador bloqueou o microfone. Libere no cadeado ao lado do endereço do site.', 5000);
  });
  $('#pReset').addEventListener('click', () => {
    if (window.confirm('Zerar as estatísticas de falas?')) { F.store.resetStats(); fillStats(); }
  });

  function goFullscreen() {
    const d = document.documentElement;
    const req = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
      const p = req.call(d, { navigationUI: 'hide' });
      if (p && p.then) p.then(() => { try { screen.orientation.lock('portrait').catch(() => {}); } catch (e) { /* ok */ } }).catch(() => {});
    } catch (e) { /* ok */ }
  }

  return {
    showCard, cardOut, cardMode, cardGood, cardListen, cardWiggle, runSyl, cardCenter,
    setActive, attract, pressFx, toyCenter, night, party, toast, micState, heard,
    prop, tween, setPos, stageRect, goFullscreen, openParent, closeParent,
    get parentIsOpen() { return !parent.hidden; },
  };
})();
