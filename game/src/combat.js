// Combat: fists, the pistol and the SMG, bullets, muzzle sparks, enemy gang members
// who shoot back with poor aim, and the damage numbers that keep a fight fair.
// Enemy damage is tuned so a fight is survivable: no single hit takes much health.

import { clamp, dist, distSq, angleTo, mulberry32, pick } from './util.js';
import { WORLD } from './city.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 42, rate: 0.45, auto: false, bulletSpeed: 0, spread: 0 },
  pistol: { name: 'Pistol', damage: 22, range: 420, rate: 0.32, auto: false, bulletSpeed: 720, spread: 0.05, ammo: 12 },
  smg: { name: 'SMG', damage: 12, range: 380, rate: 0.09, auto: true, bulletSpeed: 780, spread: 0.12, ammo: 30 },
};

let nextBulletId = 1;
let nextEnemyId = 1;

/** Make a bullet from (x, y) along `angle`. */
export function makeBullet(x, y, angle, speed, damage, friendly) {
  return {
    id: nextBulletId,
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    friendly: !!friendly,
    life: 1.2,
    dead: false,
  };
}

/** Make one Viper gang member who shoots at the player. */
export function makeEnemy(x, y, rng) {
  return {
    id: nextEnemyId,
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 95 + rng() * 30,
    radius: 13,
    health: 55,
    maxHealth: 55,
    shootCooldown: 0.6 + rng() * 0.8,
    retarget: 0,
    dead: false,
    shirt: '#5a2e6e',
  };
}

/** Spawn a small gang squad around a point, on open ground. */
export function spawnGang(game, x, y, count, rng) {
  const made = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const r = 60 + rng() * 160;
    const enemy = makeEnemy(
      clamp(x + Math.cos(angle) * r, 80, WORLD - 80),
      clamp(y + Math.sin(angle) * r, 80, WORLD - 80),
      rng,
    );
    game.enemies.push(enemy);
    made.push(enemy);
  }
  return made;
}

/** Step all bullets: move, age out, and hit buildings, cars, enemies, officers or the player. */
export function updateBullets(game, dt) {
  for (const bullet of game.bullets) {
    if (bullet.dead) continue;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.x < 20 || bullet.x > WORLD - 20 || bullet.y < 20 || bullet.y > WORLD - 20) {
      bullet.dead = true;
      continue;
    }
    if (game.city && hitsBuildingPoint(game.city, bullet.x, bullet.y)) {
      bullet.dead = true;
      game.particles.push(makeSpark(bullet.x, bullet.y));
      continue;
    }
    if (bullet.friendly) {
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        if (distSq(bullet.x, bullet.y, enemy.x, enemy.y) < (enemy.radius + 4) * (enemy.radius + 4)) {
          enemy.health -= bullet.damage;
          bullet.dead = true;
          game.particles.push(makeSpark(bullet.x, bullet.y));
          if (enemy.health <= 0) {
            enemy.dead = true;
            game.particles.push(makeBurst(enemy.x, enemy.y, '#c94f6e'));
          }
          break;
        }
      }
      if (bullet.dead) continue;
      for (const officer of game.officers) {
        if (officer.dead) continue;
        if (distSq(bullet.x, bullet.y, officer.x, officer.y) < (officer.radius + 4) * (officer.radius + 4)) {
          officer.health -= bullet.damage;
          bullet.dead = true;
          game.particles.push(makeSpark(bullet.x, bullet.y));
          if (officer.health <= 0) officer.dead = true;
          break;
        }
      }
    } else {
      const player = game.player;
      const target = player.inCar ? player.car : player;
      const radius = target.radius || 14;
      if (distSq(bullet.x, bullet.y, target.x, target.y) < (radius + 4) * (radius + 4)) {
        bullet.dead = true;
        hurtPlayer(game, bullet.damage, 'shot');
      }
    }
  }
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    if (game.bullets[i].dead) game.bullets.splice(i, 1);
  }
}

