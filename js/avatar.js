/**
 * TalkingHead.js + Ready Player Me — polished classroom stage.
 */
import { TalkingHead } from 'talkinghead';

export const AVATAR_URL = './avatars/brunette.glb';
export const AVATAR_URL_FALLBACKS = [
  './avatars/brunette.glb',
  'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars/brunette.glb',
  'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png'
];

let head = null;

export function getHead() {
  return head;
}

export async function initAvatar(container, onProgress) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  head = new TalkingHead(container, {
    lipsyncModules: ['en'],
    lipsyncLang: 'en',
    cameraView: 'head',
    cameraDistance: 0,
    cameraY: 0,
    cameraX: 0,
    modelFPS: 30,
    modelPixelRatio: dpr,
    cameraRotateEnable: false,
    cameraPanEnable: false,
    cameraZoomEnable: false,
    lightAmbientColor: 0xc9c2ff,
    lightAmbientIntensity: 2.2,
    lightDirectColor: 0xffd59a,
    lightDirectIntensity: 26,
    lightDirectPhi: 0.55,
    lightDirectTheta: 0.35,
    lightSpotColor: 0x8fa8ff,
    lightSpotIntensity: 20,
    lightSpotPhi: 0.9,
    lightSpotTheta: -0.55,
    avatarMood: 'happy',
    avatarIdleEyeContact: 0.55,
    avatarIdleHeadMove: 0.7,
    avatarSpeakingEyeContact: 0.8,
    avatarSpeakingHeadMove: 0.5
  });

  let loaded = false;
  let lastErr = null;
  for (const url of AVATAR_URL_FALLBACKS) {
    try {
      await head.showAvatar(
        {
          url,
          body: 'F',
          avatarMood: 'happy',
          lipsyncLang: 'en'
        },
        (ev) => {
          if (onProgress && ev.lengthComputable) {
            onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
          }
        }
      );
      loaded = true;
      break;
    } catch (err) {
      console.warn('avatar load failed', url, err);
      lastErr = err;
    }
  }
  if (!loaded) throw lastErr || new Error('Avatar load failed');

  head.setMood('happy');
  try {
    head.setFixedValue && head.setFixedValue('mouthSmile', 0.22);
  } catch (_) {}
  return head;
}

export function praiseGesture() {
  if (!head) return;
  try {
    head.playGesture('thumbup', 2.5, false, 600);
    head.setMood('happy');
  } catch (_) {}
}

export function waveGesture() {
  if (!head) return;
  try {
    head.playGesture('handup', 2.2, true, 500);
  } catch (_) {}
}

export function listenPose() {
  if (!head) return;
  try {
    head.lookAtCamera(2500);
    head.makeEyeContact(2000);
  } catch (_) {}
}

export function pauseAvatar(paused) {
  if (!head) return;
  if (paused) head.stop();
  else head.start();
}

export function clearMouth(h = head) {
  if (!h || !h.setFixedValue) return;
  try {
    h.setFixedValue('jawOpen', null);
    h.setFixedValue('mouthOpen', null);
    h.setFixedValue('mouthSmile', 0.18);
  } catch (_) {}
}
