// Solmar City itself: the road grid, the blocks between the roads, the buildings,
// parks and the marina, plus the collision and drawing helpers for the map.
// The city is deterministic for a seed, so a screenshot seed always replays the same streets.

import { clamp, mulberry32, pick, randRange, circleHitsRect } from './util.js';

export const WORLD = 4860;
export const ROAD_WIDTH = 100;
export const GRID = 540;
export const ROAD_COUNT = 9;
/** The beach strip along the south edge: sand, walkable, no buildings. */
export const BEACH_Y = 4620;

const BUILDING_COLORS = [
  '#c9a37e', '#b98d6b', '#a8b6c4', '#8fa3b8', '#d6b48c',
  '#9db3a5', '#c4a4a4', '#7e8fa3', '#bfae8e', '#a3b8a3',
];
const ROOF_COLORS = ['#6b5d4f', '#4f5a66', '#7a6a58', '#5d6b5a', '#8a7a68'];

/** Road centre lines, both directions. */
export function roadCentres() {
  const centres = [];
  for (let i = 0; i < ROAD_COUNT; i += 1) centres.push(270 + i * GRID);
  return centres;
}

/** True when the point is on a road surface (either direction). */
export function isRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (let i = 0; i < ROAD_COUNT; i += 1) {
    const c = 270 + i * GRID;
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}

/** True when the point is on a sidewalk ring beside a road. */
export function isSidewalk(x, y) {
  const half = ROAD_WIDTH / 2 + 22;
  const roadHalf = ROAD_WIDTH / 2;
  for (let i = 0; i < ROAD_COUNT; i += 1) {
    const c = 270 + i * GRID;
    const dx = Math.abs(x - c);
    const dy = Math.abs(y - c);
    if ((dx < half && dx >= roadHalf) || (dy < half && dy >= roadHalf)) return true;
  }
  return false;
}

/** Build the whole city for a seed: roads, buildings, parks, the marina and landmarks. */
export function buildCity(seed) {
  const rng = mulberry32(seed);
  const centres = roadCentres();
  const buildings = [];
  const parks = [];
  const landmarks = [];
  const palms = [];
  const lamps = [];

  // Street lamps at every intersection corner, so the grid reads at night as well as day.
  for (const cx of centres) {
    for (const cy of centres) {
      lamps.push({ x: cx - ROAD_WIDTH / 2 - 8, y: cy - ROAD_WIDTH / 2 - 8 });
      lamps.push({ x: cx + ROAD_WIDTH / 2 + 8, y: cy + ROAD_WIDTH / 2 + 8 });
    }
  }
  for (let bx = 0; bx < ROAD_COUNT - 1; bx += 1) {
    for (let by = 0; by < ROAD_COUNT - 1; by += 1) {
      const x0 = centres[bx] + ROAD_WIDTH / 2 + 26;
      const y0 = centres[by] + ROAD_WIDTH / 2 + 26;
      const x1 = centres[bx + 1] - ROAD_WIDTH / 2 - 26;
      const y1 = centres[by + 1] - ROAD_WIDTH / 2 - 26;
      const bw = x1 - x0;
      const bh = y1 - y0;
      const roll = rng();
      if (roll < 0.16) {
        // A park: trees and lawn, no buildings, walkable.
        const trees = [];
        const treeCount = 6 + Math.floor(rng() * 8);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({ x: x0 + rng() * bw, y: y0 + rng() * bh, r: 10 + rng() * 12 });
        }
        parks.push({ x: x0, y: y0, w: bw, h: bh, trees });
        continue;
      }
      // One or two buildings per block, with a small plaza gap.
      const split = rng() < 0.55;
      const lots = split
        ? [
          { x: x0, y: y0, w: bw * 0.48, h: bh },
          { x: x0 + bw * 0.52, y: y0, w: bw * 0.48, h: bh },
        ]
        : [{ x: x0, y: y0, w: bw, h: bh }];
      for (const lot of lots) {
        const pad = 14 + rng() * 22;
        const w = Math.max(90, lot.w - pad * 2);
        const h = Math.max(90, lot.h - pad * 2);
        const x = lot.x + (lot.w - w) / 2;
        const y = lot.y + (lot.h - h) / 2;
        buildings.push({
          x, y, w, h,
          color: pick(rng, BUILDING_COLORS),
          roof: pick(rng, ROOF_COLORS),
          height: 1 + Math.floor(rng() * 3),
        });
      }
    }
  }

  // Landmarks the story names, placed on open ground so they never overlap a building.
  landmarks.push({ name: 'Solmar Bank', x: 2430, y: 810, w: 220, h: 150, color: '#d8c690' });
  landmarks.push({ name: 'Vera\u2019s Office', x: 1350, y: 2430, w: 180, h: 130, color: '#b8c4d0' });
  landmarks.push({ name: 'Marina', x: 4050, y: 4050, w: 420, h: 300, color: '#7fb3c8' });
  landmarks.push({ name: 'Safehouse', x: 810, y: 3510, w: 170, h: 130, color: '#a3b8a3' });
  for (const lm of landmarks) {
    // Clear any building that would sit under a landmark.
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (b.x < lm.x + lm.w && b.x + b.w > lm.x && b.y < lm.y + lm.h && b.y + b.h > lm.y) {
        buildings.splice(i, 1);
      }
    }
  }

  // Palm trees along the marina promenade and the beachfront, so the
  // waterfront reads as a waterfront instead of bare water.
  for (let i = 0; i < 12; i += 1) {
    palms.push({
      x: 4050 + 30 + i * 34 + randRange(rng, -8, 8),
      y: 4050 - 34 + randRange(rng, -6, 6),
      r: 11 + rng() * 5,
    });
  }
  for (let i = 0; i < 16; i += 1) {
    palms.push({
      x: 200 + i * 290 + randRange(rng, -30, 30),
      y: BEACH_Y + 60 + randRange(rng, 0, 120),
      r: 11 + rng() * 5,
    });
  }

  return { seed, centres, buildings, parks, landmarks, palms, lamps };
}

