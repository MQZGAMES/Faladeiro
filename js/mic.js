/* Microfone: detecta quando a criança fala (ou faz barulho) e grava o trecho para o Faladeiro repetir. */
F.mic = (() => {
  const CHUNK = 2048;
  const PREROLL = 8;        // ~0,35 s guardados antes do início do som
  const START_CHUNKS = 3;   // blocos seguidos acima do limiar para começar
  const END_CHUNKS = 13;    // ~0,55 s de silêncio para terminar (resposta rápida, como o Tom)
  const MIN_VOICED = 4;     // som mínimo (~0,17 s) para contar
  const MAX_SEC = 6;

  let ctx = null, stream = null, proc = null, source = null, mute = null, track = null;
  let enabled = false, denied = false, paused = false, lastError = '';
  let state = 'idle';
  let pre = [], rec = [], above = 0, below = 0, voiced = 0, peak = 0;
  let nf = 0.006;           // nível de ruído ambiente
  let suppressUntil = 0;
  let musicMode = false;
  let lastLevel = 0, lastRms = 0;
  let chunks = 0, lastChunkAt = 0, connectedAt = 0;

  // iPhone/iPad (todos os navegadores de lá usam o motor do Safari) e Safari no Mac.
  const ua = navigator.userAgent;
  const isApple = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);

  const handlers = { start: [], end: [], cancel: [], level: [] };
  const on = (ev, fn) => handlers[ev].push(fn);
  const emit = (ev, ...a) => handlers[ev].forEach((fn) => { try { fn(...a); } catch (e) { console.error(e); } });

  // Pede o microfone. Chamar logo no toque de "começar" (antes de criar o áudio).
  function request() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(Object.assign(new Error('sem suporte'), { name: 'NotSupportedError' }));
    return navigator.mediaDevices.getUserMedia({
      // ganho automático ligado: deixa a voz de criança (baixinha ou longe) mais forte
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
    }).catch((e) => {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
      return navigator.mediaDevices.getUserMedia({ audio: true });
    });
  }

  async function start(req) {
    if (enabled && track && track.readyState === 'live') { F.sound.ensureRunning(); return true; }
    try {
      stream = await (req || request());
    } catch (e) {
      console.warn('Microfone indisponível', e);
      lastError = (e && e.name) || 'erro';
      denied = true; enabled = false;
      F.sound.init();
      return false;
    }
    track = stream.getAudioTracks()[0] || null;
    // No iPhone o áudio precisa nascer DEPOIS do microfone ligado (e na mesma taxa), senão chega mudo.
    if (isApple || F.mic.forceApple) {
      let sr = 0;
      try { sr = (track && track.getSettings && track.getSettings().sampleRate) || 0; } catch (e) { sr = 0; }
      F.sound.rebuild(sr || undefined);
    } else {
      F.sound.init();
    }
    connect();
    if (track) {
      track.onended = () => { enabled = false; };
    }
    enabled = true; denied = false; lastError = '';
    return true;
  }

  function connect() {
    ctx = F.sound.ctx;
    try { if (proc) { proc.onaudioprocess = null; proc.disconnect(); } } catch (e) { /* ok */ }
    try { if (source) source.disconnect(); } catch (e) { /* ok */ }
    try { if (mute) mute.disconnect(); } catch (e) { /* ok */ }
    source = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(CHUNK, 1, 1);
    proc.onaudioprocess = onChunk;
    mute = ctx.createGain(); mute.gain.value = 0;
    source.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    reset();
    chunks = 0; lastChunkAt = 0; connectedAt = performance.now();
    F.sound.ensureRunning();
  }

  // Religa tudo (usado quando o som do microfone para de chegar). Deve ser chamado num toque.
  async function revive() {
    if (!stream || !track || track.readyState !== 'live') { enabled = false; return start(); }
    if (isApple || F.mic.forceApple) {
      let sr = 0;
      try { sr = (track.getSettings && track.getSettings().sampleRate) || 0; } catch (e) { sr = 0; }
      F.sound.rebuild(sr || undefined);
    }
    connect();
    enabled = true;
    return true;
  }

  // Microfone ligado mas nenhum som chegando há um tempo (áudio travado pelo sistema).
  function isStalled() {
    if (!enabled || paused) return false;
    const since = lastChunkAt || connectedAt;
    return performance.now() - since > 2500;
  }

  // Enquanto o Faladeiro fala, o microfone não escuta (para não repetir a si mesmo).
  function isSuppressed() {
    const t = performance.now();
    return paused || F.voice.speaking || t < suppressUntil || t - F.voice.lastEnd < 380;
  }
  function suppress(ms) { suppressUntil = Math.max(suppressUntil, performance.now() + ms); }

  function threshold() {
    const s = F.store.s.sensitivity;
    const minAbs = 0.03 * Math.pow(0.05, s);       // 0,03 … 0,0015 (máximo = ouve voz baixinha)
    const overNoise = 3.2 - 1.4 * s;               // quanto acima do ruído da casa precisa estar
    return Math.max(minAbs, nf * overNoise) * (musicMode ? 2.4 : 1);
  }
  const loudLevel = () => Math.max(0.22, threshold() * 7);

  function reset() { state = 'idle'; pre = []; rec = []; above = 0; below = 0; voiced = 0; peak = 0; }

  function onChunk(e) {
    chunks++; lastChunkAt = performance.now();
    const data = e.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    lastRms = rms;

    if (isSuppressed()) {
      if (state === 'voice') { reset(); emit('cancel'); } else { pre = []; above = 0; }
      lastLevel = 0; emit('level', 0, false, false);
      return;
    }

    if (state !== 'voice') nf = rms < nf ? nf * 0.9 + rms * 0.1 : nf * 0.997 + rms * 0.003;
    const th = threshold();
    const active = rms > th;
    const loud = rms > loudLevel();
    lastLevel = Math.min(1, rms / (th * 4));
    emit('level', lastLevel, active, loud);

    const copy = new Float32Array(data);
    if (state === 'idle') {
      pre.push(copy); if (pre.length > PREROLL) pre.shift();
      if (active) {
        above++;
        if (above >= START_CHUNKS) {
          state = 'voice'; rec = pre.slice(); pre = []; voiced = above; below = 0; peak = rms;
          emit('start');
        }
      } else above = Math.max(0, above - 1);
    } else {
      rec.push(copy);
      if (rms > peak) peak = rms;
      if (rms > th * 0.7) { below = 0; if (active) voiced++; } else below++;
      const dur = (rec.length * CHUNK) / ctx.sampleRate;
      if (below >= END_CHUNKS || dur > MAX_SEC) finish();
    }
  }

  function finish() {
    const chunks = rec, trailing = below, count = voiced, pk = peak;
    reset();
    if (count < MIN_VOICED) { emit('cancel'); return; }

    const keep = Math.max(1, chunks.length - Math.max(0, trailing - 4));
    const len = keep * CHUNK;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < keep; i++) ch.set(chunks[i], i * CHUNK);

    // Normaliza o volume (a voz de criança costuma ser baixinha) e suaviza as pontas.
    let mx = 0;
    for (let i = 0; i < len; i++) { const a = Math.abs(ch[i]); if (a > mx) mx = a; }
    const g = Math.min(12, 0.92 / (mx || 1));
    const fade = Math.min(len >> 2, Math.round(ctx.sampleRate * 0.012));
    for (let i = 0; i < len; i++) {
      let w = 1;
      if (i < fade) w = i / fade; else if (i > len - fade) w = (len - i) / fade;
      ch[i] *= g * w;
    }
    emit('end', buf, { dur: len / ctx.sampleRate, peak: pk, loud: pk > loudLevel() });
  }

  return {
    start, request, revive, on, suppress, reset,
    forceApple: false,        // só para testes: simula o caminho do iPhone
    isApple,
    get enabled() { return enabled; },
    get denied() { return denied; },
    get stalled() { return isStalled(); },
    get receiving() { return enabled && !isStalled() && chunks > 0; },
    get chunks() { return chunks; },
    get lastError() { return lastError; },
    get trackState() { return track ? `${track.readyState}${track.muted ? ', mudo' : ''}` : 'sem microfone'; },
    get speaking() { return state === 'voice'; },
    get level() { return lastLevel; },
    get rms() { return lastRms; },
    get threshold() { return threshold(); },
    set paused(v) { paused = v; if (v) reset(); },
    get paused() { return paused; },
    set musicMode(v) { musicMode = v; },
  };
})();