function hitsBuildingPoint(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  for (const lm of city.landmarks) {
    if (lm.name === 'Marina') continue;
    if (x >= lm.x && x <= lm.x + lm.w && y >= lm.y && y <= lm.y + lm.h) return true;
  }
  return false;
}

/** Damage the player, through armor first, with a short grace window after each hit. */
export function hurtPlayer(game, damage, source) {
  const player = game.player;
  if (player.invuln > 0 || player.health <= 0) return false;
  let remaining = damage;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, remaining * 0.6);
    player.armor -= absorbed;
    remaining -= absorbed;
  }
  player.health -= remaining;
  player.invuln = 0.25;
  player.lastHurtAt = game.time;
  if (player.health <= 0) {
    player.health = 0;
    game.screen = 'over';
    game.audio.fail();
  }
  return true;
}

/** Enemies strafe toward the player and fire with deliberately poor aim. */
export function updateEnemies(game, dt, rng) {
  const player = game.player;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    enemy.retarget -= dt;
    enemy.shootCooldown -= dt;
    const d = dist(enemy.x, enemy.y, player.x, player.y);
    if (enemy.retarget <= 0) {
      enemy.retarget = 0.7 + rng() * 0.9;
      const strafe = rng() < 0.5 ? 1 : -1;
      enemy.angle = angleTo(enemy.x, enemy.y, player.x, player.y) + strafe * (0.5 + rng() * 0.5);
    }
    if (d > 260) {
      enemy.x += Math.cos(angleTo(enemy.x, enemy.y, player.x, player.y)) * enemy.speed * dt;
      enemy.y += Math.sin(angleTo(enemy.x, enemy.y, player.x, player.y)) * enemy.speed * dt;
    } else if (d < 130) {
      enemy.x -= Math.cos(angleTo(enemy.x, enemy.y, player.x, player.y)) * enemy.speed * 0.6 * dt;
      enemy.y -= Math.sin(angleTo(enemy.x, enemy.y, player.x, player.y)) * enemy.speed * 0.6 * dt;
    } else {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * 0.5 * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * 0.5 * dt;
    }
    if (enemy.shootCooldown <= 0 && d < 480) {
      enemy.shootCooldown = 0.9 + rng() * 0.7;
      const aim = angleTo(enemy.x, enemy.y, player.x, player.y) + (rng() - 0.5) * 0.35;
      game.bullets.push(makeBullet(enemy.x, enemy.y, aim, 520, 6, false));
      game.particles.push(makeSpark(enemy.x + Math.cos(aim) * 16, enemy.y + Math.sin(aim) * 16));
    }
  }
  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    if (game.enemies[i].dead) game.enemies.splice(i, 1);
  }
}

export function makeSpark(x, y) {
  return { x, y, vx: 0, vy: 0, life: 0.18, maxLife: 0.18, color: '#ffd76a', size: 5, kind: 'spark' };
}

export function makeBurst(x, y, color) {
  return { x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color: color || '#ff8a5c', size: 16, kind: 'burst' };
}

/** Step particles (sparks, bursts, cash pops) and drop the spent ones. */
export function updateParticles(game, dt) {
  for (const p of game.particles) {
    p.life -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
  }
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    if (game.particles[i].life <= 0) game.particles.splice(i, 1);
  }
}

/** Draw bullets, enemies and particles. Bullets are bright tracer streaks along
 * their flight, so a firefight reads at a glance. */
export function drawCombat(ctx, game) {
  for (const bullet of game.bullets) {
    const tx = bullet.x - bullet.vx * 0.035;
    const ty = bullet.y - bullet.vy * 0.035;
    ctx.strokeStyle = bullet.friendly ? '#ffd76a' : '#ff5c5c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.fillStyle = bullet.friendly ? '#fff3c4' : '#ffb3b3';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(3, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(-8, -14, 16, 3);
    ctx.restore();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(enemy.x - 16, enemy.y - 24, 32, 5);
    ctx.fillStyle = '#e84f4f';
    ctx.fillRect(enemy.x - 16, enemy.y - 24, 32 * clamp(enemy.health / enemy.maxHealth, 0, 1), 5);
  }
  for (const p of game.particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
