// The world renderer: draws the city, the mission marker, the cars, the people,
// the player and the little effects that make the street feel alive —
// in that order, so the player always stands on top of the road.

import { clamp, dist } from './util.js';
import { drawCity, WORLD } from './city.js';
import { drawCar } from './vehicles.js';
import { drawPedestrian } from './pedestrians.js';
import { drawOfficer } from './police.js';
import { drawCombat } from './combat.js';
import { missionMarker } from './missions.js';

/** Draw one frame of the world for the camera at (camX, camY). */
export function drawWorld(ctx, game, viewW, viewH) {
  const cam = game.camera;
  ctx.save();
  ctx.translate(viewW / 2 - cam.x, viewH / 2 - cam.y);

  drawCity(ctx, game.city, cam, viewW, viewH);

  // Mission marker: a tall golden beacon and a ring on the ground.
  const marker = missionMarker(game);
  if (marker && game.screen === 'play') {
    const pulse = 1 + Math.sin(game.time * 4) * 0.12;
    ctx.fillStyle = 'rgba(255,215,106,0.25)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    const grad = ctx.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(255,215,106,0)');
    grad.addColorStop(1, 'rgba(255,215,106,0.5)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(marker.x - 8, marker.y);
    ctx.lineTo(marker.x + 8, marker.y);
    ctx.lineTo(marker.x + 3, marker.y - 260);
    ctx.lineTo(marker.x - 3, marker.y - 260);
    ctx.closePath();
    ctx.fill();
  }

  // Cars first (lowest), then people, then the player.
  for (const car of game.cars) {
    if (car.dead) continue;
    if (Math.abs(car.x - cam.x) > viewW / 2 + 120 || Math.abs(car.y - cam.y) > viewH / 2 + 120) continue;
    drawCar(ctx, car);
  }
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (Math.abs(ped.x - cam.x) > viewW / 2 + 80 || Math.abs(ped.y - cam.y) > viewH / 2 + 80) continue;
    drawPedestrian(ctx, ped, game.time);
  }
  for (const officer of game.officers) {
    if (officer.dead) continue;
    drawOfficer(ctx, officer);
  }
  drawCombat(ctx, game);
  drawPlayer(ctx, game);
  ctx.restore();
}

/** Draw the player on foot: shoulders, head, and the weapon they carry. */
export function drawPlayer(ctx, game) {
  const player = game.player;
  if (player.inCar || player.health <= 0) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body and head.
  ctx.fillStyle = '#2f6db3';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(5, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  // The weapon in hand, when armed.
  if (player.weapon !== 'fists') {
    ctx.fillStyle = '#22222a';
    ctx.fillRect(8, -2, 12, 4);
  }
  // Aim line, short and subtle.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(26, 0);
  ctx.stroke();
  ctx.restore();
}

/** The camera eases toward its target so the view never snaps. */
export function updateCamera(game, dt) {
  const target = game.player.inCar && game.player.car ? game.player.car : game.player;
  const tx = clamp(target.x, 0, WORLD);
  const ty = clamp(target.y, 0, WORLD);
  const k = 1 - Math.pow(0.001, dt);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
}
