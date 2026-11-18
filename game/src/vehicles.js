// Cars: the player's driving physics, traffic that follows the roads, car stealing,
// spawning near the camera and despawning far away, and simple car-to-car bumps.

import { clamp, dist, distSq, angleDiff, angleTo, pick } from './util.js';
import { WORLD, ROAD_WIDTH, roadCentres, randomRoadPoint, resolveBuildings } from './city.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#7ac74f', '#e8e8e8', '#8a5fc0', '#e07b39', '#39c0c0'];
export const POLICE_COLOR = '#2b4a8a';

let nextCarId = 1;

/** Make a car object. `kind` is 'traffic', 'player' or 'police'. */
export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextCarId,
    kind: kind || 'traffic',
    x, y, angle,
    speed: 0,
    color: color || '#d94f3d',
    radius: 21,
    width: 46,
    height: 22,
    maxSpeed: 320,
    accel: 260,
    steer: 2.6,
    driver: null, // 'player' when the player is driving this car
    dead: false,
  };
}

/** A parked or driving traffic car on a road near the camera. */
export function spawnTrafficCar(rng, camX, camY) {
  const centres = roadCentres();
  const vertical = rng() < 0.5;
  const c = centres[Math.floor(rng() * centres.length)];
  const along = clamp((vertical ? camY : camX) + (rng() - 0.5) * 1600, 150, WORLD - 150);
  const off = (rng() - 0.5) * (ROAD_WIDTH - 44);
  const x = vertical ? c + off : along;
  const y = vertical ? along : c + off;
  const angle = vertical ? (off > 0 ? Math.PI / 2 : -Math.PI / 2) : (off > 0 ? 0 : Math.PI);
  const car = makeCar(x, y, angle, pick(rng, CAR_COLORS), 'traffic');
  car.speed = 90 + rng() * 90;
  return car;
}

/** Steer a traffic car along its road; it turns at intersections and slows for cars ahead. */
export function updateTrafficCar(car, dt, cars, rng) {
  const centres = roadCentres();
  // Find the road centre this car is on and how far along it the car is.
  const horizontal = Math.abs(Math.sin(car.angle)) < 0.5;
  let nearest = centres[0];
  let nearestD = Infinity;
  for (const c of centres) {
    const d = horizontal ? Math.abs(car.y - c) : Math.abs(car.x - c);
    if (d < nearestD) { nearestD = d; nearest = c; }
  }
  // Drift back toward the centre line of the road.
  const off = horizontal ? car.y - nearest : car.x - nearest;
  const targetAngle = horizontal ? (Math.cos(car.angle) >= 0 ? 0 : Math.PI) : (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
  car.angle += clamp(angleDiff(car.angle, targetAngle), -1.4 * dt, 1.4 * dt);
  if (horizontal) car.y -= off * 1.2 * dt;
  else car.x -= off * 1.2 * dt;

  // Slow down when a car is close ahead.
  let targetSpeed = car.maxSpeed * 0.55;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 110 && side < 30) { targetSpeed = 0; break; }
  }
  car.speed += clamp(targetSpeed - car.speed, -260 * dt, 140 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // At an intersection, sometimes turn onto the crossing road.
  if (rng() < dt * 0.25) {
    const onV = centres.some((c) => Math.abs(car.x - c) < 40);
    const onH = centres.some((c) => Math.abs(car.y - c) < 40);
    if (onV && onH && rng() < 0.35) {
      const turns = [-Math.PI / 2, Math.PI / 2];
      car.angle += pick(rng, turns);
    }
  }
  // Bounce off the world edge instead of leaving the city.
  if (car.x < 60) { car.x = 60; car.angle = Math.PI - car.angle; }
  if (car.x > WORLD - 60) { car.x = WORLD - 60; car.angle = Math.PI - car.angle; }
  if (car.y < 60) { car.y = 60; car.angle = -car.angle; }
  if (car.y > WORLD - 60) { car.y = WORLD - 60; car.angle = -car.angle; }
}

/** The player's car: arcade steering, building collisions, and a bump when it hits traffic. */
export function updatePlayerCar(car, input, dt, city) {
  const axis = input.axis();
  const forward = axis.y < 0 ? 1 : axis.y > 0 ? -0.55 : 0;
  const throttle = forward !== 0 ? forward : (input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 0.35 : 0);
  car.speed += throttle * car.accel * dt;
  if (forward === 0) car.speed -= car.speed * 1.6 * dt; // Rolling drag.
  car.speed = clamp(car.speed, -140, car.maxSpeed);
  const steerInput = axis.x;
  const steerAmount = steerInput * car.steer * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount;
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 50, WORLD - 50);
  car.y = clamp(car.y, 50, WORLD - 50);
  if (resolveBuildings(city, car)) {
    // A hard hit: kill most of the speed and spark a crash.
    const hitSpeed = Math.abs(car.speed);
    car.speed *= 0.35;
    if (hitSpeed > 200) return { crashed: true, speed: hitSpeed };
  }
  if (prevX === car.x && prevY === car.y && Math.abs(car.speed) > 240) car.speed *= 0.5;
  return { crashed: false, speed: Math.abs(car.speed) };
}

/** Push two overlapping cars apart and trade a little speed. */
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const d2 = distSq(a.x, a.y, b.x, b.y);
      const min = a.radius + b.radius;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2 / d;
      const px = (a.x - b.x) * push;
      const py = (a.y - b.y) * push;
      a.x += px; a.y += py;
      b.x -= px; b.y -= py;
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.8;
      b.speed = avg * 0.8;
    }
  }
}

/** Keep traffic near the camera: spawn up to the target count, drop far cars. */
export function maintainTraffic(cars, rng, camX, camY, target) {
  let count = 0;
  for (const car of cars) {
    if (car.kind === 'traffic' && !car.dead) count += 1;
  }
  for (let i = cars.length - 1; i >= 0; i -= 1) {
    const car = cars[i];
    if (car.kind !== 'traffic' || car.dead) continue;
    if (dist(car.x, car.y, camX, camY) > 1700) {
      cars.splice(i, 1);
      count -= 1;
    }
  }
  let guard = 0;
  while (count < target && guard < 40) {
    guard += 1;
    const car = spawnTrafficCar(rng, camX, camY);
    if (dist(car.x, car.y, camX, camY) < 500) continue;
    cars.push(car);
    count += 1;
  }
}

/** Draw a car top-down: body, cabin, windshield, wheels and headlights. */
export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-20, -13, 12, 6);
  ctx.fillRect(-20, 7, 12, 6);
  ctx.fillRect(10, -13, 12, 6);
  ctx.fillRect(10, 7, 12, 6);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  ctx.beginPath();
  ctx.roundRect(-6, -8, 14, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(20, -8, 3, 4);
  ctx.fillRect(20, 4, 3, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-2, -11, 8, 22);
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(-1, -11, 3, 5);
    ctx.fillStyle = '#3d7dd9';
    ctx.fillRect(-1, 6, 3, 5);
  }
  ctx.restore();
}

/** The nearest car the player can steal, within reach, or null. */
export function nearestStealableCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.dead || car.driver === 'player') continue;
    const d = dist(car.x, car.y, x, y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
