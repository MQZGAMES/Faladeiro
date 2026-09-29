/* Áudio: voz do Faladeiro (falas gravadas), repetição da criança com variações, efeitos e músicas. */
F.sound = (() => {
  let ctx = null, master, sfxBus, musicBus, voiceBus, analyser, anaData;
  let noiseBuf = null;
  let talking = null;        // fonte de voz tocando agora (fala do cachorro ou repetição)
  let talkingDone = null;    // resolve da promessa da fala atual
  let holdUntil = 0;         // cauda de eco ainda soando
  let talkLevel = 0;

  function init() {
    if (ctx) {
      if (ctx.state !== 'running') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });

    master = ctx.createDynamicsCompressor();
    master.threshold.value = -8; master.knee.value = 8; master.ratio.value = 5;
    master.attack.value = 0.003; master.release.value = 0.2;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);

    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.2;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    anaData = new Float32Array(analyser.fftSize);
    voiceBus.connect(analyser); analyser.connect(master);

    applyVolumes();

    // Desbloqueio do áudio no iOS: toca um silêncio dentro do gesto do usuário.
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0);
    if (ctx.state !== 'running') ctx.resume();
    return ctx;
  }

  function applyVolumes() {
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(F.store.s.sfxVolume, ctx.currentTime, 0.02);
    musicBus.gain.setTargetAtTime(F.store.s.musicVolume * 0.5, ctx.currentTime, 0.02);
  }

  const now = () => ctx.currentTime;

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function osc(type, f0, f1, t, dur, peak, bus) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.006, peak == null ? 0.3 : peak, dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  function noise(t, dur, peak, type, f0, f1, q, bus) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(f0 || 1000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q == null ? 1 : q;
    const g = ctx.createGain(); env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

  const sfx = {
    pop() { const t = now(); osc('sine', 380, 1300, t, 0.09, 0.35); noise(t, 0.03, 0.12, 'highpass', 3000); },
    boing() {
      const t = now();
      const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(560, t + 0.28);
      l.frequency.value = 16; lg.gain.value = 70; l.connect(lg); lg.connect(o.frequency);
      env(g, t, 0.01, 0.35, 0.5); o.connect(g); g.connect(sfxBus);
      o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6);
    },
    bounce(v) { const t = now(); osc('sine', 200, 80, t, 0.12, 0.12 + 0.2 * (v || 0.5)); noise(t, 0.04, 0.05, 'lowpass', 600); },
    chime() { const t = now(); [1318.5, 1760, 2637].forEach((f, i) => osc('sine', f, f, t + i * 0.07, 0.5, 0.14)); },
    note(i) {
      const f = PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length];
      const t = now(); osc('triangle', f, f, t, 0.4, 0.2); osc('sine', f * 2, f * 2, t, 0.22, 0.05);
    },
    fanfare() {
      const t = now();
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { osc('triangle', f, f, t + i * 0.11, 0.26, 0.24); osc('square', f, f, t + i * 0.11, 0.12, 0.035); });
      osc('triangle', 1046.5, 1046.5, t + 0.44, 0.8, 0.24); osc('triangle', 1318.5, 1318.5, t + 0.44, 0.8, 0.18); osc('triangle', 1568, 1568, t + 0.44, 0.8, 0.12);
    },
    whoosh() { noise(now(), 0.38, 0.22, 'bandpass', 350, 2800, 0.8); },
    munch() { const t = now(); for (let i = 0; i < 4; i++) noise(t + i * 0.16, 0.09, 0.45, 'bandpass', 800 + Math.random() * 600, null, 1.6); },
    sneeze() {
      const t = now();
      noise(t, 0.35, 0.08, 'bandpass', 700, 2600, 2);
      noise(t + 0.46, 0.2, 0.55, 'bandpass', 3800, 1100, 0.7);
    },
    giggle() {
      const t = now();
      for (let i = 0; i < 6; i++) { const f = 720 + (i % 2) * 140 + i * 25; osc('sine', f * 1.15, f, t + i * 0.085, 0.07, 0.2); }
    },
    slurp() { noise(now(), 0.32, 0.28, 'bandpass', 450, 2600, 4); },
    sparkle() { const t = now(); for (let i = 0; i < 6; i++) { const f = 1800 + Math.random() * 2000; osc('sine', f, f, t + i * 0.045, 0.16, 0.06); } },
    clap() { const t = now(); for (let i = 0; i < 4; i++) noise(t + i * 0.14 + Math.random() * 0.02, 0.06, 0.55, 'bandpass', 1500, null, 0.9); },
    burp() {
      const t = now();
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(78, t + 0.5);
      l.frequency.value = 28; lg.gain.value = 22; l.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 650;
      env(g, t, 0.02, 0.55, 0.5); o.connect(f); f.connect(g); g.connect(sfxBus);
      o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6);
    },
    blip() { const t = now(); osc('sine', 900, 1500, t, 0.08, 0.2); },
    up() { const t = now(); osc('triangle', 400, 1200, t, 0.25, 0.2); },
    down() { const t = now(); osc('triangle', 900, 300, t, 0.3, 0.2); },
    kiss() { const t = now(); osc('sine', 1400, 600, t, 0.08, 0.25); noise(t, 0.04, 0.2, 'highpass', 4000); },
    pickup() { const t = now(); osc('triangle', 300, 1000, t, 0.3, 0.2); osc('sine', 600, 1800, t + 0.05, 0.25, 0.08); },
    flutter() { const t = now(); for (let i = 0; i < 5; i++) noise(t + i * 0.05, 0.03, 0.06, 'bandpass', 3500, null, 2); },
    shake() { const t = now(); for (let i = 0; i < 6; i++) noise(t + i * 0.07, 0.05, 0.12, 'bandpass', 1200 + i * 150, null, 1.5); },
    growl() { // "grrr" de brincadeira
      const t = now();
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(80, t + 0.8);
      f.type = 'lowpass'; f.frequency.value = 520;
      l.frequency.value = 26; lg.gain.value = 0.18; l.connect(lg); lg.connect(g.gain);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + 0.85);
      o.connect(f); f.connect(g); g.connect(sfxBus);
      o.start(t); l.start(t); o.stop(t + 0.9); l.stop(t + 0.9);
    },
  };

  /* ---------- Voz: falas gravadas e repetição da criança ---------- */

  function finishTalk(src) {
    if (talking !== src) return;
    talking = null; talkLevel = 0;
    const done = talkingDone; talkingDone = null;
    if (done) done();
  }

  function playSource(src, dur, tail) {
    stopVoice();
    return new Promise((resolve) => {
      talking = src; talkingDone = resolve;
      src.onended = () => {
        if (talking === src) holdUntil = performance.now() + (tail || 0);
        finishTalk(src);
      };
      src.start();
      setTimeout(() => finishTalk(src), dur * 1000 + 700);
    });
  }

  // Fala do Faladeiro (áudio já decodificado).
  function playClip(buf, rate) {
    init();
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate || 1;
    src.connect(voiceBus);
    return playSource(src, buf.duration / (rate || 1));
  }

  // Repetição da voz da criança, com variações engraçadas.
  function playEcho(buf, variant) {
    init();
    const base = F.store.s.echoPitch;
    let rate = base, tail = 0;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2600; pk.gain.value = 4; pk.Q.value = 0.8;
    src.connect(hp); hp.connect(pk); pk.connect(voiceBus);

    if (variant === 'fino') rate = Math.min(2.2, base + 0.45);
    else if (variant === 'grosso') rate = 0.74;
    else if (variant === 'canta') {
      rate = Math.max(1.2, base - 0.05);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = rate * 0.07;
      lfo.connect(lg); lg.connect(src.playbackRate);
      lfo.start(); lfo.stop(ctx.currentTime + buf.duration / rate + 0.2);
    } else if (variant === 'eco') {
      const d = ctx.createDelay(1); d.delayTime.value = 0.24;
      const fb = ctx.createGain(); fb.gain.value = 0.45;
      const wet = ctx.createGain(); wet.gain.value = 0.7;
      pk.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(voiceBus);
      tail = 900;
      setTimeout(() => { try { wet.disconnect(); fb.disconnect(); } catch (e) { /* ok */ } }, (buf.duration / rate) * 1000 + 2200);
    }
    src.playbackRate.value = rate;
    return playSource(src, buf.duration / rate, tail);
  }

  function stopVoice() {
    const src = talking;
    holdUntil = 0;
    if (src) { try { src.stop(); } catch (e) { /* já parou */ } finishTalk(src); }
  }

  function isTalking() { return !!talking || performance.now() < holdUntil; }

  function voiceLevel() {
    if (!talking && performance.now() >= holdUntil) { talkLevel = 0; return 0; }
    analyser.getFloatTimeDomainData(anaData);
    let sum = 0;
    for (let i = 0; i < anaData.length; i++) sum += anaData[i] * anaData[i];
    const rms = Math.sqrt(sum / anaData.length);
    talkLevel = talkLevel * 0.45 + rms * 0.55;
    return talkLevel;
  }

  // Tira o silêncio do começo e do fim das falas gravadas (resposta mais rápida).
  function trim(buf) {
    const d = buf.getChannelData(0), sr = buf.sampleRate;
    let a = 0, b = d.length - 1;
    while (a < b && Math.abs(d[a]) < 0.012) a++;
    while (b > a && Math.abs(d[b]) < 0.012) b--;
    a = Math.max(0, a - Math.round(sr * 0.01));
    b = Math.min(d.length - 1, b + Math.round(sr * 0.05));
    if (b <= a) return buf;
    const out = ctx.createBuffer(1, b - a + 1, sr);
    out.getChannelData(0).set(d.subarray(a, b + 1));
    return out;
  }

  function decode(arrayBuffer) {
    init();
    return new Promise((res, rej) => {
      const p = ctx.decodeAudioData(arrayBuffer, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }

  /* ---------- Músicas (composições originais simples) ---------- */

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const music = { timer: null, next: 0, step: 0, song: null, out: null, t0: 0, stopAt: 0 };

  function pluck(dest, type, f, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(dest, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.22);
  }
  function snare(dest, t) { noise(t, 0.12, 0.25, 'highpass', 1800, null, 0.7, dest); }
  function hat(dest, t, v) { noise(t, 0.04, v, 'highpass', 8000, null, 0.7, dest); }
  function musicBox(dest, f, t, vol) {
    pluck(dest, 'sine', f, t, 1.4, vol);
    pluck(dest, 'sine', f * 3, t, 0.35, vol * 0.18);
    pluck(dest, 'triangle', f * 2, t, 0.6, vol * 0.12);
  }

  const SONGS = {
    danca: {
      bpm: 118, spb: 2,
      mel: [76, 79, 76, 72, 74, 76, 72, null, 74, 79, 74, 71, 72, 74, 71, null,
        72, 76, 81, 79, 76, 72, 76, null, 77, 76, 74, 72, 74, null, 72, null],
      roots: [48, 43, 45, 41],
      chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]],
      play(step, t, dt, d) {
        const i = step % 32, bar = Math.floor(i / 8), b = i % 8;
        const m = this.mel[i];
        if (m) { pluck(d, 'triangle', mtof(m), t, dt * 1.6, 0.16); pluck(d, 'square', mtof(m), t, dt * 0.8, 0.035); }
        if (b === 0 || b === 3 || b === 4 || b === 6) {
          const r = this.roots[bar] + (b === 3 || b === 6 ? 12 : 0);
          pluck(d, 'triangle', mtof(r), t, dt * 1.8, 0.3);
        }
        if (b === 2 || b === 6) this.chords[bar].forEach((n) => pluck(d, 'triangle', mtof(n), t, dt * 0.9, 0.05));
        if (b % 4 === 0) kick(d, t);
        if (b % 4 === 2) snare(d, t);
        hat(d, t, b % 2 ? 0.025 : 0.045);
      },
    },
    ninar: {
      bpm: 72, spb: 1,
      mel: [79, 76, 79, 81, 79, 76, 77, 74, 77, 79, null, null, 76, 72, 76, 77, 76, 74, 72, 74, 76, 72, null, null],
      bass: [48, null, null, 53, null, null, 50, null, null, 55, null, null, 48, null, null, 53, null, null, 55, null, null, 48, null, null],
      play(step, t, dt, d) {
        const i = step % 24;
        const m = this.mel[i]; if (m) musicBox(d, mtof(m), t, 0.2);
        const b = this.bass[i]; if (b) pluck(d, 'sine', mtof(b), t, dt * 3, 0.14);
      },
    },
  };

  function schedule() {
    const song = music.song; if (!song) return;
    const dt = 60 / song.bpm / song.spb;
    while (music.next < ctx.currentTime + 0.15) {
      if (music.stopAt && music.next > music.stopAt) { stopMusic(); return; }
      song.play(music.step, music.next, dt, music.out);
      music.next += dt; music.step++;
    }
  }

  function playMusic(name, maxSeconds) {
    init(); stopMusic();
    const g = ctx.createGain(); g.gain.value = 1; g.connect(musicBus);
    music.out = g; music.song = SONGS[name]; music.step = 0;
    music.next = ctx.currentTime + 0.08; music.t0 = music.next;
    music.stopAt = maxSeconds ? music.t0 + maxSeconds : 0;
    music.timer = setInterval(schedule, 25);
    schedule();
  }

  function stopMusic() {
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
    if (music.out) {
      const g = music.out;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* ok */ } }, 900);
      music.out = null;
    }
    music.song = null;
  }

  function beat() {
    if (!music.song || !ctx) return null;
    return Math.max(0, (ctx.currentTime - music.t0) * music.song.bpm / 60);
  }

  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state !== 'running') ctx.resume(); }

  let ducked = false;
  function duck(on) {
    if (!ctx || on === ducked) return;
    ducked = on;
    const base = F.store.s.musicVolume * 0.5;
    musicBus.gain.setTargetAtTime(on ? base * 0.35 : base, ctx.currentTime, 0.08);
  }

  // Tempo (ms) que o microfone ignora depois de cada efeito, para não "ouvir" o próprio som.
  const MUTE = { fanfare: 1300, sneeze: 900, burp: 800, boing: 650, clap: 700, whoosh: 500, giggle: 650, munch: 750, sparkle: 500, chime: 700, slurp: 450, up: 400, down: 450, pickup: 450, shake: 550, bounce: 200, growl: 1000 };
  const sfxProxy = new Proxy(sfx, {
    get: (o, k) => (...a) => {
      if (!ctx || !o[k]) return;
      try { o[k](...a); } catch (e) { console.warn(e); }
      if (F.mic) F.mic.suppress(MUTE[k] || 250);
    },
  });

  return {
    init, applyVolumes, duck, sfx: sfxProxy,
    playClip, playEcho, stopVoice, isTalking, voiceLevel, trim, decode,
    playMusic, stopMusic, beat, isMusic: () => !!music.song,
    suspend, resume, get ctx() { return ctx; },
  };
})();