/** True when the point is on the beach strip (sand, walkable, no buildings). */
export function isBeach(x, y) {
  return y >= BEACH_Y && y <= WORLD && x >= 0 && x <= WORLD;
}

/** Find a landmark by name. */
export function landmark(city, name) {
  return city.landmarks.find((lm) => lm.name === name) || null;
}

/** Centre of a landmark, always finite numbers. */
export function landmarkCentre(city, name) {
  const lm = landmark(city, name);
  if (!lm) return { x: WORLD / 2, y: WORLD / 2 };
  return { x: lm.x + lm.w / 2, y: lm.y + lm.h / 2 };
}

/** True when a circle of `radius` at (x, y) overlaps any solid building or landmark wall. */
export function hitsBuilding(city, x, y, radius) {
  for (let i = 0; i < city.buildings.length; i += 1) {
    if (circleHitsRect(x, y, radius, city.buildings[i])) return true;
  }
  for (let i = 0; i < city.landmarks.length; i += 1) {
    const lm = city.landmarks[i];
    if (lm.name === 'Marina') continue; // The marina is open ground, not a wall.
    if (circleHitsRect(x, y, radius, lm)) return true;
  }
  return false;
}

/** Resolve a moving body out of every building it overlaps. */
export function resolveBuildings(city, body) {
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (Math.abs(body.x - (b.x + b.w / 2)) > b.w / 2 + body.radius + 4) continue;
    if (Math.abs(body.y - (b.y + b.h / 2)) > b.h / 2 + body.radius + 4) continue;
    resolveCircleRect(body, b);
  }
  for (let i = 0; i < city.landmarks.length; i += 1) {
    const lm = city.landmarks[i];
    if (lm.name === 'Marina') continue;
    if (Math.abs(body.x - (lm.x + lm.w / 2)) > lm.w / 2 + body.radius + 4) continue;
    if (Math.abs(body.y - (lm.y + lm.h / 2)) > lm.h / 2 + body.radius + 4) continue;
    resolveCircleRect(body, lm);
  }
}

/** A random point on a road, for spawning cars and pedestrians. */
export function randomRoadPoint(rng) {
  const centres = roadCentres();
  if (rng() < 0.5) {
    const y = centres[Math.floor(rng() * centres.length)];
    return { x: 120 + rng() * (WORLD - 240), y: y + (rng() - 0.5) * (ROAD_WIDTH - 36) };
  }
  const x = centres[Math.floor(rng() * centres.length)];
  return { x: x + (rng() - 0.5) * (ROAD_WIDTH - 36), y: 120 + rng() * (WORLD - 240) };
}

