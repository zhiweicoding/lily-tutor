/**
 * TTS + boundary-driven lip sync (Web Speech API).
 * Prefer speakAudio when real audio is available; otherwise drive
 * mouth from utterance.onboundary (EN) / character schedule (ZH).
 * speakWithProvider() reserved for ElevenLabs/Azure later.
 */

import { clearMouth } from './avatar.js';

let unlocked = false;
let preferredEn = null;
let preferredZh = null;
let speaking = false;
let cancelToken = 0;
let mouthRaf = 0;

export function unlockAudio() {
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    speechSynthesis.cancel();
  } catch (_) {}
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const c = new Ctx();
      c.resume().then(() => c.close()).catch(() => {});
    }
  } catch (_) {}
  return unlocked;
}

export function isUnlocked() {
  return unlocked;
}

function pickVoices() {
  const voices = speechSynthesis.getVoices() || [];
  preferredEn =
    voices.find((v) => /en-US|en_US/i.test(v.lang) && /female|samantha|karen|moira|zira|aria|jenny|siri/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang) && /female|samantha|google us/i.test(v.name)) ||
    voices.find((v) => /^en-US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null;
  preferredZh =
    voices.find((v) => /zh-CN|zh_CN|cmn/i.test(v.lang) && /female|tingting|xiaoxiao|yaoyao|huihui|lili|mandarin|普通话|婷婷/i.test(v.name)) ||
    voices.find((v) => /zh-CN|zh_CN|cmn-Hans/i.test(v.lang) && !/yue|canton|粤|hong ?kong|sinji/i.test(v.name)) ||
    voices.find((v) => /zh-TW|zh_TW|cmn-Hant/i.test(v.lang) && !/yue|canton|粤|hong ?kong|sinji/i.test(v.name)) ||
    null;
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoices();
  speechSynthesis.onvoiceschanged = pickVoices;
}

/** Simple viseme openness for Latin letters / Chinese chars */
function opennessForToken(token, isZh) {
  if (!token) return 0.2;
  const t = token.toLowerCase();
  if (isZh) {
    // vowels / open syllables in pinyin-ish guess from char length alone
    return 0.28 + (token.charCodeAt(0) % 5) * 0.06;
  }
  if (/[aeiouáéíóú]/.test(t[0])) return 0.55;
  if (/[bpm]/.test(t[0])) return 0.12;
  if (/[fv]/.test(t[0])) return 0.18;
  if (/[tdnlsz]/.test(t[0])) return 0.28;
  if (/[kgcqx]/.test(t[0])) return 0.35;
  if (/[wy]/.test(t[0])) return 0.4;
  return 0.32;
}

function splitZhChars(text) {
  return [...text.replace(/\s+/g, '')].filter((c) => /[\u4e00-\u9fffa-zA-Z0-9]/.test(c));
}

function estimateZhSchedule(text, rate) {
  const chars = splitZhChars(text);
  const cps = 3.4 * rate;
  const each = Math.max(160, Math.round(1000 / cps));
  const events = [];
  let t = 60;
  for (const c of chars) {
    events.push({ at: t, token: c, open: opennessForToken(c, true), dur: Math.max(120, each - 40) });
    t += each;
  }
  return { events, durationMs: t + 160 };
}

function cancelMouthAnim() {
  if (mouthRaf) cancelAnimationFrame(mouthRaf);
  mouthRaf = 0;
}

function setMouth(head, open, smile = 0.2) {
  if (!head || !head.setFixedValue) return;
  try {
    head.setFixedValue('jawOpen', open);
    head.setFixedValue('mouthOpen', open * 0.85);
    head.setFixedValue('mouthSmile', smile);
  } catch (_) {}
}

/**
 * Drive mouth from a list of {at, open, dur} relative to speech start.
 */
