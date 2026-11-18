// Screenshot staging: ?shot=drive|chase|mission|menu plays the real game forward
// from a fresh world with a simple autopilot, so each screenshot is a frame a real
// player could reach, and the same seed always gives the same frame.

import { clamp, dist, angleDiff, angleTo } from './util.js';
import { WORLD } from './city.js';
import { startMission, missionMarker } from './missions.js';
import { addWanted } from './police.js';
import { tryEnterCar } from './player.js';

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

/**
 * Set the game to the named scene and return the screen to show.
 * drive: the player steals a car and cruises the avenues with traffic.
 * chase: wanted level 3, police cars closing in on a speeding player.
 * mission: the getaway mission, mid-escape, with the safehouse marker ahead.
 * menu: the title screen after a few seconds of the city living behind it.
 */
export function stageShot(name, game, stepWorld) {
  game.resetWorld();
  if (name === 'menu') {
    simulate(game, stepWorld, 3);
    return 'title';
  }
  if (name === 'drive') {
    // Put the player beside a car, steal it, and cruise.
    const car = game.cars.find((c) => c.kind === 'traffic');
    if (car) {
      game.player.x = car.x + 30;
      game.player.y = car.y;
      tryEnterCar(game);
    }
    simulate(game, stepWorld, 16);
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
    return 'play';
  }
  if (name === 'mission') {
    startMission(game, 1);
    const car = game.cars.find((c) => c.kind === 'traffic');
    if (car) {
      game.player.x = car.x + 30;
      game.player.y = car.y;
      tryEnterCar(game);
    }
    simulate(game, stepWorld, 12);
    return 'play';
  }
  // Any other name stages the drive scene.
  return stageShot('drive', game, stepWorld);
}
