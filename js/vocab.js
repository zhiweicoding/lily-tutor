/** Toddler vocab — one word at a time, Chinese gloss + emoji cue */
export const CATEGORIES = [
  {
    id: 'animals',
    nameZh: '小动物',
    emoji: '🐱',
    words: [
      { en: 'cat', zh: '小猫', emoji: '🐱', coco: ['cat'] },
      { en: 'dog', zh: '小狗', emoji: '🐶', coco: ['dog'] },
      { en: 'bird', zh: '小鸟', emoji: '🐦', coco: ['bird'] },
      { en: 'fish', zh: '小鱼', emoji: '🐟', coco: [] },
      { en: 'rabbit', zh: '兔子', emoji: '🐰', coco: [] },
      { en: 'bear', zh: '小熊', emoji: '🐻', coco: ['bear', 'teddy bear'] }
    ]
  },
  {
    id: 'fruits',
    nameZh: '水果',
    emoji: '🍎',
    words: [
      { en: 'apple', zh: '苹果', emoji: '🍎', coco: ['apple'] },
      { en: 'banana', zh: '香蕉', emoji: '🍌', coco: ['banana'] },
      { en: 'orange', zh: '橙子', emoji: '🍊', coco: ['orange'] },
      { en: 'grape', zh: '葡萄', emoji: '🍇', coco: [] },
      { en: 'strawberry', zh: '草莓', emoji: '🍓', coco: [] },
      { en: 'watermelon', zh: '西瓜', emoji: '🍉', coco: [] }
    ]
  },
  {
    id: 'colors',
    nameZh: '颜色',
    emoji: '🌈',
    words: [
      { en: 'red', zh: '红色', emoji: '🔴', coco: [], color: '#FF4D6D' },
      { en: 'yellow', zh: '黄色', emoji: '🟡', coco: [], color: '#FFD60A' },
      { en: 'blue', zh: '蓝色', emoji: '🔵', coco: [], color: '#4EA8DE' },
      { en: 'green', zh: '绿色', emoji: '🟢', coco: [], color: '#52B788' },
      { en: 'pink', zh: '粉色', emoji: '💗', coco: [], color: '#FF8FAB' },
      { en: 'orange', zh: '橙色', emoji: '🟠', coco: [], color: '#FF9F1C' }
    ]
  },
  {
    id: 'family',
    nameZh: '家人',
    emoji: '👨‍👩‍👧',
    words: [
      { en: 'mama', zh: '妈妈', emoji: '👩', coco: ['person'] },
      { en: 'dada', zh: '爸爸', emoji: '👨', coco: ['person'] },
      { en: 'baby', zh: '宝宝', emoji: '👶', coco: ['person'] },
      { en: 'me', zh: '我', emoji: '😊', coco: [] }
    ]
  },
  {
    id: 'body',
    nameZh: '身体',
    emoji: '👀',
    words: [
      { en: 'eyes', zh: '眼睛', emoji: '👀', coco: [] },
      { en: 'nose', zh: '鼻子', emoji: '👃', coco: [] },
      { en: 'mouth', zh: '嘴巴', emoji: '👄', coco: [] },
      { en: 'hand', zh: '手', emoji: '✋', coco: [] },
      { en: 'foot', zh: '脚', emoji: '🦶', coco: [] },
      { en: 'ear', zh: '耳朵', emoji: '👂', coco: [] }
    ]
  },
  {
    id: 'toys',
    nameZh: '玩具',
    emoji: '🧸',
    words: [
      { en: 'ball', zh: '球', emoji: '⚽', coco: ['sports ball'] },
      { en: 'car', zh: '小汽车', emoji: '🚗', coco: ['car'] },
      { en: 'doll', zh: '娃娃', emoji: '🪆', coco: [] },
      { en: 'book', zh: '书', emoji: '📖', coco: ['book'] },
      { en: 'blocks', zh: '积木', emoji: '🧱', coco: [] },
      { en: 'teddy', zh: '泰迪熊', emoji: '🧸', coco: ['teddy bear'] }
    ]
  }
];

export const PRAISE_ZH = [
  '真棒！',
  '好厉害！',
  '宝宝真聪明！',
  '太棒了！',
  '说得真好！',
  '加油，宝宝！',
  '哇，好厉害哦！'
];

export const GREET_ZH = [
  '你好呀，宝宝！我是 Lily 老师。',
  '哇，宝宝来啦！我们一起学英语好不好？'
];

export const REST_ZH =
  '宝宝学了好几分钟啦，我们休息一下眼睛和耳朵，好吗？喝口水再来～';

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem('lilyProgress') || '{}');
  } catch {
    return {};
  }
}

export function saveProgress(p) {
  localStorage.setItem('lilyProgress', JSON.stringify(p));
}

export function markWordLearned(en) {
  const p = loadProgress();
  p.words = p.words || {};
  p.words[en] = (p.words[en] || 0) + 1;
  p.lastAt = Date.now();
  p.sessionMinutes = p.sessionMinutes || 0;
  saveProgress(p);
  return p;
}

export function cocoToWord(label) {
  const map = {
    cat: 'cat', dog: 'dog', bird: 'bird', bear: 'bear',
    'teddy bear': 'teddy', apple: 'apple', banana: 'banana', orange: 'orange',
    'sports ball': 'ball', car: 'car', book: 'book',
    cup: 'cup', bottle: 'bottle', person: null
  };
  return map[label] || null;
}

export function findWordByEn(en) {
  for (const c of CATEGORIES) {
    const w = c.words.find((x) => x.en === en);
    if (w) return { ...w, category: c };
  }
  return null;
}
