// Pedestrians: city folk who stroll the sidewalks, flee from danger, and never
// pile up without a limit. The count is capped and far walkers are recycled,
// so the street stays busy without the simulation growing forever.

import { clamp, dist, mulberry32, pick } from './util.js';
import { WORLD, randomSidewalkPoint, resolveBuildings } from './city.js';

export const MAX_PEDESTRIANS = 90;

const SHIRT_COLORS = ['#e07b39', '#3d7dd9', '#7ac74f', '#c0a0d8', '#e8c33a', '#d94f3d', '#39c0c0', '#e8e8e8'];
const SKIN_COLORS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];

let nextPedId = 1;

/** Make one pedestrian near (x, y), or anywhere on a sidewalk when no point is given.
 * `label` names a story character (drawn above them); `stand` keeps them in place. */
export function makePedestrian(rng, x, y) {
  const p = x !== undefined ? { x, y } : randomSidewalkPoint(rng);
  const jogger = rng() < 0.12; // A few Solmar folk out for a run, faster than a stroll.
  return {
    id: nextPedId,
    x: p.x,
    y: p.y,
    angle: rng() * Math.PI * 2,
    speed: jogger ? 68 + rng() * 26 : 28 + rng() * 26,
    jogger,
    radius: 11,
    shirt: pick(rng, SHIRT_COLORS),
    skin: pick(rng, SKIN_COLORS),
    retarget: 0,
    fleeing: false,
    dead: false,
    panic: 0,
    label: null,
    stand: false,
  };
}

/** Update every pedestrian: stroll, turn at random, flee from cars and gunfire.
 * `city` keeps walkers out of buildings; pass null to skip the check. */
export function updatePedestrians(peds, dt, rng, danger, city) {
  for (const ped of peds) {
    if (ped.dead) continue;
    if (ped.stand) continue; // A named character waiting at their spot stays put.
    ped.retarget -= dt;
    ped.panic = Math.max(0, ped.panic - dt);
    let fleeX = 0;
    let fleeY = 0;
    if (danger) {
      for (const d of danger) {
        const dx = ped.x - d.x;
        const dy = ped.y - d.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < d.radius * d.radius && d2 > 0.01) {
          const len = Math.sqrt(d2);
          fleeX += (dx / len) * (1 - Math.sqrt(d2) / d.radius);
          fleeY += (dy / len) * (1 - Math.sqrt(d2) / d.radius);
        }
      }
    }
    if (fleeX !== 0 || fleeY !== 0) {
      ped.fleeing = true;
      ped.panic = 1.2;
      ped.angle = Math.atan2(fleeY, fleeX);
      const speed = ped.speed * 2.6;
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
    } else {
      ped.fleeing = false;
      if (ped.retarget <= 0) {
        ped.retarget = 2 + rng() * 5;
        ped.angle += (rng() - 0.5) * 1.6;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = clamp(ped.x, 40, WORLD - 40);
    ped.y = clamp(ped.y, 40, WORLD - 40);
    // Walkers stay on the street: never cut through a building.
    if (city) resolveBuildings(city, ped);
  }
}

/** Keep the street populated near the camera without ever passing the cap. */
export function maintainPedestrians(peds, rng, camX, camY) {
  for (let i = peds.length - 1; i >= 0; i -= 1) {
    const ped = peds[i];
    if (ped.dead) { peds.splice(i, 1); continue; }
    if (dist(ped.x, ped.y, camX, camY) > 1500) peds.splice(i, 1);
  }
  let guard = 0;
  while (peds.length < MAX_PEDESTRIANS && guard < 30) {
    guard += 1;
    const ped = makePedestrian(rng);
    if (dist(ped.x, ped.y, camX, camY) > 1300) continue;
    if (dist(ped.x, ped.y, camX, camY) < 320) continue;
    peds.push(ped);
  }
}

/** Draw a pedestrian top-down: head, shoulders and a walking bob. */
export function drawPedestrian(ctx, ped, time) {
  const bob = ped.fleeing ? Math.sin(time * 18 + ped.id) * 2 : Math.sin(time * 8 + ped.id) * 1.2;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  // Joggers wear a white headband.
  if (ped.jogger) {
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(-4, -8, 8, 3);
  }
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(4 + bob * 0.3, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // A named story character gets a tag above their head.
  if (ped.label) {
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(ped.label).width + 12;
    ctx.fillStyle = 'rgba(10,10,14,0.75)';
    ctx.beginPath();
    ctx.roundRect(ped.x - w / 2, ped.y - 34, w, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(ped.label, ped.x, ped.y - 22);
    ctx.textAlign = 'left';
  }
}
