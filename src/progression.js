export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

export function levelForExperience(experience) {
  const xp = Math.max(0, Number(experience) || 0);
  let level = 1;
  for (let index = 1; index < LEVEL_THRESHOLDS.length; index++) {
    if (xp >= LEVEL_THRESHOLDS[index]) level = index + 1;
    else break;
  }
  return level;
}

export function createProgression() {
  return {
    experience: 0,
    rewardedEvents: [],
    actions: { choices: 0, checksAttempted: 0, checksSucceeded: 0, discoveries: 0, combatsWon: 0, combatsEscaped: 0 }
  };
}

export function awardProgress(progression, eventId, amount, category) {
  if (!progression || !eventId || progression.rewardedEvents.includes(eventId)) {
    return { awarded: false, amount: 0, oldLevel: levelForExperience(progression?.experience), newLevel: levelForExperience(progression?.experience) };
  }
  const oldLevel = levelForExperience(progression.experience);
  const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
  progression.rewardedEvents.push(eventId);
  progression.experience = Math.max(0, progression.experience + safeAmount);
  if (category && Object.hasOwn(progression.actions, category)) progression.actions[category]++;
  return { awarded: true, amount: safeAmount, oldLevel, newLevel: levelForExperience(progression.experience) };
}
