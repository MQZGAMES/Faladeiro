/* O "cérebro" do Faladeiro.
   Regra de ouro: o microfone está sempre ligado. A QUALQUER momento que a criança fala ou faz barulho,
   o cachorro pausa o que está fazendo, repete de um jeito divertido e depois volta para a brincadeira.
   Se a criança fica quieta, ele imita as últimas falas dela (vozes engraçadas) para chamá-la de volta.
   Nada depende de ler, entender instruções ou apertar "próximo". */
F.brain = (() => {
  class Cancel extends Error {}
  const dog = F.dog, ui = F.ui, fx = F.fx, sfx = F.sound.sfx, V = F.voice, ball = F.ball;
  const now = () => performance.now();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((v) => v[1]);
  const COLORS = ['#FF5A6E', '#FFC23D', '#3DB2FF', '#22C58B', '#9B7BFF', '#FF8A3D', '#FF5DA2'];
  const backOut = (p) => 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2);
  const easeIn = (p) => p * p;

  let started = false, pOpen = false;
  let mode = 'free';          // free | bola | comida | bolhas | musica | figuras | dormir
  let task = null;            // sequência da brincadeira escolhida
  let fg = null;              // reação em primeiro plano (repetição, toque, chamada)
  let listener = null;
  const memory = [];          // últimas falas da criança (para imitar depois)
  let lastChildAt = 0, lastTouchAt = 0, lastDogAt = 0, calloutStep = 0, streak = 0;
  let sleeping = false, sleepKind = null;
  let nextFidget = 0, nextZ = 0, nextAttract = 0, nextWave = 0, nextFx = 0;
  const lastSaid = {};

  /* ================= Tarefas (canceláveis) ================= */

  function token(kind, name) {
    return { kind, name, cancelled: false, ended: false, cleanups: [], started: now(), onCancel(f) { this.cleanups.push(f); } };
  }
  function check(t) { if (t.cancelled) throw new Cancel(); }
  function finish(t) {
    if (t.ended) return;
    t.ended = true; t.cancelled = true;
    t.cleanups.splice(0).forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  }

  // Espera que pausa enquanto há uma reação em primeiro plano (a atividade "congela" e depois continua).
  function wait(t, ms) {
    return new Promise((res, rej) => {
      let left = ms, last = now();
      const iv = setInterval(() => {
        const n = now();
        if (!fg || fg === t) left -= n - last;
        last = n;
        if (t.cancelled) { clearInterval(iv); rej(new Cancel()); } else if (left <= 0) { clearInterval(iv); res(); }
      }, 40);
    });
  }
  const frame = (t) => new Promise((res, rej) => requestAnimationFrame(() => (t.cancelled ? rej(new Cancel()) : res())));

  async function gate(t) { while (fg && fg !== t) { check(t); await new Promise((r) => setTimeout(r, 60)); } check(t); }

  async function say(t, ids) { await gate(t); await V.say(ids); check(t); }

  // Escuta a criança. Resolve com {voiced, buf, info} | {voiced:false} | {skipped} | {tapped}.
  function listen(t, ms, opts) {
    check(t);
    opts = opts || {};
    return new Promise((resolve, reject) => {
      const prev = listener;
      let left = ms, last = now(), speakingNow = false;
      const L = { t, reveal: !!opts.reveal, closed: false };
      const iv = setInterval(() => {
        const n = now();
        if ((!fg || fg === t) && !speakingNow) left -= n - last;
        last = n;
        if (t.cancelled) L.done({ cancelled: true });
        else if (left <= 0) L.done({ voiced: false });
      }, 50);
      L.done = (r) => {
        if (L.closed) return;
        L.closed = true; clearInterval(iv);
        if (listener === L) listener = prev && !prev.closed ? prev : null;
        if (r.cancelled) reject(new Cancel()); else resolve(r);
      };
      L.onStart = () => { speakingNow = true; };
      L.onCancel = () => { speakingNow = false; left = Math.max(left, 2500); };
      L.onEnd = (buf, info) => L.done({ voiced: true, buf, info });
      listener = L;
    });
  }

  function runFg(name, fn) {
    cancelFg(true);
    const t = token('fg', name);
    fg = t;
    (async () => {
      try { await fn(t); } catch (e) { if (!(e instanceof Cancel)) console.error(e); }
      finally {
        finish(t);
        if (fg === t) { fg = null; lastDogAt = now(); restMood(); }
      }
    })();
    return t;
  }
  function cancelFg(silent) {
    const t = fg;
    if (!t) return;
    fg = null;
    t.cancelled = true;
    if (listener && listener.t === t) listener.done({ cancelled: true });
    V.stop();
    finish(t);
    if (!silent) restMood();
  }

  function startMode(name, fn) {
    stopMode();
    dog.stopRun();
    goHome();
    mode = name;
    const t = token('mode', name);
    task = t;
    ui.setActive(name);
    (async () => {
      try { await fn(t); } catch (e) { if (!(e instanceof Cancel)) console.error(e); }
      finally {
        finish(t);
        if (task === t) { task = null; mode = 'free'; ui.setActive(null); lastDogAt = now(); restMood(); goHome(); }
      }
    })();
  }
  function stopMode() {
    const t = task;
    if (!t) return;
    task = null;
    t.cancelled = true;
    if (listener && listener.t === t) listener.done({ cancelled: true });
    V.stop();
    finish(t);
    mode = 'free';
    ui.setActive(null);
  }

  function restMood() {
    if (fg) return;
    if (sleeping) { dog.mood('sleepy'); return; }
    const m = { musica: 'happy', bola: 'excited', figuras: 'excited', bolhas: 'excited', comida: 'hungry' }[mode];
    dog.mood(m || 'idle');
  }
  function goHome() { if (!dog.isHeld && Math.abs(dog.posX) > 6) dog.runTo(0, 520); }

  function sayOnce(ids) { if (!fg && !V.speaking) V.say(ids); }
  function pickNew(list, key) {
    let v = pick(list);
    if (list.length > 1 && v === lastSaid[key]) v = pick(list.filter((x) => x !== lastSaid[key]));
    lastSaid[key] = v;
    return v;
  }

  /* ================= Efeitos de alegria ================= */

  function joy(big) {
    const h = dog.headTop();
    fx.burst(h.x, h.y, { type: 'star', n: big ? 22 : 12, speed: big ? 320 : 240 });
    if (big) fx.confetti(90);
  }
  function hearts(p, n) {
    fx.burst(p.x, p.y, { type: 'heart', n: n || 5, speed: 110, g: -70, up: 40, life: 1.4, size: 11, colors: ['#FF4D6D', '#FF7A9A', '#FF5DA2'] });
  }
  function crumbs(p) {
    fx.burst(p.x, p.y, { type: 'crumb', n: 12, speed: 170, g: 700, up: 60, life: 0.9, size: 6, colors: ['#C98A4B', '#E8B77A', '#8A5A2B', '#FFD08F'] });
  }
  function notes(n) {
    const m = dog.mouthPoint(), s = dog.scale();
    for (let i = 0; i < (n || 3); i++) fx.floatUp(m.x + (Math.random() - 0.5) * 260 * s, m.y - 40 * s, 'note', { color: pick(COLORS), size: 28 + Math.random() * 10 });
  }

  /* ================= A CRIANÇA FALOU (a qualquer momento) ================= */

  function remember(buf, info) {
    if (info && info.dur > 4.5) return;
    memory.push(buf);
    if (memory.length > 6) memory.shift();
  }

  function voiceStart() {
    lastChildAt = now();
    if (pOpen) return;
    if (listener) listener.onStart();
    if (sleeping) { dog.play('earTwitch'); return; }
    if (!fg) { dog.mood('listen'); dog.play('earPerk'); }
  }

  function voiceCancel() {
    if (listener) listener.onCancel();
    else if (!fg) restMood();
  }

  function onLevel(v, active, loud) {
    if (pOpen || !started) return;
    if (!sleeping) dog.hear(active, loud);
    if (!active) return;
    const n = now();
    if (!sleeping && n > nextWave) { // ondinhas saindo da orelha: "estou te ouvindo"
      nextWave = n + 170;
      const e = dog.earPoint(), s = dog.scale();
      fx.add({ type: 'wave', x: e.x - 10 * s, y: e.y, size: 10 + 8 * s, a0: Math.PI, max: 0.6, color: 'rgba(255,255,255,.95)' });
    }
    if (n < nextFx) return;
    if (mode === 'bolhas') { // a voz faz bolhas
      nextFx = n + 130;
      const S = ui.stageRect();
      fx.addBubble(S.left + S.width * (0.25 + Math.random() * 0.5), S.bottom - 10, { vy: -(120 + v * 220), vx: (Math.random() - 0.5) * 120, r: 20 + v * 40, grow: true });
    } else if (mode === 'musica') {
      nextFx = n + 160;
      const S = ui.stageRect();
      fx.floatUp(S.left + S.width * (0.2 + Math.random() * 0.6), S.bottom - 20, 'note', { color: pick(COLORS), size: 28 + v * 22, vy: -150 });
    }
  }

  function onUtterance(buf, info) {
    if (pOpen) return;
    F.store.countUtterance();
    remember(buf, info);
    lastChildAt = now(); calloutStep = 0; streak++;
    if (listener) { listener.onEnd(buf, info); return; }
    // comandos de voz: reconhece em paralelo enquanto ele repete a criança
    const cmd = commandsOn() ? F.cmd.recognize(buf) : null;
    if (sleeping) { sleepTalk(buf, info, cmd); return; }
    echoReact(buf, info, cmd);
  }
  const commandsOn = () => F.store.s.commands && F.cmd.ready && mode !== 'figuras';
  const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

  const REACTIONS = [
    { id: 'r_denovo', mood: 'excited', anim: 'hop' }, { id: 'r_mais', mood: 'excited', anim: 'hop' },
    { id: 'r_uau', mood: 'surprised', anim: 'surprise' }, { id: 'r_legal', mood: 'happy', anim: 'nod' },
    { id: 'r_eba', mood: 'happy', anim: 'jump' }, { id: 'r_risada', mood: 'laugh', anim: 'giggle' },
    { id: 'r_risinho', mood: 'laugh', anim: 'giggle' }, { id: 'r_adorei', mood: 'love', anim: 'wiggle' },
    { id: 'r_vozlinda', mood: 'love', anim: 'nod' }, { id: 'r_falamais', mood: 'excited', anim: 'earPerk' },
    { id: 'r_engracado', mood: 'laugh', anim: 'giggle' }, { id: 'r_bonito', mood: 'happy', anim: 'nod' },
    { id: 'r_isso', mood: 'happy', anim: 'hop' }, { id: 'r_muitobem', mood: 'proud', anim: 'jump' },
  ];
  const SILENT_FUN = ['hop', 'giggle', 'earFlap', 'spin', 'wiggle', 'shake'];

  // Repete a criança (estilo Tom) e reage. Depois a brincadeira atual continua sozinha.
  function echoReact(buf, info, cmd) {
    runFg('echo', async (t) => {
      const dancing = mode === 'musica';
      if (dancing) dog.setDance(false);
      dog.stopRun();
      dog.lookAtChild(3500);
      if (info.loud) { dog.mood('surprised'); dog.play('shake'); } else dog.mood('excited');
      await F.sound.playEcho(buf, 'normal');
      check(t);
      F.mic.suppress(250);
      joy(false);

      // entendeu um comando? então obedece (em vez da reação comum)
      const c = cmd ? await within(cmd, 900) : null;
      check(t);
      if (c) {
        if (dancing && mode === 'musica') dog.setDance(true);
        obey(c);
        return;
      }

      const inPlay = mode !== 'free' && mode !== 'bola';
      if (streak > 0 && streak % 6 === 0) {
        sfx.fanfare(); joy(true); dog.play('jump'); dog.mood('proud');
        await V.say('r_eba'); check(t);
      } else if (info.loud) {
        dog.mood('laugh');
        await V.say(pickNew(['r_barulhao', 'r_forte'], 'loud')); check(t);
      } else if (Math.random() < (inPlay ? 0.3 : 0.5)) {
        const rid = pickNew(REACTIONS.map((x) => x.id), 'react');
        const R = REACTIONS.find((r) => r.id === rid);
        dog.mood(R.mood); dog.play(R.anim);
        await V.say(R.id); check(t);
      } else {
        dog.mood(pick(['happy', 'laugh', 'excited']));
        const a = pick(SILENT_FUN);
        dog.play(a);
        if (a === 'giggle') sfx.giggle();
        await wait(t, 700);
      }
      dog.mood('listen');
      await wait(t, 700);
      if (dancing && mode === 'musica') dog.setDance(true);
      if (task && task.afterEcho) task.afterEcho();
    });
  }

  /* ================= Criança quieta: imitar as falas dela ================= */

  const SEQ_MEM = ['replay:normal', 'prompt', 'replay:grosso', 'getter', 'replay:canta', 'prompt', 'replay:fino', 'getter', 'replay:eco', 'replay:duplo'];
  const SEQ_NOMEM = ['prompt', 'getter', 'prompt', 'getter', 'prompt', 'getter', 'prompt', 'getter'];

  function tickCallouts(n) {
    if (!F.store.s.callbacks || fg || listener || sleeping || dog.isHeld) return;
    if (mode !== 'free' && mode !== 'bola') return;
    const last = Math.max(lastChildAt, lastTouchAt, lastDogAt);
    const gap = memory.length ? (calloutStep === 0 ? 4500 : 7000) : (calloutStep === 0 ? 8000 : 10000);
    if (n - last < gap) return;
    const seq = memory.length ? SEQ_MEM : SEQ_NOMEM;
    if (calloutStep >= seq.length + 2) { if (mode === 'free') goNap(); return; }
    const a = seq[calloutStep % seq.length];
    calloutStep++;
    if (a.startsWith('replay')) replay(a.split(':')[1]);
    else if (a === 'prompt') promptChild();
    else getter();
  }

  function pickMemory() {
    if (!memory.length) return null;
    return Math.random() < 0.6 ? memory[memory.length - 1] : pick(memory);
  }

  function replay(variant) {
    const buf = pickMemory();
    if (!buf) { promptChild(); return; }
    runFg('replay', async (t) => {
      dog.lookAtChild(4000);
      dog.mood(variant === 'grosso' ? 'monster' : variant === 'canta' ? 'happy' : 'excited');
      dog.play(variant === 'grosso' ? 'hop' : 'tilt');
      await wait(t, 280);
      if (variant === 'canta') notes(4);
      if (variant === 'duplo') {
        await F.sound.playEcho(buf, 'normal'); check(t);
        dog.play('hop');
        await wait(t, 120);
        await F.sound.playEcho(buf, 'fino');
      } else {
        await F.sound.playEcho(buf, variant);
      }
      check(t);
      F.mic.suppress(250);
      if (variant === 'grosso') { dog.mood('laugh'); sfx.giggle(); await wait(t, 500); }
      dog.mood('listen'); dog.play('earPerk');
      await wait(t, 1500);
    });
  }

  const PROMPTS = [
    { id: 'p_falacomigo', anim: 'wave' }, { id: 'p_oi', anim: 'tilt' }, { id: 'p_cade', anim: 'peek' },
    { id: 'p_alguem', anim: 'tilt' }, { id: 'p_barulho', anim: 'hop' }, { id: 'p_uhu', anim: 'jump' },
    { id: 'p_ouvir', anim: 'earPerk' }, { id: 'p_vem', anim: 'wave' }, { id: 'p_lala', anim: 'wiggle', notes: true },
  ];
  function promptChild() {
    runFg('prompt', async (t) => {
      const pid = pickNew(PROMPTS.map((x) => x.id), 'prompt');
      const P = PROMPTS.find((p) => p.id === pid);
      dog.mood('excited'); dog.play(P.anim);
      if (P.notes) notes(4);
      await V.say(P.id); check(t);
      dog.mood('listen');
      await wait(t, 1500);
    });
  }

  function getter() {
    const options = ['bark', 'spin', 'flap', 'toy'];
    if (mode === 'free') options.push('peek', 'peek');
    const g = pickNew(options, 'getter');
    if (g === 'peek') { peekaboo(); return; }
    runFg('getter', async (t) => {
      if (g === 'bark') {
        dog.mood('excited'); dog.play('bark');
        await V.say('p_auau'); check(t);
        await wait(t, 250); dog.play('bark');
        await V.say('p_auau');
      } else if (g === 'spin') {
        dog.mood('happy'); dog.play('spin'); sfx.whoosh();
        await wait(t, 500);
        await V.say('p_uhu');
      } else if (g === 'flap') {
        dog.mood('laugh'); dog.play('earFlap'); sfx.up();
        await V.say('r_risada');
      } else {
        const toy = pick(['bola', 'comida', 'bolhas', 'musica', 'figuras']);
        ui.attract(toy);
        const c = ui.toyCenter(toy); dog.lookAt(c.x, c.y, 2500);
        dog.mood('excited'); dog.play('hop');
        await V.say('p_vem');
      }
      check(t);
      dog.mood('listen');
      await wait(t, 1300);
    });
  }

  // Esconde-esconde: qualquer som ou toque faz ele aparecer ("Achou!").
  function peekaboo() {
    runFg('peek', async (t) => {
      sfx.whoosh();
      dog.pose({ earL: -45, earR: 45, eye: 'closed', smile: 1.1 });
      await wait(t, 500);
      await V.say(pick(['c_cade', 'c_cade2'])); check(t);
      const r = await listen(t, 5500, { reveal: true });
      dog.pose(null); dog.mood('surprised'); dog.play('jump'); sfx.boing();
      joy(true);
      await V.say('c_achou'); check(t);
      dog.mood('laugh'); dog.play('giggle'); sfx.giggle();
      if (r.voiced && r.buf) { await wait(t, 200); await F.sound.playEcho(r.buf, 'normal'); check(t); }
      await wait(t, 700);
    });
  }

  /* ================= Soninho ================= */

  function goNap(goodnight) {
    sleeping = true; sleepKind = 'nap';
    runFg('nap', async (t) => {
      dog.play('yawn');
      await wait(t, 500);
      await V.say('s_soninho'); check(t);
      if (goodnight) { dog.mood('love'); await V.say('s_boanoite'); check(t); }
      dog.mood('sleepy'); dog.setSleep(true);
      await wait(t, 300);
    });
  }

  function wakeNap(thenEcho) {
    sleeping = false; sleepKind = null; dog.setSleep(false); calloutStep = 0;
    runFg('wake', async (t) => {
      dog.mood('surprised'); dog.play('stretch'); sfx.up();
      await wait(t, 900);
      dog.mood('happy'); dog.play('jump'); sfx.boing();
      await V.say('s_acordei'); check(t);
      if (thenEcho) {
        dog.mood('excited');
        await F.sound.playEcho(thenEcho, 'normal'); check(t);
        joy(false);
      }
      await wait(t, 400);
    });
  }

  function sleepTalk(buf, info, cmd) {
    if (sleepKind === 'bed' && !info.loud) {
      // falou baixinho: ele repete sonolento e volta a dormir (a não ser que tenha ouvido "acorda")
      runFg('sleeptalk', async (t) => {
        dog.setSleep(false); dog.mood('happy');
        await F.sound.playEcho(buf, 'normal'); check(t);
        const c = cmd ? await within(cmd, 900) : null;
        check(t);
        if (c && c.id === 'acorda') { showHeard(c); if (task && task.wake) task.wake(); return; }
        dog.mood('sleepy'); dog.setSleep(true);
        await V.say('s_hmm');
      });
      return;
    }
    if (sleepKind === 'bed') { if (task && task.wake) task.wake(buf); return; }
    wakeNap(buf);
  }

  /* ================= Comandos de voz (a lista fica em js/commands.js e nas opções) ================= */

  let pendingKick = false, forcedFood = null;

  function showHeard(c) {
    ui.heard(c.phrase || c.cmd.say);
    F.store.countWord(c.phrase);
  }

  function obey(c) {
    showHeard(c);
    setTimeout(() => runCommand(c.id), 0); // depois que a repetição termina
  }

  // Ações simples: animação + fala, sem trocar de brincadeira.
  const SIMPLE = {
    bravo: async (t) => {
      dog.mood('angry'); dog.play('growl'); sfx.growl();
      await V.say('cmd_bravo'); check(t);
      await wait(t, 600);
      dog.mood('laugh'); dog.play('giggle'); sfx.giggle();
      await V.say('cmd_brincadeira');
    },
    pula: async (t) => {
      dog.mood('excited'); dog.play('jump'); sfx.boing();
      await wait(t, 760); dog.play('jump'); sfx.boing();
      await V.say('t_pula');
    },
    senta: async (t) => { dog.mood('proud'); dog.play('sit'); await V.say('cmd_senta'); await wait(t, 500); },
    late: async (t) => {
      dog.mood('excited'); dog.play('bark'); await V.say('p_auau'); check(t);
      await wait(t, 200); dog.play('bark'); await V.say('p_auau');
    },
    gira: async (t) => { dog.mood('happy'); dog.play('spin'); sfx.whoosh(); await wait(t, 700); await V.say('t_uii'); },
    rola: async (t) => { dog.mood('laugh'); dog.play('roll'); sfx.whoosh(); await wait(t, 1100); sfx.boing(); await V.say('cmd_rolei'); },
    pata: async (t) => {
      dog.mood('excited'); dog.play('highfive');
      await wait(t, 330); sfx.clap(); const p = dog.pawPoint(); fx.burst(p.x, p.y, { type: 'star', n: 12, speed: 220 });
      await V.say('t_tocaaqui');
    },
    beijo: async (t) => { dog.mood('love'); dog.play('kiss'); sfx.kiss(); setTimeout(() => hearts(dog.mouthPoint(), 6), 250); await V.say('t_beijo'); },
    abraco: async (t) => { dog.mood('love'); dog.play('hug'); hearts(dog.bellyPoint(), 9); await V.say('w_abraco'); await wait(t, 700); },
    oi: async (t) => { dog.mood('excited'); dog.play('wave'); await V.say('oi'); },
    tchau: async (t) => { dog.mood('happy'); dog.play('wave'); await V.say('w_tchau'); },
    canta: async (t) => { dog.mood('happy'); dog.play('wiggle'); notes(6); await V.say('p_lala'); notes(4); await wait(t, 400); },
    ri: async (t) => { dog.mood('laugh'); dog.play('giggle'); sfx.giggle(); await V.say('r_risada'); },
    lingua: async (t) => { dog.mood('pant'); dog.play('lick'); await V.say('cmd_lingua'); await wait(t, 1300); },
    espirra: async (t) => {
      dog.mood('surprised'); dog.play('sneeze');
      await wait(t, 380); await V.say('t_atchim'); check(t);
      const n = dog.nosePoint(); fx.burst(n.x, n.y, { type: 'drop', n: 12, speed: 230, g: 420, up: 30, life: 0.7, size: 4 });
      dog.mood('laugh'); await V.say('r_risinho');
    },
    coca: async (t) => { dog.mood('happy'); dog.play('scratch'); await V.say('cmd_coceira'); await wait(t, 700); },
    vem: async (t) => {
      if (Math.abs(dog.posX) > 6) { dog.mood('excited'); await dog.runTo(0, 650); check(t); }
      dog.mood('love'); dog.play('come'); await V.say('cmd_vem'); await wait(t, 1000);
    },
    corre: async (t) => {
      dog.mood('excited'); V.say('cmd_correndo');
      const hw = dog.halfWidth();
      await dog.runTo(hw * 0.7, 720); check(t);
      await dog.runTo(-hw * 0.7, 720); check(t);
      await dog.runTo(0, 620); check(t);
      dog.mood('pant'); await wait(t, 1300);
    },
    acorda: async (t) => { dog.mood('excited'); dog.play('hop'); await V.say('cmd_acordado'); },
  };

  function runCommand(id) {
    if (!started || pOpen) return;
    touched();
    const wakeQuiet = () => { if (sleeping && sleepKind === 'nap') { sleeping = false; sleepKind = null; dog.setSleep(false); } };

    if (id === 'acorda' && sleeping) { if (sleepKind === 'bed') { if (task && task.wake) task.wake(); } else wakeNap(); return; }
    if (id === 'dorme') {
      if (sleeping) return;
      if (task && mode !== 'dormir') { stopMode(); goHome(); }
      goNap(true);
      return;
    }
    wakeQuiet();
    if (id === 'biscoito') {
      forcedFood = 'biscoito';
      if (mode === 'comida' && task) task.again();
      else { cancelFg(true); dog.mood('hungry'); startMode('comida', MODES.comida); }
      return;
    }
    if (id === 'bola') {
      if (mode === 'bola' && task) task.again();
      else { pendingKick = true; cancelFg(true); startMode('bola', MODES.bola); }
      return;
    }
    if (id === 'danca' || id === 'bolhas') {
      const m = id === 'danca' ? 'musica' : 'bolhas';
      if (mode === m && task) task.again();
      else { cancelFg(true); startMode(m, MODES[m]); }
      return;
    }
    if (id === 'esconde') { peekaboo(); return; }
    const fn = SIMPLE[id];
    if (fn) runFg('cmd', fn);
  }

  /* ================= Toques ================= */

  const REACT = {
    head: { mood: 'love', fx() { sfx.giggle(); hearts(dog.headTop(), 6); dog.play('nod'); }, lines: ['t_carinho', 't_gostoso'] },
    ear: { mood: 'laugh', fx() { dog.play('earFlap'); sfx.up(); }, lines: ['t_orelha', 'r_risada'] },
    nose: {
      mood: 'surprised', delay: 380,
      fx() {
        dog.play('sneeze');
        setTimeout(() => { const n = dog.nosePoint(); fx.burst(n.x, n.y, { type: 'drop', n: 12, speed: 230, g: 420, up: 30, life: 0.7, size: 4 }); dog.mood('laugh'); }, 520);
      },
      lines: ['t_atchim'], after: 'r_risinho',
    },
    eye: { mood: 'happy', fx() { dog.play('wink'); sfx.blip(); }, lines: ['t_pisca'] },
    mouth: { mood: 'love', delay: 300, fx() { dog.play('kiss'); sfx.kiss(); setTimeout(() => hearts(dog.mouthPoint(), 5), 250); }, lines: ['t_beijo'] },
    belly: { mood: 'laugh', fx() { dog.play('giggle'); sfx.giggle(); }, lines: ['t_cocegas', 'r_risada'] },
    body: { mood: 'laugh', fx() { dog.play('giggle'); sfx.giggle(); }, lines: ['t_cocegas', 'r_risinho'] },
    paw: {
      mood: 'excited', delay: 330,
      fx() { dog.play('highfive'); setTimeout(() => { sfx.clap(); const p = dog.pawPoint(); fx.burst(p.x, p.y, { type: 'star', n: 10, speed: 200 }); }, 320); },
      lines: ['t_tocaaqui'],
    },
    feet: { mood: 'excited', fx() { dog.play('jump'); sfx.boing(); }, lines: ['t_pula', 't_boing'] },
    tail: { mood: 'happy', fx() { dog.play('spin'); sfx.whoosh(); }, lines: ['t_rabinho', 't_uii'] },
  };

  function touched() { lastTouchAt = now(); calloutStep = 0; }

  function tapPart(part) {
    if (!started || pOpen) return;
    touched();
    if (listener && listener.reveal) { listener.done({ voiced: false, tapped: true }); return; }
    if (sleeping) {
      if (sleepKind === 'bed') { if (task && task.wake) task.wake(); }
      else wakeNap();
      return;
    }
    const R = REACT[part] || REACT.belly;
    if (fg && fg.name === 'tap' && now() - fg.started < 800) { R.fx(); dog.mood(R.mood); return; }
    runFg('tap', async (t) => {
      dog.mood(R.mood); R.fx();
      await wait(t, R.delay || 90);
      await V.say(pickNew(R.lines, 'tap-' + part)); check(t);
      if (R.after) { await V.say(R.after); check(t); }
      await wait(t, 500);
    });
  }

  let petting = false, petLast = 0;
  function petStart() {
    if (!started || pOpen || sleeping) return;
    touched(); petting = true;
    runFg('pet', async (t) => {
      dog.mood('love'); sfx.giggle();
      while (petting) { check(t); await new Promise((r) => setTimeout(r, 80)); }
      await V.say(pickNew(['t_carinho', 't_gostoso'], 'pet'));
      await wait(t, 400);
    });
  }
  function petMove(x, y) {
    if (!petting) return;
    touched();
    const n = now();
    if (n - petLast > 110) {
      petLast = n;
      fx.burst(x, y - 20, { type: 'heart', n: 1, speed: 40, g: -90, up: 60, life: 1.2, size: 12, colors: ['#FF4D6D', '#FF7A9A', '#FF5DA2'] });
    }
    dog.lookAt(x, y, 600);
  }
  function petEnd() { petting = false; touched(); }

  // Pegar o cachorro no colo (arrastar o corpo).
  function grabDog(x, y) {
    if (!started || pOpen) return;
    touched();
    if (sleeping) { if (sleepKind === 'bed') { if (task && task.wake) task.wake(); } else { sleeping = false; sleepKind = null; dog.setSleep(false); } }
    dog.grab(x, y);
    sfx.pickup();
    runFg('held', async (t) => {
      dog.mood('held');
      V.say(pickNew(['t_uii', 't_voando'], 'held'));
      while (dog.isHeld || dog.isFalling) { check(t); await new Promise((r) => setTimeout(r, 50)); }
      dog.mood(Math.random() < 0.35 ? 'dizzy' : 'laugh');
      if (Math.random() < 0.65) await V.say(pickNew(['t_boing', 't_opa', 'r_risada'], 'land'));
      check(t);
      await wait(t, 600);
      if (mode === 'free' && Math.abs(dog.posX) > 6) { dog.mood('happy'); await dog.runTo(0, 440); }
    });
  }
  function dragDog(x, y) { dog.drag(x, y); touched(); }
  function releaseDog() { dog.release(); touched(); }
  dog.onLand = (k) => {
    sfx.boing();
    const g = dog.groundY(), x = dog.screenX();
    fx.burst(x, g, { type: 'spark', n: 10, speed: 160 + 200 * k, g: 300, up: 60, life: 0.5, size: 5, colors: ['#fff', '#E8F5D0', '#C8E6A0'] });
  };

  let noteIdx = 0;
  function tapBackground(x, y) {
    if (!started || pOpen) return;
    touched();
    fx.burst(x, y, { type: 'star', n: 7, speed: 180, life: 0.8, size: 10 });
    noteIdx = (noteIdx + 1 + Math.floor(Math.random() * 3)) % 9;
    sfx.note(noteIdx);
    if (!sleeping) dog.lookAt(x, y, 1800);
    if (!fg && !sleeping && mode === 'free' && Math.random() < 0.25) dog.play(pick(['hop', 'tilt', 'earTwitch']));
  }

  function tapCard() {
    touched();
    if (mode !== 'figuras' || !task) return;
    task.skip = true;
    if (listener && listener.t === task) listener.done({ voiced: false, skipped: true });
    if (!fg) V.stop();
  }

  function bubblePopped() {
    touched();
    if (mode === 'bolhas' && task && task.popped) task.popped();
  }

  /* ================= Brinquedos ================= */

  function pressToy(name) {
    if (!started || pOpen) return;
    touched();
    if (sleeping && sleepKind === 'nap') { sleeping = false; sleepKind = null; dog.setSleep(false); }
    if (task && mode === name) {
      if (task.again) { task.again(); return; }
      stopMode(); cancelFg(); restMood(); goHome();
      return;
    }
    cancelFg(true);
    startMode(name, MODES[name]);
  }

  /* ----- Bola: joga, ele corre atrás, pega e traz de volta ----- */
  async function modeBola(t) {
    const S = ui.stageRect();
    let st = 'wait', stT = now(), lastPrompt = now(), jumpLock = 0, offAt = 0, promptN = 0;
    t.onCancel(() => { ball.remove(); ball.onEvent = null; dog.stopRun(); });
    ball.spawn(S.left + S.width * 0.2, S.top + S.height * 0.25, 120, 0);
    ball.onEvent = (ev, arg) => {
      if (ev === 'bounce') sfx.bounce(arg);
      else if (ev === 'grab') { st = 'child'; dog.stopRun(); dog.mood('excited'); touched(); }
      else if (ev === 'throw') { st = 'chase'; stT = now(); touched(); dog.mood('excited'); if (Math.random() < 0.3) sayOnce('b_lavou'); }
      else if (ev === 'drop') { st = 'wait'; stT = now(); touched(); }
      else if (ev === 'gone') { if (st === 'chase' || st === 'wait') { st = 'fetchOff'; offAt = 0; } }
    };
    const kick = () => {
      const b = ball.B;
      if (b.state !== 'free') return;
      dog.play('hop'); sfx.boing();
      ball.launch((b.x < innerWidth / 2 ? 1 : -1) * (300 + Math.random() * 300), -1000 - Math.random() * 250);
      st = 'chase'; stT = now();
    };
    t.again = () => { if (ball.B.state === 'free') kick(); else if (ball.B.state === 'mouth') { st = 'return'; } };
    t.afterEcho = () => { if (st === 'wait') kick(); }; // falou → ele joga a bola para o alto e vai atrás

    dog.mood('excited');
    await say(t, 'b_bola');

    for (;;) {
      await frame(t);
      if (fg || dog.isHeld || dog.isFalling) continue;
      const b = ball.B, n = now(), s = dog.scale();
      if (pendingKick && st === 'wait' && b.state === 'free' && b.rest) { pendingKick = false; kick(); continue; } // comando "pega a bola"
      if (st === 'wait' || st === 'child') {
        dog.lookAt(b.x, b.y, 400);
        if (st === 'wait' && n - lastPrompt > 7000 && n - stT > 3500) {
          lastPrompt = n; promptN++;
          if (promptN % 3 === 0) kick();
          else { dog.play('hop'); sayOnce(pick(['b_joga', 'b_joga2'])); }
        }
        if (st === 'wait' && n - lastTouchAt > 120000) return;
      } else if (st === 'chase') {
        if (b.state === 'free') {
          dog.steer(dog.toPosX(b.x), 780);
          const m = dog.mouthPoint();
          const dx = b.x - m.x, dy = b.y - m.y;
          if (Math.hypot(dx, dy) < b.r + 40 * s) {
            ball.attachMouth(); sfx.pop(); fx.burst(m.x, m.y, { type: 'star', n: 12, speed: 220 });
            dog.mood('happy');
            if (Math.random() < 0.6) sayOnce(pick(['b_peguei', 'b_oba']));
            st = 'return'; stT = n;
          } else if (Math.abs(dx) < 80 * s && dy < -10 && dy > -300 * s && b.vy > -250 && n > jumpLock) {
            dog.play('jump'); jumpLock = n + 850;
          } else if (b.rest && Math.abs(dx) < 40 * s) {
            dog.play('snap'); ball.attachMouth(); sfx.pop();
            if (Math.random() < 0.5) sayOnce('b_peguei');
            st = 'return'; stT = n;
          }
        } else if (b.state === 'gone') { st = 'fetchOff'; offAt = 0; }
      } else if (st === 'fetchOff') {
        const hw = dog.halfWidth();
        dog.steer(b.side * (hw * 2 + 260), 900);
        if (Math.abs(dog.posX) > hw * 2 + 200) {
          if (!offAt) offAt = n;
          if (n - offAt > 700) { ball.attachMouth(); st = 'return'; stT = n; sayOnce('b_achei'); }
        }
      } else if (st === 'return') {
        if (b.state !== 'mouth') { st = 'chase'; continue; }
        dog.steer(0, 620);
        if (Math.abs(dog.posX) < 3 && n - stT > 400) {
          dog.stopRun();
          ball.launch(0, -250);
          if (Math.random() < 0.5) sayOnce('b_toma');
          st = 'wait'; stT = n; lastPrompt = n;
        }
      }
    }
  }

  /* ----- Comida: aparece, ele pede, a criança arrasta até a boca (ou ele pega sozinho) ----- */
  const FOODS = [
    ['🦴', 'osso'], ['🍎', 'maca'], ['🍌', 'banana'], ['🍪', 'biscoito'], ['🥕', 'cenoura'], ['🍉', 'melancia'],
    ['🧀', 'queijo'], ['🍓', 'morango'], ['🍞', 'pao'], ['🍇', 'uva'], ['🍕', 'pizza'], ['🥛', 'leite'], ['🎂', 'bolo'], ['🥚', 'ovo'],
  ];
  let lastFood = '';
  async function modeComida(t) {
    const foods = [], requests = [];
    let eaten = 0, lastEatAt = now(), eating = false;
    t.onCancel(() => foods.forEach((f) => f.el.remove()));

    const spot = (i) => {
      const S = ui.stageRect();
      return [{ x: S.left + S.width * 0.17, y: S.top + S.height * 0.36 }, { x: S.left + S.width * 0.83, y: S.top + S.height * 0.36 }, { x: S.left + S.width * 0.5, y: S.top + S.height * 0.13 }][i % 3];
    };
    t.again = () => {
      if (foods.length >= 3) { dog.play('hop'); return; }
      const forced = forcedFood ? FOODS.find((x) => x[1] === forcedFood) : null;
      forcedFood = null;
      let d = forced || pick(FOODS);
      while (!forced && d[1] === lastFood) d = pick(FOODS);
      lastFood = d[1];
      const from = ui.toyCenter('comida');
      const S = ui.stageRect();
      const el = ui.prop(d[0], from.x, from.y, Math.min(96, S.width * 0.24), 'bob food');
      const used = foods.map((f) => f.slot);
      const slot = [0, 1, 2].find((i) => !used.includes(i));
      const f = { el, id: d[1], state: 'fly', slot, hoverAt: 0, wait: forced ? 2200 : 5000 };
      el._food = f;
      foods.push(f);
      sfx.up();
      ui.tween(el, spot(slot), 620, { arc: -140, s0: 0.4, s1: 1, ease: backOut }).then(() => { if (f.state === 'fly') { f.state = 'hover'; f.hoverAt = now(); } });
      dog.mood('hungry'); dog.lookAtEl(el, 2500);
      t.announce = forced ? 'cmd' : d[1];
    };
    t.request = (f) => { if (f && f.state !== 'eating' && !requests.includes(f)) requests.push(f); };
    t.foods = foods;
    t.spot = spot;
    t.afterEcho = () => { const f = foods.find((x) => x.state === 'hover'); if (f) t.request(f); };

    t.again();
    for (;;) {
      await frame(t);
      if (fg) continue;
      const n = now();
      if (t.announce && !V.speaking && !eating) {
        const w = t.announce; t.announce = null;
        await say(t, w === 'cmd' ? ['f_fome', 'cmd_biscoito'] : Math.random() < 0.7 ? `w_${w}` : ['f_meda', `w_${w}`]);
        continue;
      }
      const auto = foods.find((f) => f.state === 'hover' && n - f.hoverAt > f.wait);
      if (auto) t.request(auto);
      if (requests.length && !eating) {
        const f = requests.shift();
        if (!foods.includes(f)) continue;
        eating = true;
        f.state = 'eating';
        foods.splice(foods.indexOf(f), 1);
        dog.pose({ mouth: 0.85, eyeS: 1.15, brow: 10, tongue: 0 });
        sfx.whoosh();
        f.el.classList.remove('bob', 'grabbed');
        await ui.tween(f.el, () => dog.mouthPoint(), 420, { s1: 0.35, ease: easeIn });
        f.el.remove(); dog.pose(null);
        sfx.munch(); dog.play('chew'); crumbs(dog.mouthPoint()); dog.mood('love');
        eaten++; lastEatAt = now();
        await wait(t, 350);
        await say(t, pick(['f_nham', 'f_delicia', 'f_gostoso']));
        if (eaten % 3 === 0 && Math.random() < 0.7) {
          await wait(t, 300); sfx.burp(); dog.play('burp');
          await wait(t, 700); dog.mood('laugh'); sfx.giggle();
          await say(t, 'f_desculpa');
        } else if (!foods.length && Math.random() < 0.6) {
          ui.attract('comida'); dog.play('hop');
          await say(t, 'r_mais');
        }
        dog.mood('hungry');
        eating = false;
      }
      if (!foods.length && !eating && n - lastEatAt > 9000) {
        dog.mood('happy');
        await say(t, eaten >= 3 ? 'f_cheio' : 'f_obrigado');
        return;
      }
    }
  }

  // Arrastar comida até a boca.
  function grabFood(el) {
    const f = el._food;
    if (!f || mode !== 'comida' || !task || f.state === 'eating') return null;
    touched();
    f.state = 'held'; el.classList.add('grabbed');
    dog.mood('hungry'); dog.lookAtEl(el, 3000);
    return f;
  }
  function moveFood(f, x, y) { if (!f) return; ui.setPos(f.el, x, y, 1.1, 0); dog.lookAt(x, y, 800); }
  function releaseFood(f, tapped) {
    if (!f || !task || mode !== 'comida') return;
    f.el.classList.remove('grabbed');
    const m = dog.mouthPoint();
    if (tapped || Math.hypot(f.el._x - m.x, f.el._y - m.y) < 110 * Math.max(0.7, dog.scale())) { task.request(f); return; }
    f.state = 'fly';
    ui.tween(f.el, task.spot(f.slot), 400, { ease: backOut }).then(() => { if (f.state === 'fly') { f.state = 'hover'; f.hoverAt = now(); } });
  }

  /* ----- Bolhas: estoura com o dedo; a voz faz mais bolhas ----- */
  async function modeBolhas(t) {
    let iv = 0, snapIv = 0, pops = 0, endAt = now() + 35000;
    t.onCancel(() => { clearInterval(iv); clearInterval(snapIv); fx.clearBubbles(true); });
    const fromMouth = (k) => {
      for (let i = 0; i < k; i++) setTimeout(() => {
        if (t.cancelled) return;
        const m = dog.mouthPoint();
        fx.addBubble(m.x + (Math.random() - 0.5) * 40, m.y, { r: 18 + Math.random() * 26, vy: -(90 + Math.random() * 80), vx: (Math.random() - 0.5) * 180, grow: true });
      }, i * 110);
    };
    t.again = () => { fromMouth(6); sfx.sparkle(); endAt = Math.max(endAt, now() + 20000); };
    t.popped = () => { pops++; if (pops % 7 === 0) sayOnce(pick(['bu_pop', 'bu_estoura'])); };
    t.afterEcho = () => fromMouth(5);

    dog.mood('excited'); sfx.sparkle(); fromMouth(7);
    iv = setInterval(() => {
      if (fg || fx.bubbleCount >= 12) return;
      const S = ui.stageRect();
      fx.addBubble(S.left + S.width * (0.12 + Math.random() * 0.76), S.bottom + 30);
    }, 650);
    snapIv = setInterval(() => {
      if (fg) return;
      const h = dog.headPoint(), s = dog.scale();
      if (fx.bubbleNear(h.x, h.y, 90 * s) >= 0) {
        dog.play('snap');
        setTimeout(() => { const j = fx.bubbleNear(h.x, h.y, 120 * s); if (j >= 0) fx.popBubble(j); }, 170);
      }
    }, 900);
    await say(t, 'bu_bolhas');
    let said = false;
    while (now() < endAt) {
      await wait(t, 500);
      if (!said && now() > endAt - 20000) { said = true; dog.play('hop'); await say(t, 'bu_assopra'); fromMouth(5); }
    }
    clearInterval(iv); clearInterval(snapIv);
    fx.clearBubbles(true);
    dog.mood('happy');
    await say(t, 'bu_acabou');
    dog.play('wave');
    await wait(t, 900);
  }

  /* ----- Música: dança no ritmo; dá para arrastar o cachorro dançando ----- */
  async function modeMusica(t) {
    let notesIv = 0;
    const off = () => { F.sound.stopMusic(); dog.setDance(false); ui.party(false); F.mic.musicMode = false; clearInterval(notesIv); };
    t.onCancel(off);
    ui.party(true);
    F.mic.musicMode = true;
    F.sound.playMusic('danca');
    dog.setDance(true); dog.mood('happy');
    notesIv = setInterval(() => { if (!fg) notes(1); }, 650);
    t.again = () => { dog.play('spin'); sfx.whoosh(); };
    await say(t, 'm_dancar');
    const lines = ['m_danca', 'p_lala', 'm_mexe', 'm_palmas', 'p_uhu', 'p_lala'];
    for (const id of lines) {
      await wait(t, 6000);
      await say(t, id);
      if (id === 'm_palmas') { sfx.clap(); await wait(t, 650); sfx.clap(); }
      if (id === 'p_uhu') dog.play('jump');
    }
    await wait(t, 4000);
    off();
    sfx.fanfare(); fx.confetti(90); dog.play('spin'); dog.mood('proud');
    await say(t, 'r_eba');
    sfx.clap();
    await wait(t, 800);
  }

  /* ----- Figuras: passam sozinhas; o cachorro fala e espera; tocar na figura passa para a próxima ----- */
  const WORDS = [
    ['bola', '⚽', ['BO', 'LA']], ['bebe', '👶', ['BE', 'BÊ']], ['carro', '🚗', ['CAR', 'RO'], 1], ['banana', '🍌', ['BA', 'NA', 'NA']],
    ['agua', '💧', ['Á', 'GUA']], ['mamae', '👩', ['MA', 'MÃE']], ['papai', '👨', ['PA', 'PAI']], ['vovo_f', '👵', ['VO', 'VÓ']],
    ['vovo_m', '👴', ['VO', 'VÔ']], ['uva', '🍇', ['U', 'VA']], ['bolo', '🎂', ['BO', 'LO']], ['sapato', '👟', ['SA', 'PA', 'TO']],
    ['lua', '🌙', ['LU', 'A']], ['sol', '☀️', ['SOL']], ['flor', '🌸', ['FLOR']], ['casa', '🏠', ['CA', 'SA']],
    ['peixe', '🐟', ['PEI', 'XE']], ['pe', '🦶', ['PÉ']], ['mao', '✋', ['MÃO']], ['nariz', '👃', ['NA', 'RIZ']],
    ['boca', '👄', ['BO', 'CA']], ['olho', '👀', ['O', 'LHO']], ['aviao', '✈️', ['A', 'VI', 'ÃO'], 1], ['trem', '🚂', ['TREM'], 1],
    ['estrela', '⭐', ['ES', 'TRE', 'LA']], ['balao', '🎈', ['BA', 'LÃO']], ['ovo', '🥚', ['O', 'VO']], ['pao', '🍞', ['PÃO']],
    ['leite', '🥛', ['LEI', 'TE']], ['maca', '🍎', ['MA', 'ÇÃ']], ['dente', '🦷', ['DEN', 'TE']], ['oi', '👋', ['OI']],
    ['tchau', '👋', ['TCHAU']], ['abraco', '🤗', ['A', 'BRA', 'ÇO']], ['beijo', '😘', ['BEI', 'JO'], 1], ['chuva', '🌧️', ['CHU', 'VA']],
    ['pipoca', '🍿', ['PI', 'PO', 'CA']], ['suco', '🧃', ['SU', 'CO']], ['moto', '🏍️', ['MO', 'TO'], 1], ['cama', '🛏️', ['CA', 'MA']],
    ['copo', '🥤', ['CO', 'PO']],
  ];
  const ANIMALS = [
    ['cachorro', '🐶', 'AU AU', 'ele'], ['gato', '🐱', 'MIAU', 'ele'], ['vaca', '🐮', 'MUUU', 'ela'], ['pato', '🦆', 'QUÁ QUÁ', 'ele'],
    ['galinha', '🐔', 'CÓ CÓ', 'ela'], ['porco', '🐷', 'ÓINC', 'ele'], ['ovelha', '🐑', 'MÉÉÉ', 'ela'], ['cavalo', '🐴', 'POCOTÓ', 'ele'],
    ['sapo', '🐸', 'CROÁC', 'ele'], ['leao', '🦁', 'ROAAAR', 'ele'], ['passarinho', '🐦', 'PIU PIU', 'ele'], ['abelha', '🐝', 'ZUM ZUM', 'ela'],
    ['galo', '🐓', 'COCORICÓ', 'ele'], ['macaco', '🐵', 'UH UH', 'ele'], ['lobo', '🐺', 'AUUUU', 'ele'], ['coruja', '🦉', 'UUU UUU', 'ela'],
  ];
  const LABEL = { vovo_f: 'vovó', vovo_m: 'vovô', agua: 'água', mamae: 'mamãe', bebe: 'bebê', pe: 'pé', mao: 'mão', aviao: 'avião', balao: 'balão', pao: 'pão', maca: 'maçã', abraco: 'abraço', leao: 'leão' };

  async function modeFiguras(t) {
    ui.cardMode(true);
    t.onCancel(() => ui.cardMode(false));
    const counts = F.store.stats.words;
    const words = WORDS.map((w) => ({ w, k: (counts[LABEL[w[0]] || w[0]] || 0) + Math.random() * 2.5 })).sort((a, b) => a.k - b.k).slice(0, 4).map((o) => o.w);
    const animals = shuffle(ANIMALS).slice(0, 3);
    const items = [];
    for (let i = 0; i < 4; i++) { if (words[i]) items.push({ kind: 'w', d: words[i] }); if (animals[i]) items.push({ kind: 'a', d: animals[i] }); }

    const sayC = async (ids) => { if (!t.skip) await say(t, ids); };
    let got = 0;
    for (const it of items) {
      t.skip = false;
      const isW = it.kind === 'w';
      const id = it.d[0];
      ui.showCard(isW ? { emoji: it.d[1], syl: it.d[2] } : { emoji: it.d[1], syl: [it.d[2]] });
      sfx.whoosh();
      await wait(t, 380);
      dog.lookAtEl(document.getElementById('card'), 9000);
      dog.mood('excited');
      if (isW) {
        await sayC(['g_olha', `w_${id}`]);
        if (it.d[3]) { ui.cardWiggle(); await sayC(`x_${id}`); }
      } else {
        await sayC(`an_${id}`);
        ui.cardWiggle(); ui.runSyl(900);
        await sayC(`snd_${id}`);
      }
      let r = { skipped: true };
      if (!t.skip) {
        ui.cardListen(true); dog.mood('listen');
        r = await listen(t, 6500);
        if (!r.voiced && !r.skipped && !t.skip) {
          ui.cardWiggle(); dog.mood('excited');
          if (isW) { ui.runSyl(Math.max(300, 1100 / it.d[2].length)); await sayC(`ws_${id}`); }
          else { await sayC(`g_${it.d[3]}`); ui.runSyl(900); await sayC(`snd_${id}`); }
          if (!t.skip) { dog.mood('listen'); r = await listen(t, 5500); }
        }
        ui.cardListen(false);
      }
      if (r.voiced) {
        if (r.buf) { dog.mood('excited'); await F.sound.playEcho(r.buf, 'normal'); check(t); F.mic.suppress(250); }
        got++;
        ui.cardGood(); sfx.fanfare(); dog.play('jump'); dog.mood('proud');
        const c = ui.cardCenter(); fx.burst(c.x, c.y, { type: 'star', n: 18, speed: 320 });
        F.store.countWord(LABEL[id] || id);
        await say(t, ['r_isso', isW ? `w_${id}` : `snd_${id}`]);
        await wait(t, 500);
      } else if (!t.skip && !r.skipped) {
        ui.cardWiggle(); sfx.boing(); dog.play('hop'); dog.mood('happy');
        await sayC(isW ? `w_${id}` : `snd_${id}`);
        await wait(t, 300);
      } else {
        sfx.whoosh();
      }
      await ui.cardOut();
    }
    ui.cardMode(false);
    await wait(t, 350);
    dog.mood('proud'); dog.play('spin'); sfx.fanfare(); fx.confetti(got >= 3 ? 110 : 60);
    await say(t, got ? 'r_muitobem' : 'r_eba');
  }

  /* ----- Dormir: noite e canção de ninar; falar baixinho ele repete sonolento; toque ou grito acorda ----- */
  async function modeDormir(t) {
    let woke = false, wakeBuf = null;
    const off = () => { ui.night(false); F.sound.stopMusic(); F.mic.musicMode = false; sleeping = false; sleepKind = null; dog.setSleep(false); };
    t.onCancel(off);
    t.wake = (buf) => { woke = true; wakeBuf = buf || null; };
    ui.night(true);
    F.mic.musicMode = true;
    F.sound.playMusic('ninar', 90);
    dog.play('yawn');
    await wait(t, 900);
    dog.mood('sleepy');
    await say(t, 's_soninho');
    dog.mood('love');
    await say(t, 's_boanoite');
    dog.mood('sleepy'); sleeping = true; sleepKind = 'bed'; dog.setSleep(true);
    while (!woke) await wait(t, 200);
    off();
    dog.mood('surprised'); dog.play('stretch'); sfx.up();
    await wait(t, 1100);
    dog.mood('happy'); dog.play('jump'); sfx.boing();
    await say(t, 's_bomdia');
    if (wakeBuf) { dog.mood('excited'); await F.sound.playEcho(wakeBuf, 'normal'); check(t); joy(false); }
    await wait(t, 500);
  }

  const MODES = { bola: modeBola, comida: modeComida, bolhas: modeBolhas, musica: modeMusica, figuras: modeFiguras, dormir: modeDormir };

  /* ================= Borboleta ================= */
  const BF_SVG = '<svg viewBox="0 0 64 64" width="64" height="64"><g class="wing l"><ellipse cx="19" cy="24" rx="15" ry="13" fill="#FF8AC4" stroke="#B84A86" stroke-width="2.5"/><ellipse cx="22" cy="42" rx="10" ry="9" fill="#FFB86B" stroke="#B87A2E" stroke-width="2.5"/><circle cx="17" cy="22" r="4" fill="#fff" opacity=".7"/></g><g class="wing r"><ellipse cx="45" cy="24" rx="15" ry="13" fill="#FF8AC4" stroke="#B84A86" stroke-width="2.5"/><ellipse cx="42" cy="42" rx="10" ry="9" fill="#FFB86B" stroke="#B87A2E" stroke-width="2.5"/><circle cx="47" cy="22" r="4" fill="#fff" opacity=".7"/></g><ellipse cx="32" cy="33" rx="3.5" ry="14" fill="#5B3520"/><path d="M31,20 Q27,10 23,8 M33,20 Q37,10 41,8" stroke="#5B3520" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  const bf = { el: null, t0: 0, dur: 0, dir: 1, y0: 0, amp: 0, jumped: false, fleeing: false, fx: 0, fy: 0 };
  let nextButterfly = 0;

  function spawnButterfly() {
    const S = ui.stageRect();
    const el = document.createElement('div');
    el.className = 'prop butterfly';
    el.innerHTML = BF_SVG;
    document.getElementById('props').appendChild(el);
    Object.assign(bf, { el, t0: now(), dur: 11000, dir: Math.random() < 0.5 ? 1 : -1, y0: S.top + S.height * (0.16 + Math.random() * 0.2), amp: 30 + Math.random() * 40, jumped: false, fleeing: false });
  }
  function updateButterfly(n, dt) {
    if (!bf.el) {
      if (F.store.s.butterfly && mode === 'free' && !sleeping && n > nextButterfly) { nextButterfly = n + 30000 + Math.random() * 25000; spawnButterfly(); }
      return;
    }
    const W = innerWidth;
    let x, y;
    if (bf.fleeing) {
      bf.fx += bf.dir * 380 * dt; bf.fy -= 420 * dt;
      x = bf.fx; y = bf.fy;
      if (y < -80) { bf.el.remove(); bf.el = null; if (Math.random() < 0.5) sayOnce('w_tchau_borboleta'); return; }
    } else {
      const p = (n - bf.t0) / bf.dur;
      if (p >= 1) { bf.el.remove(); bf.el = null; return; }
      x = bf.dir > 0 ? -60 + (W + 120) * p : W + 60 - (W + 120) * p;
      y = bf.y0 + Math.sin(p * Math.PI * 5) * bf.amp + Math.sin(p * Math.PI * 13) * 10;
      if (!fg && !sleeping && mode === 'free') {
        dog.lookAt(x, y, 300);
        const h = dog.headPoint();
        if (!bf.jumped && Math.abs(x - h.x) < 50 && Math.random() < 0.02) { bf.jumped = true; if (Math.random() < 0.5) { dog.play('jump'); dog.mood('excited'); } }
      }
    }
    bf.x = x; bf.y = y;
    ui.setPos(bf.el, x, y, 1, Math.sin(n / 200) * 12);
  }
  function tapButterfly() {
    if (!bf.el || bf.fleeing) return;
    touched();
    bf.fleeing = true; bf.fx = bf.x; bf.fy = bf.y;
    sfx.flutter(); sfx.sparkle();
    fx.burst(bf.x, bf.y, { type: 'spark', n: 14, speed: 200, g: 0, up: 0, life: 0.6, size: 5, colors: ['#FF8AC4', '#FFB86B', '#fff'] });
    runFg('butterfly', async (t) => {
      dog.mood('excited'); dog.play('jump'); dog.lookAt(bf.x, bf.y, 1500);
      await V.say('w_borboleta'); check(t);
      await wait(t, 500);
    });
  }

  /* ================= Relógio ================= */

  const FIDGETS = ['earTwitch', 'tilt', 'sniff', 'scratch', 'hop', 'pant', 'wiggle', 'earTwitch', 'nod', 'lick'];
  function tick(n, dt) {
    if (!started || pOpen || document.hidden) return;
    updateButterfly(n, dt);
    if (n - lastChildAt > 30000) streak = 0;

    if (sleeping) {
      if (n > nextZ) {
        nextZ = n + 1300;
        const p = dog.headTop(), s = dog.scale();
        fx.floatUp(p.x + 70 * s, p.y, 'zzz', { color: sleepKind === 'bed' ? '#FFF3B0' : '#6677F0', size: 30, vy: -60 });
      }
      return;
    }
    tickCallouts(n);
    if (fg || mode !== 'free' || dog.isHeld || dog.isRunning) return;
    if (n > nextFidget) {
      nextFidget = n + 3500 + Math.random() * 4500;
      const f = pick(FIDGETS);
      if (f === 'pant') { dog.mood('pant'); setTimeout(() => { if (!fg && mode === 'free' && !sleeping) restMood(); }, 2600); }
      else dog.play(f);
    }
    if (n > nextAttract) { nextAttract = n + 12000 + Math.random() * 8000; ui.attract(); }
  }

  function start() {
    started = true;
    const n = now();
    lastDogAt = n; nextFidget = n + 6000; nextAttract = n + 9000; nextButterfly = n + 18000;
    V.preload(V.ids());
    runFg('intro', async (t) => {
      dog.pose({ y: 380 });
      await wait(t, 250);
      dog.pose(null); sfx.whoosh();
      await wait(t, 420);
      dog.play('jump'); sfx.boing();
      await wait(t, 600);
      dog.mood('excited'); dog.play('wave');
      await V.say('oi_henrique'); check(t);
      await wait(t, 500);
      dog.play('wave');
      await V.say('oi_brincar'); check(t);
      dog.mood('listen');
      await wait(t, 900);
      ui.attract('bola');
    });
  }

  function parentOpen(v) {
    pOpen = v;
    if (v) { cancelFg(); stopMode(); V.stop(); petting = false; }
    else touched();
  }

  function pause() { cancelFg(); stopMode(); petting = false; }
  function resume() { touched(); restMood(); goHome(); }

  return {
    start, tick, pressToy, tapPart, tapBackground, tapCard, tapButterfly, bubblePopped,
    petStart, petMove, petEnd, grabDog, dragDog, releaseDog, grabFood, moveFood, releaseFood,
    voiceStart, voiceCancel, onUtterance, onLevel, parentOpen, pause, resume, runCommand,
    get mode() { return mode; }, get fg() { return fg && fg.name; }, get sleeping() { return sleeping; },
    get memory() { return memory.length; },
  };
})();
