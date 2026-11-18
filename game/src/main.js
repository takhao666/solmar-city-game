// Solmar City: Streets of Gold — boot, the game loop, the screens and the wiring.
// This file owns the game state object and steps every system once per frame.

import { clamp, dist, mulberry32 } from './util.js';
import { WORLD, buildCity, randomRoadPoint } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { makePlayer, updatePlayerOnFoot, tryEnterCar, exitCar, carHitsPlayer } from './player.js';
import {
  makeCar, updateTrafficCar, updatePlayerCar, separateCars,
  maintainTraffic, spawnTrafficCar, CAR_COLORS,
} from './vehicles.js';
import { makePedestrian, updatePedestrians, maintainPedestrians } from './pedestrians.js';
import {
  addWanted, maintainPolice, updatePoliceCar, updateOfficer, updateWantedDecay,
} from './police.js';
import {
  WEAPONS, updateBullets, updateEnemies, updateParticles, hurtPlayer,
} from './combat.js';
import { startMission, updateMission } from './missions.js';
import { drawHUD, drawTitle, drawPause, drawGameOver, drawWin } from './hud.js';
import { drawWorld, updateCamera } from './render.js';
import { stageShot, simulate } from './shots.js';

const SPAWN = { x: 1350, y: 1350 };

/** Build a fresh game for a seed. */
export function createGame(seed) {
  const rng = mulberry32(seed);
  const save = loadSave();
  const game = {
    seed,
    rng,
    city: buildCity(seed),
    player: makePlayer(SPAWN.x, SPAWN.y),
    cars: [],
    peds: [],
    officers: [],
    enemies: [],
    bullets: [],
    particles: [],
    wanted: 0,
    wantedTimer: 0,
    lastSeen: { x: SPAWN.x, y: SPAWN.y },
    spawnCooldown: 0,
    mission: null,
    failReason: '',
    pendingRestart: null,
    camera: { x: SPAWN.x, y: SPAWN.y },
    time: 0,
    screen: 'title',
    save,
    audio: createAudio(),
    input: createInput(),
    viewW: 1280,
    viewH: 720,
    frozen: false,
  };
  game.player.money = save.money;
  if (save.weapons.includes('smg')) {
    game.player.weapon = 'smg';
    game.player.ammo = WEAPONS.smg.ammo;
  } else if (save.weapons.includes('pistol')) {
    game.player.weapon = 'pistol';
    game.player.ammo = WEAPONS.pistol.ammo;
  }
  // A starting fleet: parked and rolling traffic around the spawn.
  for (let i = 0; i < 20; i += 1) {
    const car = spawnTrafficCar(rng, SPAWN.x, SPAWN.y);
    if (dist(car.x, car.y, SPAWN.x, SPAWN.y) > 500) game.cars.push(car);
  }
  for (let i = 0; i < 55; i += 1) {
    const ped = makePedestrian(rng);
    if (dist(ped.x, ped.y, SPAWN.x, SPAWN.y) < 1300) game.peds.push(ped);
  }
  game.resetWorld = () => resetWorld(game);
  return game;
}

/** Reset the world for a fresh run or a staged screenshot, keeping the same city. */
export function resetWorld(game) {
  game.player = makePlayer(SPAWN.x, SPAWN.y);
  game.player.money = game.save.money;
  if (game.save.weapons.includes('smg')) {
    game.player.weapon = 'smg';
    game.player.ammo = WEAPONS.smg.ammo;
  } else if (game.save.weapons.includes('pistol')) {
    game.player.weapon = 'pistol';
    game.player.ammo = WEAPONS.pistol.ammo;
  }
  game.cars = [];
  game.peds = [];
  game.officers = [];
  game.enemies = [];
  game.bullets = [];
  game.particles = [];
  game.wanted = 0;
  game.wantedTimer = 0;
  game.mission = null;
  game.failReason = '';
  game.pendingRestart = null;
  game.camera = { x: SPAWN.x, y: SPAWN.y };
  game.screen = 'play';
  for (let i = 0; i < 20; i += 1) {
    const car = spawnTrafficCar(game.rng, SPAWN.x, SPAWN.y);
    if (dist(car.x, car.y, SPAWN.x, SPAWN.y) > 420) game.cars.push(car);
  }
  for (let i = 0; i < 55; i += 1) {
    const ped = makePedestrian(game.rng);
    if (dist(ped.x, ped.y, SPAWN.x, SPAWN.y) < 1300) game.peds.push(ped);
  }
}

