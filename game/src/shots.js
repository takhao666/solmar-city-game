// Screenshot staging: ?shot=drive|chase|mission|menu plays the real game forward
// from a fresh world with a simple autopilot, so each screenshot is a frame a real
// player could reach, and the same seed always gives the same frame.

import { clamp, dist, angleDiff, angleTo, pick } from './util.js';
import { WORLD, isRoad, landmark, resolveBuildings } from './city.js';
import { startMission, missionMarker } from './missions.js';
import { addWanted } from './police.js';
import { tryEnterCar } from './player.js';
import { makeBullet, makeSpark } from './combat.js';
import { makePedestrian } from './pedestrians.js';
import { makeCar, CAR_COLORS, POLICE_COLOR } from './vehicles.js';

const STEP = 1 / 60;

function autopilotInput(game) {
  const player = game.player;
  const marker = missionMarker(game);
  const target = marker || { x: WORLD / 2, y: WORLD / 2 };
  const keys = new Set();
  const tx = target.x - player.x;
  const ty = target.y - player.y;
  if (player.inCar && player.car) {
    const car = player.car;
    const want = angleTo(car.x, car.y, target.x, target.y);
    const diff = angleDiff(car.angle, want);
    const speed = Math.abs(car.speed);
    // Drive forward, steering toward the target; reverse out when badly misaligned.
    if (Math.abs(diff) < 0.5) keys.add('KeyW');
    else if (Math.abs(diff) > 2.2 && speed < 40) keys.add('KeyS');
    else keys.add('KeyW');
    if (diff > 0.12) keys.add('KeyD');
    else if (diff < -0.12) keys.add('KeyA');
    if (speed > 240 && Math.abs(diff) > 0.9) keys.delete('KeyW');
    return { keys };
  }
  // On foot: walk toward the target.
  if (Math.abs(tx) > 24) keys.add(tx > 0 ? 'KeyD' : 'KeyA');
  if (Math.abs(ty) > 24) keys.add(ty > 0 ? 'KeyS' : 'KeyW');
  return { keys };
}

/** Run the game forward for `seconds` of simulation with the autopilot at the wheel. */
export function simulate(game, stepWorld, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.input.synth = autopilotInput(game);
    stepWorld(game, STEP);
    game.input.synth = null;
  }
}

/** Remove cars, officers and pedestrians within `r` of (x, y), except the `keep` set. */
function clearAround(game, x, y, r, keep) {
  game.cars = game.cars.filter((c) => keep.has(c) || dist(c.x, c.y, x, y) > r);
  game.officers = game.officers.filter((o) => dist(o.x, o.y, x, y) > r);
  game.peds = game.peds.filter((p) => keep.has(p) || dist(p.x, p.y, x, y) > r);
}

/** Scatter pedestrians on the north sidewalk of the road at `roadY`, around `cx`. */
function sprinkleSidewalkPeds(game, roadY, cx, count) {
  for (let i = 0; i < count; i += 1) {
    const x = cx + (i - count / 2) * 150 + (game.rng() - 0.5) * 60;
    const ped = makePedestrian(game.rng, clamp(x, 60, WORLD - 60), roadY - 61);
    ped.angle = game.rng() * Math.PI * 2;
    game.peds.push(ped);
  }
}

/** A staged traffic car on a road, moving with the flow. */
function stageTrafficCar(game, x, y, angle, speed) {
  const car = makeCar(x, y, angle, pick(game.rng, CAR_COLORS), 'traffic');
  car.speed = speed;
  game.cars.push(car);
  return car;
}

/** Nudge a staged car toward the player until it sits on a road, never on a building. */
function snapToRoad(game, car) {
  for (let i = 0; i < 8 && !isRoad(car.x, car.y); i += 1) {
    car.x += (game.player.x - car.x) * 0.15;
    car.y += (game.player.y - car.y) * 0.15;
  }
}

/**
 * Set the game to the named scene and return the screen to show.
 * drive: the player cruises the marina waterfront road, traffic ahead, boats behind.
 * chase: wanted level 4, four cruisers trailing the speeding player in formation.
 * mission: the Rival Turf shootout, mid-firefight, tracers in the air.
 * marina: the First Fare pickup — the taxi, the waiting client, the marina behind.
 */
