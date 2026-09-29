/* Configurações e estatísticas salvas no aparelho. */
window.F = window.F || {};

F.store = (() => {
  const KEY = 'faladeiro.v2';
  const defaults = {
    sensitivity: 0.65, // 0..1 — sensibilidade do microfone
    echoPitch: 1.5,    // quão fininha fica a repetição da criança
    voiceRate: 1.0,    // velocidade/tom da voz do Faladeiro
    callbacks: true,   // imitar a criança quando ela fica quieta
    butterfly: true,   // borboleta passeando
    commands: true,    // comandos de voz ("corre", "pega a bola"...)
    cmdStrict: 0.72,   // quão certo o reconhecedor precisa estar (0..1)
    sfxVolume: 0.8,
    musicVolume: 0.6,
  };

  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { raw = {}; }

  const s = Object.assign({}, defaults, raw.settings || {});
  const stats = Object.assign({ total: 0, days: {}, words: {} }, raw.stats || {});

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ settings: s, stats })); } catch (e) { /* modo privado */ }
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function countUtterance() {
    stats.total++;
    const t = today();
    stats.days[t] = (stats.days[t] || 0) + 1;
    save();
  }

  function countWord(w) {
    if (!w) return;
    stats.words[w] = (stats.words[w] || 0) + 1;
    save();
  }

  function resetStats() {
    stats.total = 0; stats.days = {}; stats.words = {};
    save();
  }

  return { s, stats, defaults, save, today, countUtterance, countWord, resetStats };
})();
