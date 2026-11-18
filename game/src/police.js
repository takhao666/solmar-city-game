// The wanted system and the Solmar Police Department: stars that rise with crime,
// patrol cars and foot officers who chase the player, and a heat level that cools
// off when the player breaks line of sight. Damage is tuned to be threatening,
// never a one-shot: an officer's touch costs a little health over time.

import { clamp, dist, angleDiff, angleTo, mulberry32, pick } from './util.js';
import { WORLD, roadCentres, randomRoadPoint } from './city.js';
import { makeCar, POLICE_COLOR } from './vehicles.js';

export const MAX_WANTED = 5;

let nextOfficerId = 1;

/** Make one foot officer near a point. */
export function makeOfficer(x, y) {
  return {
    id: nextOfficerId,
    x, y,
    angle: 0,
    speed: 150,
    radius: 12,
    health: 40,
    dead: false,
    hitCooldown: 0,
  };
}

/**
 * Add wanted heat (0..5 stars). Returns the new star count.
 * Stealing a car is a small crime; hurting people and shooting at police is worse.
 */
export function addWanted(game, amount) {
  game.wanted = clamp(game.wanted + amount, 0, MAX_WANTED);
  game.wantedTimer = 0;
  game.lastSeen = { x: game.player.x, y: game.player.y };
  return game.wanted;
}

/** How many police cars and foot officers the current wanted level calls for. */
export function policeQuota(wanted) {
  return {
    cars: wanted === 0 ? 0 : Math.min(1 + wanted, 6),
    officers: wanted >= 3 ? Math.min((wanted - 2) * 2, 6) : 0,
  };
}

/** Spawn police near the player, on a road, chasing from a short distance away. */
export function spawnPoliceCar(game, rng) {
  const p = randomRoadPoint(rng);
  const car = makeCar(p.x, p.y, rng() * Math.PI * 2, POLICE_COLOR, 'police');
  car.maxSpeed = 380;
  car.accel = 320;
  game.cars.push(car);
  return car;
}

export function spawnOfficer(game, rng) {
  const px = game.player.x + (rng() - 0.5) * 700;
  const py = game.player.y + (rng() - 0.5) * 700;
  const officer = makeOfficer(clamp(px, 60, WORLD - 60), clamp(py, 60, WORLD - 60));
  game.officers.push(officer);
  return officer;
}

/** Keep the police presence at the wanted level's quota, spawning near the player. */
export function maintainPolice(game, rng, dt) {
  const quota = policeQuota(game.wanted);
  let cars = 0;
  let officers = 0;
  for (const car of game.cars) if (car.kind === 'police' && !car.dead) cars += 1;
  for (const officer of game.officers) if (!officer.dead) officers += 1;
  game.spawnCooldown -= dt;
  if (game.spawnCooldown <= 0) {
    if (cars < quota.cars) {
      spawnPoliceCar(game, rng);
      game.spawnCooldown = 1.2;
    } else if (officers < quota.officers) {
      spawnOfficer(game, rng);
      game.spawnCooldown = 1.0;
    }
  }
  // Drop police that fell far behind.
  for (let i = game.cars.length - 1; i >= 0; i -= 1) {
    const car = game.cars[i];
    if (car.kind === 'police' && dist(car.x, car.y, game.player.x, game.player.y) > 1900) {
      game.cars.splice(i, 1);
    }
  }
  for (let i = game.officers.length - 1; i >= 0; i -= 1) {
    const officer = game.officers[i];
    if (officer.dead) { game.officers.splice(i, 1); continue; }
    if (dist(officer.x, officer.y, game.player.x, game.player.y) > 1600) game.officers.splice(i, 1);
  }
}

/** A police car chases the player: steer toward them, ram when close. */
export function updatePoliceCar(car, game, dt) {
  const player = game.player;
  const target = player.inCar ? player.car : player;
  const want = angleTo(car.x, car.y, target.x, target.y);
  car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
  const d = dist(car.x, car.y, target.x, target.y);
  const targetSpeed = d > 260 ? car.maxSpeed : car.maxSpeed * 0.55;
  car.speed += clamp(targetSpeed - car.speed, -340 * dt, 300 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 50, WORLD - 50);
  car.y = clamp(car.y, 50, WORLD - 50);
  if (d < 70) game.lastSeen = { x: player.x, y: player.y };
}

/** A foot officer runs at the player and deals small contact damage on a cooldown. */
export function updateOfficer(officer, game, dt) {
  const player = game.player;
  officer.hitCooldown -= dt;
  const d = dist(officer.x, officer.y, player.x, player.y);
  if (player.inCar) {
    // On foot officers cannot catch a car; they hold their ground and radio it in.
    return;
  }
  officer.angle = angleTo(officer.x, officer.y, player.x, player.y);
  const speed = d > 40 ? officer.speed : 0;
  officer.x += Math.cos(officer.angle) * speed * dt;
  officer.y += Math.sin(officer.angle) * speed * dt;
  if (d < officer.radius + player.radius + 4 && officer.hitCooldown <= 0) {
    officer.hitCooldown = 0.9;
    return { hitPlayer: true, damage: 7 };
  }
  return { hitPlayer: false, damage: 0 };
}

/** Cool the wanted level down when no police can see the player. */
export function updateWantedDecay(game, dt) {
  if (game.wanted <= 0) return;
  let seen = false;
  for (const car of game.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    if (dist(car.x, car.y, game.player.x, game.player.y) < 850) { seen = true; break; }
  }
  if (!seen) {
    for (const officer of game.officers) {
      if (!officer.dead && dist(officer.x, officer.y, game.player.x, game.player.y) < 620) { seen = true; break; }
    }
  }
  if (seen) {
    game.wantedTimer = 0;
    game.lastSeen = { x: game.player.x, y: game.player.y };
    return;
  }
  game.wantedTimer += dt;
  const coolSeconds = 14 + game.wanted * 6;
  if (game.wantedTimer >= coolSeconds) {
    game.wanted -= 1;
    game.wantedTimer = 0;
  }
}

/** Draw a foot officer: navy uniform, badge and cap. */
export function drawOfficer(ctx, officer) {
  ctx.save();
  ctx.translate(officer.x, officer.y);
  ctx.rotate(officer.angle);
  ctx.fillStyle = '#2b4a8a';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c33a';
  ctx.beginPath();
  ctx.arc(5, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c2c55';
  ctx.beginPath();
  ctx.arc(3, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
