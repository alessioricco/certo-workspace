"use strict";

const canvas = document.getElementById("playfield");
const ctx = canvas.getContext("2d");
const game = new Game(window.innerWidth, window.innerHeight);
const ui = Object.fromEntries([
  "score", "wave", "lives", "life-icons", "pause", "pause-label", "pause-icon",
  "wave-notice", "notice-text", "launch-hint", "overlay", "overlay-title",
  "overlay-kicker", "overlay-copy", "overlay-action", "overlay-shortcut",
  "flight-status", "speed", "announcer",
].map(id => [id, document.getElementById(id)]));
const keys = new Set();
const pointers = new Map();
const keyControls = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "thrust", KeyW: "thrust", Space: "shoot",
};
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const stars = Array.from({ length: 145 }, (_, index) => ({
  x: fraction(Math.sin(index * 127.1 + 17) * 43758.5453),
  y: fraction(Math.sin(index * 311.7 + 43) * 23758.5453),
  radius: index % 9 === 0 ? 1.1 : 0.6,
  alpha: 0.15 + (index % 6) * 0.065,
}));
let particles = [];
let labels = [];
let dpr = 1;
let nebula;
let lastFrame = performance.now();
let noticeUntil = 3.6;
let hasPiloted = false;
let previousState = "";
let previousLives = game.lives;

function fraction(value) {
  return value - Math.floor(value);
}

function resizeCanvas() {
  game.resize(window.innerWidth, window.innerHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(game.width * dpr);
  canvas.height = Math.round(game.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  nebula = ctx.createRadialGradient(game.width * 0.5, game.height * 0.48, 0, game.width * 0.5, game.height * 0.48, Math.max(game.width, game.height) * 0.65);
  nebula.addColorStop(0, "#13212b");
  nebula.addColorStop(0.5, "#0d1722");
  nebula.addColorStop(1, "#090e16");
}

function clearControls() {
  keys.clear();
  pointers.clear();
  document.querySelectorAll("[data-control]").forEach(button => button.classList.remove("pressed"));
}

function readControls() {
  const controls = {};
  for (const code of keys) controls[keyControls[code]] = true;
  for (const control of pointers.values()) controls[control] = true;
  return controls;
}

function pauseFlight() {
  clearControls();
  game.togglePause();
  lastFrame = performance.now();
  syncHud();
}

function resumeOrRestart() {
  clearControls();
  if (game.gameOver) {
    game.restart();
    particles = [];
    labels = [];
    hasPiloted = false;
    noticeUntil = 3.6;
    previousLives = game.lives;
  } else if (game.paused) {
    game.togglePause();
  }
  lastFrame = performance.now();
  syncHud();
  canvas.focus({ preventScroll: true });
}

window.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (keyControls[event.code]) {
    // Let keyboard users activate focused buttons with Space normally.
    if (event.code === "Space" && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (!game.paused && !game.gameOver) {
      keys.add(event.code);
      hasPiloted = true;
    }
  } else if (event.code === "KeyP" && !event.repeat) {
    event.preventDefault();
    pauseFlight();
  } else if (event.code === "Enter" && game.gameOver) {
    event.preventDefault();
    if (!event.repeat) resumeOrRestart();
  }
});
window.addEventListener("keyup", event => keys.delete(event.code));
window.addEventListener("blur", () => {
  clearControls();
  if (!game.paused && !game.gameOver) pauseFlight();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !game.paused && !game.gameOver) pauseFlight();
});
window.addEventListener("resize", resizeCanvas);
ui.pause.addEventListener("click", () => {
  pauseFlight();
  if (!game.paused) canvas.focus({ preventScroll: true });
});
ui["overlay-action"].addEventListener("click", resumeOrRestart);
canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));

for (const button of document.querySelectorAll("[data-control]")) {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (game.paused || game.gameOver) return;
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, button.dataset.control);
    button.classList.add("pressed");
    hasPiloted = true;
  });
  const release = event => {
    pointers.delete(event.pointerId);
    if (![...pointers.values()].includes(button.dataset.control)) button.classList.remove("pressed");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", event => event.preventDefault());
}

