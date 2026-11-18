// Save and load through localStorage: money, mission progress, owned weapons and best stats.
// Nothing here touches the network; a missing or corrupt save simply starts fresh.

const SAVE_KEY = 'solmar-city-save-v1';

export function defaultSave() {
  return {
    money: 0,
    missionIndex: 0,
    weapons: ['fists'],
    bestMoney: 0,
    missionsDone: 0,
    savedAt: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const save = defaultSave();
    if (typeof parsed.money === 'number' && Number.isFinite(parsed.money)) save.money = parsed.money;
    if (typeof parsed.missionIndex === 'number' && Number.isFinite(parsed.missionIndex)) {
      save.missionIndex = Math.max(0, Math.min(5, Math.floor(parsed.missionIndex)));
    }
    if (Array.isArray(parsed.weapons)) save.weapons = parsed.weapons.filter((w) => typeof w === 'string');
    if (typeof parsed.bestMoney === 'number' && Number.isFinite(parsed.bestMoney)) save.bestMoney = parsed.bestMoney;
    if (typeof parsed.missionsDone === 'number' && Number.isFinite(parsed.missionsDone)) save.missionsDone = parsed.missionsDone;
    return save;
  } catch (err) {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    const copy = { ...save, savedAt: Date.now() };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) { /* a save that cannot be cleared is harmless */ }
}
