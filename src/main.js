import { createProgression, awardProgress, levelForExperience, LEVEL_THRESHOLDS } from "./progression.js";
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
function modifier(score) { return Math.floor((Math.max(1, Number(score) || 10) - 10) / 2); }
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

const ABILITIES = ["forza", "destrezza", "costituzione", "intelligenza", "saggezza", "carisma"];
const ANCESTRIES = {
  umano: { label: "Umano", bonuses: Object.fromEntries(ABILITIES.map(key => [key, 1])), description: "+1 a tutte le caratteristiche" },
  elfo: { label: "Elfo", bonuses: { destrezza: 2, intelligenza: 1 }, description: "+2 Destrezza, +1 Intelligenza" },
  nano: { label: "Nano", bonuses: { costituzione: 2, saggezza: 1 }, description: "+2 Costituzione, +1 Saggezza" },
  halfling: { label: "Halfling", bonuses: { destrezza: 2, carisma: 1 }, description: "+2 Destrezza, +1 Carisma" },
  tiefling: { label: "Tiefling", bonuses: { carisma: 2, intelligenza: 1 }, description: "+2 Carisma, +1 Intelligenza" }
};
const BACKGROUNDS = {
  accolito: { label: "Accolito", skills: ["religione", "intuizione"], equipment: ["Simbolo votivo", "Libro di preghiere"], description: "Una vita al servizio di un culto." },
  criminale: { label: "Criminale", skills: ["furtivita", "rapidita di mano"], equipment: ["Attrezzi da scasso", "Mantello scuro"], description: "Contatti, segreti e vita ai margini." },
  erudito: { label: "Erudito", skills: ["arcano", "storia"], equipment: ["Taccuino", "Inchiostro e penna"], description: "Anni trascorsi tra libri e conoscenza." },
  eroe_popolare: { label: "Eroe popolare", skills: ["addestrare animali", "sopravvivenza"], equipment: ["Attrezzo da artigiano", "Ricordo di casa"], description: "Hai difeso la tua comunità." },
  forestiero: { label: "Forestiero", skills: ["natura", "sopravvivenza"], equipment: ["Mantello da viaggio", "Kit da esplorazione"], description: "Hai imparato a sopravvivere lontano dalle città." },
  nobile: { label: "Nobile", skills: ["persuasione", "storia"], equipment: ["Abiti eleganti", "Anello con sigillo"], description: "Educazione, reputazione e doveri." }
};
const SKILLS = {
  atletica: { label: "Atletica", stat: "forza" }, acrobazia: { label: "Acrobazia", stat: "destrezza" },
  "rapidita di mano": { label: "Rapidità di mano", stat: "destrezza" }, furtivita: { label: "Furtività", stat: "destrezza" },
  "resistenza": { label: "Resistenza", stat: "costituzione" }, arcano: { label: "Arcano", stat: "intelligenza" },
  storia: { label: "Storia", stat: "intelligenza" }, investigazione: { label: "Investigazione", stat: "intelligenza" },
  natura: { label: "Natura", stat: "intelligenza" }, religione: { label: "Religione", stat: "intelligenza" },
  "addestrare animali": { label: "Addestrare animali", stat: "saggezza" }, intuizione: { label: "Intuizione", stat: "saggezza" },
  medicina: { label: "Medicina", stat: "saggezza" }, percezione: { label: "Percezione", stat: "saggezza" },
  sopravvivenza: { label: "Sopravvivenza", stat: "saggezza" }, inganno: { label: "Inganno", stat: "carisma" },
  intimidazione: { label: "Intimidazione", stat: "carisma" }, intrattenere: { label: "Intrattenere", stat: "carisma" },
  persuasione: { label: "Persuasione", stat: "carisma" }
};
const CLASS_SKILLS = {
  guerriero: ["atletica", "intimidazione", "percezione", "sopravvivenza", "storia", "acrobazia"],
  mago: ["arcano", "storia", "investigazione", "medicina", "religione", "intuizione"],
  ladro: ["acrobazia", "atletica", "inganno", "investigazione", "percezione", "rapidita di mano", "furtivita", "intimidazione"],
  chierico: ["medicina", "intuizione", "religione", "persuasione", "storia"]
};
const SPELLS = {
  mago: [
    { id: "dardo_arcano", name: "Dardo arcano", description: "Un colpo di energia a distanza." },
    { id: "scudo_eterico", name: "Scudo eterico", description: "Una barriera riduce il prossimo danno subito." },
    { id: "luce_errante", name: "Luce errante", description: "Una sfera luminosa rischiara il cammino." },
    { id: "sonno", name: "Sussurro soporifero", description: "Un impulso arcano induce torpore." }
  ],
  chierico: [
    { id: "cura_lieve", name: "Cura lieve", description: "Ripristina una piccola quantità di punti vita." },
    { id: "fiamma_sacra", name: "Fiamma sacra", description: "Una scintilla sacra colpisce un avversario." },
    { id: "protezione", name: "Velo protettivo", description: "Una preghiera attenua il prossimo colpo." },
    { id: "guida", name: "Guida", description: "Una benedizione aiuta una prova di abilità." }
  ]
};
const BUILDER_STEPS = ["Identità", "Lancio dei dadi", "Caratteristiche", "Abilità", "Magie", "Riepilogo"];
const builder = {
  step: 0, name: "Il Viandante", classId: "guerriero", ancestry: "umano", background: "forestiero", mode: "standard",
  rolls: [], assignment: {}, skills: [], spells: []
};
function rollAbilityScores() {
  return Array.from({ length: 6 }, () => {
    const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6));
    const dropped = Math.min(...dice);
    return { dice, dropped, score: dice.reduce((sum, die) => sum + die, 0) - dropped };
  });
}
function getBuilderStats() {
  const ancestry = ANCESTRIES[builder.ancestry] || ANCESTRIES.umano;
  const base = {};
  ABILITIES.forEach(key => {
    const rollIndex = builder.assignment[key];
    const rolled = Number.isInteger(rollIndex) && builder.rolls[rollIndex] ? builder.rolls[rollIndex].score : 10;
    base[key] = Math.min(20, rolled + (ancestry.bonuses[key] || 0));
  });
  return base;
}
function isCaster() { return ["mago", "chierico"].includes(builder.classId); }
function builderSheetMarkup() {
  const stats = getBuilderStats();
  const name = safeText(builder.name.trim() || "Il Viandante");
  const klass = CLASS_DATA[builder.classId] || CLASS_DATA.guerriero;
  const ancestry = ANCESTRIES[builder.ancestry] || ANCESTRIES.umano;
  const background = BACKGROUNDS[builder.background] || BACKGROUNDS.forestiero;
  const skills = [...new Set([...background.skills, ...builder.skills])];
  const skillMarkup = skills.map(id => {
    const skill = SKILLS[id];
    return skill ? `<li>${safeText(skill.label)} <strong>${signed(modifier(stats[skill.stat]) + (builder.skills.includes(id) || background.skills.includes(id) ? 2 : 0))}</strong></li>` : "";
  }).join("");
  return `<div class="live-sheet-heading"><p class="eyebrow">SCHEDA IN COSTRUZIONE</p><h3>${name}</h3><p>${safeText(ancestry.label)} · ${safeText(klass.label)}</p><p class="muted">${safeText(background.label)}</p></div>
    <div class="live-sheet-stats">${ABILITIES.map(key => `<div><span>${STAT_NAMES[key]}</span><strong>${stats[key]}</strong><small>${signed(modifier(stats[key]))}</small></div>`).join("")}</div>
    <div class="live-sheet-derived"><span>PF stimati <strong>${klass.hp + modifier(stats.costituzione)}</strong></span><span>CA stimata <strong>${10 + modifier(stats.destrezza)}</strong></span><span>Competenza <strong>+2</strong></span></div>
    <h4>Abilità</h4><ul class="live-sheet-skills">${skillMarkup || "<li>Da scegliere</li>"}</ul>
    <h4>Magie</h4><ul class="live-sheet-skills">${(builder.spells.length ? builder.spells.map(id => (SPELLS[builder.classId] || []).find(spell => spell.id === id)?.name).filter(Boolean) : []).map(safeText).map(name => `<li>${name}</li>`).join("") || "<li>Nessuna selezionata</li>"}</ul>
    <p class="sheet-hint">La scheda si aggiorna mentre modifichi le scelte.</p>`;
}
function renderBuilder() {
  const form = el.form;
  const step = builder.step;
  let content = "";
  if (step === 0) {
    content = `<div class="wizard-step"><p class="eyebrow">PASSO 1 DI 6</p><h3>Identità e origini</h3><label class="field-label" for="builder-name">Nome del personaggio</label><input id="builder-name" maxlength="32" value="${safeText(builder.name)}" required>
      <div class="builder-field-grid"><label class="field-label">Discendenza<select id="builder-ancestry">${Object.entries(ANCESTRIES).map(([id,item]) => `<option value="${id}" ${builder.ancestry===id?"selected":""}>${item.label} — ${item.description}</option>`).join("")}</select></label>
      <label class="field-label">Classe<select id="builder-class">${Object.entries(CLASS_DATA).map(([id,item]) => `<option value="${id}" ${builder.classId===id?"selected":""}>${item.label}</option>`).join("")}</select></label>
      <label class="field-label">Background<select id="builder-background">${Object.entries(BACKGROUNDS).map(([id,item]) => `<option value="${id}" ${builder.background===id?"selected":""}>${item.label} — ${item.description}</option>`).join("")}</select></label>
      <label class="field-label">Modalità di partita<select id="builder-mode"><option value="standard" ${builder.mode==="standard"?"selected":""}>Libera</option><option value="permadeath" ${builder.mode==="permadeath"?"selected":""}>Permadeath</option></select></label></div>
      <p class="wizard-note">Classe, discendenza e background modificano la scheda, l'equipaggiamento e le abilità disponibili.</p></div>`;
  } else if (step === 1) {
    content = `<div class="wizard-step"><p class="eyebrow">PASSO 2 DI 6</p><h3>Determina le caratteristiche</h3><p>Per ogni caratteristica lancia 4d6 e scarta il dado più basso. I sei risultati ottenuti saranno poi distribuiti liberamente.</p><button type="button" class="secondary-button" id="roll-abilities">Lancia i dadi (4d6, scarta il minore)</button>
      ${builder.rolls.length ? `<div class="dice-results">${builder.rolls.map((roll,index)=>`<div class="dice-result"><strong>Risultato ${index+1}: ${roll.score}</strong><span>Dadi: ${roll.dice.map((die,i)=>i===roll.dice.indexOf(roll.dropped)?"":"").length ? roll.dice.map((die,i)=>`<i class="${die===roll.dropped && roll.dice.indexOf(die)===i?"dropped-die":""}">${die}</i>`).join(" ") : ""}</span><small>Scartato: ${roll.dropped}</small></div>`).join("")}</div><p class="wizard-note">Puoi rilanciare prima di proseguire. Una volta confermati, i risultati restano quelli della partita.</p>` : `<p class="wizard-note">Non hai ancora lanciato i dadi.</p>`}</div>`;
  } else if (step === 2) {
    const used = Object.values(builder.assignment).filter(Number.isInteger);
    content = `<div class="wizard-step"><p class="eyebrow">PASSO 3 DI 6</p><h3>Distribuisci i risultati</h3><p>Assegna un risultato diverso a ciascuna caratteristica. I bonus della discendenza si applicano automaticamente; i modificatori sono calcolati in tempo reale.</p><div class="ability-assignment">${ABILITIES.map(key=>`<label><span>${STAT_NAMES[key]}</span><select data-ability="${key}"><option value="">Scegli un risultato</option>${builder.rolls.map((roll,index)=>`<option value="${index}" ${builder.assignment[key]===index?"selected":""} ${used.includes(index)&&builder.assignment[key]!==index?"disabled":""}>Risultato ${index+1}: ${roll.score}</option>`).join("")}</select><strong>${getBuilderStats()[key]} (${signed(modifier(getBuilderStats()[key]))})</strong></label>`).join("")}</div></div>`;
  } else if (step === 3) {
    const backgroundSkills = BACKGROUNDS[builder.background].skills;
    const options = CLASS_SKILLS[builder.classId].filter(id => !backgroundSkills.includes(id));
    content = `<div class="wizard-step"><p class="eyebrow">PASSO 4 DI 6</p><h3>Scegli le abilità</h3><p>Il background concede automaticamente due competenze. Scegli altre <strong>due</strong> abilità tra quelle della tua classe.</p><p class="wizard-note">Competenze del background: ${backgroundSkills.map(id=>SKILLS[id].label).join(", ")}.</p><div class="skill-choice-grid">${options.map(id=>`<label class="skill-choice"><input type="checkbox" data-skill="${id}" ${builder.skills.includes(id)?"checked":""}><span><strong>${SKILLS[id].label}</strong><small>${STAT_NAMES[SKILLS[id].stat]}</small></span></label>`).join("")}</div><p class="wizard-note">Selezionate: ${builder.skills.length} / 2</p></div>`;
  } else if (step === 4) {
    const spells = SPELLS[builder.classId] || [];
    content = `<div class="wizard-step"><p class="eyebrow">PASSO 5 DI 6</p><h3>${isCaster()?"Scegli le magie iniziali":"Talenti e capacità"}</h3>${isCaster()? `<p>Seleziona due magie iniziali. Potrai ampliarle durante lo sviluppo del sistema magico.</p><div class="spell-choice-grid">${spells.map(spell=>`<label class="spell-choice"><input type="checkbox" data-spell="${spell.id}" ${builder.spells.includes(spell.id)?"checked":""}><span><strong>${spell.name}</strong><small>${spell.description}</small></span></label>`).join("")}</div><p class="wizard-note">Selezionate: ${builder.spells.length} / 2</p>` : `<p>Questa classe non utilizza magie nel prototipo. Le sue capacità derivano da caratteristiche, abilità ed equipaggiamento.</p>`}</div>`;
  } else {
    const stats = getBuilderStats();
    content = `<div class="wizard-step"><p class="eyebrow">PASSO 6 DI 6</p><h3>Pronto per partire</h3><p>Controlla la scheda a lato. Quando confermi, i valori vengono salvati nella partita e usati da prove e combattimenti.</p><div class="review-list"><p><strong>Discendenza:</strong> ${ANCESTRIES[builder.ancestry].label}</p><p><strong>Classe:</strong> ${CLASS_DATA[builder.classId].label}</p><p><strong>Background:</strong> ${BACKGROUNDS[builder.background].label}</p><p><strong>Caratteristiche:</strong> ${ABILITIES.map(key=>`${STAT_NAMES[key]} ${stats[key]} (${signed(modifier(stats[key]))})`).join(" · ")}</p><p><strong>Abilità scelte:</strong> ${builder.skills.map(id=>SKILLS[id].label).join(", ") || "Nessuna"}</p><p><strong>Magie:</strong> ${builder.spells.map(id=>(SPELLS[builder.classId]||[]).find(spell=>spell.id===id)?.name).filter(Boolean).join(", ") || "Nessuna"}</p></div></div>`;
  }
  form.innerHTML = `<div class="wizard-layout"><div class="wizard-main">${content}<div class="wizard-navigation"><button type="button" id="builder-back" class="secondary-button" ${step===0?"disabled":""}>Indietro</button>${step<5?`<button type="button" id="builder-next" class="primary-button">${step===4?"Riepilogo":"Continua"} <span>↗</span></button>`:`<button type="submit" class="primary-button">Comincia il viaggio <span>↗</span></button>`}</div></div><aside class="live-character-sheet">${builderSheetMarkup()}</aside></div>`;
}
function builderValidationMessage() {
  if (builder.step === 1 && builder.rolls.length !== 6) return "Lancia i dadi prima di proseguire.";
  if (builder.step === 2 && (Object.keys(builder.assignment).length !== 6 || new Set(Object.values(builder.assignment)).size !== 6)) return "Assegna tutti e sei i risultati senza ripeterli.";
  if (builder.step === 3 && builder.skills.length !== 2) return "Scegli esattamente due abilità.";
  if (builder.step === 4 && isCaster() && builder.spells.length !== 2) return "Scegli esattamente due magie iniziali.";
  return "";
}
function handleBuilderChange(event) {
  const target = event.target;
  if (target.id === "builder-name") builder.name = target.value;
  if (target.id === "builder-ancestry") builder.ancestry = target.value;
  if (target.id === "builder-class") {
    builder.classId = target.value;
    builder.skills = [];
    builder.spells = [];
  }
  if (target.id === "builder-background") { builder.background = target.value; builder.skills = []; }
  if (target.id === "builder-mode") builder.mode = target.value;
  if (target.dataset.ability) {
    if (target.value === "") delete builder.assignment[target.dataset.ability];
    else builder.assignment[target.dataset.ability] = Number(target.value);
  }
  if (target.dataset.skill) {
    const id = target.dataset.skill;
    if (target.checked && builder.skills.length < 2) builder.skills.push(id);
    else if (target.checked) target.checked = false;
    else builder.skills = builder.skills.filter(item => item !== id);
  }
  if (target.dataset.spell) {
    const id = target.dataset.spell;
    if (target.checked && builder.spells.length < 2) builder.spells.push(id);
    else if (target.checked) target.checked = false;
    else builder.spells = builder.spells.filter(item => item !== id);
  }
  renderBuilder();
}