function runMouthSchedule(head, events, durationMs, token) {
  cancelMouthAnim();
  const start = performance.now();
  const tick = () => {
    if (token !== cancelToken) {
      clearMouth(head);
      return;
    }
    const now = performance.now() - start;
    if (now > durationMs + 80) {
      clearMouth(head);
      return;
    }
    let open = 0.05;
    let smile = 0.2;
    for (const e of events) {
      if (now >= e.at && now < e.at + e.dur) {
        const local = (now - e.at) / e.dur;
        // attack / release envelope so lips don't look robotic
        const env = local < 0.15 ? local / 0.15 : local > 0.75 ? (1 - local) / 0.25 : 1;
        open = Math.max(open, e.open * env);
        smile = 0.12 + (1 - e.open) * 0.12;
        break;
      }
    }
    // tiny idle wobble while speaking
    open += Math.sin(now / 70) * 0.03;
    setMouth(head, Math.max(0, Math.min(0.75, open)), smile);
    mouthRaf = requestAnimationFrame(tick);
  };
  mouthRaf = requestAnimationFrame(tick);
}

/**
 * speakAudio with silent buffer + word timings (TalkingHead native lipsync).
 * Used when we have good word/char timings.
 */
function speakAudioLipsync(head, words, wtimes, wdurations, durationMs) {
  try {
    const ctx = head.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const sr = ctx.sampleRate || 22050;
    const len = Math.max(1, Math.floor((durationMs / 1000) * sr));
    const audio = ctx.createBuffer(1, len, sr);
    const ch = audio.getChannelData(0);
    for (let i = 0; i < Math.min(32, len); i++) ch[i] = (Math.random() - 0.5) * 1e-5;
    head.setMood && head.setMood('happy');
    head.speakAudio(
      { audio, words, wtimes, wdurations },
      { lipsyncLang: 'en', isRaw: false }
    );
    return true;
  } catch (err) {
    console.warn('speakAudio lipsync failed', err);
    return false;
  }
}

/**
 * Plug-in for paid TTS later:
 * speakWithProvider({ text, lang, audioUrl|audioBuffer, words, wtimes, wdurations })
 */
export async function speakWithProvider(_payload) {
  throw new Error('No external TTS provider configured yet.');
}

/**
 * Prefer real audio clip if registered; else Web Speech + boundary lipsync.
 */
const clipMap = new Map(); // key -> { url, words?, wtimes?, wdurations? }

export function registerClip(key, meta) {
  clipMap.set(key, meta);
}

