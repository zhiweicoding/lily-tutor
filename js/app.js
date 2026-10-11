import { CATEGORIES, PRAISE_ZH, GREET_ZH, REST_ZH, loadProgress, markWordLearned, findWordByEn } from './vocab.js';
import { unlockAudio, speak, teachWord, stopSpeaking, isUnlocked } from './tts.js';
import { initAvatar, getHead, praiseGesture, waveGesture, listenPose, pauseAvatar } from './avatar.js';
import { initChat } from './chat.js';
import { loadDetector, startCamera, stopCamera, startDetectLoop } from './camera.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  mode: 'home', // home | learn | find | camera
  category: null,
  word: null,
  sessionStart: Date.now(),
  restShown: false,
  busy: false,
  listening: false
};

let recognition = null;

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function updateProgressUI() {
  const p = loadProgress();
  const n = Object.keys(p.words || {}).length;
  $('#progressBadge').textContent = `学会 ${n} 个词`;
}


function setNavActive(id) {
  $$('.nav button').forEach((b) => b.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  const map = { screenHome: 'btnHome', screenLearn: 'btnLearn', screenFind: 'btnFind', screenCamera: 'btnCamera', screenChat: 'btnChat' };
  if (map[id]) setNavActive(map[id]);
}

function randomPraise() {
  return PRAISE_ZH[Math.floor(Math.random() * PRAISE_ZH.length)];
}

function checkRest() {
  const mins = (Date.now() - state.sessionStart) / 60000;
  if (!state.restShown && mins >= 5) {
    state.restShown = true;
    $('#restModal').classList.add('show');
    const head = getHead();
    speak({ text: REST_ZH, lang: 'zh', head });
  }
}

async function bootAvatar() {
  const wrap = $('#avatar');
  const loading = $('#avatarLoading');
  try {
    await initAvatar(wrap, (pct) => {
      loading.textContent = `Lily 老师正在来… ${pct}%`;
    });
    loading.classList.add('hidden');
    waveGesture();
  } catch (err) {
    console.error(err);
    loading.textContent = '数字人加载失败，请检查网络后刷新。';
    loading.classList.add('error');
  }
}

async function onStart() {
  unlockAudio();
  $('#gate').classList.add('hidden');
  showScreen('screenHome');
  updateProgressUI();
  await bootAvatar();
  try {
    const h = getHead();
    if (h?.audioCtx?.state === 'suspended') await h.audioCtx.resume();
  } catch (_) {}
  const head = getHead();
  const greet = GREET_ZH[Math.floor(Math.random() * GREET_ZH.length)];
  await speak({ text: greet, lang: 'zh', head });
  await speak({ text: 'Hello! I am Lily.', lang: 'en', head, rate: 0.75 });
}

function renderCategories() {
  const box = $('#categoryGrid');
  box.innerHTML = CATEGORIES.map(
    (c) => `
    <button class="big-card" data-cat="${c.id}">
      <span class="emoji">${c.emoji}</span>
      <span class="label">${c.nameZh}</span>
    </button>`
  ).join('');
  box.onclick = (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    const cat = CATEGORIES.find((c) => c.id === btn.dataset.cat);
    openCategory(cat);
  };
}

function openCategory(cat) {
  state.category = cat;
  state.mode = 'learn';
  showScreen('screenLearn');
  $('#learnTitle').textContent = cat.nameZh;
  renderWordGrid(cat);
}

function renderWordGrid(cat) {
  const box = $('#wordGrid');
  box.innerHTML = cat.words
    .map((w) => {
      const bg = w.color ? `style="--card-accent:${w.color}"` : '';
      return `<button class="word-card" data-en="${w.en}" ${bg}>
        <span class="emoji">${w.emoji}</span>
        <span class="en">${w.en}</span>
        <span class="zh">${w.zh}</span>
      </button>`;
    })
    .join('');
  box.onclick = async (e) => {
    const btn = e.target.closest('[data-en]');
    if (!btn || state.busy) return;
    const word = cat.words.find((w) => w.en === btn.dataset.en);
    await teachOne(word);
  };
}

async function teachOne(word) {
  state.busy = true;
  state.word = word;
  checkRest();
  const head = getHead();
  $('#subtitle').textContent = `${word.emoji} ${word.en} · ${word.zh}`;
  $('#subtitle').classList.add('show');
  try {
    await teachWord(head, word, randomPraise());
    markWordLearned(word.en);
    updateProgressUI();
    praiseGesture();
    $('#repeatBar').classList.add('show');
  } finally {
    state.busy = false;
  }
}

function setupSpeechRec() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $('#btnRepeat').style.display = 'none';
    return;
  }
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;
  recognition.continuous = false;

  recognition.onresult = async (ev) => {
    state.listening = false;
    $('#btnRepeat').classList.remove('listening');
    const said = [...ev.results]
      .map((r) => r[0].transcript.toLowerCase())
      .join(' ');
    const target = (state.word?.en || '').toLowerCase();
    const head = getHead();
    // Always praise for toddlers
    praiseGesture();
    markWordLearned(state.word?.en || 'try');
    updateProgressUI();
    const hit = target && said.includes(target);
    if (hit) {
      await speak({ text: `Yes! ${state.word.en}!`, lang: 'en', head });
      await speak({ text: randomPraise(), lang: 'zh', head });
    } else {
      await speak({ text: `${randomPraise()}再跟 Lily 说一次。`, lang: 'zh', head });
      await speak({ text: state.word.en, lang: 'en', head });
    }
  };
  recognition.onerror = () => {
    state.listening = false;
    $('#btnRepeat').classList.remove('listening');
    // still praise attempt
    const head = getHead();
    speak({ text: '宝宝真棒！再试一次哦。', lang: 'zh', head });
    praiseGesture();
  };
  recognition.onend = () => {
    state.listening = false;
    $('#btnRepeat').classList.remove('listening');
  };
}

