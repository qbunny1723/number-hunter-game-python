const MIN_NUMBER = 1;
const MAX_NUMBER = 100;
const SHARED_HINTS_PER_ROUND = 2;
const ROLE_DEFS = [
  { id: "detective", icon: "🕵️", name: "偵探", image: "H1.png", detectivePrivilege: true },
  { id: "sniper", icon: "🎯", name: "狙擊手", image: "H2.png", nearRange: 5 },
  { id: "recorder", icon: "📝", name: "記錄員", image: "H3.png", freeMiss: true },
  { id: "star", icon: "⭐", name: "星星獵人", image: "H4.png", winBonusStar: 1 },
];

const game = {
  status: "setup",
  currentPlayerIndex: 0,
  nextStartingPlayerIndex: 0,
  players: [],
  guesses: [],
  roundGuesses: [],
  hints: [],
  sharedHintsLeft: SHARED_HINTS_PER_ROUND,
  firstTightRangePlayer: null,
  roleAssignments: [],
  message: "請設定玩家並開始遊戲。",
};

const els = {
  entrance: document.querySelector("#entrance"),
  room: document.querySelector("#room"),
  setupForm: document.querySelector("#setupForm"),
  playerCountSelect: document.querySelector("#playerCountSelect"),
  playerInputs: document.querySelector("#playerInputs"),
  drawRolesBtn: document.querySelector("#drawRolesBtn"),
  setupPreviewPlayers: document.querySelector("#setupPreviewPlayers"),
  modeRibbon: document.querySelector("#modeRibbon"),
  roomCode: document.querySelector("#roomCode"),
  connectionBadge: document.querySelector("#connectionBadge"),
  statusText: document.querySelector("#statusText"),
  playerCount: document.querySelector("#playerCount"),
  currentPlayerBadge: document.querySelector("#currentPlayerBadge"),
  rangeText: document.querySelector("#rangeText"),
  legendRange: document.querySelector("#legendRange"),
  message: document.querySelector("#message"),
  startBtn: document.querySelector("#startBtn"),
  leaveBtn: document.querySelector("#leaveBtn"),
  guessForm: document.querySelector("#guessForm"),
  guessInput: document.querySelector("#guessInput"),
  halfHintBtn: document.querySelector("#halfHintBtn"),
  nearHintForm: document.querySelector("#nearHintForm"),
  probeInput: document.querySelector("#probeInput"),
  hintsLeft: document.querySelector("#hintsLeft"),
  rankingList: document.querySelector("#rankingList"),
  guessList: document.querySelector("#guessList"),
  hintFeedback: document.querySelector("#hintFeedback"),
  numberGrid: document.querySelector("#numberGrid"),
};

function playerNameInput(index) {
  return document.querySelector(`#playerName${index}`);
}

function cleanName(value, fallback) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  return Array.from(cleaned || fallback).slice(0, 3).join("");
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function roleForOrder(order) {
  const roleId = game.roleAssignments[order];
  return ROLE_DEFS.find((role) => role.id === roleId) || null;
}

function roleBadgeHTML(role) {
  if (!role) return `<span class="role-pending">未抽角色</span>`;
  return `<span class="role-badge"><img src="${role.image}" alt="${role.name}"><span>${role.name}</span></span>`;
}

function playerBadgeHTML(player, className = "player-badge") {
  return `<span class="${className}"><img src="${player.role.image}" alt="${player.role.name}"><span>${escapeHTML(player.name)}</span></span>`;
}

function starChipHTML(player) {
  return `<span class="star-chip"><span>${player.stars || 0}⭐</span></span>`;
}

function activePlayerNames() {
  const count = Number(els.playerCountSelect.value);
  const defaults = ["小獵人", "小可愛", "小灰貓", "小星星"];
  return Array.from({ length: count }, (_, index) => cleanName(playerNameInput(index + 1).value, defaults[index]));
}

function drawRoles() {
  const count = Number(els.playerCountSelect.value);
  game.roleAssignments = shuffle(ROLE_DEFS).slice(0, count).map((role) => role.id);
  syncPlayerSetup();
}

function ensureRolesDrawn() {
  const count = Number(els.playerCountSelect.value);
  if (game.roleAssignments.slice(0, count).filter(Boolean).length !== count) drawRoles();
}

function syncPlayerSetup() {
  const count = Number(els.playerCountSelect.value);
  game.roleAssignments = game.roleAssignments.slice(0, count);
  for (let index = 1; index <= 4; index += 1) {
    const input = playerNameInput(index);
    const label = input.closest("label");
    const enabled = index <= count;
    label.classList.toggle("inactive-player", !enabled);
    input.required = enabled;
    input.disabled = !enabled;
    input.value = Array.from(input.value).slice(0, 3).join("");
  }

  els.setupPreviewPlayers.innerHTML = "";
  activePlayerNames().forEach((name, index) => {
    const item = document.createElement("li");
    const role = roleForOrder(index);
    item.innerHTML = `<b>${index + 1}</b><span>${escapeHTML(name)}</span><span class="setup-role-label">角色：${roleBadgeHTML(role)}</span><em>${index === 0 ? "先" : ""}</em>`;
    els.setupPreviewPlayers.append(item);
  });
}