/** A point on a road a short chase from (x, y): near enough to join the action fast. */
export function randomRoadPointNear(rng, x, y) {
  const centres = roadCentres();
  for (let tries = 0; tries < 12; tries += 1) {
    const vertical = rng() < 0.5;
    const c = centres[Math.floor(rng() * centres.length)];
    const dir = rng() < 0.5 ? -1 : 1;
    const along = (vertical ? y : x) + dir * (520 + rng() * 420);
    const off = (rng() - 0.5) * (ROAD_WIDTH - 36);
    const px = vertical ? c + off : clamp(along, 120, WORLD - 120);
    const py = vertical ? clamp(along, 120, WORLD - 120) : c + off;
    if (Math.hypot(px - x, py - y) >= 480) return { x: px, y: py };
  }
  return randomRoadPoint(rng);
}

/** A random point on a sidewalk, for spawning pedestrians. */
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const off = ROAD_WIDTH / 2 + 12;
  if (rng() < 0.5) p.x += rng() < 0.5 ? off : -off;
  else p.y += rng() < 0.5 ? off : -off;
  return { x: clamp(p.x, 60, WORLD - 60), y: clamp(p.y, 60, WORLD - 60) };
}

function resolveCircleRect(body, rect) {
  const nx = clamp(body.x, rect.x, rect.x + rect.w);
  const ny = clamp(body.y, rect.y, rect.y + rect.h);
  let dx = body.x - nx;
  let dy = body.y - ny;
  const d2 = dx * dx + dy * dy;
  const r = body.radius;
  if (d2 >= r * r) return;
  if (d2 === 0) {
    const left = body.x - rect.x;
    const right = rect.x + rect.w - body.x;
    const top = body.y - rect.y;
    const bottom = rect.y + rect.h - body.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) body.x = rect.x - r;
    else if (m === right) body.x = rect.x + rect.w + r;
    else if (m === top) body.y = rect.y - r;
    else body.y = rect.y + rect.h + r;
    return;
  }
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  body.x += dx * push;
  body.y += dy * push;
}