async function startListening() {
  if (!recognition || !state.word) {
    toast('请先点一个单词');
    return;
  }
  const head = getHead();
  listenPose();
  await speak({ text: `Say: ${state.word.en}`, lang: 'en', head, rate: 0.7 });
  try {
    state.listening = true;
    $('#btnRepeat').classList.add('listening');
    recognition.start();
  } catch (e) {
    toast('麦克风暂不可用');
  }
}

function renderFindGame() {
  state.mode = 'find';
  showScreen('screenFind');
  const all = CATEGORIES.flatMap((c) => c.words);
  const target = all[Math.floor(Math.random() * all.length)];
  state.word = target;
  $('#findPrompt').textContent = `找一找：${target.emoji} ${target.en}`;
  // 3 options including target
  const others = all.filter((w) => w.en !== target.en).sort(() => Math.random() - 0.5).slice(0, 2);
  const opts = [target, ...others].sort(() => Math.random() - 0.5);
  $('#findOptions').innerHTML = opts
    .map(
      (w) => `<button class="word-card" data-en="${w.en}"><span class="emoji">${w.emoji}</span><span class="en">${w.en}</span></button>`
    )
    .join('');
  const head = getHead();
  (async () => {
    await speak({ text: `Where is the ${target.en}?`, lang: 'en', head, rate: 0.75 });
    await speak({ text: `找一找${target.zh}`, lang: 'zh', head });
  })();

  $('#findOptions').onclick = async (e) => {
    const btn = e.target.closest('[data-en]');
    if (!btn || state.busy) return;
    state.busy = true;
    const pick = btn.dataset.en;
    praiseGesture();
    markWordLearned(target.en);
    updateProgressUI();
    if (pick === target.en) {
      await speak({ text: `Yes! ${target.en}!`, lang: 'en', head, rate: 0.75 });
      await speak({ text: randomPraise(), lang: 'zh', head });
    } else {
      await speak({ text: `这是${findWordByEn(pick)?.zh || pick}。`, lang: 'zh', head });
      await speak({ text: '我们再找一找。', lang: 'zh', head });
      await speak({ text: target.en, lang: 'en', head, rate: 0.65 });
    }
    state.busy = false;
    setTimeout(renderFindGame, 800);
  };
}

async function openCamera() {
  state.mode = 'camera';
  showScreen('screenCamera');
  const video = $('#camVideo');
  const status = $('#camStatus');
  try {
    status.textContent = '请求摄像头权限…';
    await loadDetector((m) => (status.textContent = m));
    await startCamera(video);
    status.textContent = '把东西对准镜头，Lily 会告诉你英文～';
    const head = getHead();
    await speak({ text: '给我看一样东西吧！', lang: 'zh', head });
    startDetectLoop(video, async (word) => {
      if (state.busy) return;
      state.busy = true;
      state.word = word;
      $('#subtitle').textContent = `${word.emoji || '✨'} ${word.en} · ${word.zh || ''}`;
      $('#subtitle').classList.add('show');
      status.textContent = `看到了：${word.en}`;
      try {
        await teachWord(head, word, randomPraise());
        markWordLearned(word.en);
        updateProgressUI();
        praiseGesture();
        $('#repeatBar').classList.add('show');
      } finally {
        state.busy = false;
      }
    });
  } catch (err) {
    console.error(err);
    status.textContent = '摄像头无法使用。请在系统设置允许摄像头，或换 Chrome 浏览器。';
    toast('摄像头权限被拒绝');
  }
}

function wireNav() {
  $('#btnHome').onclick = () => {
    stopCamera($('#camVideo'));
    stopSpeaking(getHead());
    state.mode = 'home';
    showScreen('screenHome');
    $('#repeatBar').classList.remove('show');
  };
  $('#btnLearn').onclick = () => {
    stopCamera($('#camVideo'));
    showScreen('screenHome');
  };
  $('#btnFind').onclick = () => {
    stopCamera($('#camVideo'));
    renderFindGame();
  };
  $('#btnCamera').onclick = () => openCamera();
  $('#btnChat').onclick = () => { stopCamera($('#camVideo')); showScreen('screenChat'); };
  $('#btnBackLearn').onclick = () => {
    showScreen('screenHome');
    $('#repeatBar').classList.remove('show');
  };
  $('#btnRepeat').onclick = () => startListening();
  $('#btnHearAgain').onclick = async () => {
    if (!state.word) return;
    await speak({ text: state.word.en, lang: 'en', head: getHead(), rate: 0.65 });
  };
  $('#restOk').onclick = () => {
    $('#restModal').classList.remove('show');
    state.sessionStart = Date.now();
    state.restShown = false;
  };
  $('#gateBtn').onclick = onStart;
}

document.addEventListener('visibilitychange', () => {
  pauseAvatar(document.visibilityState !== 'visible');
});

document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
  setupSpeechRec();
  wireNav();
  initChat({ getHead, speak, praiseGesture, listenPose, toast });
  updateProgressUI();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