function buildNumberGrid() {
  els.numberGrid.innerHTML = "";
  for (let value = MIN_NUMBER; value <= MAX_NUMBER; value += 1) {
    const cell = document.createElement("div");
    cell.className = "number-cell";
    cell.dataset.value = String(value);
    cell.textContent = String(value);
    els.numberGrid.append(cell);
  }
}

function currentPlayer() {
  return game.players[game.currentPlayerIndex];
}

function boundsFromGuesses() {
  let low = MIN_NUMBER;
  let high = MAX_NUMBER;
  const marks = new Map();
  game.roundGuesses.forEach((guess) => {
    marks.set(guess.guess, guess.result);
    if (guess.result === "higher") low = Math.max(low, guess.guess + 1);
    if (guess.result === "lower") high = Math.min(high, guess.guess - 1);
    if (guess.result === "correct") {
      low = guess.guess;
      high = guess.guess;
    }
  });
  return { low, high, marks };
}

function previewGuessValue() {
  const guess = Number.parseInt(els.guessInput.value, 10);
  if (!Number.isInteger(guess) || guess < MIN_NUMBER || guess > MAX_NUMBER) return null;
  return guess;
}

function renderGrid() {
  const { low, high, marks } = boundsFromGuesses();
  const remainingCount = high >= low ? high - low + 1 : 0;
  const previewGuess = game.status === "playing" ? previewGuessValue() : null;
  const latestGuessEntry = [...game.roundGuesses].reverse()[0];
  const latestGuess = latestGuessEntry ? latestGuessEntry.guess : null;
  els.rangeText.textContent = `${low}~${high}`;
  if (els.legendRange) els.legendRange.textContent = `答案落在 ${low}~${high}`;
  els.numberGrid.querySelectorAll(".number-cell").forEach((cell) => {
    const value = Number(cell.dataset.value);
    const result = marks.get(value);
    cell.className = "number-cell";
    if (value < low) cell.classList.add("too-small");
    if (value > high) cell.classList.add("too-large");
    if (value >= low && value <= high) {
      cell.classList.add("in-range");
      if (remainingCount <= 10) cell.classList.add("near-range");
    }
    if (result) cell.classList.add("guessed", result);
    if (value === latestGuess) cell.classList.add("latest");
    if (value === previewGuess) cell.classList.add("preview");
  });
}

function addCell(item, text, strong = false) {
  const cell = document.createElement(strong ? "strong" : "span");
  cell.textContent = text;
  item.append(cell);
}

function emptyItem(text) {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = text;
  return item;
}

function resultLabel(result) {
  if (result === "correct") return "猜中了";
  if (result === "lower") return "答案更小";
  return "答案更大";
}

function renderRankings() {
  els.rankingList.innerHTML = "";
  game.players.forEach((player, index) => {
    const item = document.createElement("li");
    item.className = [
      player.won ? "winner" : "",
      game.status === "playing" && index === game.currentPlayerIndex ? "current-player" : "",
    ].filter(Boolean).join(" ");
    item.innerHTML = `
      ${starChipHTML(player)}
      <img class="ranking-avatar" src="${player.role.image}" alt="${player.role.name}">
      <strong class="ranking-name">${escapeHTML(player.name)}</strong>
      <span class="ranking-stats">${player.guesses}猜 ${player.hintsUsed}提示｜${player.wins}勝</span>
    `;
    els.rankingList.append(item);
  });
}

function renderGuesses() {
  els.guessList.innerHTML = "";
  if (!game.guesses.length) {
    els.guessList.append(emptyItem("尚無事件紀錄"));
    return;
  }
  [...game.guesses].reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.event ? `event-${entry.type || "event"}` : entry.result === "correct" ? "winner" : "";
    if (entry.event) {
      addCell(item, entry.title, true);
      addCell(item, entry.detail);
    } else {
      addCell(item, `${entry.player} 猜 ${entry.guess}`, true);
      addCell(item, resultLabel(entry.result));
    }
    els.guessList.append(item);
  });
}

function renderHintFeedback() {
  if (!els.hintFeedback) return;
  if (!game.hints.length) {
    els.hintFeedback.textContent = `共用提示池：${game.sharedHintsLeft}/${SHARED_HINTS_PER_ROUND}。使用提示會跳過猜測，偵探每局一次可提示後繼續猜。`;
    return;
  }
  const recentHints = game.hints.slice(-2).map((hint) => `${hint.player} 使用 ${hint.label}：${hint.detail}`);
  els.hintFeedback.textContent = `共用提示池剩 ${game.sharedHintsLeft}/${SHARED_HINTS_PER_ROUND}。${recentHints.join("　")}`;
}

