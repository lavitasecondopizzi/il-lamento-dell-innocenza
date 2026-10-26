const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const SAVE_PREFIX = "lamento-innocenza-v01";
const CLASS_DATA = {
  guerriero: { label: "Guerriero", hp: 12, stat: "forza", bonus: 2, items: ["Spada consumata", "Benda pulita"] },
  mago: { label: "Mago", hp: 6, stat: "intelligenza", bonus: 2, items: ["Bastone nodoso", "Appunti arcani"] },
  ladro: { label: "Ladro", hp: 8, stat: "destrezza", bonus: 2, items: ["Pugnale", "Attrezzi da scasso"] },
  chierico: { label: "Chierico", hp: 10, stat: "saggezza", bonus: 2, items: ["Mazza semplice", "Simbolo sacro"] }
};
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const STAT_NAMES = { forza: "Forza", destrezza: "Destrezza", costituzione: "Costituzione", intelligenza: "Intelligenza", saggezza: "Saggezza", carisma: "Carisma" };
const MODS = { 3:-4, 4:-3, 5:-3, 6:-2, 7:-2, 8:-1, 9:-1, 10:0, 11:0, 12:1, 13:1, 14:2, 15:2, 16:3, 17:3, 18:4 };
let state = null;
let story = null;
let activeTab = "journal";
let combat = null;
let turnLock = false;

const el = {
  title: $("#title-screen"), character: $("#character-screen"), game: $("#game-screen"), ending: $("#ending-screen"),
  name: $("#hero-name"), form: $("#character-form"), continue: $("#continue-button"), toast: $("#toast"),
  sceneTitle: $("#scene-title"), sceneText: $("#scene-text"), choices: $("#choices"), extra: $("#scene-extra"),
  sceneNumber: $("#scene-number"), chapterLabel: $("#chapter-label"), sceneKicker: $("#scene-kicker"),
  hp: $("#hp-value"), hpFill: $("#hp-meter-fill"), lucidity: $("#lucidity-value"), lucidityFill: $("#lucidity-meter-fill"),
  stats: $("#stats-list"), tabPanel: $("#tab-panel"), combatPanel: $("#combat-panel"), sceneArt: $("#scene-art")
};

