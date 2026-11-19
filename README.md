# solmar-city-game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/takhao666/solmar-city-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/takhao666/solmar-city-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar City: Streets of Gold — an original top-down open-world crime game. Explore a sun-soaked city on foot and by car, steal cars, outrun the Solmar police, and run six story missions from taxi fares to the big score.

## The story

Rex Marlowe, a wheelman down on his luck, takes jobs from the fixer Vera Cruz and climbs from a first fare — picking up Lena at the marina — to the big score at Solmar Bank and a final showdown with Salvatore Viper at the marina. Everything is original: the city, the characters, the names, the art and the sounds. Nothing is taken from any commercial game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests: game/index.html and its modules are plain static files under game/.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse | Aim |
| Click | Shoot (hold for the SMG) |
| E | Enter / steal a car, exit a car |
| F | Punch |
| Space | Handbrake (slide the car) |
| H | Horn |
| Shift | Sprint / boost |
| M | Start the next job |
| P / Esc | Pause |

## The six missions

1. **First Fare** — pick up Lena at the marina, drop her at Solmar Bank. Unlocks the pistol.
2. **Getaway** — grab the crew at Vera's office, lose the heat at the safehouse.
3. **Parcel Run** — three parcels, three corners of the city, two and a half minutes.
4. **Rival Turf** — clear the Vipers out of the north blocks. Unlocks the SMG.
5. **The Big Score** — rob Solmar Bank and escape to the safehouse.
6. **King of Solmar** — take down Salvatore Viper at the marina, then board the yacht.

## What's in the game

- A 9×9-block open city with parks, a marina waterfront, a beachfront and palm-lined promenades, traffic, pedestrians (including joggers), and street lamps.
- Car stealing and arcade driving with a handbrake, brake lights, tyre smoke and crash shake.
- A 5-star wanted system: police cruisers with flashing lightbars chase in formation and foot officers give chase — and dodge out of a speeding car's way.
- Combat with fists, pistol and SMG, visible tracer fire, muzzle flashes, hit stagger and wall-impact dust.
- A HUD with health, armor, money, weapon and ammo, wanted stars, a speedometer, a live minimap, mission objectives with the distance to the target, and stage banners.
- Synthesized sound (no audio files): engine hum, shots, sirens, horns, cash and mission jingles.
- Saves: money, mission progress and unlocked weapons persist in localStorage; progress shows on the title screen.

## Layout

- `game/` — the game itself, plain static files. `game/src/` holds one module per system (`city`, `vehicles`, `police`, `pedestrians`, `combat`, `missions`, `player`, `hud`, `render`, `shots`, `audio`, `input`, `save`, `util`, `main`).
- `screenshots/` — four screenshots of the game itself, staged from real play with `game/src/shots.js` (`?shot=chase|drive|mission|marina&seed=…`).
- `main.ts` — the make.fun hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `serve.ts` — a tiny static server for local play.
- `shots.json` — the screenshot list and the seed each shot was staged from.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hvn9m3q0&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