/** Draw the ground, roads, parks, buildings and landmarks inside the camera view. */
export function drawCity(ctx, city, cam, viewW, viewH) {
  const x0 = cam.x - viewW / 2 - 120;
  const y0 = cam.y - viewH / 2 - 120;
  const x1 = cam.x + viewW / 2 + 120;
  const y1 = cam.y + viewH / 2 + 120;

  // Sun-baked ground.
  ctx.fillStyle = '#c8b28a';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // The beach: pale sand along the south edge, with a darker wet band at the water.
  if (BEACH_Y < y1 && WORLD > y0) {
    ctx.fillStyle = '#e8d5a4';
    ctx.fillRect(x0, BEACH_Y, x1 - x0, WORLD - BEACH_Y);
    ctx.fillStyle = '#d9c48c';
    ctx.fillRect(x0, BEACH_Y, x1 - x0, 10);
    ctx.fillStyle = '#7fb3c8';
    ctx.fillRect(x0, WORLD - 26, x1 - x0, 26);
  }

  // Palm trees on the promenade and the beachfront.
  for (const palm of city.palms || []) {
    if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(palm.x - 2, palm.y - 4, 4, 12);
    ctx.fillStyle = '#4e7d46';
    ctx.beginPath();
    ctx.arc(palm.x, palm.y - 6, palm.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6aa356';
    ctx.beginPath();
    ctx.arc(palm.x - 3, palm.y - 9, palm.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  // Street lamps: a dark post and a warm head at every intersection corner.
  for (const lamp of city.lamps || []) {
    if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(lamp.x - 3, lamp.y - 3, 6, 2);
  }

  // Parks.
  for (const park of city.parks) {
    if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
    ctx.fillStyle = '#7fae6b';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    for (const tree of park.trees) {
      ctx.fillStyle = '#4e7d46';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6aa356';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Roads: dark asphalt with pale centre dashes.
  ctx.fillStyle = '#3c3f45';
  for (const c of city.centres) {
    if (c > y0 - 60 && c < y1 + 60) ctx.fillRect(x0, c - ROAD_WIDTH / 2, x1 - x0, ROAD_WIDTH);
    if (c > x0 - 60 && c < x1 + 60) ctx.fillRect(c - ROAD_WIDTH / 2, y0, ROAD_WIDTH, y1 - y0);
  }
  ctx.fillStyle = '#e8d27a';
  for (const c of city.centres) {
    for (let d = 120; d < WORLD; d += 120) {
      if (c > y0 - 10 && c < y1 + 10 && d > x0 && d < x1) ctx.fillRect(d, c - 3, 54, 6);
      if (c > x0 - 10 && c < x1 + 10 && d > y0 && d < y1) ctx.fillRect(c - 3, d, 6, 54);
    }
  }
  // Sidewalk rings.
  ctx.fillStyle = '#b7ab90';
  for (const c of city.centres) {
    if (c > y0 - 80 && c < y1 + 80) {
      ctx.fillRect(x0, c - ROAD_WIDTH / 2 - 22, x1 - x0, 22);
      ctx.fillRect(x0, c + ROAD_WIDTH / 2, x1 - x0, 22);
    }
    if (c > x0 - 80 && c < x1 + 80) {
      ctx.fillRect(c - ROAD_WIDTH / 2 - 22, y0, 22, y1 - y0);
      ctx.fillRect(c + ROAD_WIDTH / 2, y0, 22, y1 - y0);
    }
  }

  // Marina water.
  const marina = landmark(city, 'Marina');
  if (marina && marina.x < x1 && marina.x + marina.w > x0 && marina.y < y1 && marina.y + marina.h > y0) {
    ctx.fillStyle = '#5fa8c4';
    ctx.fillRect(marina.x, marina.y, marina.w, marina.h);
    ctx.fillStyle = '#8ec8dd';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(marina.x + 20 + i * 70, marina.y + 30 + (i % 2) * 120, 46, 6);
    }
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(marina.x, marina.y + marina.h - 26, marina.w, 26);
    // Moored boats: pale hulls with a coloured cabin, riding the water.
    const boats = [
      { x: marina.x + 46, y: marina.y + 62, w: 66, h: 20, cabin: '#d94f3d' },
      { x: marina.x + 186, y: marina.y + 158, w: 74, h: 22, cabin: '#3d7dd9' },
      { x: marina.x + 306, y: marina.y + 72, w: 58, h: 18, cabin: '#e8c33a' },
    ];
    for (const boat of boats) {
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath();
      ctx.roundRect(boat.x, boat.y, boat.w, boat.h, 7);
      ctx.fill();
      ctx.fillStyle = boat.cabin;
      ctx.fillRect(boat.x + boat.w / 2 - 10, boat.y + 4, 20, boat.h - 8);
      ctx.fillStyle = 'rgba(20,24,32,0.7)';
      ctx.fillRect(boat.x + boat.w / 2 - 1, boat.y - 12, 2, 12);
    }
  }

  // Buildings with roof shading, a soft shadow, and lit windows.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(60,40,20,0.20)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    // Window panes on the roof face, spaced off the building's own grid.
    ctx.fillStyle = 'rgba(255,244,200,0.55)';
    for (let wx = b.x + 24; wx + 14 < b.x + b.w - 8; wx += 36) {
      for (let wy = b.y + 26; wy + 12 < b.y + b.h - 8; wy += 32) {
        ctx.fillRect(wx, wy, 14, 12);
      }
    }
  }

  // Named landmarks with labels.
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px sans-serif';
  for (const lm of city.landmarks) {
    if (lm.name === 'Marina') continue;
    if (lm.x > x1 || lm.x + lm.w < x0 || lm.y > y1 || lm.y + lm.h < y0) continue;
    ctx.fillStyle = lm.color;
    ctx.fillRect(lm.x, lm.y, lm.w, lm.h);
    ctx.fillStyle = '#3a3230';
    ctx.fillRect(lm.x + 10, lm.y + 10, lm.w - 20, lm.h - 20);
    ctx.fillStyle = '#f5edd8';
    ctx.fillText(lm.name, lm.x + lm.w / 2, lm.y + lm.h / 2 + 7);
  }
  ctx.textAlign = 'left';
}