export function stageShot(name, game, stepWorld) {
  game.resetWorld();
  if (name === 'drive') {
    // Steal a car, cruise a few seconds, then set the waterfront scene: the player
    // westbound on the marina road, traffic ahead, boats on the water below.
    const car = game.cars.find((c) => c.kind === 'traffic');
    if (car) {
      game.player.x = car.x + 30;
      game.player.y = car.y;
      tryEnterCar(game);
    }
    simulate(game, stepWorld, 4);
    game.wanted = 0;
    game.cars = game.cars.filter((c) => c.kind !== 'police');
    game.officers = [];
    const marina = landmark(game.city, 'Marina');
    const playerCar = game.player.car;
    if (playerCar) {
      playerCar.x = marina.x + 200;
      playerCar.y = marina.y - 18;
      playerCar.angle = Math.PI;
      playerCar.speed = 260;
      game.player.x = playerCar.x;
      game.player.y = playerCar.y;
      game.player.angle = Math.PI;
      game.camera.x = playerCar.x;
      game.camera.y = playerCar.y;
    }
    clearAround(game, marina.x + 200, marina.y - 18, 220, new Set([playerCar]));
    stageTrafficCar(game, marina.x - 60, marina.y - 18, Math.PI, 210);
    stageTrafficCar(game, marina.x - 240, marina.y - 18, Math.PI, 200);
    stageTrafficCar(game, marina.x - 420, marina.y - 18, Math.PI, 215);
    stageTrafficCar(game, marina.x + 520, marina.y + 18, 0, 190);
    sprinkleSidewalkPeds(game, marina.y, marina.x + 50, 6);
    return 'play';
  }
  if (name === 'chase') {
    const car = game.cars.find((c) => c.kind === 'traffic');
    if (car) {
      game.player.x = car.x + 30;
      game.player.y = car.y;
      tryEnterCar(game);
    }
    addWanted(game, 3);
    simulate(game, stepWorld, 13);
    // Four stars, four cruisers trailing the player in formation — a chase, not a pile-up.
    game.wanted = 4;
    game.cars = game.cars.filter((c) => c.kind !== 'police');
    game.officers = [];
    const playerCar = game.player.car;
    if (playerCar) {
      const fx = Math.cos(playerCar.angle);
      const fy = Math.sin(playerCar.angle);
      const px = -fy;
      const py = fx;
      clearAround(game, playerCar.x, playerCar.y, 170, new Set([playerCar]));
      for (let i = 0; i < 4; i += 1) {
        const back = 150 + i * 115;
        const side = (i % 2 === 0 ? 34 : -34) + (i - 1.5) * 8;
        const cruiser = makeCar(
          playerCar.x - fx * back + px * side,
          playerCar.y - fy * back + py * side,
          playerCar.angle, POLICE_COLOR, 'police',
        );
        cruiser.maxSpeed = 380;
        cruiser.accel = 320;
        cruiser.speed = playerCar.speed;
        snapToRoad(game, cruiser);
        game.cars.push(cruiser);
      }
    }
    return 'play';
  }
  if (name === 'mission') {
    // Rival Turf: the player on foot with the SMG, Vipers closing in, tracers flying.
    startMission(game, 3);
    game.player.weapon = 'smg';
    game.player.ammo = 30;
    simulate(game, stepWorld, 6);
    if (game.mission) game.mission.messageTimer = 0;
    const living = game.enemies.filter((e) => !e.dead);
    living.sort((a, b) => dist(a.x, a.y, game.player.x, game.player.y) - dist(b.x, b.y, game.player.x, game.player.y));
    if (living.length > 0) {
      const target = living[0];
      // Step the player to a clear firing position 260px from the nearest Viper.
      const a = angleTo(target.x, target.y, game.player.x, game.player.y);
      game.player.x = clamp(target.x + Math.cos(a) * 260, 60, WORLD - 60);
      game.player.y = clamp(target.y + Math.sin(a) * 260, 60, WORLD - 60);
      resolveBuildings(game.city, game.player);
      game.player.angle = angleTo(game.player.x, game.player.y, target.x, target.y);
      game.camera.x = game.player.x;
      game.camera.y = game.player.y;
      clearAround(game, game.player.x, game.player.y, 170, new Set());
      // Two of Rex's tracers downrange, one Viper round coming back, muzzle sparks.
      for (let i = 0; i < Math.min(2, living.length); i += 1) {
        const e = living[i];
        const fa = angleTo(game.player.x, game.player.y, e.x, e.y);
        game.bullets.push(makeBullet(
          (game.player.x + e.x) / 2, (game.player.y + e.y) / 2, fa, 720, 12, true,
        ));
      }
      const shooter = living[0];
      const ba = angleTo(shooter.x, shooter.y, game.player.x, game.player.y);
      game.bullets.push(makeBullet(
        (shooter.x + game.player.x) / 2, (shooter.y + game.player.y) / 2, ba, 520, 6, false,
      ));
      game.particles.push(makeSpark(
        game.player.x + Math.cos(game.player.angle) * 22,
        game.player.y + Math.sin(game.player.angle) * 22,
      ));
      game.particles.push(makeSpark(
        shooter.x + Math.cos(ba) * 18,
        shooter.y + Math.sin(ba) * 18,
      ));
    }
    return 'play';
  }
  if (name === 'marina') {
    // First Fare: the taxi at the marina pickup, the client waiting on the sidewalk,
    // the mission beacon over them and the boats behind.
    startMission(game, 0);
    const car = game.cars.find((c) => c.kind === 'traffic');
    if (car) {
      game.player.x = car.x + 30;
      game.player.y = car.y;
      tryEnterCar(game);
    }
    simulate(game, stepWorld, 2);
    if (game.mission) game.mission.messageTimer = 0;
    game.wanted = 0;
    game.cars = game.cars.filter((c) => c.kind !== 'police');
    game.officers = [];
    const marina = landmark(game.city, 'Marina');
    const playerCar = game.player.car;
    if (playerCar) {
      playerCar.x = marina.x - 150;
      playerCar.y = marina.y - 18;
      playerCar.angle = Math.PI;
      playerCar.speed = 0;
      game.player.x = playerCar.x;
      game.player.y = playerCar.y;
      game.player.angle = Math.PI;
      game.camera.x = playerCar.x;
      game.camera.y = playerCar.y;
    }
    clearAround(game, marina.x - 150, marina.y - 18, 220, new Set([playerCar]));
    // The client waits on the sidewalk beside the mission's pickup point.
    const client = makePedestrian(game.rng, marina.x + marina.w / 2 - 260, marina.y - 61);
    client.label = 'CLIENT';
    client.stand = true;
    client.shirt = '#e8c33a';
    game.peds.push(client);
    sprinkleSidewalkPeds(game, marina.y, marina.x + 50, 5);
    return 'play';
  }
  // Any other name stages the drive scene.
  return stageShot('drive', game, stepWorld);
}
