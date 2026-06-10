export const TAU = Math.PI * 2;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rand(seedRand, min, max) {
  return min + (max - min) * seedRand();
}

export function vec2Length(v) {
  return Math.hypot(v.x, v.y);
}

export function normalize2(v) {
  const l = vec2Length(v) || 1;
  return { x: v.x / l, y: v.y / l };
}

export function perp2(v) {
  return { x: -v.y, y: v.x };
}

export function hashRandom(seed) {
  let s = seed >>> 0;
  return function random() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedPick(random, items) {
  const total = items.reduce((acc, item) => acc + item.weight, 0);
  let r = random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

export function createLabelTexture(text, color = '#8ef3ff', bg = 'rgba(0,0,0,0.25)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(120,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  ctx.fillStyle = color;
  ctx.font = '26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas;
}
