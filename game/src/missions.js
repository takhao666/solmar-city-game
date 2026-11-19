// The story and the six missions of Solmar City. Rex Marlowe, a wheelman down on his
// luck, takes jobs from the fixer Vera Cruz and climbs from taxi fares to the big score.
// Every stage's marker is computed from a real, finite target: a kill stage points at the
// first living enemy, and a stage with no living target is already complete.

import { clamp, dist, formatTime } from './util.js';
import { landmarkCentre } from './city.js';
import { spawnGang, WEAPONS } from './combat.js';
import { addWanted } from './police.js';

/** The six missions, in story order. Each returns its stages for the live game. */
export function missionList(game) {
  const bank = landmarkCentre(game.city, 'Solmar Bank');
  const office = landmarkCentre(game.city, 'Vera\u2019s Office');
  const marina = landmarkCentre(game.city, 'Marina');
  const safehouse = landmarkCentre(game.city, 'Safehouse');
  return [
    {
      id: 'first-fare',
      title: '1. First Fare',
      briefing: 'Vera needs a driver. Pick up Lena at the marina road and drop her at the bank. No trouble, no heat.',
      reward: 150,
      unlock: 'pistol',
      stages: [
        { type: 'goto', label: 'Pick up Lena', x: marina.x - 260, y: marina.y - 120, radius: 70 },
        { type: 'goto', label: 'Drop Lena at Solmar Bank', x: bank.x, y: bank.y - 130, radius: 80 },
      ],
    },
    {
      id: 'getaway',
      title: '2. Getaway',
      briefing: 'The crew hit a pawn shop and the cops are already rolling. Grab the crew at Vera\u2019s office, then lose the heat at the safehouse.',
      reward: 300,
      stages: [
        { type: 'goto', label: 'Pick up the crew at Vera\u2019s office', x: office.x, y: office.y - 120, radius: 80 },
        { type: 'escape', label: 'Reach the safehouse with the crew', x: safehouse.x, y: safehouse.y, radius: 90, wanted: 2 },
      ],
    },
    {
      id: 'parcel-run',
      title: '3. Parcel Run',
      briefing: 'Three parcels, three corners of the city, two and a half minutes. Drive like the rent is due.',
      reward: 350,
      stages: [
        { type: 'deliver', label: 'Deliver parcel 1 of 3', x: 810, y: 810, radius: 70, time: 150 },
        { type: 'deliver', label: 'Deliver parcel 2 of 3', x: 3510, y: 1350, radius: 70, time: 0 },
        { type: 'deliver', label: 'Deliver parcel 3 of 3', x: 1350, y: 4050, radius: 70, time: 0 },
      ],
    },
    {
      id: 'rival-turf',
      title: '4. Rival Turf',
      briefing: 'The Vipers are muscling in on Vera\u2019s corners. Clear five of them out of the north blocks. You earned the SMG for this one.',
      reward: 500,
      unlock: 'smg',
      stages: [
        { type: 'kill', label: 'Clear the Vipers from the north blocks', x: 2970, y: 810, radius: 420, count: 5 },
      ],
    },
    {
      id: 'big-score',
      title: '5. The Big Score',
      briefing: 'Solmar Bank, Friday, noon. Walk in, grab the cash, and get out before the whole department shows up.',
      reward: 1200,
      stages: [
        { type: 'goto', label: 'Get to Solmar Bank', x: bank.x, y: bank.y - 130, radius: 90 },
        { type: 'grab', label: 'Grab the cash — hold the vault', x: bank.x, y: bank.y, radius: 110, hold: 5 },
        { type: 'escape', label: 'Escape to the safehouse', x: safehouse.x, y: safehouse.y, radius: 90, wanted: 3 },
      ],
    },
    {
      id: 'king-of-solmar',
      title: '6. King of Solmar',
      briefing: 'Salvatore Viper wants the whole city. End him at the marina, then take the yacht and sail out a king.',
      reward: 2000,
      stages: [
        { type: 'kill', label: 'Take down Salvatore Viper and his crew', x: marina.x, y: marina.y - 60, radius: 460, count: 6, boss: true },
        { type: 'goto', label: 'Board the yacht at the marina', x: marina.x + 40, y: marina.y + 120, radius: 90 },
      ],
    },
  ];
}

/** Start a mission: reset its runtime and run its opening hooks. */
export function startMission(game, index) {
  const list = missionList(game);
  const def = list[index];
  if (!def) return false;
  game.mission = {
    index,
    def,
    stageIndex: 0,
    stage: null,
    stageTimer: 0,
    kills: 0,
    enemiesSpawned: false,
    message: def.briefing,
    messageTimer: 6,
  };
  beginStage(game);
  return true;
}