function applyServerState(state) {
  Object.assign(game, {
    status: state.status,
    currentPlayerIndex: state.currentPlayerIndex || 0,
    nextStartingPlayerIndex: state.nextStartingPlayerIndex || 0,
    players: state.players || [],
    guesses: state.guesses || [],
    roundGuesses: state.roundGuesses || [],
    hints: state.hints || [],
    sharedHintsLeft: state.sharedHintsLeft ?? SHARED_HINTS_PER_ROUND,
    firstTightRangePlayer: state.firstTightRangePlayer,
    roleAssignments: state.roleAssignments || game.roleAssignments,
    message: state.message || "",
  });
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Python 後端錯誤");
  return data;
}

function showError(message) {
  els.message.textContent = message;
  els.message.classList.add("error");
}

function render() {
  const playing = game.status === "playing";
  const finished = game.status === "finished";
  const player = currentPlayer();

  els.modeRibbon.textContent = finished ? "遊戲結束" : "遊戲進行中";
  els.entrance.classList.toggle("hidden", game.status !== "setup");
  els.room.classList.toggle("hidden", game.status === "setup");
  els.roomCode.textContent = "PY";
  els.playerCount.textContent = `${game.players.length} 位玩家`;
  els.connectionBadge.innerHTML = finished ? "本局已結束" : player ? playerBadgeHTML(player, "top-player-badge") : "";
  els.statusText.textContent = finished ? "已完成" : "遊戲進行中";
  if (els.currentPlayerBadge) els.currentPlayerBadge.textContent = String((game.currentPlayerIndex || 0) + 1);
  if (els.hintsLeft) els.hintsLeft.textContent = `${game.sharedHintsLeft}/${SHARED_HINTS_PER_ROUND}`;
  els.guessInput.disabled = !playing;
  els.guessForm.querySelector("button").disabled = !playing;
  els.halfHintBtn.disabled = !playing || game.sharedHintsLeft <= 0;
  els.probeInput.disabled = !playing || game.sharedHintsLeft <= 0;
  els.nearHintForm.querySelector("button").disabled = !playing || game.sharedHintsLeft <= 0;
  els.startBtn.textContent = finished ? "再玩一局" : "重新開始";
  els.message.innerHTML = player ? game.message.replaceAll(player.name, playerBadgeHTML(player, "message-player-badge")) : game.message;
  els.message.classList.remove("error");

  renderGrid();
  renderRankings();
  renderGuesses();
  renderHintFeedback();
}

async function startGame(options = {}) {
  try {
    ensureRolesDrawn();
    const state = await api(options.freshSeries ? "/api/game/new" : "/api/game/restart", {
      method: "POST",
      body: options.freshSeries ? JSON.stringify({ players: activePlayerNames(), roles: game.roleAssignments }) : "{}",
    });
    els.guessInput.value = "";
    els.probeInput.value = "";
    applyServerState(state);
  } catch (error) {
    showError(error.message);
  }
}

async function submitGuess(value) {
  try {
    const state = await api("/api/game/guess", {
      method: "POST",
      body: JSON.stringify({ guess: Number.parseInt(value, 10) }),
    });
    els.guessInput.value = "";
    applyServerState(state);
  } catch (error) {
    showError(error.message);
  }
}

async function useHalfHint() {
  try {
    applyServerState(await api("/api/game/hint/range", { method: "POST", body: "{}" }));
  } catch (error) {
    showError(error.message);
  }
}

async function useNearHint(value) {
  try {
    const state = await api("/api/game/hint/near", {
      method: "POST",
      body: JSON.stringify({ probe: Number.parseInt(value, 10) }),
    });
    els.probeInput.value = "";
    applyServerState(state);
  } catch (error) {
    showError(error.message);
  }
}

function backToSetup() {
  game.status = "setup";
  els.modeRibbon.textContent = "本機模式";
  els.room.classList.add("hidden");
  els.entrance.classList.remove("hidden");
  syncPlayerSetup();
}

els.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startGame({ freshSeries: true });
});

els.playerCountSelect.addEventListener("change", syncPlayerSetup);
els.playerInputs.addEventListener("input", syncPlayerSetup);
els.drawRolesBtn.addEventListener("click", drawRoles);

els.guessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitGuess(els.guessInput.value);
});

els.guessInput.addEventListener("input", renderGrid);
els.halfHintBtn.addEventListener("click", useHalfHint);

els.nearHintForm.addEventListener("submit", (event) => {
  event.preventDefault();
  useNearHint(els.probeInput.value);
});

els.startBtn.addEventListener("click", () => startGame({ freshSeries: false }));
els.leaveBtn.addEventListener("click", backToSetup);

buildNumberGrid();
syncPlayerSetup();
