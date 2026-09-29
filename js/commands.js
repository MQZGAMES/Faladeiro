/* Comandos de voz: reconhecimento offline (Vosk, no próprio aparelho) só com a lista de comandos abaixo.
   Usa o mesmo áudio que o microfone já gravou, então não disputa o microfone e nada é enviado para a internet. */
F.cmd = (() => {
  // "phrases" = o que pode ser falado. Só palavras que existem no vocabulário do modelo português.
  const LIST = [
    { id: 'bravo', say: 'fica bravo', does: 'faz cara de bravo, rosna e depois ri', phrases: ['fica bravo', 'bravo', 'brava', 'zangado', 'fica zangado'] },
    { id: 'dorme', say: 'vai deitar · dorme · nana', does: 'boceja e dorme', phrases: ['vai deitar', 'deita', 'dorme', 'dormir', 'vai dormir', 'nana'] },
    { id: 'acorda', say: 'acorda', does: 'acorda', phrases: ['acorda', 'acordar'] },
    { id: 'biscoito', say: 'biscoito · quer biscoito · fome · papá', does: 'fica com fome, aparece um biscoito e ele come', phrases: ['biscoito', 'quer biscoito', 'bolacha', 'fome', 'papá', 'come', 'comida'] },
    { id: 'corre', say: 'corre', does: 'corre pela tela', phrases: ['corre', 'correr', 'corra', 'vai correr'] },
    { id: 'bola', say: 'pega a bola · bola', does: 'a bola aparece, ele corre e pega', phrases: ['pega a bola', 'bola', 'pega', 'pegar a bola', 'quer bola'] },
    { id: 'pula', say: 'pula', does: 'pula', phrases: ['pula', 'pular'] },
    { id: 'senta', say: 'senta', does: 'senta bonitinho', phrases: ['senta', 'sentar', 'senta aqui'] },
    { id: 'late', say: 'late · au au', does: 'late', phrases: ['late', 'au au', 'au'] },
    { id: 'danca', say: 'dança · música', does: 'festa de dança', phrases: ['dança', 'dançar', 'música'] },
    { id: 'gira', say: 'gira · roda', does: 'gira', phrases: ['gira', 'girar', 'roda', 'rodar'] },
    { id: 'rola', say: 'rola', does: 'dá uma cambalhota', phrases: ['rola', 'rolar'] },
    { id: 'pata', say: 'dá a pata · toca aqui', does: 'bate na mão', phrases: ['pata', 'dá a pata', 'toca aqui'] },
    { id: 'beijo', say: 'beijo', does: 'manda beijo', phrases: ['beijo', 'beijinho', 'dá um beijo'] },
    { id: 'abraco', say: 'abraço', does: 'dá um abraço', phrases: ['abraço', 'dá um abraço'] },
    { id: 'oi', say: 'oi · olá', does: 'acena e diz oi', phrases: ['oi', 'olá'] },
    { id: 'tchau', say: 'tchau', does: 'dá tchau', phrases: ['tchau'] },
    { id: 'canta', say: 'canta', does: 'canta lá lá lá', phrases: ['canta', 'cantar'] },
    { id: 'bolhas', say: 'bolhas', does: 'faz bolhas', phrases: ['bolha', 'bolhas'] },
    { id: 'esconde', say: 'esconde · cadê', does: 'brinca de esconder', phrases: ['esconde', 'esconder', 'cadê'] },
    { id: 'ri', say: 'ri · cócegas', does: 'dá risada', phrases: ['ri', 'risada', 'cócegas'] },
    { id: 'lingua', say: 'língua', does: 'mostra a língua', phrases: ['língua'] },
    { id: 'espirra', say: 'espirra', does: 'espirra', phrases: ['espirra'] },
    { id: 'coca', say: 'coça', does: 'se coça', phrases: ['coça', 'coçar'] },
    { id: 'vem', say: 'vem · vem aqui', does: 'vem pertinho', phrases: ['vem', 'vem aqui'] },
  ];

  const MODEL_URL = 'vosk/model.tar.gz';
  const LIB_URL = 'js/vendor/vosk.js';
  const CACHE_NAME = 'faladeiro-comandos-v2';

  let state = 'off';        // off | loading | ready | error | unsupported | paused
  let progress = 0;
  let model = null, rec = null, chain = Promise.resolve(), pending = null;
  let last = null;
  const watchers = [];

  function set(s, p) { state = s; if (p != null) progress = p; watchers.forEach((f) => { try { f(state, progress); } catch (e) { /* ok */ } }); }

  function grammar() {
    const all = new Set();
    LIST.forEach((c) => c.phrases.forEach((p) => all.add(p)));
    return JSON.stringify([...all, '[unk]']);
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (window.Vosk) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('vosk.js'));
      document.head.appendChild(s);
    });
  }

  // Pega o modelo do cache do app; se não tiver, baixa uma vez mostrando o progresso e guarda.
  async function getModelBlob(url) {
    let cache = null;
    try {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('faladeiro-comandos-') && n !== CACHE_NAME).map((n) => caches.delete(n)));
      cache = await caches.open(CACHE_NAME);
    } catch (e) { cache = null; }
    if (cache) {
      const hit = await cache.match(url);
      if (hit) return hit.blob();
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('modelo ' + res.status);
    const total = +res.headers.get('Content-Length') || 32.5e6;
    let blob;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader(), parts = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.length;
        set('loading', Math.min(0.99, got / total));
      }
      blob = new Blob(parts, { type: 'application/gzip' });
    } else {
      blob = await res.blob();
    }
    if (cache) { try { await cache.put(url, new Response(blob)); } catch (e) { /* sem espaço: segue sem guardar */ } }
    return blob;
  }

  function createModel(src) {
    // Espera o "load" do modelo ou um erro do reconhecedor (o que vier primeiro).
    return new Promise((resolve, reject) => {
      const m = new window.Vosk.Model(src, -2);
      const timer = setTimeout(() => reject(new Error('tempo esgotado')), 180000);
      m.on('load', (msg) => { clearTimeout(timer); if (msg && msg.result) resolve(m); else reject(new Error('modelo não carregou')); });
      m.on('error', (msg) => { clearTimeout(timer); reject(new Error((msg && msg.error) || 'erro no reconhecedor')); });
    });
  }

  async function init() {
    if (!F.store.s.commands) { set('off'); return; }
    if (state === 'loading' || state === 'ready') return;
    if (!window.WebAssembly || !window.Worker || !window.OfflineAudioContext || !window.fetch) { set('unsupported'); return; }
    set('loading', 0);
    let blobUrl = null;
    try {
      const url = new URL(MODEL_URL, location.href).href;
      const blob = await getModelBlob(url);
      set('loading', 1);
      await loadScript(LIB_URL);
      blobUrl = URL.createObjectURL(blob);
      model = await createModel(blobUrl);
      rec = new model.KaldiRecognizer(16000, grammar());
      rec.setWords(true);
      rec.on('result', (m) => onResult(m && m.result));
      set('ready', 1);
    } catch (e) {
      console.warn('Comandos de voz indisponíveis', e);
      try { if (model) model.terminate(); } catch (e2) { /* ok */ }
      model = null; rec = null;
      set('error');
    } finally {
      if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  }

  function disable() {
    try { if (model) model.terminate(); } catch (e) { /* ok */ }
    model = null; rec = null; pending = null;
    set('off', 0);
  }

  // Converte o trecho gravado para 16 kHz (taxa do modelo).
  async function to16k(buf) {
    if (buf.sampleRate === 16000) return buf.getChannelData(0);
    const len = Math.ceil(buf.duration * 16000);
    const oc = new OfflineAudioContext(1, len, 16000);
    const src = oc.createBufferSource(); src.buffer = buf; src.connect(oc.destination); src.start();
    const out = await oc.startRendering();
    return out.getChannelData(0);
  }

  function onResult(r) {
    const P = pending;
    if (!P || !r) return;
    if (r.text) P.texts.push(r.text);
    if (r.result) P.words.push(...r.result);
    clearTimeout(P.timer);
    P.timer = setTimeout(() => done(P), 140);
  }
  function done(P) {
    if (P.finished) return;
    P.finished = true;
    if (pending === P) pending = null;
    P.resolve(match(P.texts.join(' '), P.words));
  }

  function match(text, words) {
    const t = ' ' + (text || '').replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    if (!t.trim()) { last = { text: '(nada reconhecido)', conf: 0, id: null, cmd: null, phrase: null }; return null; }
    const real = (words || []).filter((w) => w.word && w.word !== '[unk]');
    const conf = real.length ? real.reduce((a, w) => a + (w.conf || 0), 0) / real.length : 0;
    let best = null;
    for (const c of LIST) {
      for (const p of c.phrases) {
        if (t.includes(' ' + p + ' ') && (!best || p.length > best.p.length)) best = { c, p };
      }
    }
    const res = { text: t.trim(), conf, id: null, cmd: null, phrase: null };
    if (best) { res.id = best.c.id; res.cmd = best.c; res.phrase = best.p; }
    last = res;
    const need = F.store.s.cmdStrict;
    return best && conf >= need ? res : null;
  }

  // Reconhece um trecho de fala. Resolve com o comando (ou null) em poucos décimos de segundo.
  function recognize(buf) {
    if (state !== 'ready' || !rec || !buf) return Promise.resolve(null);
    const job = chain.then(async () => {
      const data = await to16k(buf);
      return new Promise((resolve) => {
        const P = { texts: [], words: [], resolve, finished: false, timer: 0 };
        pending = P;
        rec.acceptWaveformFloat(new Float32Array(data), 16000);
        rec.retrieveFinalResult();
        P.timer = setTimeout(() => done(P), 2500);
      });
    });
    chain = job.catch(() => null);
    return job.catch(() => null);
  }

  return {
    LIST, init, disable, recognize, match,
    onChange(f) { watchers.push(f); },
    get state() { return state; },
    get progress() { return progress; },
    get ready() { return state === 'ready'; },
    get last() { return last; },
  };
})();