/** One fixed step of the whole simulation. */
export function stepWorld(game, dt) {
  const input = game.input;
  const player = game.player;
  game.time += dt;

  if (game.mission && game.mission.messageTimer > 0) game.mission.messageTimer -= dt;

  // Mission restart after a failure.
  if (game.pendingRestart) {
    game.pendingRestart.timer -= dt;
    if (game.pendingRestart.timer <= 0) {
      const index = game.pendingRestart.index;
      game.pendingRestart = null;
      player.health = player.maxHealth;
      player.x = SPAWN.x;
      player.y = SPAWN.y;
      if (player.inCar) { player.inCar = false; player.car = null; }
      startMission(game, index);
    }
  }

  // Read the frame's key press directly: consume() would also clear the click,
  // and the click is the fire button, read by the player update below.
  const pressed = input.pressed;
  input.pressed = null;
  // Keep the click until the player update below has read it; only the key press
  // is consumed here, because a click is the fire button.
  if (pressed === 'KeyM' && !game.mission && !game.pendingRestart) {
    startMission(game, game.save.missionIndex);
  }

  // The player, on foot or driving.
  if (player.inCar && player.car) {
    const result = updatePlayerCar(player.car, input, dt, game.city);
    player.x = player.car.x;
    player.y = player.car.y;
    player.angle = player.car.angle;
    if (result.crashed) {
      game.audio.crash();
      game.particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#ffd76a', size: 10, kind: 'spark' });
    }
    game.audio.engine(clamp(Math.abs(player.car.speed) / player.car.maxSpeed, 0, 1), true);
    if (pressed === 'KeyE') exitCar(game);
  } else {
    input.pressed = pressed;
    updatePlayerOnFoot(game, input, dt, game.camera);
    input.pressed = null;
    game.audio.engine(0, false);
    if (pressed === 'KeyE') tryEnterCar(game);
  }
  input.clicked = false; // The player update has read the click (or dropped it).

  // Traffic and police cars.
  for (const car of game.cars) {
    if (car.dead) continue;
    if (car.kind === 'traffic') updateTrafficCar(car, dt, game.cars, game.rng);
    else if (car.kind === 'police') updatePoliceCar(car, game, dt);
  }
  separateCars(game.cars);

  // A fast car that touches a pedestrian is a hit-and-run when it is the player's.
  for (const car of game.cars) {
    if (car.dead) continue;
    for (const ped of game.peds) {
      if (ped.dead) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < car.radius + ped.radius - 6) {
        if (car.kind === 'player' && Math.abs(car.speed) > 120) {
          ped.dead = true;
          addWanted(game, 1);
          game.audio.crash();
        } else if (car.kind === 'police' && Math.abs(car.speed) > 120) {
          ped.dead = true;
        } else {
          // Shove the pedestrian clear of a slow car.
          const a = Math.atan2(ped.y - car.y, ped.x - car.x);
          ped.x += Math.cos(a) * 30 * dt * 10;
          ped.y += Math.sin(a) * 30 * dt * 10;
        }
      }
    }
    carHitsPlayer(game, car);
  }

  // Pedestrians flee from fast cars and from gunfire.
  const danger = [];
  for (const car of game.cars) {
    if (!car.dead && Math.abs(car.speed) > 60) danger.push({ x: car.x, y: car.y, radius: 110 });
  }
  if (game.time - (player.lastShotAt || -99) < 1.5) {
    danger.push({ x: player.x, y: player.y, radius: 220 });
  }
  updatePedestrians(game.peds, dt, game.rng, danger);
  maintainPedestrians(game.peds, game.rng, game.camera.x, game.camera.y);
  maintainTraffic(game.cars, game.rng, game.camera.x, game.camera.y, 30);

  // Police and wanted.
  maintainPolice(game, game.rng, dt);
  for (const officer of game.officers) {
    if (officer.dead) continue;
    const hit = updateOfficer(officer, game, dt);
    if (hit && hit.hitPlayer) hurtPlayer(game, hit.damage, 'officer');
  }
  updateWantedDecay(game, dt);

  // Combat and missions.
  updateBullets(game, dt);
  updateEnemies(game, dt, game.rng);
  updateParticles(game, dt);
  const missionResult = updateMission(game, dt);
  if (missionResult === 'mission' || missionResult === 'win') {
    writeSave(game.save);
  }
  if (missionResult === 'fail' && game.failReason) {
    game.mission = null;
  }

  updateCamera(game, dt);
}

