/** TensorFlow.js COCO-SSD object recognition from CDN */
import { cocoToWord, findWordByEn } from './vocab.js';

let model = null;
let stream = null;
let running = false;
let raf = 0;

export async function loadDetector(statusFn) {
  if (model) return model;
  statusFn && statusFn('正在加载识别模型…');
  // dynamic script load
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
  statusFn && statusFn('模型准备中…');
  model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  statusFn && statusFn('识别已就绪');
  return model;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function startCamera(videoEl) {
  const tries = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } },
    { audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
    { audio: false, video: true }
  ];
  let lastErr;
  for (const constraints of tries) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = stream;
      await videoEl.play();
      return stream;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('getUserMedia failed');
}

export function stopCamera(videoEl) {
  running = false;
  cancelAnimationFrame(raf);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (videoEl) videoEl.srcObject = null;
}

export function startDetectLoop(videoEl, onDetect) {
  running = true;
  let lastLabel = '';
  let lastAt = 0;
  let cooldownUntil = 0;

  const tick = async () => {
    if (!running || !model || videoEl.readyState < 2) {
      raf = requestAnimationFrame(tick);
      return;
    }
    try {
      const preds = await model.detect(videoEl);
      const now = Date.now();
      if (now > cooldownUntil && preds && preds.length) {
        const best = preds
          .filter((p) => p.score > 0.55)
          .sort((a, b) => b.score - a.score)[0];
        if (best) {
          const en = cocoToWord(best.class);
          if (en && (en !== lastLabel || now - lastAt > 8000)) {
            lastLabel = en;
            lastAt = now;
            cooldownUntil = now + 5000;
            const word = findWordByEn(en) || { en, zh: en, emoji: '✨' };
            onDetect(word, best);
          }
        }
      }
    } catch (e) {
      console.warn('detect', e);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
