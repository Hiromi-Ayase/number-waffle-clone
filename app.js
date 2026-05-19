const SIZE = 7;
const TARGET_SWAPS = 15;
const SWAP_LIMIT = 20;
const STORAGE_KEY = "number-waffle-stats";
const LINE_ROWS = [0, 2, 4, 6];
const LINE_COLS = [0, 2, 4, 6];
const TOUCH_DRAG_THRESHOLD = 8;

const boardElement = document.querySelector("#board");
const movesLeftElement = document.querySelector("#moves-left");
const correctCountElement = document.querySelector("#correct-count");
const starCountElement = document.querySelector("#star-count");
const statusLineElement = document.querySelector("#status-line");
const puzzleLabelElement = document.querySelector("#puzzle-label");
const lineListElement = document.querySelector("#line-list");
const statPlayedElement = document.querySelector("#stat-played");
const statWinsElement = document.querySelector("#stat-wins");
const statStarsElement = document.querySelector("#stat-stars");
const helpDialog = document.querySelector("#help-dialog");
const resultDialog = document.querySelector("#result-dialog");
const resultTitleElement = document.querySelector("#result-title");
const resultCopyElement = document.querySelector("#result-copy");
const resultStarsElement = document.querySelector("#result-stars");

const state = {
  board: [],
  solution: [],
  initialBoard: [],
  clues: [],
  selected: null,
  dragIndex: null,
  moves: 0,
  solved: false,
  revealed: false,
  resultSaved: false,
  pointerDrag: null,
  ignoreNextClick: false,
  label: "",
  seed: "",
};

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function cellIndex(row, col) {
  return row * SIZE + col;
}

function isPlayableCell(row, col) {
  return row % 2 === 0 || col % 2 === 0;
}

function isPlayableIndex(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  return isPlayableCell(row, col);
}

function getPlayableIndices() {
  const indices = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (isPlayableCell(row, col)) {
        indices.push(cellIndex(row, col));
      }
    }
  }
  return indices;
}

const PLAYABLE_INDICES = getPlayableIndices();
const PLAYABLE_TOTAL = PLAYABLE_INDICES.length;

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createSolution(random) {
  const rows = shuffle([0, 1, 2, 3, 4, 5, 6], random);
  const cols = shuffle([0, 1, 2, 3, 4, 5, 6], random);
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7], random);
  const solution = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      solution.push(digits[(rows[row] + cols[col]) % SIZE]);
    }
  }

  return solution;
}

function countCorrect(board, solution) {
  return PLAYABLE_INDICES.reduce(
    (count, index) => count + (board[index] === solution[index] ? 1 : 0),
    0,
  );
}

function createScrambledBoard(solution, random) {
  let bestBoard = null;
  let bestScore = PLAYABLE_TOTAL;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const board = [...solution];
    const usedPairs = new Set();

    for (let swap = 0; swap < TARGET_SWAPS; swap += 1) {
      let first = 0;
      let second = 0;
      let guard = 0;

      do {
        first = PLAYABLE_INDICES[Math.floor(random() * PLAYABLE_INDICES.length)];
        second = PLAYABLE_INDICES[Math.floor(random() * PLAYABLE_INDICES.length)];
        const pair = [Math.min(first, second), Math.max(first, second)].join("-");
        if (first !== second && board[first] !== board[second] && !usedPairs.has(pair)) {
          usedPairs.add(pair);
          break;
        }
        guard += 1;
      } while (guard < 100);

      [board[first], board[second]] = [board[second], board[first]];
    }

    const correct = countCorrect(board, solution);
    const distanceFromTarget = Math.abs(correct - 14);
    if (correct >= 8 && correct <= 24) {
      return board;
    }
    if (distanceFromTarget < bestScore) {
      bestScore = distanceFromTarget;
      bestBoard = board;
    }
  }

  return bestBoard;
}

