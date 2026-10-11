/**
 * TalkingHead.js + Ready Player Me realistic female teacher avatar.
 * CDN-only, no paid API required for avatar rendering / idle animation.
 */
import { TalkingHead } from 'talkinghead';

// Local vendored Ready Player Me brunette (TalkingHead example, CC BY-NC).
// RPM CDN is often blocked in CN; keep remote fallbacks for other hosts.
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
  head = new TalkingHead(container, {
    lipsyncModules: ['en'],
    lipsyncLang: 'en',
    cameraView: 'upper',
    cameraDistance: -0.15,
    cameraY: 0.02,
    modelFPS: 24,
    modelPixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    cameraRotateEnable: false,
    cameraPanEnable: false,
    cameraZoomEnable: false,
    lightAmbientIntensity: 2.2,
    lightDirectIntensity: 22,
    lightSpotIntensity: 8,
    avatarMood: 'happy',
    avatarIdleEyeContact: 0.45,
    avatarIdleHeadMove: 0.55,
    avatarSpeakingEyeContact: 0.7,
    avatarSpeakingHeadMove: 0.45
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
