/**
 * TTS layer: Web Speech API first.
 * Structure allows plugging ElevenLabs / Azure later via speakWithProvider().
 *
 * For lip-sync: estimate word timings + silent AudioBuffer → TalkingHead.speakAudio
 * while speechSynthesis plays the real voice in parallel.
 */

let unlocked = false;
let preferredEn = null;
let preferredZh = null;
let speaking = false;
let cancelToken = 0;

export function unlockAudio() {
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    speechSynthesis.cancel();
  } catch (_) {}
  // Resume AudioContext if provided later
  return unlocked;
}

export function isUnlocked() {
  return unlocked;
}

function pickVoices() {
  const voices = speechSynthesis.getVoices() || [];
  preferredEn =
    voices.find((v) => /en-US|en_US/i.test(v.lang) && /female|samantha|karen|moira|zira|aria|jenny/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang) && /female|samantha|google us/i.test(v.name)) ||
    voices.find((v) => /^en-US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null;
  preferredZh =
    // Mandarin only (普通话): never Cantonese (zh-HK / yue) voices
    voices.find((v) => /zh-CN|zh_CN|cmn/i.test(v.lang) && /female|tingting|xiaoxiao|yaoyao|huihui|lili|mandarin|普通话/i.test(v.name)) ||
    voices.find((v) => /zh-CN|zh_CN|cmn-Hans/i.test(v.lang) && !/yue|canton|粤|hong ?kong|sinji/i.test(v.name)) ||
    voices.find((v) => /zh-TW|zh_TW|cmn-Hant/i.test(v.lang) && !/yue|canton|粤|hong ?kong|sinji/i.test(v.name)) ||
    null;
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoices();
  speechSynthesis.onvoiceschanged = pickVoices;
}

function estimateDurationMs(text, rate, lang) {
  const chars = text.replace(/\s+/g, '').length;
  // Slow toddler pacing
  const cps = lang.startsWith('zh') ? 3.2 : 2.4; // chars/syllables per sec at rate 1
  return Math.max(600, Math.round((chars / (cps * rate)) * 1000) + 350);
}

function splitWords(text, lang) {
  if (lang.startsWith('zh')) {
    // Treat short Chinese phrases as syllable-ish chunks of 1–2 chars
    const chars = [...text.replace(/\s+/g, '')];
    const words = [];
    for (let i = 0; i < chars.length; i += 1) {
      words.push(chars[i]);
    }
    return words.length ? words : [text];
  }
  return text.trim().split(/\s+/).filter(Boolean);
}

function buildTiming(text, lang, rate) {
  const words = splitWords(text, lang);
  const total = estimateDurationMs(text, rate, lang);
  const wtimes = [];
  const wdurations = [];
  let t = 80;
  const each = Math.max(180, Math.floor((total - 160) / Math.max(1, words.length)));
  for (let i = 0; i < words.length; i++) {
    wtimes.push(t);
    const dur = i === words.length - 1 ? Math.max(each, 280) : each;
    wdurations.push(dur);
    t += dur;
  }
  return { words, wtimes, wdurations, durationMs: t + 120 };
}

function makeSilentBuffer(audioCtx, durationMs) {
  const sr = audioCtx.sampleRate || 22050;
  const len = Math.max(1, Math.floor((durationMs / 1000) * sr));
  const buf = audioCtx.createBuffer(1, len, sr);
  // tiny near-silence so engines don't skip
  const ch = buf.getChannelData(0);
  for (let i = 0; i < Math.min(64, len); i++) ch[i] = (Math.random() - 0.5) * 0.00001;
  return buf;
}

/**
 * Plug-in point for paid TTS:
 * speakWithProvider({ text, lang, audioBuffer, words, wtimes, wdurations, visemes, vtimes, vdurations })
 */
export async function speakWithProvider(_payload) {
  throw new Error('No external TTS provider configured. Set ELEVENLABS_API_KEY / Azure later.');
}

/**
 * @param {object} opts
 * @param {string} opts.text
 * @param {'en'|'zh'} opts.lang
 * @param {object|null} opts.head TalkingHead instance
 * @param {number} [opts.rate]
 * @param {number} [opts.pitch]
 * @param {function} [opts.onend]
 * @param {boolean} [opts.lipsync] default true for English
 */
export function speak({ text, lang = 'en', head = null, rate, pitch, onend, lipsync = true }) {
  return new Promise((resolve) => {
    if (!text) {
      onend && onend();
      resolve();
      return;
    }
    cancelToken++;
    const myToken = cancelToken;
    speaking = true;

    const isZh = lang === 'zh' || lang.startsWith('zh');
    const r = rate ?? (isZh ? 0.92 : 0.72); // slow English for toddlers
    const p = pitch ?? (isZh ? 1.05 : 1.15);

    const timing = buildTiming(text, isZh ? 'zh' : 'en', r);

    // Lip-sync via TalkingHead (silent buffer + word timings)
    if (head && lipsync) {
      try {
        const ctx = head.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const audio = makeSilentBuffer(ctx, timing.durationMs);
        head.setMood && head.setMood('happy');
        head.speakAudio(
          {
            audio,
            words: timing.words,
            wtimes: timing.wtimes,
            wdurations: timing.wdurations
          },
          { lipsyncLang: isZh ? 'en' : 'en', isRaw: false }
        );
      } catch (err) {
        console.warn('lipsync fallback', err);
        // Simple jaw pulse fallback
        pulseMouth(head, timing.durationMs);
      }
    }

    // Real voice via Web Speech API
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = isZh ? 'zh-CN' : 'en-US';
      u.rate = r;
      u.pitch = p;
      u.volume = 1;
      if (isZh && preferredZh) u.voice = preferredZh;
      if (!isZh && preferredEn) u.voice = preferredEn;

      u.onend = () => {
        if (myToken !== cancelToken) return;
        speaking = false;
        onend && onend();
        resolve();
      };
      u.onerror = () => {
        if (myToken !== cancelToken) return;
        speaking = false;
        onend && onend();
        resolve();
      };
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn(e);
      speaking = false;
      setTimeout(() => {
        onend && onend();
        resolve();
      }, timing.durationMs);
    }
  });
}

function pulseMouth(head, durationMs) {
  if (!head || !head.setFixedValue) return;
  const start = performance.now();
  const tick = () => {
    const t = performance.now() - start;
    if (t > durationMs) {
      head.setFixedValue('jawOpen', null);
      head.setFixedValue('mouthOpen', null);
      return;
    }
    const v = 0.15 + Math.abs(Math.sin(t / 90)) * 0.45;
    try {
      head.setFixedValue('jawOpen', v);
      head.setFixedValue('mouthOpen', v * 0.8);
    } catch (_) {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function stopSpeaking(head) {
  cancelToken++;
  speaking = false;
  try {
    speechSynthesis.cancel();
  } catch (_) {}
  try {
    head && head.speakAudio && head.stopListening && null;
  } catch (_) {}
}

export function isSpeaking() {
  return speaking || speechSynthesis.speaking;
}

/** Speak English word slowly, then short Chinese gloss/praise */
export async function teachWord(head, word, praiseZh) {
  await speak({
    text: word.en,
    lang: 'en',
    head,
    rate: 0.65,
    pitch: 1.2
  });
  await speak({
    text: `${word.zh}。${word.en}。`,
    lang: 'zh',
    head,
    rate: 0.9,
    lipsync: true
  });
  if (praiseZh) {
    await speak({ text: praiseZh, lang: 'zh', head, rate: 0.95 });
  }
}
