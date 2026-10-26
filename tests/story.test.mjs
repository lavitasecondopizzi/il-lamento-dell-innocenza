import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const story = JSON.parse(readFileSync(new URL("../content/demo-story.json", import.meta.url), "utf8"));
const scenes = story.scenes;
const sceneIds = new Set(Object.keys(scenes));

function destinationsFromChoice(choice) {
  const destinations = [];
  if (choice.next) destinations.push(choice.next);
  for (const outcome of [choice.success, choice.failure]) {
    if (outcome?.next) destinations.push(outcome.next);
  }
  return destinations;
}

test("la scena iniziale esiste", () => {
  assert.ok(sceneIds.has(story.start), `Scena iniziale inesistente: ${story.start}`);
});

test("ogni scena ha titolo e testo", () => {
  for (const [id, scene] of Object.entries(scenes)) {
    assert.equal(typeof scene.title, "string", `${id}: titolo mancante`);
    assert.ok(scene.title.trim(), `${id}: titolo vuoto`);
    assert.ok(scene.text, `${id}: testo mancante`);
  }
});

test("tutte le destinazioni narrative puntano a scene esistenti", () => {
  for (const [id, scene] of Object.entries(scenes)) {
    for (const choice of scene.choices ?? []) {
      for (const target of destinationsFromChoice(choice)) {
        assert.ok(sceneIds.has(target), `${id}: destinazione inesistente ${target}`);
      }
      if (choice.type === "combat") {
        assert.ok(story.enemies[choice.enemy], `${id}: nemico inesistente ${choice.enemy}`);
      }
    }
  }
});

test("le destinazioni di vittoria e fuga dei nemici esistono", () => {
  for (const [enemyId, enemy] of Object.entries(story.enemies ?? {})) {
    for (const key of ["victoryScene", "escapeScene"]) {
      if (enemy[key]) assert.ok(sceneIds.has(enemy[key]), `${enemyId}: ${key} punta a ${enemy[key]}`);
    }
  }
});

test("tutti i finali sono raggiungibili dal punto di partenza", () => {
  const edges = new Map(Object.keys(scenes).map(id => [id, []]));
  for (const [id, scene] of Object.entries(scenes)) {
    for (const choice of scene.choices ?? []) {
      edges.get(id).push(...destinationsFromChoice(choice));
      if (choice.type === "combat") {
        const enemy = story.enemies[choice.enemy];
        if (enemy?.victoryScene) edges.get(id).push(enemy.victoryScene);
        if (enemy?.escapeScene) edges.get(id).push(enemy.escapeScene);
      }
    }
  }

  const reached = new Set([story.start]);
  const pending = [story.start];
  while (pending.length) {
    const current = pending.shift();
    for (const next of edges.get(current) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        pending.push(next);
      }
    }
  }

  const endings = Object.entries(scenes).filter(([, scene]) => scene.ending).map(([id]) => id);
  assert.ok(endings.length > 0, "Nessun finale definito");
  for (const ending of endings) assert.ok(reached.has(ending), `Finale irraggiungibile: ${ending}`);
});
