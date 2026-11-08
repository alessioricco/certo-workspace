const FOV_DEGREES = 70;
const FADE_DISTANCE = 260;
const GRID_COLOR = "#1fd6a0";
const OBSTACLE_COLOR = "#ffb13b";
const MOUNTAIN_COLOR = "#8fb8ff";
const MOON_COLOR = "#e8f1ff";
const SKY_ALPHA = 0.85;
const OBSTACLE_COUNT = 24;
const OBSTACLE_SEED = 1337;
const OBSTACLE_MIN_DISTANCE = 12;
const OBSTACLE_SPREAD = 110;
const MAX_FRAME_SECONDS = 0.1;
const ENEMY_COLOR = "#ff5d73";
const SHELL_COLOR = "#ffe066";
const CRACK_COLOR = "#e8fbff";
const HUD_COLOR = "#9dffd9";
const GAME_SEED = 2024;
const CRACK_SEED = 11;
const CRACK_RAYS = 14;
const FIRE_KEY = "Space";
const PAUSE_KEY = "KeyP";
const NEW_GAME_KEYS = ["Enter", "NumpadEnter"];
const HIGH_SCORE_KEY = "iron-horizon.high-score";
const RADAR_RADIUS = 70;
const RADAR_MARGIN = 16;
const RADAR_COLOR = "#7dff9e";
const BLIP_RADIUS = 4;
const SWEEP_SECONDS = 4;
const SWEEP_STEPS = 12;
const SWEEP_SPREAD = 0.5;
const WARNING_COLOR = "#ff9f1c";
const WARNING_OFFSET = 30;

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const obstacles = createObstacles(
  OBSTACLE_COUNT,
  OBSTACLE_SEED,
  OBSTACLE_MIN_DISTANCE,
  OBSTACLE_SPREAD
);
const obstacleEdges = obstacles.flatMap(obstacleSegments);
const cracks = crackPattern(CRACK_SEED, CRACK_RAYS);
let gameNumber = 0;
let game = createGame(obstacles, GAME_SEED, storedHighScore());
let savedHighScore = game.highScore;
let fireRequested = false;

function storedHighScore() {
  return Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
}

function startNewGame() {
  gameNumber += 1;
  game = createGame(obstacles, GAME_SEED + gameNumber, game.highScore);
}

let width = 0;
let height = 0;
let focal = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  focal = focalLength(height, FOV_DEGREES);
}

const DRIVE_KEYS = {
  ArrowUp: "forward",
  KeyW: "forward",
  ArrowDown: "back",
  KeyS: "back",
  ArrowRight: "right",
  KeyD: "right",
  ArrowLeft: "left",
  KeyA: "left",
};
const pressed = new Set();

function readControls() {
  const has = (action) => [...pressed].some((code) => DRIVE_KEYS[code] === action);
  return {
    throttle: (has("forward") ? 1 : 0) - (has("back") ? 1 : 0),
    steer: (has("right") ? 1 : 0) - (has("left") ? 1 : 0),
  };
}

function fadeFor(depth) {
  return Math.min(1, Math.max(0.05, 1 - depth / FADE_DISTANCE));
}

function drawSegments(segments, color, camera, alphaAt) {
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  for (const [a, b] of segments) {
    const line = segmentToScreen(a, b, camera, focal, width, height);
    if (!line) continue;
    ctx.globalAlpha = alphaAt(line.depth);
    ctx.beginPath();
    ctx.moveTo(line.from.x, line.from.y);
    ctx.lineTo(line.to.x, line.to.y);
    ctx.stroke();
  }
}

