// The HUD, the minimap and the menus: health, armor, money, wanted stars, the mission
// objective, the weapon readout, the start screen, pause, game over and the win screen.
// Everything is drawn on the canvas so the screenshots show the real interface.

import { clamp, formatMoney, formatTime } from './util.js';
import { WORLD } from './city.js';
import { missionMarker, objectiveText } from './missions.js';
import { MAX_WANTED } from './police.js';
import { WEAPONS } from './combat.js';

const MINIMAP = 168;
const MINIMAP_MARGIN = 14;

/** Draw the in-game HUD over the world. */
export function drawHUD(ctx, game, viewW, viewH) {
  const player = game.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: health and armor bars, money, weapon.
  ctx.fillStyle = 'rgba(10,10,14,0.62)';
  ctx.beginPath();
  ctx.roundRect(14, 14, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#f5edd8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('REX MARLOWE', 26, 36);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(26, 46, 226, 12);
  ctx.fillStyle = player.health > 30 ? '#5ec95e' : '#e84f4f';
  ctx.fillRect(26, 46, 226 * clamp(player.health / 100, 0, 1), 12);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(26, 62, 226, 8);
  ctx.fillStyle = '#7ab8e8';
  ctx.fillRect(26, 62, 226 * clamp(player.armor / 100, 0, 1), 8);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(formatMoney(player.money), 26, 94);
  const weapon = WEAPONS[player.weapon] || WEAPONS.fists;
  ctx.fillStyle = '#f5edd8';
  ctx.font = '13px sans-serif';
  const ammo = player.weapon === 'fists' ? '∞' : `${player.ammo}`;
  ctx.fillText(`${weapon.name}  ·  ${ammo}`, 150, 94);

  // Top-centre: wanted stars.
  const stars = game.wanted;
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < MAX_WANTED; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd76a' : 'rgba(245,237,216,0.28)';
    ctx.fillText('★', viewW / 2 + (i - 2) * 30, 44);
  }
  ctx.fillStyle = 'rgba(245,237,216,0.85)';
  ctx.font = '12px sans-serif';
  if (stars > 0) ctx.fillText(stars >= 3 ? 'THE WHOLE DEPARTMENT IS AFTER YOU' : 'WANTED — break line of sight to cool off', viewW / 2, 64);
  ctx.textAlign = 'left';

  // Bottom-centre: mission objective.
  const objective = objectiveText(game);
  ctx.font = 'bold 16px sans-serif';
  const ow = ctx.measureText(objective).width;
  ctx.fillStyle = 'rgba(10,10,14,0.62)';
  ctx.beginPath();
  ctx.roundRect(viewW / 2 - ow / 2 - 16, viewH - 52, ow + 32, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.textAlign = 'center';
  ctx.fillText(objective, viewW / 2, viewH - 29);
  ctx.textAlign = 'left';

  // Bottom-left: controls hint.
  ctx.fillStyle = 'rgba(245,237,216,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move · E enter/exit car · F punch · Click shoot · Shift sprint · P pause · M next job', 16, viewH - 14);

  // Mission briefing banner, fading after a few seconds.
  if (game.mission && game.mission.messageTimer > 0) {
    const alpha = clamp(game.mission.messageTimer / 1.5, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10,10,14,0.78)';
    ctx.beginPath();
    ctx.roundRect(viewW / 2 - 330, 84, 660, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.mission.def.title, viewW / 2, 110);
    ctx.fillStyle = '#f5edd8';
    ctx.font = '13px sans-serif';
    wrapText(ctx, game.mission.message, viewW / 2, 130, 620, 17);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, game, viewW, viewH);
}

