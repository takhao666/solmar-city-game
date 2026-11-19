// Shared math, random and collision helpers for Solmar City.
// Every module in the game imports from here so the rules stay in one place.

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/** Smoothstep easing between 0 and 1: slow at both ends, fast in the middle. */
export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** A random number in [min, max) from the given rng. */
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** Shortest signed turn from angle `from` toward angle `to`, in radians. */
export function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Deterministic random number generator (mulberry32) so a seed replays a city. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry from an array with the given rng. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Circle vs axis-aligned rectangle collision test. */
export function circleHitsRect(cx, cy, radius, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

/** Push a circle out of a rectangle; returns true when a push happened. */
export function resolveCircleRect(body, rect) {
  const nx = clamp(body.x, rect.x, rect.x + rect.w);
  const ny = clamp(body.y, rect.y, rect.y + rect.h);
  let dx = body.x - nx;
  let dy = body.y - ny;
  let d2 = dx * dx + dy * dy;
  const r = body.radius;
  if (d2 >= r * r) return false;
  if (d2 === 0) {
    // Centre inside the rectangle: push out along the smallest penetration.
    const left = body.x - rect.x;
    const right = rect.x + rect.w - body.x;
    const top = body.y - rect.y;
    const bottom = rect.y + rect.h - body.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) body.x = rect.x - r;
    else if (m === right) body.x = rect.x + rect.w + r;
    else if (m === top) body.y = rect.y - r;
    else body.y = rect.y + rect.h + r;
    return true;
  }
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  body.x += dx * push;
  body.y += dy * push;
  return true;
}

/** Format a number of seconds as M:SS. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A distance in world pixels as metres on the HUD (10px ≈ 1m at this scale). */
export function formatDistance(px) {
  const m = Math.round(Math.max(0, px) / 10);
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

/** Money as $1,234. */
export function formatMoney(amount) {
  return '$' + Math.floor(amount).toLocaleString('en-US');
}