export function speak({ text, lang = 'en', head = null, rate, pitch, onend, lipsync = true, clipKey = null }) {
  return new Promise(async (resolve) => {
    if (!text) {
      onend && onend();
      resolve();
      return;
    }
    cancelToken++;
    const myToken = cancelToken;
    speaking = true;
    cancelMouthAnim();
    clearMouth(head);

    const isZh = lang === 'zh' || String(lang).startsWith('zh');
    const r = rate ?? (isZh ? 0.92 : 0.72);
    const p = pitch ?? (isZh ? 1.05 : 1.12);

    // Optional pre-baked clip path (for later edge-tts assets)
    const clip = clipKey ? clipMap.get(clipKey) : clipMap.get(`${isZh ? 'zh' : 'en'}:${text}`);
    if (clip && clip.url && head && lipsync) {
      try {
        const ok = await playClipWithLipsync(head, clip, myToken);
        if (ok && myToken === cancelToken) {
          speaking = false;
          onend && onend();
          resolve();
          return;
        }
      } catch (e) {
        console.warn('clip playback failed, falling back', e);
      }
    }

    // --- Web Speech + boundary / schedule lipsync ---
    const zhSched = isZh ? estimateZhSchedule(text, r) : null;

    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = isZh ? 'zh-CN' : 'en-US';
      u.rate = r;
      u.pitch = p;
      u.volume = 1;
      if (isZh && preferredZh) u.voice = preferredZh;
      if (!isZh && preferredEn) u.voice = preferredEn;

      const boundaryEvents = [];
      let speechStart = 0;

      if (head && lipsync) {
        if (isZh && zhSched) {
          // Pre-schedule Chinese chars; refine if boundary fires
          const words = zhSched.events.map((e) => e.token);
          const wtimes = zhSched.events.map((e) => e.at);
          const wdurations = zhSched.events.map((e) => e.dur);
          speakAudioLipsync(head, words, wtimes, wdurations, zhSched.durationMs);
          runMouthSchedule(head, zhSched.events, zhSched.durationMs, myToken);
        } else {
          // English: collect onboundary word timings; also start a soft baseline schedule
          const words = text.trim().split(/\s+/).filter(Boolean);
          const estTotal = Math.max(700, Math.round((words.join('').length / (2.5 * r)) * 1000) + 400);
          const each = Math.max(200, Math.floor((estTotal - 100) / Math.max(1, words.length)));
          const baseline = words.map((w, i) => ({
            at: 80 + i * each,
            token: w,
            open: opennessForToken(w, false),
            dur: Math.max(160, each - 40)
          }));
          runMouthSchedule(head, baseline, estTotal, myToken);
          speakAudioLipsync(
            head,
            words,
            baseline.map((e) => e.at),
            baseline.map((e) => e.dur),
            estTotal
          );
        }
      }

      u.onboundary = (ev) => {
        if (myToken !== cancelToken || !head || !lipsync) return;
        // name === 'word' on most browsers; Safari may use char
        const name = (ev.name || '').toLowerCase();
        if (name && name !== 'word' && name !== 'sentence' && !isZh) {
          // ignore mark etc.
        }
        if (!speechStart) speechStart = performance.now();
        const at = typeof ev.charIndex === 'number' ? ev.charIndex : 0;
        let token = '';
        if (isZh) {
          token = text[at] || '';
        } else {
          const slice = text.slice(at);
          token = (slice.match(/^\S+/) || [''])[0];
        }
        const open = opennessForToken(token, isZh);
        // Immediate mouth punch on each boundary for tighter sync
        setMouth(head, open, 0.14);
        boundaryEvents.push({ at: performance.now() - (speechStart || performance.now()), open, dur: isZh ? 180 : 260, token });
      };

      u.onend = () => {
        if (myToken !== cancelToken) return;
        speaking = false;
        cancelMouthAnim();
        clearMouth(head);
        onend && onend();
        resolve();
      };
      u.onerror = () => {
        if (myToken !== cancelToken) return;
        speaking = false;
        cancelMouthAnim();
        clearMouth(head);
        onend && onend();
        resolve();
      };
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn(e);
      speaking = false;
      cancelMouthAnim();
      clearMouth(head);
      onend && onend();
      resolve();
    }
  });
}

async function playClipWithLipsync(head, clip, token) {
  const audioEl = new Audio(clip.url);
  audioEl.preload = 'auto';
  await new Promise((res, rej) => {
    audioEl.oncanplaythrough = () => res();
    audioEl.onerror = rej;
    audioEl.load();
  });
  const durationMs = (audioEl.duration || 1) * 1000;
  if (clip.words && clip.wtimes && clip.wdurations) {
    // Decode for speakAudio if possible
    try {
      const ctx = head.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      const buf = await (await fetch(clip.url)).arrayBuffer();
      const audio = await ctx.decodeAudioData(buf.slice(0));
      head.speakAudio(
        { audio, words: clip.words, wtimes: clip.wtimes, wdurations: clip.wdurations },
        { lipsyncLang: 'en' }
      );
    } catch (_) {
      const events = clip.words.map((w, i) => ({
        at: clip.wtimes[i],
        open: opennessForToken(w, false),
        dur: clip.wdurations[i],
        token: w
      }));
      runMouthSchedule(head, events, durationMs, token);
    }
  }
  await new Promise((res) => {
    audioEl.onended = res;
    audioEl.onerror = res;
    audioEl.play().catch(res);
  });
  clearMouth(head);
  return token === cancelToken;
}

export function stopSpeaking(head) {
  cancelToken++;
  speaking = false;
  cancelMouthAnim();
  clearMouth(head);
  try {
    speechSynthesis.cancel();
  } catch (_) {}
}

export function isSpeaking() {
  return speaking || speechSynthesis.speaking;
}

export async function teachWord(head, word, praiseZh) {
  await speak({ text: word.en, lang: 'en', head, rate: 0.65, pitch: 1.15 });
  await speak({ text: `${word.zh}。${word.en}。`, lang: 'zh', head, rate: 0.9, lipsync: true });
  if (praiseZh) {
    await speak({ text: praiseZh, lang: 'zh', head, rate: 0.95 });
  }
}
