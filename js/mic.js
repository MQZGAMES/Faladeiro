/* Microfone: detecta quando a criança fala (ou faz barulho) e grava o trecho para o Faladeiro repetir. */
F.mic = (() => {
  const CHUNK = 2048;
  const PREROLL = 8;        // ~0,35 s guardados antes do início do som
  const START_CHUNKS = 3;   // blocos seguidos acima do limiar para começar
  const END_CHUNKS = 13;    // ~0,55 s de silêncio para terminar (resposta rápida, como o Tom)
  const MIN_VOICED = 4;     // som mínimo (~0,17 s) para contar
  const MAX_SEC = 6;

  let ctx = null, stream = null, proc = null, source = null;
  let enabled = false, denied = false, paused = false;
  let state = 'idle';
  let pre = [], rec = [], above = 0, below = 0, voiced = 0, peak = 0;
  let nf = 0.006;           // nível de ruído ambiente
  let suppressUntil = 0;
  let musicMode = false;
  let lastLevel = 0, lastRms = 0;

  const handlers = { start: [], end: [], cancel: [], level: [] };
  const on = (ev, fn) => handlers[ev].push(fn);
  const emit = (ev, ...a) => handlers[ev].forEach((fn) => { try { fn(...a); } catch (e) { console.error(e); } });

  async function start() {
    ctx = F.sound.init();
    if (enabled) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { denied = true; return false; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (e) {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e2) { console.warn('Microfone indisponível', e2); denied = true; return false; }
    }
    source = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(CHUNK, 1, 1);
    proc.onaudioprocess = onChunk;
    const mute = ctx.createGain(); mute.gain.value = 0;
    source.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    enabled = true; denied = false;
    return true;
  }

  // Enquanto o Faladeiro fala, o microfone não escuta (para não repetir a si mesmo).
  function isSuppressed() {
    const t = performance.now();
    return paused || F.voice.speaking || t < suppressUntil || t - F.voice.lastEnd < 380;
  }
  function suppress(ms) { suppressUntil = Math.max(suppressUntil, performance.now() + ms); }

  function threshold() {
    const s = F.store.s.sensitivity;
    const minAbs = 0.05 * Math.pow(0.16, s);       // 0,05 … 0,008
    return Math.max(minAbs, nf * 3.2) * (musicMode ? 2.4 : 1);
  }
  const loudLevel = () => Math.max(0.22, threshold() * 7);

  function reset() { state = 'idle'; pre = []; rec = []; above = 0; below = 0; voiced = 0; peak = 0; }

  function onChunk(e) {
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
    start, on, suppress, reset,
    get enabled() { return enabled; },
    get denied() { return denied; },
    get speaking() { return state === 'voice'; },
    get level() { return lastLevel; },
    get rms() { return lastRms; },
    get threshold() { return threshold(); },
    set paused(v) { paused = v; if (v) reset(); },
    get paused() { return paused; },
    set musicMode(v) { musicMode = v; },
  };
})();
