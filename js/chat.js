/** Toddler ↔ Lily conversation. Speech → backend /api/chat (key lives only on the server) → neural TTS + lipsync. */
import { API_BASE } from './tts.js';

const history = [];

export function initChat({ getHead, speak, praiseGesture, listenPose, toast }) {
  const btn = document.getElementById('btnTalk');
  const label = document.getElementById('talkLabel');
  const status = document.getElementById('chatStatus');
  const log = document.getElementById('chatLog');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const add = (who, text) => {
    const d = document.createElement('div');
    d.className = `bubble ${who}`;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  };
  if (!SR) { status.textContent = '这个浏览器不支持语音识别，请用 iPhone Safari 或 Chrome。'; }
  let busy = false;

  async function reply(said) {
    add('kid', said);
    status.textContent = 'Lily 在想…';
    let data = null;
    try {
      const r = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: said, history: history.slice(-8) })
      });
      if (r.ok) data = await r.json();
    } catch {}
    if (!data) {
      status.textContent = 'AI 服务暂时连不上，Lily 先夸夸宝宝～';
      data = { en: 'Great job!', zh: '宝宝说得真好！', word: '' };
    } else status.textContent = '';
    history.push({ role: 'user', content: said }, { role: 'assistant', content: `${data.en} ${data.zh}` });
    add('lily', `${data.en}\n${data.zh}`);
    praiseGesture();
    const head = getHead();
    if (data.en) await speak({ text: data.en, lang: 'en', head });
    if (data.zh) await speak({ text: data.zh, lang: 'zh', head });
  }

  btn.onclick = () => {
    if (!SR || busy) return;
    busy = true;
    const rec = new SR();
    rec.lang = 'zh-CN';            // toddler mostly speaks Mandarin; English words still come through
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    btn.classList.add('listening');
    label.textContent = '我在听…';
    listenPose();
    let got = false;
    rec.onresult = (ev) => { got = true; const t = ev.results[0][0].transcript.trim(); if (t) reply(t).finally(() => { busy = false; }); else busy = false; };
    rec.onerror = (e) => { status.textContent = e.error === 'not-allowed' ? '请允许麦克风权限' : '没听清，再按一次说说看～'; };
    rec.onend = () => { btn.classList.remove('listening'); label.textContent = '跟老师说话'; if (!got) busy = false; };
    try { rec.start(); } catch { busy = false; toast('麦克风暂不可用'); }
  };
}