/** The minimap: roads, the player, cars, police, enemies and the mission marker. */
export function drawMinimap(ctx, game, viewW, viewH) {
  const size = MINIMAP;
  const x0 = viewW - size - MINIMAP_MARGIN;
  const y0 = MINIMAP_MARGIN;
  const scale = size / WORLD;
  ctx.fillStyle = 'rgba(10,10,14,0.66)';
  ctx.beginPath();
  ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // A warm map face, like the sun-baked ground, so the roads read at a glance.
  ctx.fillStyle = '#8a7a5c';
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = '#3a332a';
  ctx.lineWidth = 2.5;
  for (const c of game.city.centres) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + c * scale);
    ctx.lineTo(x0 + size, y0 + c * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 + c * scale, y0);
    ctx.lineTo(x0 + c * scale, y0 + size);
    ctx.stroke();
  }
  // Marina water.
  ctx.fillStyle = '#5fa8c4';
  ctx.fillRect(x0 + 4050 * scale, y0 + 4050 * scale, 420 * scale, 300 * scale);
  // Mission marker, pulsing.
  const marker = missionMarker(game);
  if (marker) {
    const pulse = 3 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5c00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police, enemies, traffic.
  for (const car of game.cars) {
    if (car.dead) continue;
    ctx.fillStyle = car.kind === 'police' ? '#5c8dff' : 'rgba(245,237,216,0.8)';
    ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
  }
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    ctx.fillStyle = '#ff5c8a';
    ctx.fillRect(x0 + enemy.x * scale - 2, y0 + enemy.y * scale - 2, 4, 4);
  }
  // The player: a white arrow that turns with them.
  const player = game.player;
  ctx.save();
  ctx.translate(x0 + player.x * scale, y0 + player.y * scale);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(245,237,216,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 6, y0 - 6, size + 12, size + 12);
}

/** Word-wrap a line of text centred on x, starting at y. */
export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

/** The title screen: name, story, controls, and start / continue. */
export function drawTitle(ctx, game, viewW, viewH) {
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, viewW, viewH);
  // A warm sunset gradient behind the title.
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, '#2b1d3a');
  grad.addColorStop(0.55, '#8a3d4d');
  grad.addColorStop(1, '#e07b39');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, viewH - 190, viewW, 190);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR CITY', viewW / 2, 150);
  ctx.fillStyle = '#f5edd8';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('Streets of Gold', viewW / 2, 196);
  ctx.font = '15px sans-serif';
  ctx.fillText('An open-world crime story. Steal cars, outrun the law, and take the city.', viewW / 2, 240);
  ctx.fillText('Rex Marlowe needs one last score — and Vera Cruz has the jobs to get him there.', viewW / 2, 264);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(game.save.missionIndex > 0 ? '—  PRESS ENTER TO CONTINUE  —' : '—  PRESS ENTER TO START  —', viewW / 2, 330);
  ctx.fillStyle = '#f5edd8';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD / Arrows — move and drive    ·    E — enter or steal a car    ·    F — punch', viewW / 2, 390);
  ctx.fillText('Mouse — aim    ·    Click — shoot    ·    Shift — sprint    ·    P — pause    ·    M — next job', viewW / 2, 414);
  if (game.save.missionIndex > 0) {
    ctx.fillText(`Saved progress: mission ${game.save.missionIndex + 1} of 6  ·  ${formatMoney(game.save.money)} banked`, viewW / 2, 452);
  }
  ctx.fillStyle = 'rgba(245,237,216,0.7)';
  ctx.font = '12px sans-serif';
  ctx.fillText('Six missions. One city. No speed limit.', viewW / 2, viewH - 24);
  ctx.textAlign = 'left';
}

/** Pause overlay. */
export function drawPause(ctx, viewW, viewH) {
  ctx.fillStyle = 'rgba(8,8,12,0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5edd8';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 10);
  ctx.font = '15px sans-serif';
  ctx.fillText('Press P or Escape to keep playing', viewW / 2, viewH / 2 + 26);
  ctx.textAlign = 'left';
}

/** Game over overlay. */
export function drawGameOver(ctx, game, viewW, viewH) {
  ctx.fillStyle = 'rgba(20,4,8,0.78)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('BUSTED', viewW / 2, viewH / 2 - 30);
  ctx.fillStyle = '#f5edd8';
  ctx.font = '16px sans-serif';
  ctx.fillText('Rex went down in Solmar City. The city keeps the money — this time.', viewW / 2, viewH / 2 + 6);
  ctx.fillText('Press Enter to try again from your last job', viewW / 2, viewH / 2 + 34);
  ctx.textAlign = 'left';
}

/** Win overlay after the final mission. */
export function drawWin(ctx, game, viewW, viewH) {
  ctx.fillStyle = 'rgba(6,18,10,0.8)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('KING OF SOLMAR', viewW / 2, viewH / 2 - 30);
  ctx.fillStyle = '#f5edd8';
  ctx.font = '16px sans-serif';
  ctx.fillText('Salvatore Viper is finished, the yacht is yours, and the city is gold.', viewW / 2, viewH / 2 + 6);
  ctx.fillText(`Final take: ${formatMoney(game.player.money)}  ·  Press Enter to keep roaming free`, viewW / 2, viewH / 2 + 34);
  ctx.textAlign = 'left';
}