function syncHud() {
  for (const [id, value] of [
    ["score", String(game.score).padStart(6, "0")],
    ["wave", String(game.wave).padStart(2, "0")],
    ["lives", String(game.lives)],
  ]) {
    if (ui[id].value !== value) ui[id].value = value;
  }
  const lifeIcons = "△ ".repeat(game.lives).trim();
  if (ui["life-icons"].textContent !== lifeIcons) ui["life-icons"].textContent = lifeIcons;
  ui.speed.textContent = String(Math.round(Math.hypot(game.ship.vx, game.ship.vy))).padStart(3, "0");
  const status = game.gameOver ? "SIGNAL LOST" : game.paused ? "ON STANDBY" : game.invulnerable > 0 ? "SHIELDS UP" : "IN FLIGHT";
  const statusElement = ui["flight-status"];
  if (statusElement.dataset.status !== status) {
    statusElement.replaceChildren(Object.assign(document.createElement("i"), { ariaHidden: "true" }), document.createTextNode(` ${status}`));
    statusElement.dataset.status = status;
  }
  ui["wave-notice"].classList.toggle("faded", game.time > noticeUntil || game.gameOver);
  ui["launch-hint"].classList.toggle("faded", hasPiloted || game.time > 8 || game.gameOver);
  const state = game.gameOver ? "over" : game.paused ? "paused" : "playing";
  if (state !== previousState) {
    ui.pause.disabled = game.gameOver;
    ui["pause-label"].textContent = game.paused ? "RESUME" : "PAUSE";
    ui["pause-icon"].textContent = game.paused ? "▷" : "Ⅱ";
    ui.pause.setAttribute("aria-label", game.paused ? "Resume game" : "Pause game");
    ui.overlay.hidden = state === "playing";
    document.body.classList.toggle("is-overlay", state !== "playing");
    if (state !== "playing") {
      const over = state === "over";
      ui["overlay-kicker"].textContent = over ? "END OF TRANSMISSION" : "FLIGHT ON HOLD";
      ui["overlay-title"].textContent = over ? "Lost in the belt." : "Take a breath.";
      ui["overlay-copy"].textContent = over
        ? `${game.score.toLocaleString()} points · Wave ${String(game.wave).padStart(2, "0")}. Every flight is a fresh start.`
        : "The belt can wait. Your flight is paused.";
      ui["overlay-action"].replaceChildren(document.createTextNode(over ? "Fly again " : "Resume flight "), Object.assign(document.createElement("span"), { textContent: "↗", ariaHidden: "true" }));
      ui["overlay-shortcut"].replaceChildren(document.createTextNode("or press "), Object.assign(document.createElement("kbd"), { textContent: over ? "ENTER" : "P" }), document.createTextNode(over ? " to restart" : " to resume"));
      clearControls();
      ui.announcer.textContent = over ? `Game over. ${game.score} points. Press Enter to restart.` : "Game paused. Press P to resume.";
      if (document.hasFocus()) ui["overlay-action"].focus({ preventScroll: true });
    } else if (previousState) {
      ui.announcer.textContent = "Flight in progress.";
      canvas.focus({ preventScroll: true });
    }
    previousState = state;
  }
  if (game.lives !== previousLives && !game.gameOver) {
    ui.announcer.textContent = `${game.lives} lives remaining. Temporary shields active.`;
    previousLives = game.lives;
  }
}

function handleEvents() {
  for (const event of game.drainEvents()) {
    if (event.type === "wave") {
      noticeUntil = game.time + 3.6;
      ui["notice-text"].textContent = `WAVE ${String(event.wave).padStart(2, "0")} · CLEAR THE BELT`;
    } else {
      if (reducedMotion.matches) continue;
      const count = event.type === "ship" ? 35 : 16;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 25 + Math.random() * 130;
        particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 + Math.random() * 0.5, color: event.type === "ship" ? "#a4ffd3" : "#e0b68d" });
      }
      if (event.type === "rock") labels.push({ x: event.x, y: event.y, text: `+${event.points}`, life: 0.8 });
    }
  }
}