function createClues(solution, random) {
  const horizontal = [];
  const vertical = [];

  for (const row of LINE_ROWS) {
    for (let col = 0; col < SIZE - 1; col += 1) {
      const cells = [cellIndex(row, col), cellIndex(row, col + 1)];
      horizontal.push({
        orientation: "horizontal",
        row,
        col,
        cells,
        sum: solution[cells[0]] + solution[cells[1]],
      });
    }
  }

  for (let row = 0; row < SIZE - 1; row += 1) {
    for (const col of LINE_COLS) {
      const cells = [cellIndex(row, col), cellIndex(row + 1, col)];
      vertical.push({
        orientation: "vertical",
        row,
        col,
        cells,
        sum: solution[cells[0]] + solution[cells[1]],
      });
    }
  }

  const required = [];
  const used = new Set();

  for (const row of LINE_ROWS) {
    const rowClues = horizontal.filter((clue) => clue.row === row);
    const clue = rowClues[Math.floor(random() * rowClues.length)];
    required.push(clue);
    used.add(`${clue.orientation}-${clue.row}-${clue.col}`);
  }

  for (const col of LINE_COLS) {
    const colClues = vertical.filter((clue) => clue.col === col);
    const clue = colClues[Math.floor(random() * colClues.length)];
    required.push(clue);
    used.add(`${clue.orientation}-${clue.row}-${clue.col}`);
  }

  const extras = shuffle([...horizontal, ...vertical], random)
    .filter((clue) => !used.has(`${clue.orientation}-${clue.row}-${clue.col}`))
    .slice(0, 12);

  return shuffle([...required, ...extras], random);
}

function isLineComplete(values) {
  if (values.length !== SIZE) {
    return false;
  }
  const uniqueValues = new Set(values);
  return uniqueValues.size === SIZE && values.every((value) => value >= 1 && value <= SIZE);
}

function isSolved() {
  return PLAYABLE_INDICES.every((index) => state.board[index] === state.solution[index]);
}

function getStars() {
  return Math.max(0, Math.min(5, SWAP_LIMIT - state.moves));
}

function getStats() {
  try {
    const stats = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return {
      played: Number(stats.played) || 0,
      wins: Number(stats.wins) || 0,
      stars: Number(stats.stars) || 0,
    };
  } catch {
    return { played: 0, wins: 0, stars: 0 };
  }
}

function saveStats(nextStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStats));
  } catch {
    // Storage can be unavailable in strict private browsing or locked-down file contexts.
  }
}

function recordResult() {
  if (state.resultSaved) {
    return;
  }

  const stats = getStats();
  stats.played += 1;
  stats.wins += 1;
  stats.stars += getStars();
  saveStats(stats);
  state.resultSaved = true;
  renderStats();
}

function renderStats() {
  const stats = getStats();
  statPlayedElement.textContent = stats.played;
  statWinsElement.textContent = stats.wins;
  statStarsElement.textContent = stats.stars;
}

function getTileFromPoint(clientX, clientY) {
  if (typeof document.elementFromPoint !== "function") {
    return null;
  }

  const element = document.elementFromPoint(clientX, clientY);
  if (!element || typeof element.closest !== "function") {
    return null;
  }

  return element.closest(".tile");
}

function updatePointerDropTarget(clientX, clientY) {
  const drag = state.pointerDrag;
  if (!drag) {
    return;
  }

  const target = getTileFromPoint(clientX, clientY);
  const targetIndex = target ? Number(target.dataset.index) : NaN;
  const isValidTarget =
    target && targetIndex !== drag.source && !Number.isNaN(targetIndex) && isPlayableIndex(targetIndex);

  if (drag.dropTarget && drag.dropTarget !== target) {
    drag.dropTarget.classList.remove("drop-target");
  }

  drag.dropTarget = isValidTarget ? target : null;

  if (drag.dropTarget) {
    drag.dropTarget.classList.add("drop-target");
  }
}