/** Boot the game on the page's canvas. */
export function boot(canvas) {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed')) || 20261118;
  const shot = params.get('shot');
  const game = createGame(seed);
  const ctx = canvas.getContext('2d');

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    game.viewW = w;
    game.viewH = h;
  }
  window.addEventListener('resize', resize);
  resize();
  game.input.attach(canvas);
  game.audio.ensure();

  if (shot) {
    // Screenshot mode: stage one frozen frame and never step again.
    game.screen = stageShot(shot, game, stepWorld);
    game.frozen = true;
    render(game, ctx);
    // A resize after load clears the canvas; repaint the staged frame when that happens.
    window.addEventListener('resize', () => render(game, ctx));
    window.__solmar = { game, shot, staged: true };
    return game;
  }

  window.__solmar = { game };
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 1 / 30);
    last = now;
    const input = game.input;
    const { pressed, clicked } = input.consume();
    // A press the screen handling below consumes (P/Escape, Enter on a menu) must
    // not be re-armed for the world step, or one P press would pause and unpause.
    let handled = false;
    if (pressed === 'KeyP' || pressed === 'Escape') {
      if (game.screen === 'play') game.screen = 'paused';
      else if (game.screen === 'paused') game.screen = 'play';
      game.audio.resume();
      handled = true;
    }
    if (!handled && game.screen === 'title' && (pressed === 'Enter' || clicked)) {
      game.audio.resume();
      resetWorld(game);
      if (game.save.missionIndex > 0) startMission(game, game.save.missionIndex);
      game.screen = 'play';
      // Swallow the starting press and click so they are not also a shot.
      input.pressed = null;
      input.clicked = false;
      handled = true;
    } else if (!handled && (game.screen === 'over' || game.screen === 'win') && pressed === 'Enter') {
      game.audio.resume();
      resetWorld(game);
      game.screen = 'play';
      input.pressed = null;
      input.clicked = false;
      handled = true;
    }
    if (!handled && game.screen === 'play') {
      // Only the live game reads presses; a press made while paused is dropped.
      input.pressed = pressed;
      input.clicked = clicked;
    } else if (!handled) {
      input.pressed = null;
      input.clicked = false;
    }

    if (game.screen === 'play' && !game.frozen) {
      try {
        stepWorld(game, dt);
      } catch (err) {
        // One bad step must never kill the loop: report it and keep playing.
        console.error('step error', err);
        document.title = 'SOLMAR ERROR: ' + String(err && err.message ? err.message : err).slice(0, 120);
      }
    }
    try {
      render(game, ctx);
    } catch (err) {
      // One bad frame must never kill the loop: report it and keep playing.
      console.error('render error', err);
      document.title = 'SOLMAR ERROR: ' + String(err && err.message ? err.message : err).slice(0, 120);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return game;
}

/** Draw the current screen. */
export function render(game, ctx) {
  const viewW = game.viewW;
  const viewH = game.viewH;
  if (game.screen === 'title') {
    drawTitle(ctx, game, viewW, viewH);
    return;
  }
  drawWorld(ctx, game, viewW, viewH);
  if (game.screen === 'play' || game.screen === 'paused') drawHUD(ctx, game, viewW, viewH);
  if (game.screen === 'paused') drawPause(ctx, viewW, viewH);
  if (game.screen === 'over') drawGameOver(ctx, game, viewW, viewH);
  if (game.screen === 'win') drawWin(ctx, game, viewW, viewH);
}