function drawWrapped(item, draw) {
  const xOffsets = [0];
  const yOffsets = [0];
  if (item.x < item.radius) xOffsets.push(game.width);
  if (item.x > game.width - item.radius) xOffsets.push(-game.width);
  if (item.y < item.radius) yOffsets.push(game.height);
  if (item.y > game.height - item.radius) yOffsets.push(-game.height);
  for (const dx of xOffsets) for (const dy of yOffsets) {
    ctx.save();
    ctx.translate(item.x + dx, item.y + dy);
    draw();
    ctx.restore();
  }
}

function drawRock(rock) {
  drawWrapped(rock, () => {
    ctx.rotate(rock.angle);
    ctx.beginPath();
    for (let i = 0; i < 11; i++) {
      const angle = i / 11 * Math.PI * 2;
      const radius = rock.radius * (0.74 + fraction(Math.sin(rock.id * 71.7 + i * 12.9) * 43758.5453) * 0.26);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#15212c80";
    ctx.fill();
    ctx.strokeStyle = rock.size === "small" ? "#9b8f84" : "#8fa2ac";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-rock.radius * 0.35, -rock.radius * 0.2);
    ctx.lineTo(rock.radius * 0.05, -rock.radius * 0.4);
    ctx.lineTo(rock.radius * 0.3, -rock.radius * 0.15);
    ctx.strokeStyle = "#7b919733";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawShip(controls) {
  if (game.gameOver) return;
  const ship = game.ship;
  drawWrapped({ ...ship, radius: 25 }, () => {
    ctx.rotate(ship.angle);
    if (game.invulnerable > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(164, 255, 211, ${0.14 + Math.sin(game.time * 8) * 0.05})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (controls.thrust && !game.paused) {
      ctx.beginPath();
      ctx.moveTo(-9, -5);
      ctx.lineTo(-23 - (reducedMotion.matches ? 3 : Math.sin(game.time * 55) * 6), 0);
      ctx.lineTo(-9, 5);
      ctx.strokeStyle = "#e8bb85";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#e8bb85";
      ctx.shadowBlur = 12;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-11, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fillStyle = "#0c1c23";
    ctx.fill();
    ctx.strokeStyle = "#caffdf";
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.shadowColor = "#a4ffd3";
    ctx.shadowBlur = 13;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
}

function drawEffects(delta) {
  if (!game.paused) {
    for (const particle of particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.life -= delta;
    }
    for (const label of labels) { label.y -= delta * 25; label.life -= delta; }
    particles = particles.filter(particle => particle.life > 0);
    labels = labels.filter(label => label.life > 0);
  }
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 2, 2);
  }
  ctx.fillStyle = "#a4ffd3";
  ctx.font = "11px Consolas, monospace";
  ctx.textAlign = "center";
  for (const label of labels) {
    ctx.globalAlpha = Math.min(1, label.life * 2);
    ctx.fillText(label.text, label.x, label.y);
  }
  ctx.globalAlpha = 1;
}

function draw(delta, controls) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, game.width, game.height);
  for (const star of stars) {
    ctx.fillStyle = `rgba(188, 212, 222, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x * game.width, star.y * game.height, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const rock of game.rocks) drawRock(rock);
  ctx.shadowColor = "#a4ffd3";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#caffdf";
  for (const bullet of game.bullets) {
    drawWrapped(bullet, () => {
      ctx.beginPath();
      ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.shadowBlur = 0;
  drawShip(controls);
  drawEffects(delta);
}

function frame(now) {
  const delta = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  if (Math.min(window.devicePixelRatio || 1, 2) !== dpr) resizeCanvas();
  const controls = readControls();
  game.update(delta, controls);
  handleEvents();
  syncHud();
  draw(delta, controls);
  requestAnimationFrame(frame);
}

resizeCanvas();
handleEvents();
syncHud();
draw(0, {});
requestAnimationFrame(frame);