function showScreen(screen) {
  [el.title, el.character, el.game, el.ending].forEach(node => node.classList.add("hidden"));
  screen.classList.remove("hidden");
}
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.toast.classList.add("hidden"), 2400);
}
function modifier(score) { return MODS[Math.max(3, Math.min(18, Number(score) || 10))] ?? 0; }
function signed(value) { return value >= 0 ? `+${value}` : String(value); }
function rollD20() { return 1 + Math.floor(Math.random() * 20); }
function safeText(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char])); }
function getStatsForClass(classId) {
  const order = ["forza","destrezza","costituzione","intelligenza","saggezza","carisma"];
  const classPriority = {
    guerriero: ["forza","costituzione","destrezza","saggezza","carisma","intelligenza"],
    mago: ["intelligenza","destrezza","costituzione","saggezza","carisma","forza"],
    ladro: ["destrezza","intelligenza","carisma","costituzione","saggezza","forza"],
    chierico: ["saggezza","costituzione","forza","carisma","destrezza","intelligenza"]
  }[classId];
  const result = {};
  classPriority.forEach((stat, index) => result[stat] = STANDARD_ARRAY[index]);
  return Object.fromEntries(order.map(stat => [stat, result[stat]]));
}
function newGame(name, classId, mode) {
  if (mode === "permadeath") {
    try { localStorage.removeItem(saveKey("permadeath-dead")); } catch (error) {
      console.warn("Impossibile azzerare il blocco permadeath nel browser.", error);
    }
  }
  const klass = CLASS_DATA[classId] || CLASS_DATA.guerriero;
  const stats = getStatsForClass(classId);
  const maxHp = klass.hp + modifier(stats.costituzione);
  state = {
    schemaVersion: 1, runId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    hero: { name: name.trim() || "Il Viandante", classId, level: 1, xp: 0, stats, maxHp, hp: maxHp, armorClass: 10 + modifier(stats.destrezza), proficiency: 2 },
    mode, sceneId: story.start, flags: {}, inventory: [...klass.items, "Una moneta annerita"], journal: [], visited: [],
    lucidity: 100, combat: null, dead: false, ended: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  combat = null;
  recordJournal("La dimostrazione ha avuto inizio.");
  // Mostra subito la partita: un errore di storage non deve impedire l'avvio.
  renderGame();
  saveAutosave();
}
function recordJournal(entry) {
  if (!state) return;
  state.journal.push({ text: entry, at: new Date().toISOString(), sceneId: state.sceneId });
}
function applyEffects(effects = []) {
  for (const effect of effects) {
    if (effect.type === "set_flag") state.flags[effect.key] = effect.value;
    else if (effect.type === "add_item" && !state.inventory.includes(effect.item)) state.inventory.push(effect.item);
    else if (effect.type === "remove_item") {
      const index = state.inventory.indexOf(effect.item);
      if (index >= 0) state.inventory.splice(index, 1);
    } else if (effect.type === "lucidity") state.lucidity = Math.max(0, Math.min(100, state.lucidity + Number(effect.amount || 0)));
    else if (effect.type === "heal") state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + Number(effect.amount || 0));
    else if (effect.type === "damage") state.hero.hp = Math.max(0, state.hero.hp - Number(effect.amount || 0));
    else if (effect.type === "journal") recordJournal(effect.text);
    else if (effect.type === "xp") state.hero.xp += Number(effect.amount || 0);
  }
}
function meetsRequirements(requirements = []) {
  return requirements.every(req => {
    if (req.type === "flag") return state.flags[req.key] === req.value;
    if (req.type === "has_item") return state.inventory.includes(req.item);
    if (req.type === "stat_min") return state.hero.stats[req.stat] >= req.value;
    if (req.type === "class") return state.hero.classId === req.value;
    if (req.type === "hp_min") return state.hero.hp >= req.value;
    return false;
  });
}
function goToScene(sceneId, effects = []) {
  if (turnLock || state.dead) return;
  const next = story.scenes[sceneId];
  if (!next) { toast(`Scena non trovata: ${sceneId}`); return; }
  turnLock = true;
  applyEffects(effects);
  state.sceneId = sceneId;
  state.updatedAt = new Date().toISOString();
  combat = null;
  if (!state.visited.includes(sceneId)) state.visited.push(sceneId);
  if (next.onEnter) applyEffects(next.onEnter);
  if (state.hero.hp <= 0) { die("Le ferite si rivelano fatali."); turnLock = false; return; }
  recordJournal(`Hai raggiunto: ${next.title}.`);
  saveAutosave();
  renderGame();
  window.setTimeout(() => { turnLock = false; }, 160);
}
function makeChoice(choice) {
  if (turnLock || !meetsRequirements(choice.requirements || [])) return;
  if (choice.type === "check") {
    const stat = choice.stat || "saggezza";
    const roll = rollD20();
    const total = roll + modifier(state.hero.stats[stat]) + (choice.proficiency ? state.hero.proficiency : 0);
    const success = total >= choice.dc;
    recordJournal(`Prova di ${STAT_NAMES[stat]}: d20 ${roll} ${signed(modifier(state.hero.stats[stat]))} = ${total}, CD ${choice.dc}: ${success ? "successo" : "fallimento"}.`);
    toast(`Prova: ${roll} ${signed(modifier(state.hero.stats[stat]))} = ${total} · ${success ? "Successo" : "Fallimento"}`);
    const outcome = success ? choice.success : choice.failure;
    if (outcome) goToScene(outcome.next, outcome.effects || []);
    return;
  }
  if (choice.type === "combat") {
    startCombat(choice.enemy);
    return;
  }
  goToScene(choice.next, choice.effects || []);
}
function renderGame() {
  if (!state) return;
  const hero = state.hero;
  $("#sidebar-hero-name").textContent = hero.name;
  $("#sidebar-class").textContent = `${CLASS_DATA[hero.classId].label} · Livello ${hero.level} · ${state.mode === "permadeath" ? "Permadeath" : "Modalità libera"}`;
  el.hp.textContent = `${hero.hp} / ${hero.maxHp}`;
  el.hpFill.style.width = `${Math.max(0, Math.min(100, hero.hp / hero.maxHp * 100))}%`;
  el.lucidity.textContent = `${state.lucidity} / 100`;
  el.lucidityFill.style.width = `${state.lucidity}%`;
  el.stats.innerHTML = Object.entries(hero.stats).map(([key, value]) => `<div class="stat-chip"><span>${STAT_NAMES[key]}</span><strong>${value} (${signed(modifier(value))})</strong></div>`).join("");
  const scene = story.scenes[state.sceneId];
  if (!scene) { toast("La scena salvata non esiste in questa versione."); return; }
  el.chapterLabel.textContent = scene.chapterLabel || "AVVENTURA DIMOSTRATIVA";
  el.sceneNumber.textContent = `SCENA ${String(state.visited.length).padStart(2,"0")}`;
  el.sceneKicker.textContent = scene.kicker || "IL CUSTODE DEL PONTE";
  el.sceneTitle.textContent = scene.title;
  el.sceneText.innerHTML = (Array.isArray(scene.text) ? scene.text : [scene.text]).map(p => `<p>${safeText(p)}</p>`).join("");
  el.extra.classList.toggle("hidden", !scene.note);
  el.extra.textContent = scene.note || "";
  el.choices.innerHTML = "";
  el.combatPanel.classList.add("hidden");
  if (state.ended || scene.ending) { showEnding(scene); return; }
  if (state.combat) { renderCombat(); }
  else {
    const choices = (scene.choices || []).filter(choice => meetsRequirements(choice.requirements || []));
    choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.innerHTML = `<span class="choice-letter">${String.fromCharCode(65 + index)}.</span><span>${safeText(choice.text)}</span>`;
      button.addEventListener("click", () => makeChoice(choice));
      el.choices.appendChild(button);
    });
  }
  renderTabPanel();
  showScreen(el.game);
}
function startCombat(enemyId) {
  const enemy = story.enemies[enemyId];
  if (!enemy) { toast("Nemico non definito."); return; }
  state.combat = { enemyId, hp: enemy.hp, maxHp: enemy.hp, round: 1, log: [`${enemy.name} ti sbarra la strada.`] };
  recordJournal(`Combattimento iniziato: ${enemy.name}.`);
  saveAutosave();
  renderGame();
}
function combatLog(message) {
  state.combat.log.push(message);
  state.combat.log = state.combat.log.slice(-5);
}
function renderCombat() {
  const fight = state.combat;
  if (!fight) return;
  const enemy = story.enemies[fight.enemyId];
  el.combatPanel.classList.remove("hidden");
  el.combatPanel.innerHTML = `<h3>${safeText(enemy.name)}</h3>
    <p>${safeText(enemy.description || "")}</p>
    <div class="resource-label"><span>Resistenza del nemico</span><strong>${fight.hp} / ${fight.maxHp}</strong></div>
    <div class="meter hp-meter"><span style="width:${Math.max(0,fight.hp/fight.maxHp*100)}%"></span></div>
    <p>${fight.log.map(safeText).join("<br>")}</p>
    <div class="combat-actions"><button data-combat="attack">Attacca</button><button data-combat="item">Usa benda (+3 PF)</button><button data-combat="flee">Tenta la fuga</button></div>`;
  el.combatPanel.querySelectorAll("[data-combat]").forEach(button => button.addEventListener("click", () => combatAction(button.dataset.combat)));
}
function combatAction(action) {
  if (turnLock || !state?.combat) return;
  turnLock = true;
  const fight = state.combat;
  const enemy = story.enemies[fight.enemyId];
  if (action === "item") {
    const itemIndex = state.inventory.findIndex(item => item.toLowerCase().includes("benda"));
    if (itemIndex < 0) { toast("Non hai una benda utilizzabile."); turnLock = false; return; }
    state.inventory.splice(itemIndex, 1);
    const before = state.hero.hp;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 3);
    combatLog(`Usi una benda: recuperi ${state.hero.hp - before} punti vita.`);
  } else if (action === "flee") {
    const roll = rollD20() + modifier(state.hero.stats.destrezza);
    if (roll >= 12) {
      recordJournal("Sei riuscito a fuggire dal combattimento.");
      state.combat = null;
      state.flags.escapedEncounter = true;
      const escapeScene = enemy.escapeScene || story.start;
      // goToScene gestisce il proprio lock: libera quello del turno di combattimento prima della transizione.
      turnLock = false;
      goToScene(escapeScene, [{type:"journal",text:"Hai scelto di fuggire invece di combattere."}]);
      return;
    }
    combatLog(`La fuga fallisce (risultato ${roll}, CD 12).`);
  } else {
    const attackBonus = modifier(state.hero.stats[CLASS_DATA[state.hero.classId].stat]) + state.hero.proficiency;
    const roll = rollD20();
    const total = roll + attackBonus;
    if (total >= enemy.ac) {
      const damage = 1 + Math.max(1, Math.floor(Math.random() * (state.hero.classId === "guerriero" ? 8 : 6))) + Math.max(0, modifier(state.hero.stats[CLASS_DATA[state.hero.classId].stat]));
      fight.hp = Math.max(0, fight.hp - damage);
      combatLog(`Colpisci con ${total} e infliggi ${damage} danni.`);
    } else combatLog(`Mancato: ${total} non supera la CA ${enemy.ac}.`);
  }
  if (fight.hp <= 0) {
    state.combat = null;
    recordJournal(`Hai sconfitto ${enemy.name}.`);
    const victoryScene = enemy.victoryScene;
    turnLock = false;
    if (victoryScene) goToScene(victoryScene, enemy.victoryEffects || []);
    else renderGame();
    return;
  }
  const enemyRoll = rollD20() + enemy.attack;
  if (enemyRoll >= state.hero.armorClass) {
    const damage = enemy.damage;
    state.hero.hp = Math.max(0, state.hero.hp - damage);
    combatLog(`${enemy.name} ti colpisce: perdi ${damage} PF.`);
  } else combatLog(`${enemy.name} manca il colpo.`);
  fight.round++;
  saveAutosave();
  if (state.hero.hp <= 0) {
    turnLock = false;
    die(`${enemy.name} ti ha sconfitto.`);
    return;
  }
  renderGame();
  window.setTimeout(() => { turnLock = false; }, 180);
}
function die(reason) {
  state.hero.hp = 0;
  state.dead = true;
  state.ended = true;
  state.deathReason = reason;
  state.combat = null;
  recordJournal(`Morte del personaggio: ${reason}`);
  saveAutosave(true);
  $("#ending-title").textContent = state.mode === "permadeath" ? "La storia finisce qui" : "Sei caduto";
  $("#ending-text").textContent = state.mode === "permadeath"
    ? `${reason} In modalità permadeath questa partita è conclusa. Puoi iniziarne una nuova, ma non puoi riprendere questa avventura.`
    : `${reason} Puoi iniziare una nuova partita oppure, nella modalità libera, caricare un salvataggio precedente.`;
  showScreen(el.ending);
}
function showEnding(scene) {
  state.ended = true;
  saveAutosave();
  $("#ending-title").textContent = scene.title;
  $("#ending-text").textContent = Array.isArray(scene.text) ? scene.text.join(" ") : scene.text;
  showScreen(el.ending);
}
function saveKey(slot = "auto") { return `${SAVE_PREFIX}:${slot}`; }
function saveAutosave(force = false) {
  if (!state) return;
  state.updatedAt = new Date().toISOString();
  try {
    if (state.mode === "permadeath" && state.dead) {
      localStorage.setItem(saveKey("permadeath-dead"), JSON.stringify(state));
      localStorage.removeItem(saveKey("permadeath-active"));
    } else if (state.mode === "permadeath") {
      localStorage.setItem(saveKey("permadeath-active"), JSON.stringify(state));
    } else {
      localStorage.setItem(saveKey("auto"), JSON.stringify(state));
    }
    $("#save-status").textContent = force ? "Partita conclusa" : "Salvataggio aggiornato";
  } catch (error) {
    console.warn("Salvataggio locale non disponibile.", error);
    const status = $("#save-status");
    if (status) status.textContent = "Salvataggio non disponibile";
    toast("La partita è iniziata, ma il browser non consente di salvare. Puoi continuare a giocare in questa scheda.");
  }
}
function saveManual(slot) {
  if (!state || state.mode === "permadeath") { toast("I salvataggi manuali non sono disponibili in permadeath."); return; }
  localStorage.setItem(saveKey(`slot-${slot}`), JSON.stringify(state));
  toast(`Partita salvata nello slot ${slot}.`);
  renderTabPanel();
}
function loadSave(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== 1 || !parsed.hero || !story.scenes[parsed.sceneId]) throw new Error("Salvataggio incompatibile");
    if (parsed.mode === "permadeath" && (parsed.dead || localStorage.getItem(saveKey("permadeath-dead")))) return false;
    state = parsed;
    combat = state.combat;
    renderGame();
    return true;
  } catch (error) {
    toast("Salvataggio non valido o incompatibile.");
    return false;
  }
}
function renderTabPanel() {
  if (!state || el.game.classList.contains("hidden")) return;
  const panel = el.tabPanel;
  panel.classList.remove("hidden");
  if (activeTab === "journal") {
    panel.innerHTML = `<h2>Diario di viaggio</h2>${state.journal.slice().reverse().map(entry => `<div class="journal-entry"><p>${safeText(entry.text)}</p><small>${safeText(entry.sceneId || "")}</small></div>`).join("") || "<p>Il diario è vuoto.</p>"}`;
  } else if (activeTab === "inventory") {
    panel.innerHTML = `<h2>Inventario</h2>${state.inventory.length ? `<ul>${state.inventory.map(item => `<li>${safeText(item)}</li>`).join("")}</ul>` : "<p>Non possiedi oggetti.</p>"}`;
  } else if (activeTab === "character") {
    panel.innerHTML = `<h2>Scheda del personaggio</h2><p><strong>${safeText(state.hero.name)}</strong> · ${CLASS_DATA[state.hero.classId].label} · Livello ${state.hero.level}</p><p>PF ${state.hero.hp}/${state.hero.maxHp} · CA ${state.hero.armorClass} · Bonus competenza +${state.hero.proficiency}</p><p>Esperienza: ${state.hero.xp} PE</p><p>Modalità: ${state.mode === "permadeath" ? "Permadeath" : "Libera"}</p>`;
  } else {
    const slots = [1,2,3].map(slot => `<button class="secondary-button" data-save-slot="${slot}">Salva nello slot ${slot}</button>`).join("");
    const loads = [1,2,3].map(slot => `<button class="secondary-button" data-load-slot="${slot}">Carica slot ${slot}</button>`).join("");
    panel.innerHTML = `<h2>Salvataggi</h2><p>La partita viene autosalvata in questo browser. I dati non sono sincronizzati tra dispositivi.</p>${state.mode === "permadeath" ? "<p>In permadeath i salvataggi manuali e il caricamento di slot precedenti sono disabilitati.</p>" : `<div>${slots}</div><div style="margin-top:12px">${loads}</div>`}`;
    panel.querySelectorAll("[data-save-slot]").forEach(button => button.addEventListener("click", () => saveManual(button.dataset.saveSlot)));
    panel.querySelectorAll("[data-load-slot]").forEach(button => button.addEventListener("click", () => {
      if (loadSave(saveKey(`slot-${button.dataset.loadSlot}`))) toast("Salvataggio caricato.");
      else toast("Lo slot è vuoto o non valido.");
    }));
  }
}
function setTab(tab) {
  activeTab = tab;
  $$(".side-nav-button").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  renderTabPanel();
}
function backToTitle() { showScreen(el.title); updateContinueButton(); }
function updateContinueButton() {
  const hasAuto = !!localStorage.getItem(saveKey("auto"));
  const hasPermadeath = !!localStorage.getItem(saveKey("permadeath-active"));
  el.continue.disabled = !(hasAuto || hasPermadeath);
  el.continue.style.opacity = el.continue.disabled ? ".5" : "1";
}
async function init() {
  try {
    const response = await fetch("./content/demo-story.json");
    if (!response.ok) throw new Error("Impossibile caricare i contenuti");
    story = await response.json();
  } catch (error) {
    console.error(error);
    alert("Non riesco a caricare la storia dimostrativa. Apri il gioco tramite un server locale o GitHub Pages, non direttamente come file.");
    return;
  }
  $("#new-game-button").addEventListener("click", () => showScreen(el.character));
  $("#back-title").addEventListener("click", backToTitle);
  $("#character-form").addEventListener("submit", event => {
    event.preventDefault();
    try {
      const form = new FormData(el.form);
      newGame(el.name.value, form.get("heroClass") || "guerriero", form.get("saveMode") || "standard");
    } catch (error) {
      console.error("Errore durante l'avvio della partita:", error);
      toast("Non è stato possibile avviare la partita. Ricarica la pagina e riprova.");
    }
  });
  el.continue.addEventListener("click", () => {
    if (loadSave(saveKey("permadeath-active")) || loadSave(saveKey("auto"))) toast("Partita ripresa.");
    else toast("Non è stato trovato un salvataggio valido.");
  });
  $$(".side-nav-button").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));
  $("#restart-button").addEventListener("click", () => { state = null; showScreen(el.character); });
  $("#title-button").addEventListener("click", backToTitle);
  $("#menu-button").addEventListener("click", () => $("#menu-dialog").showModal());
  $("#close-menu").addEventListener("click", () => $("#menu-dialog").close());
  $("#menu-save").addEventListener("click", () => { $("#menu-dialog").close(); setTab("save"); el.tabPanel.scrollIntoView({behavior:"smooth",block:"nearest"}); });
  $("#menu-title").addEventListener("click", () => { $("#menu-dialog").close(); backToTitle(); });
  updateContinueButton();
}
init();