function cleanupPointerDrag(event) {
  const drag = state.pointerDrag;
  if (!drag) {
    return null;
  }

  if (drag.dropTarget) {
    drag.dropTarget.classList.remove("drop-target");
  }

  if (typeof drag.tile.releasePointerCapture === "function") {
    try {
      drag.tile.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released by the browser after pointer cancellation.
    }
  }

  drag.tile.classList.remove("dragging", "touch-dragging");
  drag.tile.style.pointerEvents = "";
  drag.tile.style.transform = "";
  drag.tile.style.zIndex = "";
  state.pointerDrag = null;
  return drag;
}

function beginPointerDrag(event, index, tile) {
  if (state.solved || event.pointerType === "mouse") {
    return;
  }

  state.pointerDrag = {
    source: index,
    tile,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    dropTarget: null,
  };

  if (typeof tile.setPointerCapture === "function") {
    tile.setPointerCapture(event.pointerId);
  }
}

function movePointerDrag(event) {
  const drag = state.pointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  const distance = Math.hypot(dx, dy);

  if (!drag.moved && distance < TOUCH_DRAG_THRESHOLD) {
    return;
  }

  if (!drag.moved) {
    drag.moved = true;
    state.selected = null;
    drag.tile.classList.add("dragging", "touch-dragging");
    drag.tile.style.zIndex = "5";
    drag.tile.style.pointerEvents = "none";
  }

  event.preventDefault();
  drag.tile.style.transform = `translate(${dx}px, ${dy}px)`;
  updatePointerDropTarget(event.clientX, event.clientY);
}

function endPointerDrag(event) {
  const drag = state.pointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const target = drag.moved ? getTileFromPoint(event.clientX, event.clientY) : null;
  const targetIndex = target ? Number(target.dataset.index) : NaN;
  const shouldSwap =
    drag.moved && targetIndex !== drag.source && !Number.isNaN(targetIndex) && isPlayableIndex(targetIndex);

  cleanupPointerDrag(event);

  if (!drag.moved) {
    return;
  }

  event.preventDefault();
  state.ignoreNextClick = true;

  if (shouldSwap) {
    swapTiles(drag.source, targetIndex);
  } else {
    statusLineElement.textContent = "タイルの上で離すと入れ替えられます。";
    renderBoard();
  }
}

function cancelPointerDrag(event) {
  const drag = state.pointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  cleanupPointerDrag(event);
  state.ignoreNextClick = true;
  renderBoard();
}

function renderBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (isPlayableCell(row, col)) {
        continue;
      }

      const hole = document.createElement("div");
      hole.className = "hole";
      hole.style.gridRow = `${row + 1}`;
      hole.style.gridColumn = `${col + 1}`;
      hole.setAttribute("aria-hidden", "true");
      boardElement.append(hole);
    }
  }

  PLAYABLE_INDICES.forEach((index) => {
    const value = state.board[index];
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.type = "button";
    tile.draggable = true;
    tile.textContent = value;
    tile.style.gridRow = `${row + 1}`;
    tile.style.gridColumn = `${col + 1}`;
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", `${row + 1}行 ${col + 1}列、数字 ${value}`);
    tile.dataset.index = String(index);

    if (value === state.solution[index]) {
      tile.classList.add("correct");
    }
    if (state.selected === index) {
      tile.classList.add("selected");
    }

    tile.addEventListener("click", () => {
      if (state.ignoreNextClick) {
        state.ignoreNextClick = false;
        return;
      }
      selectTile(index);
    });
    tile.addEventListener("pointerdown", (event) => beginPointerDrag(event, index, tile));
    tile.addEventListener("pointermove", movePointerDrag);
    tile.addEventListener("pointerup", endPointerDrag);
    tile.addEventListener("pointercancel", cancelPointerDrag);
    tile.addEventListener("dragstart", (event) => {
      state.dragIndex = index;
      tile.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });
    tile.addEventListener("dragend", () => {
      state.dragIndex = null;
      tile.classList.remove("dragging");
    });
    tile.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      const source = Number(event.dataTransfer.getData("text/plain") || state.dragIndex);
      swapTiles(source, index);
    });

    boardElement.append(tile);
  });

  state.clues.forEach((clue) => {
    const clueElement = document.createElement("div");
    clueElement.className = `clue ${clue.orientation}`;
    clueElement.textContent = clue.sum;
    clueElement.setAttribute("aria-hidden", "true");

    if (clue.orientation === "horizontal") {
      clueElement.style.left = `${((clue.col + 1) / SIZE) * 100}%`;
      clueElement.style.top = `${((clue.row + 0.5) / SIZE) * 100}%`;
    } else {
      clueElement.style.left = `${((clue.col + 0.5) / SIZE) * 100}%`;
      clueElement.style.top = `${((clue.row + 1) / SIZE) * 100}%`;
    }

    const currentSum = state.board[clue.cells[0]] + state.board[clue.cells[1]];
    if (currentSum === clue.sum) {
      clueElement.classList.add("satisfied");
    }

    boardElement.append(clueElement);
  });
}

