"use strict";

(() => {
  const game = new Game();
  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const wrap = document.getElementById("canvas-wrap");
  const scenery = document.createElement("canvas");
  const sceneryContext = scenery.getContext("2d");
  const scoreOutput = document.getElementById("score");
  const levelOutput = document.getElementById("level");
  const livesOutput = document.getElementById("lives");
  const dotsOutput = document.getElementById("dots-left");
  const statusText = document.getElementById("game-status-text");
  const statusDot = document.getElementById("game-status-dot");
  const pauseButton = document.getElementById("pause-button");
  const pauseIcon = document.getElementById("pause-icon");
  const overlay = document.getElementById("game-overlay");
  const overlayEyebrow = document.getElementById("overlay-eyebrow");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayDescription = document.getElementById("overlay-description");
  const overlayButton = document.getElementById("overlay-button");
  const overlayHint = document.getElementById("overlay-hint");
  const helpDialog = document.getElementById("help-dialog");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ghostColors = ["#ed8d91", "#b0a2e2", "#82c8b6"];
  const keyDirections = { ArrowUp: "up", ArrowLeft: "left", ArrowDown: "down", ArrowRight: "right", w: "up", a: "left", s: "down", d: "right" };
  let size = 0;
  let tileSize = 0;
  let lastTime = null;
  let started = false;
  let helpWasPlaying = false;
  let lastUI = {};
  let swipeStart = null;

  function drawWallLayer(ctx, thickness, color) {
    const width = tileSize * thickness;
    const half = width / 2;
    ctx.fillStyle = color;
    for (let y = 0; y < game.maze.length; y += 1) {
      for (let x = 0; x < game.maze[y].length; x += 1) {
        if (game.maze[y][x] !== "#") continue;
        const cx = (x + 0.5) * tileSize;
        const cy = (y + 0.5) * tileSize;
        ctx.beginPath();
        ctx.roundRect(cx - half, cy - half, width, width, tileSize * 0.16);
        ctx.fill();
        const right = game.maze[y][x + 1] === "#";
        const below = game.maze[y + 1]?.[x] === "#";
        if (right) ctx.fillRect(cx, cy - half, tileSize, width);
        if (below) ctx.fillRect(cx - half, cy, width, tileSize);
        if (right && below && game.maze[y + 1][x + 1] === "#") ctx.fillRect(cx, cy, tileSize, tileSize);
      }
    }
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    size = wrap.getBoundingClientRect().width;
    if (!size) return;
    tileSize = size / game.maze[0].length;
    canvas.width = scenery.width = Math.round(size * ratio);
    canvas.height = scenery.height = Math.round(size * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    sceneryContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    sceneryContext.fillStyle = "#08151e";
    sceneryContext.fillRect(0, 0, size, size);
    drawWallLayer(sceneryContext, 0.74, "#376578");
    drawWallLayer(sceneryContext, 0.62, "#102735");
    draw(performance.now() / 1000);
  }

  function drawPlayer(time) {
    const radius = tileSize * 0.4;
    const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
    const animated = !reducedMotion.matches && started && !game.paused && !game.gameOver;
    const mouth = animated ? 0.22 + (Math.sin(time * 20) + 1) * 0.17 : 0.45;
    context.save();
    context.translate((game.player.x + 0.5) * tileSize, (game.player.y + 0.5) * tileSize);
    context.rotate(angles[game.direction] || 0);
    context.fillStyle = "#f6d365";
    context.shadowColor = "#f6d36566";
    context.shadowBlur = tileSize * 0.4;
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, mouth, Math.PI * 2 - mouth);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = "#343420";
    context.beginPath();
    context.arc(radius * 0.07, -radius * 0.52, radius * 0.1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawGhost(ghost, index, time) {
    const r = tileSize * 0.38;
    const flashing = game.frightened && game.powerRemaining < 2 && Math.floor(time * 6) % 2;
    context.save();
    context.translate((ghost.x + 0.5) * tileSize, (ghost.y + 0.5) * tileSize);
    context.fillStyle = game.frightened ? (flashing ? "#d9dfed" : "#849bdf") : ghostColors[index % ghostColors.length];
    context.beginPath();
    context.moveTo(-r, r);
    context.lineTo(-r, -r * 0.1);
    context.arc(0, -r * 0.1, r, Math.PI, 0);
    context.lineTo(r, r);
    context.lineTo(r * 0.5, r * 0.7);
    context.lineTo(0, r);
    context.lineTo(-r * 0.5, r * 0.7);
    context.closePath();
    context.fill();
    const dx = Math.sign(game.player.x - ghost.x) * (game.frightened ? -1 : 1);
    const dy = Math.sign(game.player.y - ghost.y) * (game.frightened ? -1 : 1);
    for (const eyeX of [-0.36, 0.36]) {
      context.fillStyle = "#f6f3e8";
      context.beginPath();
      context.ellipse(r * eyeX, -r * 0.06, r * 0.25, r * 0.33, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#172b3b";
      context.beginPath();
      context.arc(r * (eyeX + dx * 0.09), r * (-0.04 + dy * 0.1), r * 0.12, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function draw(time) {
    context.clearRect(0, 0, size, size);
    context.drawImage(scenery, 0, 0, size, size);
    for (let y = 0; y < game.maze.length; y += 1) {
      for (let x = 0; x < game.maze[y].length; x += 1) {
        const tile = game.maze[y][x];
        if (tile !== "." && tile !== "o") continue;
        const cx = (x + 0.5) * tileSize;
        const cy = (y + 0.5) * tileSize;
        if (tile === "o") {
          const pulse = reducedMotion.matches ? 1 : 0.9 + Math.sin(time * 3) * 0.1;
          context.fillStyle = "#f3d26412";
          context.beginPath();
          context.arc(cx, cy, tileSize * 0.32, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#f3d264";
          context.beginPath();
          context.arc(cx, cy, tileSize * 0.2 * pulse, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillStyle = "#ddc995";
          context.beginPath();
          context.arc(cx, cy, Math.max(1.2, tileSize * 0.065), 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    game.ghosts.forEach((ghost, index) => drawGhost(ghost, index, time));
    drawPlayer(time);
  }

  function syncUI() {
    if (lastUI.score !== game.score) scoreOutput.textContent = String(game.score).padStart(6, "0");
    if (lastUI.level !== game.level) levelOutput.textContent = String(game.level).padStart(2, "0");
    if (lastUI.dots !== game.remainingDots) dotsOutput.textContent = game.remainingDots;
    if (lastUI.lives !== game.lives) {
      livesOutput.replaceChildren();
      for (let index = 0; index < 3; index += 1) {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 32 32");
        icon.setAttribute("aria-hidden", "true");
        if (index >= game.lives) icon.classList.add("lost");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M29 6A15 15 0 1 0 29 26L16 16Z");
        path.setAttribute("fill", "currentColor");
        icon.append(path);
        livesOutput.append(icon);
      }
      livesOutput.setAttribute("aria-label", `${game.lives} ${game.lives === 1 ? "life" : "lives"}`);
    }
    let status = !started ? "Your move. Use the arrow keys to begin." : "Stay hungry. Stay one step ahead.";
    if (game.frightened) status = `The tables have turned. ${Math.ceil(game.powerRemaining)}s of power.`;
    if (game.paused) status = "Paused. A little breather.";
    if (game.gameOver) status = "Out of lives. Ready for another round?";
    if (lastUI.status !== status) statusText.textContent = status;
    statusDot.style.background = game.frightened ? "#849bdf" : game.paused ? "#7b8a7c" : "#f3d264";
    pauseButton.disabled = game.gameOver;
    pauseButton.setAttribute("aria-label", game.paused ? "Resume game" : "Pause game");
    pauseButton.setAttribute("aria-pressed", String(game.paused));
    pauseButton.title = game.paused ? "Resume (P)" : "Pause (P)";
    pauseIcon.textContent = game.paused ? "▶" : "Ⅱ";
    const overlayState = game.gameOver ? "over" : game.paused ? "paused" : "hidden";
    if (lastUI.overlay !== overlayState) {
      overlay.hidden = overlayState === "hidden";
      if (game.gameOver) {
        overlayEyebrow.textContent = "A GOOD RUN. ANOTHER?";
        overlayTitle.textContent = "That's a wrap.";
        overlayDescription.textContent = `${game.score.toLocaleString()} points. Level ${game.level}. There's always one more go.`;
        overlayButton.textContent = "One more go →";
        overlayHint.textContent = "or press Enter";
      } else if (game.paused) {
        overlayEyebrow.textContent = "TAKE A BREATHER";
        overlayTitle.textContent = "On pause.";
        overlayDescription.textContent = "The dots aren't going anywhere.";
        overlayButton.textContent = "Back to the chase →";
        overlayHint.textContent = "or press P";
      }
    }
    lastUI = { score: game.score, level: game.level, dots: game.remainingDots, lives: game.lives, status, overlay: overlayState };
  }

  function move(direction) {
    if (game.gameOver || game.paused || helpDialog.open) return;
    started = true;
    game.setDirection(direction);
    canvas.focus({ preventScroll: true });
  }

  function restart() {
    game.restart();
    started = false;
    lastTime = null;
    syncUI();
    canvas.focus({ preventScroll: true });
  }

  function pause() {
    game.togglePause();
    lastTime = null;
    syncUI();
  }

  document.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || helpDialog.open) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (Object.hasOwn(keyDirections, key)) {
      event.preventDefault();
      move(keyDirections[key]);
    } else if (key === "p") {
      event.preventDefault();
      if (!event.repeat) pause();
    } else if (key === "Enter" && game.gameOver) {
      event.preventDefault();
      if (!event.repeat) restart();
    }
  });

  pauseButton.addEventListener("click", pause);
  overlayButton.addEventListener("click", () => {
    if (game.gameOver) restart();
    else pause();
  });
  document.querySelectorAll("[data-direction]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      move(button.dataset.direction);
    });
    button.addEventListener("click", () => move(button.dataset.direction));
  });

  canvas.addEventListener("pointerdown", event => {
    swipeStart = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", event => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    }
    swipeStart = null;
  });
  canvas.addEventListener("pointercancel", () => { swipeStart = null; });

  document.getElementById("help-button").addEventListener("click", () => {
    helpWasPlaying = !game.paused && !game.gameOver;
    if (helpWasPlaying) pause();
    helpDialog.showModal();
  });
  const closeHelp = () => helpDialog.close();
  document.getElementById("close-help").addEventListener("click", closeHelp);
  document.getElementById("play-button").addEventListener("click", closeHelp);
  helpDialog.addEventListener("close", () => {
    if (helpWasPlaying && game.paused) pause();
    helpWasPlaying = false;
  });
  helpDialog.addEventListener("click", event => {
    const rect = helpDialog.getBoundingClientRect();
    if (event.target === helpDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeHelp();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !game.paused && !game.gameOver && !helpDialog.open) pause();
    lastTime = null;
  });

  function frame(timestamp) {
    const delta = lastTime === null ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (started) game.update(delta);
    syncUI();
    draw(timestamp / 1000);
    window.requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(wrap);
  window.addEventListener("resize", resize);
  resize();
  syncUI();
  window.requestAnimationFrame(frame);
})();
