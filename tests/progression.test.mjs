import test from "node:test";
import assert from "node:assert/strict";
import { createProgression, awardProgress, levelForExperience, LEVEL_THRESHOLDS } from "../src/progression.js";

test("la progressione parte dal livello uno senza mostrare dati all'interfaccia", () => {
  const progression = createProgression();
  assert.equal(progression.experience, 0);
  assert.equal(levelForExperience(progression.experience), 1);
  assert.deepEqual(progression.rewardedEvents, []);
});

test("le soglie determinano livelli progressivi fino al livello dieci", () => {
  assert.equal(levelForExperience(99), 1);
  assert.equal(levelForExperience(100), 2);
  assert.equal(levelForExperience(249), 2);
  assert.equal(levelForExperience(250), 3);
  assert.equal(levelForExperience(LEVEL_THRESHOLDS.at(-1)), 10);
  assert.equal(levelForExperience(999999), 10);
});

test("un evento assegna progressi una sola volta", () => {
  const progression = createProgression();
  const first = awardProgress(progression, "choice:bridge:inspect", 14, "choices");
  const duplicate = awardProgress(progression, "choice:bridge:inspect", 14, "choices");
  assert.equal(first.awarded, true);
  assert.equal(first.amount, 14);
  assert.equal(duplicate.awarded, false);
  assert.equal(progression.experience, 14);
  assert.equal(progression.actions.choices, 1);
});

test("il superamento di una soglia restituisce il nuovo livello", () => {
  const progression = createProgression();
  progression.experience = 96;
  const result = awardProgress(progression, "victory:guard", 30, "combatsWon");
  assert.equal(result.oldLevel, 1);
  assert.equal(result.newLevel, 2);
  assert.equal(progression.actions.combatsWon, 1);
});

test("gli eventi negativi o con quantità non valida non riducono l'esperienza", () => {
  const progression = createProgression();
  awardProgress(progression, "event:negative", -50, "checksAttempted");
  assert.equal(progression.experience, 0);
});