function renderLineList() {
  lineListElement.innerHTML = "";
  const items = [];

  for (const row of LINE_ROWS) {
    const values = [];
    for (let col = 0; col < SIZE; col += 1) {
      values.push(state.board[cellIndex(row, col)]);
    }
    items.push({ label: `行 ${row + 1}`, ok: isLineComplete(values) });
  }

  for (const col of LINE_COLS) {
    const values = [];
    for (let row = 0; row < SIZE; row += 1) {
      values.push(state.board[cellIndex(row, col)]);
    }
    items.push({ label: `列 ${col + 1}`, ok: isLineComplete(values) });
  }

  items.forEach((item) => {
    const element = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    element.className = `line-pill${item.ok ? " ok" : ""}`;
    label.textContent = item.label;
    value.textContent = item.ok ? "OK" : "...";
    element.append(label, value);
    lineListElement.append(element);
  });
}

function renderStatus() {
  const movesLeft = Math.max(0, SWAP_LIMIT - state.moves);
  const correct = countCorrect(state.board, state.solution);
  movesLeftElement.textContent = movesLeft;
  correctCountElement.textContent = `${correct}/${PLAYABLE_TOTAL}`;
  starCountElement.textContent = getStars();
  puzzleLabelElement.textContent = state.label;

  if (state.revealed) {
    statusLineElement.textContent = "答えを表示しました。";
  } else if (state.solved) {
    statusLineElement.textContent = `クリア。${state.moves}手、${getStars()}スターです。`;
  } else if (state.moves >= SWAP_LIMIT) {
    statusLineElement.textContent = "20手に到達しました。スターはありませんが、このまま解けます。";
  }
}

function renderStars(container, count) {
  container.innerHTML = "";
  for (let index = 0; index < 5; index += 1) {
    const star = document.createElement("span");
    star.className = `star${index < count ? " filled" : ""}`;
    star.textContent = "★";
    container.append(star);
  }
}

function render() {
  renderBoard();
  renderLineList();
  renderStatus();
}

function selectTile(index) {
  if (state.solved) {
    return;
  }

  if (state.selected === null) {
    state.selected = index;
    statusLineElement.textContent = "入れ替える相手を選びます。";
    renderBoard();
    return;
  }

  if (state.selected === index) {
    state.selected = null;
    statusLineElement.textContent = "選択を解除しました。";
    renderBoard();
    return;
  }

  swapTiles(state.selected, index);
}

function swapTiles(first, second) {
  if (
    state.solved ||
    Number.isNaN(first) ||
    Number.isNaN(second) ||
    first === second ||
    !isPlayableIndex(first) ||
    !isPlayableIndex(second)
  ) {
    return;
  }

  if (state.board[first] === state.board[second]) {
    state.selected = null;
    statusLineElement.textContent = "同じ数字同士なので盤面は変わりません。";
    renderBoard();
    return;
  }

  [state.board[first], state.board[second]] = [state.board[second], state.board[first]];
  state.moves += 1;
  state.selected = null;
  state.revealed = false;

  if (isSolved()) {
    state.solved = true;
    recordResult();
    showResult();
  } else if (state.moves === SWAP_LIMIT) {
    statusLineElement.textContent = "20手に到達しました。続けて解けます。";
  } else {
    statusLineElement.textContent = "交換しました。";
  }

  render();
}

