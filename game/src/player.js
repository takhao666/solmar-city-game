// The player on foot: walking, sprinting, punching, shooting, and getting in and out
// of cars. Driving itself lives in vehicles.js; this module is only the person.

import { clamp, dist, angleTo, angleDiff } from './util.js';
import { WORLD, resolveBuildings } from './city.js';
import { nearestStealableCar } from './vehicles.js';
import { makeBullet, WEAPONS, hurtPlayer } from './combat.js';
import { addWanted } from './police.js';

/** Make the player at a spawn point. */
export function makePlayer(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    radius: 14,
    health: 100,
    maxHealth: 100,
    armor: 0,
    money: 0,
    weapon: 'fists',
    ammo: 0,
    inCar: false,
    car: null,
    punchCooldown: 0,
    shootCooldown: 0,
    ramCooldown: 0,
    invuln: 0,
    lastHurtAt: -99,
  };
}

/** Update the player on foot: move, aim at the mouse, punch and shoot. */
export function updatePlayerOnFoot(game, input, dt, cam) {
  const player = game.player;
  player.invuln = Math.max(0, player.invuln - dt);
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.ramCooldown = Math.max(0, player.ramCooldown - dt);

  // Slow health recovery after eight quiet seconds.
  if (game.time - player.lastHurtAt > 8 && player.health > 0 && player.health < player.maxHealth) {
    player.health = Math.min(player.maxHealth, player.health + 2 * dt);
  }

  // Aim follows the mouse (screen space -> world space).
  const worldMouseX = input.mouseX + cam.x - game.viewW / 2;
  const worldMouseY = input.mouseY + cam.y - game.viewH / 2;
  const moving = input.axis();
  if (moving.x !== 0 || moving.y !== 0) {
    player.angle = Math.atan2(moving.y, moving.x);
  } else if (Number.isFinite(worldMouseX) && Number.isFinite(worldMouseY)) {
    player.angle = angleTo(player.x, player.y, worldMouseX, worldMouseY);
  }

  const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = sprint ? 235 : 150;
  const len = Math.hypot(moving.x, moving.y) || 1;
  player.x += (moving.x / len) * speed * dt;
  player.y += (moving.y / len) * speed * dt;
  player.x = clamp(player.x, 40, WORLD - 40);
  player.y = clamp(player.y, 40, WORLD - 40);
  resolveBuildings(game.city, player);

  // Punch: a short-range swing that hurts the nearest enemy, officer or pedestrian.
  if (input.pressed === 'KeyF' && player.punchCooldown <= 0) {
    player.punchCooldown = WEAPONS.fists.rate;
    game.audio.punch();
    const reach = WEAPONS.fists.range;
    let best = null;
    let bestD = reach;
    const candidates = [];
    for (const e of game.enemies) if (!e.dead) candidates.push(e);
    for (const o of game.officers) if (!o.dead) candidates.push(o);
    for (const target of candidates) {
      const d = dist(player.x, player.y, target.x, target.y);
      const facing = Math.abs(angleDiff(player.angle, angleTo(player.x, player.y, target.x, target.y)));
      if (d < bestD && facing < 1.2) { bestD = d; best = target; }
    }
    if (best) {
      best.health -= WEAPONS.fists.damage;
      if (best.health <= 0) best.dead = true;
      // Knockback: the punch visibly shoves them back.
      const ka = angleTo(player.x, player.y, best.x, best.y);
      best.x = clamp(best.x + Math.cos(ka) * 26, 40, WORLD - 40);
      best.y = clamp(best.y + Math.sin(ka) * 26, 40, WORLD - 40);
      resolveBuildings(game.city, best);
      game.particles.push({ x: best.x, y: best.y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2, color: '#ffd76a', size: 6, kind: 'spark' });
    }
  }

  // Shoot toward the mouse when armed; a click is one shot for the pistol.
  const weapon = WEAPONS[player.weapon];
  const wantShot = player.weapon !== 'fists'
    && player.shootCooldown <= 0
    && (weapon.auto ? input.mouseDown : input.clicked);
  if (wantShot) {
    if (player.ammo <= 0) {
      player.shootCooldown = 0.3;
      game.audio.tone(140, 0.06, 'square', 0.1);
      return;
    }
    player.shootCooldown = weapon.rate;
    player.ammo -= 1;
    player.lastShotAt = game.time;
    const spread = (Math.random() - 0.5) * weapon.spread * 2;
    const angle = player.angle + spread;
    game.bullets.push(makeBullet(
      player.x + Math.cos(angle) * 18,
      player.y + Math.sin(angle) * 18,
      angle, weapon.bulletSpeed, weapon.damage, true,
    ));
    // Muzzle flash: a bright spark at the barrel so the shot reads.
    game.particles.push({
      x: player.x + Math.cos(angle) * 22, y: player.y + Math.sin(angle) * 22,
      vx: 0, vy: 0, life: 0.12, maxLife: 0.12, color: '#fff3c4', size: 9, kind: 'spark',
    });
    game.audio.shot();
    if (game.wanted < 1) addWanted(game, 1);
  }
}

/** Try to enter the nearest car (stealing it when it has a driver of its own). */
export function tryEnterCar(game) {
  const player = game.player;
  if (player.inCar) return false;
  const car = nearestStealableCar(game.cars, player.x, player.y, 70);
  if (!car) return false;
  if (car.kind === 'traffic') {
    addWanted(game, 1); // Stealing a car is a crime, and the street notices.
    game.audio.crash();
  }
  car.driver = 'player';
  car.kind = 'player';
  player.inCar = true;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  return true;
}

/** Step out of the car beside it. */
export function exitCar(game) {
  const player = game.player;
  if (!player.inCar || !player.car) return false;
  const car = player.car;
  car.driver = null;
  car.kind = 'traffic';
  car.speed *= 0.2;
  player.inCar = false;
  player.car = null;
  player.x = clamp(car.x + Math.cos(car.angle + Math.PI / 2) * 34, 40, WORLD - 40);
  player.y = clamp(car.y + Math.sin(car.angle + Math.PI / 2) * 34, 40, WORLD - 40);
  player.angle = car.angle;
  return true;
}

/** The player is run over or rammed: a fast car touch costs a little health, at most
 *  once a second per player, so a police car leaning on a standing player cannot
 *  shred them faster than they can run. */
export function carHitsPlayer(game, car) {
  const player = game.player;
  if (player.inCar || player.health <= 0) return;
  if (Math.abs(car.speed) < 60) return;
  if (player.ramCooldown > 0) return;
  if (dist(car.x, car.y, player.x, player.y) < car.radius + player.radius - 4) {
    player.ramCooldown = 1.0;
    hurtPlayer(game, 6, 'ram');
    // Shove the player clear of the wheels.
    const a = angleTo(car.x, car.y, player.x, player.y);
    player.x = clamp(player.x + Math.cos(a) * 26, 40, WORLD - 40);
    player.y = clamp(player.y + Math.sin(a) * 26, 40, WORLD - 40);
    game.audio.crash();
  }
}