/** Set up the current stage: spawn its enemies, set its wanted level, reset its timer. */
export function beginStage(game) {
  const mission = game.mission;
  const stage = mission.def.stages[mission.stageIndex];
  mission.stage = { ...stage };
  mission.stageTimer = stage.time || 0;
  mission.enemiesSpawned = false;
  if (stage.type === 'kill' && !mission.enemiesSpawned) {
    const count = stage.count || 4;
    spawnGang(game, stage.x, stage.y, count, game.rng);
    if (stage.boss) {
      const boss = game.enemies[game.enemies.length - 1];
      if (boss) {
        boss.health = 160;
        boss.maxHealth = 160;
        boss.speed = 120;
        boss.shirt = '#8a1f3d';
      }
    }
    mission.enemiesSpawned = true;
  }
  if (stage.type === 'escape' && stage.wanted) {
    game.wanted = Math.max(game.wanted, stage.wanted);
  }
  if (stage.type === 'deliver' && stage.time) mission.stageTimer = stage.time;
}

/** The stage's objective marker, always a finite point on the map. */
export function missionMarker(game) {
  const mission = game.mission;
  if (!mission || !mission.stage) return null;
  const stage = mission.stage;
  if (stage.type === 'kill') {
    // Point at the first living enemy; if none is alive the stage is done.
    for (const enemy of game.enemies) {
      if (!enemy.dead && Number.isFinite(enemy.x) && Number.isFinite(enemy.y)) {
        return { x: enemy.x, y: enemy.y };
      }
    }
    return { x: game.player.x, y: game.player.y };
  }
  const x = Number.isFinite(stage.x) ? stage.x : game.player.x;
  const y = Number.isFinite(stage.y) ? stage.y : game.player.y;
  return { x, y };
}

/** Advance the mission: returns 'stage', 'mission', 'win', 'fail' or null. */
export function updateMission(game, dt) {
  const mission = game.mission;
  if (!mission || !mission.stage) return null;
  const stage = mission.stage;
  const player = game.player;

  if (mission.stageTimer > 0) {
    mission.stageTimer -= dt;
    if (mission.stageTimer <= 0 && stage.type === 'deliver') {
      game.audio.fail();
      return failMission(game, 'Too slow — the parcels went cold.');
    }
  }

  const d = dist(player.x, player.y, stage.x || 0, stage.y || 0);
  switch (stage.type) {
    case 'goto':
    case 'escape':
    case 'deliver':
      if (d < (stage.radius || 70)) return completeStage(game);
      break;
    case 'grab': {
      if (d < (stage.radius || 110)) {
        stage.holdLeft = (stage.holdLeft === undefined ? stage.hold : stage.holdLeft) - dt;
        if (stage.holdLeft <= 0) return completeStage(game);
      } else {
        stage.holdLeft = stage.hold;
      }
      break;
    }
    case 'kill': {
      const alive = game.enemies.filter((e) => !e.dead).length;
      if (alive === 0) return completeStage(game);
      break;
    }
    default:
      break;
  }
  return null;
}

function completeStage(game) {
  const mission = game.mission;
  game.audio.cash();
  const doneLabel = mission.stage ? mission.stage.label : '';
  mission.stageIndex += 1;
  if (mission.stageIndex >= mission.def.stages.length) {
    return completeMission(game);
  }
  beginStage(game);
  // A banner for the step just finished, so progress is visible mid-mission.
  mission.message = doneLabel ? `${doneLabel} — done. ${mission.stage.label}` : mission.stage.label;
  mission.messageTimer = 3.5;
  return 'stage';
}

function completeMission(game) {
  const mission = game.mission;
  const reward = mission.def.reward;
  game.player.money += reward;
  game.save.money = game.player.money;
  game.save.missionsDone = Math.max(game.save.missionsDone, mission.index + 1);
  if (mission.def.unlock && !game.save.weapons.includes(mission.def.unlock)) {
    game.save.weapons.push(mission.def.unlock);
    game.player.weapon = mission.def.unlock;
    game.player.ammo = WEAPONS[mission.def.unlock].ammo;
  }
  game.save.missionIndex = Math.min(mission.index + 1, 5);
  game.audio.missionDone();
  const last = mission.index >= missionList(game).length - 1;
  if (last) {
    game.screen = 'win';
    game.mission = null;
    return 'win';
  }
  game.mission = null;
  startMission(game, mission.index + 1);
  return 'mission';
}

function failMission(game, reason) {
  const mission = game.mission;
  game.mission = null;
  game.failReason = reason;
  // Restart the same mission after a beat; the player keeps their money.
  game.pendingRestart = { index: mission.index, timer: 2.5 };
  return 'fail';
}

/** The current objective line for the HUD. */
export function objectiveText(game) {
  const mission = game.mission;
  if (!mission || !mission.stage) return 'Free roam — press M for the next job';
  let text = mission.stage.label;
  if (mission.stage.type === 'deliver' && mission.stageTimer > 0) {
    text += `  ·  ${formatTime(mission.stageTimer)}`;
  }
  if (mission.stage.type === 'grab' && mission.stage.holdLeft !== undefined) {
    text += `  ·  hold ${Math.max(0, mission.stage.holdLeft).toFixed(1)}s`;
  }
  if (mission.stage.type === 'kill') {
    const alive = game.enemies.filter((e) => !e.dead).length;
    text += `  ·  ${alive} left`;
  }
  return `${mission.def.title} — ${text}`;
}