function startGame(seed, label) {
  const random = mulberry32(hashString(seed));
  const solution = createSolution(random);
  const board = createScrambledBoard(solution, random);

  state.solution = solution;
  state.board = board;
  state.initialBoard = [...board];
  state.clues = createClues(solution, random);
  state.selected = null;
  state.dragIndex = null;
  state.moves = 0;
  state.solved = false;
  state.revealed = false;
  state.resultSaved = false;
  state.pointerDrag = null;
  state.ignoreNextClick = false;
  state.label = label;
  state.seed = seed;
  statusLineElement.textContent = "2枚を選ぶか、タイルをドラッグして入れ替えます。";
  render();
}

function retryGame() {
  state.board = [...state.initialBoard];
  state.selected = null;
  state.moves = 0;
  state.solved = false;
  state.revealed = false;
  state.resultSaved = false;
  state.pointerDrag = null;
  state.ignoreNextClick = false;
  statusLineElement.textContent = "同じ盤面を最初からやり直します。";
  render();
}

function startDailyGame() {
  const key = formatDateKey(new Date());
  startGame(`daily-${key}`, `Daily ${key}`);
}

function startPracticeGame() {
  const seed = `practice-${Date.now()}-${Math.random()}`;
  startGame(seed, "Practice");
}

function showResult() {
  const stars = getStars();
  resultTitleElement.textContent = "クリア";
  resultCopyElement.textContent = `${state.moves}手で完成。獲得スターは ${stars}/5 です。`;
  renderStars(resultStarsElement, stars);

  openDialog(resultDialog);
}

function showSolution() {
  state.board = [...state.solution];
  state.moves = Math.max(state.moves, SWAP_LIMIT);
  state.solved = true;
  state.revealed = true;
  state.resultSaved = true;
  state.selected = null;
  statusLineElement.textContent = "答えを表示しました。";
  closeDialog(helpDialog);
  render();
}

async function shareResult() {
  const stars = state.solved ? getStars() : 0;
  const correct = countCorrect(state.board, state.solution);
  const text = [
    `Number Waffle ${state.label}`,
    state.solved
      ? `${state.moves}手 / ${stars}スター`
      : `${state.moves}手目 / 正位置 ${correct}/${PLAYABLE_TOTAL}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    statusLineElement.textContent = "結果をコピーしました。";
  } catch {
    statusLineElement.textContent = text;
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  if (current === "dark") {
    document.documentElement.removeAttribute("data-theme");
    saveTheme("light");
  } else {
    document.documentElement.dataset.theme = "dark";
    saveTheme("dark");
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem("number-waffle-theme", theme);
  } catch {
    // Theme persistence is optional.
  }
}

function restoreTheme() {
  try {
    if (localStorage.getItem("number-waffle-theme") === "dark") {
      document.documentElement.dataset.theme = "dark";
    }
  } catch {
    // Keep the default light theme if storage is blocked.
  }
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

document.querySelector("#retry-button").addEventListener("click", retryGame);
document.querySelector("#new-button").addEventListener("click", startPracticeGame);
document.querySelector("#share-button").addEventListener("click", shareResult);
document.querySelector("#result-share-button").addEventListener("click", shareResult);
document.querySelector("#result-new-button").addEventListener("click", () => {
  closeDialog(resultDialog);
  startPracticeGame();
});
document.querySelector("#theme-button").addEventListener("click", toggleTheme);
document.querySelector("#help-button").addEventListener("click", () => openDialog(helpDialog));
document.querySelector("#close-help-button").addEventListener("click", () => closeDialog(helpDialog));
document.querySelector("#close-result-button").addEventListener("click", () => closeDialog(resultDialog));
document.querySelector("#solution-button").addEventListener("click", showSolution);

restoreTheme();
renderStats();
startDailyGame();
