/**
 * Real-audio speech + waveform-driven lipsync.
 * Order: pre-generated neural clip (audio/<key>.mp3) → backend /api/tts → Web Speech (last resort).
 * Visemes are computed from the decoded AudioBuffer itself, so the mouth follows the actual sound.
 */
import { clearMouth } from './avatar.js';

export const API_BASE = (window.LILY_API_BASE || '').replace(/\/$/, '');
let manifest = null;
let unlocked = false;
let speaking = false;
let queue = Promise.resolve();
const bufCache = new Map();

export function keyFor(lang, text) {
  // FNV-1a 32bit, must match tools/gen_audio.py
  const bytes = new TextEncoder().encode(`${lang}|${text}`);
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

async function loadManifest() {
  if (manifest) return manifest;
  try { manifest = await (await fetch('./audio/manifest.json')).json(); } catch { manifest = {}; }
  return manifest;
}

export function unlockAudio() { unlocked = true; loadManifest(); }
export function isUnlocked() { return unlocked; }
export function isSpeaking() { return speaking; }

async function fetchBuffer(head, lang, text) {
  const k = keyFor(lang, text);
  if (bufCache.has(k)) return bufCache.get(k);
  const m = await loadManifest();
  let ab = null;
  if (m[k]) {
    try { const r = await fetch(`./audio/${k}.mp3`); if (r.ok) ab = await r.arrayBuffer(); } catch {}
  }
  if (!ab) {
    try {
      const r = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang })
      });
      if (r.ok && (r.headers.get('content-type') || '').includes('audio')) ab = await r.arrayBuffer();
    } catch {}
  }
  if (!ab) return null;
  const buf = await head.audioCtx.decodeAudioData(ab);
  bufCache.set(k, buf);
  return buf;
}

/** Derive viseme track from the real waveform (RMS + zero-crossing rate per 40 ms frame). */
export function visemesFromBuffer(buf) {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const step = Math.round(sr * 0.04);
  const frames = [];
  let peak = 1e-6;
  for (let i = 0; i < data.length; i += step) {
    let sum = 0, zc = 0;
    const end = Math.min(data.length, i + step);
    for (let j = i; j < end; j++) {
      sum += data[j] * data[j];
      if (j > i && (data[j] >= 0) !== (data[j - 1] >= 0)) zc++;
    }
    const rms = Math.sqrt(sum / (end - i));
    peak = Math.max(peak, rms);
    frames.push({ rms, zcr: zc / (end - i) });
  }
  const visemes = [], vtimes = [], vdurations = [];
  frames.forEach((f, idx) => {
    const lvl = f.rms / peak;
    let v = null;
    if (lvl < 0.07) v = null;                 // silence → mouth closes
    else if (f.zcr > 0.28) v = 'SS';
    else if (f.zcr > 0.18) v = 'FF';
    else if (lvl > 0.62) v = 'aa';
    else if (lvl > 0.42) v = idx % 2 ? 'O' : 'E';
    else if (lvl > 0.22) v = idx % 3 ? 'I' : 'U';
    else v = 'PP';
    const t = idx * 40;
    const n = visemes.length;
    if (v && n && visemes[n - 1] === v && vtimes[n - 1] + vdurations[n - 1] === t) vdurations[n - 1] += 40;
    else if (v) { visemes.push(v); vtimes.push(t); vdurations.push(40); }
  });
  return { visemes, vtimes, vdurations };
}

function playWebSpeech(text, lang, rate) {
  return new Promise((res) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
      u.rate = rate || (lang === 'zh' ? 0.95 : 0.8);
      u.onend = u.onerror = () => res();
      speechSynthesis.speak(u);
    } catch { res(); }
  });
}

async function speakNow({ text, lang = 'en', head, rate, onSubtitle }) {
  if (!text) return;
  speaking = true;
  try {
    if (head?.audioCtx?.state === 'suspended') await head.audioCtx.resume();
    const buf = head ? await fetchBuffer(head, lang, text) : null;
    onSubtitle && onSubtitle(text);
    const sub = document.getElementById('subtitle');
    if (sub) { sub.textContent = text; sub.classList.add('show'); }
    if (buf && head) {
      const vis = visemesFromBuffer(buf);
      const dur = buf.duration * 1000;
      head.speakAudio({ audio: buf, words: [text], wtimes: [0], wdurations: [dur], ...vis });
      await new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
          const el = performance.now() - t0;
          if ((el > dur + 120 && !head.isSpeaking) || el > dur + 4000) return resolve();
          setTimeout(tick, 80);
        };
        setTimeout(tick, dur);
      });
    } else {
      console.warn('no neural clip, Web Speech fallback:', text);
      await playWebSpeech(text, lang, rate);
    }
  } finally {
    speaking = false;
    clearMouth(head);
  }
}

export function speak(opts) {
  queue = queue.then(() => speakNow(opts)).catch(() => {});
  return queue;
}

export function stopSpeaking(head) {
  try { head?.stopSpeaking(); } catch {}
  try { speechSynthesis.cancel(); } catch {}
  queue = Promise.resolve();
  speaking = false;
}

export async function teachWord(head, word, praiseZh) {
  await speak({ text: word.en, lang: 'en', head });
  await speak({ text: `${word.zh}。${word.en}。`, lang: 'zh', head });
  if (praiseZh) await speak({ text: praiseZh, lang: 'zh', head });
}