function drawCracks(amount) {
  if (amount <= 0) return;
  ctx.strokeStyle = CRACK_COLOR;
  ctx.shadowColor = CRACK_COLOR;
  ctx.globalAlpha = amount;
  for (const line of cracks) {
    ctx.beginPath();
    line.forEach((p, i) => {
      const x = width / 2 + (p.x * width) / 2;
      const y = height / 2 - (p.y * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

function drawHud(state) {
  ctx.globalAlpha = 1;
  ctx.shadowColor = HUD_COLOR;
  ctx.fillStyle = HUD_COLOR;
  ctx.textAlign = "left";
  ctx.font = "18px monospace";
  ctx.fillText(`SCORE ${state.score}`, 20, 32);
  ctx.fillText(`HIGH ${state.highScore}`, 20, 58);
  ctx.fillText(`LIVES ${state.lives}`, 20, 84);
  ctx.fillText(`WAVE ${waveIndex(state) + 1}`, 20, 110);
}

function drawRadar(state, now) {
  const cx = width / 2;
  const cy = RADAR_MARGIN + RADAR_RADIUS;
  const R = RADAR_RADIUS;
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = RADAR_COLOR;
  ctx.shadowColor = RADAR_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.arc(cx, cy, R / 2, 0, TAU);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.stroke();

  const sweep = ((now / 1000) / SWEEP_SECONDS) * TAU;
  for (let i = 0; i < SWEEP_STEPS; i++) {
    const angle = sweep - (i / SWEEP_STEPS) * SWEEP_SPREAD;
    ctx.globalAlpha = 1 - i / SWEEP_STEPS;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.sin(angle), cy - R * Math.cos(angle));
    ctx.stroke();
  }

  const blip = radarPosition(state.tank, state.enemy);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ENEMY_COLOR;
  ctx.shadowColor = ENEMY_COLOR;
  ctx.beginPath();
  ctx.arc(cx + blip.x * R, cy - blip.y * R, BLIP_RADIUS, 0, TAU);
  ctx.fill();
  return cy + R;
}

function drawCentredText(lines, y) {
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.shadowColor = HUD_COLOR;
  ctx.fillStyle = HUD_COLOR;
  lines.forEach(([text, font], i) => {
    ctx.font = font;
    ctx.fillText(text, width / 2, y + i * 40);
  });
}

function drawStatus(state, radarBottom) {
  if (state.over) {
    drawCentredText(
      [
        ["GAME OVER", "48px monospace"],
        ["Press Enter to start a new game", "18px monospace"],
      ],
      height / 2
    );
    return;
  }
  if (state.paused) {
    drawCentredText(
      [
        ["PAUSED", "48px monospace"],
        ["Press P to resume", "18px monospace"],
      ],
      height / 2
    );
    return;
  }
  const warning = enemyWarning(state);
  if (warning) {
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.font = "20px monospace";
    ctx.shadowColor = WARNING_COLOR;
    ctx.fillStyle = WARNING_COLOR;
    ctx.fillText(warning, width / 2, radarBottom + WARNING_OFFSET);
  }
}

function draw(state, now) {
  const camera = state.tank;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8;
  drawSegments(mountainSegments(camera), MOUNTAIN_COLOR, camera, () => SKY_ALPHA);
  drawSegments(moonSegments(camera), MOON_COLOR, camera, () => SKY_ALPHA);
  drawSegments(gridSegments(camera), GRID_COLOR, camera, fadeFor);
  drawSegments(obstacleEdges, OBSTACLE_COLOR, camera, fadeFor);
  drawSegments(tankModelSegments(state.enemy), ENEMY_COLOR, camera, fadeFor);
  const shells = [state.shell, state.enemy.shell].filter(Boolean);
  drawSegments(shells.flatMap(shellSegments), SHELL_COLOR, camera, fadeFor);
  drawCracks(state.crack / CRACK_SECONDS);
  drawHud(state);
  const radarBottom = drawRadar(state, now);
  drawStatus(state, radarBottom);
}

let lastTime = null;

function frame(now) {
  const seconds = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
  lastTime = now;
  const controls = { ...readControls(), fire: fireRequested };
  fireRequested = false;
  game = stepGame(game, controls, seconds);
  if (game.highScore !== savedHighScore) {
    localStorage.setItem(HIGH_SCORE_KEY, String(game.highScore));
    savedHighScore = game.highScore;
  }
  draw(game, now);
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (event.code === FIRE_KEY) {
    if (!event.repeat) fireRequested = true;
    event.preventDefault();
    return;
  }
  if (event.code === PAUSE_KEY) {
    if (!event.repeat) game = togglePause(game);
    return;
  }
  if (NEW_GAME_KEYS.includes(event.code)) {
    if (game.over) startNewGame();
    event.preventDefault();
    return;
  }
  if (!(event.code in DRIVE_KEYS)) return;
  pressed.add(event.code);
  event.preventDefault();
});
window.addEventListener("keyup", (event) => pressed.delete(event.code));
window.addEventListener("blur", () => pressed.clear());
window.addEventListener("resize", resize);

resize();
requestAnimationFrame(frame);