function newGame(name, classId, mode, characterBuild = null) {
  if (mode === "permadeath") {
    try { localStorage.removeItem(saveKey("permadeath-dead")); } catch (error) {
      console.warn("Impossibile azzerare il blocco permadeath nel browser.", error);
    }
  }
  const klass = CLASS_DATA[classId] || CLASS_DATA.guerriero;
  const stats = characterBuild?.stats || getStatsForClass(classId);
  const maxHp = klass.hp + modifier(stats.costituzione);
  state = {
    schemaVersion: 1, runId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    hero: { name: name.trim() || "Il Viandante", classId, ancestry: characterBuild?.ancestry || "umano", background: characterBuild?.background || "forestiero", level: 1, stats, maxHp, hp: maxHp, armorClass: 10 + modifier(stats.destrezza), proficiency: 2, skills: characterBuild?.skills || [], spells: characterBuild?.spells || [] },
    progression: createProgression(), mode, sceneId: story.start, flags: {}, inventory: [...klass.items, ...(characterBuild?.equipment || []), "Una moneta annerita"], journal: [], visited: [],
    lucidity: 100, combat: null, dead: false, ended: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  combat = null;
  recordJournal("La dimostrazione ha avuto inizio.");
  // Mostra subito la partita: un errore di storage non deve impedire l'avvio.
  renderGame();
  saveAutosave();
}

function awardHiddenProgress(eventId, amount, category) {
  if (!state) return;
  if (!state.progression) state.progression = createProgression();
  if (!Array.isArray(state.progression.rewardedEvents)) state.progression.rewardedEvents = [];
  if (!state.progression.actions) state.progression.actions = createProgression().actions;
  const result = awardProgress(state.progression, eventId, amount, category);
  if (!result.awarded || result.newLevel <= result.oldLevel) return;
  const hero = state.hero;
  for (let level = result.oldLevel + 1; level <= result.newLevel; level++) {
    const hitDie = CLASS_DATA[hero.classId]?.hp || 8;
    const gain = Math.max(1, Math.floor(hitDie / 2) + 1 + modifier(hero.stats.costituzione));
    hero.maxHp += gain;
    hero.hp = Math.min(hero.maxHp, hero.hp + gain);
  }
  hero.level = result.newLevel;
  hero.proficiency = result.newLevel >= 9 ? 4 : result.newLevel >= 5 ? 3 : 2;
  hero.armorClass = 10 + modifier(hero.stats.destrezza);
  recordJournal("Le tue esperienze ti hanno reso più forte. Nuove capacità si risvegliano in te.");
  toast(`La tua esperienza ha dato frutto: sei salito al livello ${hero.level}.`);
}
function migrateProgression(save) {
  if (!save.progression) save.progression = createProgression();
  if (!Array.isArray(save.progression.rewardedEvents)) save.progression.rewardedEvents = [];
  if (!save.progression.actions) save.progression.actions = createProgression().actions;
  save.progression.experience = Math.max(0, Number(save.progression.experience) || 0);
  const actualLevel = levelForExperience(save.progression.experience);
  if (save.hero.level < actualLevel) {
    const oldLevel = save.hero.level || 1;
    for (let level = oldLevel + 1; level <= actualLevel; level++) {
      const hitDie = CLASS_DATA[save.hero.classId]?.hp || 8;
      const gain = Math.max(1, Math.floor(hitDie / 2) + 1 + modifier(save.hero.stats.costituzione));
      save.hero.maxHp += gain;
      save.hero.hp = Math.min(save.hero.maxHp, save.hero.hp + gain);
    }
    save.hero.level = actualLevel;
  }
  save.hero.proficiency = save.hero.level >= 9 ? 4 : save.hero.level >= 5 ? 3 : 2;
}

function recordJournal(entry) {
  if (!state) return;
  state.journal.push({ text: entry, at: new Date().toISOString(), sceneId: state.sceneId });
}
function applyEffects(effects = []) {
  for (const effect of effects) {
    if (effect.type === "set_flag") {
      const wasSet = state.flags[effect.key] === effect.value;
      state.flags[effect.key] = effect.value;
      if (!wasSet && effect.value === true) awardHiddenProgress(`discovery:${effect.key}`, 12, "discoveries");
    }
    else if (effect.type === "add_item" && !state.inventory.includes(effect.item)) state.inventory.push(effect.item);
    else if (effect.type === "remove_item") {
      const index = state.inventory.indexOf(effect.item);
      if (index >= 0) state.inventory.splice(index, 1);
    } else if (effect.type === "lucidity") state.lucidity = Math.max(0, Math.min(100, state.lucidity + Number(effect.amount || 0)));
    else if (effect.type === "heal") state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + Number(effect.amount || 0));
    else if (effect.type === "damage") state.hero.hp = Math.max(0, state.hero.hp - Number(effect.amount || 0));
    else if (effect.type === "journal") recordJournal(effect.text);
    else if (effect.type === "xp") awardHiddenProgress(`story-effect:${state.sceneId}:${effect.key || effect.amount || "xp"}`, Number(effect.amount || 0), "choices");
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
  awardHiddenProgress(`choice:${state.sceneId}:${choice.text}`, choice.type === "combat" ? 3 : 6, "choices");
  if (choice.type === "check") {
    awardHiddenProgress(`check-attempt:${state.sceneId}:${choice.text}`, 4, "checksAttempted");
    const skillId = choice.skill;
    const skill = skillId ? SKILLS[skillId] : null;
    const stat = skill?.stat || choice.stat || "saggezza";
    const trained = skillId ? (state.hero.skills || []).includes(skillId) : Boolean(choice.proficiency);
    const roll = rollD20();
    const bonus = modifier(state.hero.stats[stat]) + (trained ? state.hero.proficiency : 0);
    const total = roll + bonus;
    const success = total >= choice.dc;
    if (success) awardHiddenProgress(`check-success:${state.sceneId}:${choice.text}`, 8 + Math.max(0, Number(choice.dc || 10) - 10), "checksSucceeded");
    const testName = skill ? skill.label : STAT_NAMES[stat];
    recordJournal(`Prova di ${testName}: d20 ${roll} ${signed(bonus)} = ${total}, CD ${choice.dc}: ${success ? "successo" : "fallimento"}.`);
    toast(`Prova di ${testName}: ${roll} ${signed(bonus)} = ${total} · ${success ? "Successo" : "Fallimento"}`);
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
      awardHiddenProgress(`combat-escape:${fight.enemyId}`, 8, "combatsEscaped");
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
    awardHiddenProgress(`combat-victory:${fight.enemyId}`, 28 + enemy.hp * 2 + Math.max(0, enemy.attack), "combatsWon");
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
  if (!state.progression?.rewardedEvents?.includes(`ending:${state.sceneId}`)) {
    awardHiddenProgress(`ending:${state.sceneId}`, scene.ending === true ? 18 : 8, "choices");
  }
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
    migrateProgression(state);
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
    panel.innerHTML = `<h2>Scheda del personaggio</h2><p><strong>${safeText(state.hero.name)}</strong> · ${state.hero.ancestry || "Umano"} · ${CLASS_DATA[state.hero.classId].label} · ${state.hero.background || "Forestiero"} · Livello ${state.hero.level}</p><p>PF ${state.hero.hp}/${state.hero.maxHp} · CA ${state.hero.armorClass} · Bonus competenza +${state.hero.proficiency}</p><div class="live-sheet-stats">${Object.entries(state.hero.stats).map(([key,value]) => `<div><span>${STAT_NAMES[key]}</span><strong>${value}</strong><small>${signed(modifier(value))}</small></div>`).join("")}</div><p><strong>Abilità:</strong> ${(state.hero.skills || []).map(id => SKILLS[id]?.label || id).join(", ") || "Nessuna"}</p><p><strong>Magie:</strong> ${(state.hero.spells || []).map(id => (SPELLS[state.hero.classId] || []).find(spell => spell.id === id)?.name || id).join(", ") || "Nessuna"}</p><p>Modalità: ${state.mode === "permadeath" ? "Permadeath" : "Libera"}</p>`;
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
  renderBuilder();
  el.form.addEventListener("change", handleBuilderChange);
  el.form.addEventListener("input", event => {
    if (event.target.id === "builder-name") {
      builder.name = event.target.value;
      const sheet = document.querySelector(".live-character-sheet");
      if (sheet) sheet.innerHTML = builderSheetMarkup();
    }
  });
  el.form.addEventListener("click", event => {
    if (event.target.closest("#roll-abilities")) {
      builder.rolls = rollAbilityScores();
      builder.assignment = {};
      renderBuilder();
    }
    if (event.target.closest("#builder-back")) {
      builder.step = Math.max(0, builder.step - 1);
      renderBuilder();
    }
    if (event.target.closest("#builder-next")) {
      const error = builderValidationMessage();
      if (error) { toast(error); return; }
      builder.step = Math.min(5, builder.step + 1);
      renderBuilder();
    }
  });
  el.form.addEventListener("submit", event => {
    event.preventDefault();
    try {
      const error = builderValidationMessage();
      if (builder.step !== 5 || error) {
        toast(error || "Completa tutti i passaggi della scheda.");
        return;
      }
      const stats = getBuilderStats();
      const klass = CLASS_DATA[builder.classId];
      const background = BACKGROUNDS[builder.background];
      newGame(builder.name, builder.classId, builder.mode, {
        stats, ancestry: builder.ancestry, background: builder.background,
        skills: [...new Set([...background.skills, ...builder.skills])],
        spells: [...builder.spells], equipment: background.equipment
      });
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
