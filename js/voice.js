/* Voz do Faladeiro: falas gravadas com voz neural (pasta voice/).
   Se algum áudio faltar, usa a voz do aparelho como reserva. */
F.voice = (() => {
  let catalog = {};
  const bufs = new Map(), pending = new Map();
  let gen = 0, ttsSpeaking = false, lastEnd = 0;

  async function init() {
    try {
      const r = await fetch('voice/falas.json');
      catalog = (await r.json()).lines || {};
    } catch (e) { catalog = {}; }
  }

  function text(id) {
    const s = catalog[id];
    if (!s) return '';
    return typeof s === 'string' ? s : s.text;
  }

  // Só baixa os arquivos (sem abrir o áudio). Pode rodar antes do toque de "começar" — importante no iPhone.
  const raw = new Map();
  const fetchRaw = (id) => fetch(`voice/${id}.mp3`).then((r) => { if (!r.ok) throw new Error(id); return r.arrayBuffer(); });
  function prefetch(ids) {
    ids.forEach((id) => { if (!raw.has(id) && !bufs.has(id)) raw.set(id, fetchRaw(id).catch(() => null)); });
  }

  function load(id) {
    if (bufs.has(id)) return Promise.resolve(bufs.get(id));
    if (pending.has(id)) return pending.get(id);
    const src = raw.has(id) ? raw.get(id) : fetchRaw(id);
    raw.delete(id);
    const p = Promise.resolve(src)
      .then((ab) => { if (!ab) throw new Error(id); return F.sound.decode(ab); })
      .then((b) => { const t = F.sound.trim(b); bufs.set(id, t); pending.delete(id); return t; })
      .catch(() => { pending.delete(id); bufs.set(id, null); return null; });
    pending.set(id, p);
    return p;
  }

  function preload(ids) {
    let i = 0;
    const next = () => { if (i < ids.length) load(ids[i++]).then(next, next); };
    for (let k = 0; k < 4; k++) next();
  }

  const timeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

  function tts(t) {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth || !t) { resolve(); return; }
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'pt-BR'; u.pitch = 1.25; u.rate = 1.0;
      const v = synth.getVoices().find((x) => /pt[-_]BR/i.test(x.lang) && /google|francisca|luciana/i.test(x.name)) ||
        synth.getVoices().find((x) => /pt[-_]BR/i.test(x.lang));
      if (v) u.voice = v;
      let done = false;
      const fin = () => { if (done) return; done = true; ttsSpeaking = false; lastEnd = performance.now(); resolve(); };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 1500 + t.length * 90);
      ttsSpeaking = true;
      synth.speak(u);
    });
  }

  // Fala uma ou mais falas em sequência: say('r_uau') ou say(['g_olha', 'w_bola']).
  async function say(ids) {
    if (!Array.isArray(ids)) ids = [ids];
    const my = ++gen;
    for (let i = 0; i < ids.length; i++) {
      if (my !== gen) return;
      const buf = await timeout(load(ids[i]), 2500);
      if (my !== gen) return;
      if (buf) await F.sound.playClip(buf, F.store.s.voiceRate);
      else await tts(text(ids[i]));
      lastEnd = performance.now();
      if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 70));
    }
  }

  function stop() {
    gen++;
    F.sound.stopVoice();
    if (ttsSpeaking && window.speechSynthesis) window.speechSynthesis.cancel();
    ttsSpeaking = false;
  }

  return {
    init, say, stop, load, preload, prefetch, text,
    ids: () => Object.keys(catalog),
    has: (id) => id in catalog,
    get speaking() { return ttsSpeaking || F.sound.isTalking(); },
    get lastEnd() { return lastEnd; },
  };
})();
