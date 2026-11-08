/* global createWorld, modelLines, groundLines, projectLine, projectSkyLine, toCamera, createGame, updateGame, tankLines, shellLines, DRIVE_SPEED, DAMAGE_DURATION, waveDifficulty, radarContact, isGameOver, RADAR_RANGE */
(() => {
  'use strict';

  const canvas = document.getElementById('view');
  const ctx = canvas.getContext('2d');
  const compass = document.getElementById('compass');
  const compassCtx = compass.getContext('2d');
  const radar = document.getElementById('radar');
  const radarCtx = radar.getContext('2d');
  const dialog = document.getElementById('pause-dialog');
  const pauseButton = document.getElementById('pause-button');
  const byId = id => document.getElementById(id);
  const ui = Object.fromEntries([
    'heading-value', 'position-x', 'position-z', 'gear', 'speed', 'speed-kmh',
    'speed-fill', 'drive-state', 'link-status', 'frame-rate',
    'score', 'high-score', 'lives', 'weapon-state', 'target-state', 'combat-state',
    'wave-state', 'threat-state', 'storage-state',
  ].map(id => [id, byId(id)]));
  const world = createWorld();
  const structures = world.obstacles.map(obstacle => ({ ...obstacle, lines: modelLines(obstacle) }));
  const keyboard = new Set();
  const pointers = new Map();
  const bindings = {
    forward: ['KeyW', 'ArrowUp'], backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], fire: ['Space'],
  };
  const driveCodes = new Set(Object.values(bindings).flat());
  const touchButtons = [...document.querySelectorAll('[data-control]')];
  const keyElements = [...document.querySelectorAll('.key-guide kbd')];
  let game = createGame(world);
  let camera = game.player;
  let width = 0;
  let height = 0;
  let focal = 0;
  let lastTime = null;
  let lastHudTime = -Infinity;
  let fpsTime = 0;
  let frames = 0;
  let paused = false;
  let actualSpeed = 0;
  let groundGlow;
  let skyGlow;
  const highScoreKey = 'iron-horizon.highScore';
  let storageAvailable = true;
  let highScore = readHighScore();

  function readHighScore() {
    try {
      const stored = Number(window.localStorage.getItem(highScoreKey));
      return Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
    } catch {
      storageAvailable = false;
      return 0;
    }
  }

  function saveHighScore() {
    if (game.score <= highScore) return;
    highScore = game.score;
    try {
      window.localStorage.setItem(highScoreKey, String(highScore));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }

  function sizeCanvas(element, context, w, h) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(w * ratio);
    element.height = Math.round(h * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    focal = Math.min(width * 0.78, height * 1.12);
    sizeCanvas(canvas, ctx, width, height);
    sizeCanvas(compass, compassCtx, 440, 42);
    sizeCanvas(radar, radarCtx, 136, 136);
    groundGlow = ctx.createLinearGradient(0, height / 2, 0, height);
    groundGlow.addColorStop(0, '#26221518');
    groundGlow.addColorStop(0.45, '#12170e12');
    groundGlow.addColorStop(1, '#080a0900');
    skyGlow = ctx.createRadialGradient(width / 2, height * 0.48, 10, width / 2, height * 0.48, width * 0.6);
    skyGlow.addColorStop(0, '#a57a2d0a');
    skyGlow.addColorStop(1, '#080a0900');
  }

  function isHeld(control) {
    return bindings[control].some(code => keyboard.has(code)) || [...pointers.values()].includes(control);
  }

  function readControls() {
    return {
      throttle: Number(isHeld('forward')) - Number(isHeld('backward')),
      steer: Number(isHeld('right')) - Number(isHeld('left')),
      fire: isHeld('fire'),
    };
  }

  function releaseControls() {
    keyboard.clear();
    pointers.clear();
    touchButtons.forEach(button => button.classList.remove('active'));
  }

  function setPaused(value, guide = false) {
    if (value && isGameOver(game)) return;
    paused = value;
    releaseControls();
    lastTime = null;
    lastHudTime = -Infinity;
    ui['link-status'].textContent = value ? 'ENGINE IDLING' : 'SYSTEM ONLINE';
    pauseButton.innerHTML = value ? '▷ <span>RESUME</span>' : 'Ⅱ <span>PAUSE</span>';
    pauseButton.setAttribute('aria-label', value ? 'Resume combat' : 'Pause combat');
    pauseButton.setAttribute('aria-pressed', String(value));
    byId('dialog-title').textContent = guide ? 'HOLD THE HORIZON.' : 'ENGINE IDLING.';
    if (value && !dialog.open) dialog.showModal();
    if (!value && dialog.open) dialog.close();
    actualSpeed = 0;
    updateHud(readControls());
  }

  function reset() {
    saveHighScore();
    game = createGame(world);
    camera = game.player;
    actualSpeed = 0;
    setPaused(false);
    updateHud(readControls());
  }

  window.addEventListener('keydown', event => {
    if (driveCodes.has(event.code)) {
      event.preventDefault();
      if (!paused && !isGameOver(game)) keyboard.add(event.code);
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyP' || event.code === 'Escape' || event.code === 'KeyH') {
      event.preventDefault();
      setPaused(!paused, event.code === 'KeyH');
    } else if (event.code === 'Enter' && isGameOver(game)) {
      event.preventDefault();
      reset();
    } else if (event.code === 'KeyR' && !paused) {
      reset();
    }
  });
  window.addEventListener('keyup', event => {
    if (driveCodes.has(event.code)) event.preventDefault();
    keyboard.delete(event.code);
  });
  window.addEventListener('blur', releaseControls);
  document.addEventListener('visibilitychange', () => {
    releaseControls();
    lastTime = null;
  });
  pauseButton.addEventListener('click', () => setPaused(!paused));
  byId('help-button').addEventListener('click', () => setPaused(true, true));
  byId('resume-button').addEventListener('click', () => setPaused(false));
  byId('restart-button').addEventListener('click', reset);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    setPaused(false);
  });
  dialog.addEventListener('close', () => {
    if (paused) setPaused(false);
  });
  for (const button of touchButtons) {
    button.addEventListener('pointerdown', event => {
      if (paused || isGameOver(game)) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.control);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, event => pointers.delete(event.pointerId));
    }
    button.addEventListener('contextmenu', event => event.preventDefault());
  }

  function strokeWorldLines(lines, color, lineWidth, glow = 0, projector = projectLine) {
    ctx.beginPath();
    let count = 0;
    for (const line of lines) {
      const screen = projector(line, camera, focal, width, height);
      if (!screen) continue;
      const [a, b] = screen;
      if ((a.x < 0 && b.x < 0) || (a.x > width && b.x > width) ||
          (a.y < 0 && b.y < 0) || (a.y > height && b.y > height)) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      count++;
    }
    if (!count) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawTerrain() {
    ctx.fillStyle = '#080a09';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = groundGlow;
    ctx.fillRect(0, height / 2, width, height / 2);
    strokeWorldLines(world.mountains, '#c6a56483', 0.9, 3, projectSkyLine);
    strokeWorldLines(world.moon, '#e7ce9a', 1.15, 9, projectSkyLine);

    ctx.strokeStyle = '#ac95592a';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(22, height / 2);
    ctx.lineTo(width - 22, height / 2);
    ctx.stroke();

    const grid = groundLines(camera);
    const nearGrid = [];
    const farGrid = [];
    for (const line of grid) {
      const a = toCamera(line[0], camera);
      const b = toCamera(line[1], camera);
      if (Math.min(a.z, b.z) > 110) farGrid.push(line);
      else nearGrid.push(line);
    }
    strokeWorldLines(farGrid, '#7d754a27', 0.65);
    strokeWorldLines(nearGrid, '#a6915541', 0.8);

    const enemy = { ...game.enemy, type: 'enemy', lines: tankLines(game.enemy) };
    const ordered = [...structures, enemy].map(object => ({ object, distance: Math.hypot(object.x - camera.x, object.z - camera.z) }))
      .sort((a, b) => b.distance - a.distance);
    for (const { object, distance } of ordered) {
      if (object.type === 'enemy') {
        strokeWorldLines(object.lines, '#ff8977', 1.4, 9);
        continue;
      }
      const opacity = Math.max(0.16, Math.min(0.88, 1 - distance / 380));
      const color = object.type === 'pyramid' ? `rgba(229,179,95,${opacity})` : `rgba(242,196,119,${opacity})`;
      strokeWorldLines(object.lines, color, distance < 100 ? 1.15 : 0.85, distance < 110 ? 5 : 2);
    }
    for (const shell of [game.playerShell, game.enemyShell]) {
      if (shell) strokeWorldLines(shellLines(shell), shell.owner === 'player' ? '#fff0c4' : '#ff6857', 2, 12);
    }
    drawViewScale();
  }

  function drawDamage() {
    if (game.damageTime <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.damageTime / DAMAGE_DURATION);
    ctx.fillStyle = '#b52f2014';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#ffb39cbb';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#ff6857';
    ctx.shadowBlur = 5;
    const x = width * 0.64;
    const y = height * 0.43;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      const dx = Math.cos(angle) * width * 0.65;
      const dy = Math.sin(angle) * height * 0.65;
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 0.16 + 5, y + dy * 0.16 - 4);
      ctx.lineTo(x + dx * 0.4 - 6, y + dy * 0.4 + 7);
      ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + dx * 0.4 - 6, y + dy * 0.4 + 7);
      ctx.lineTo(x + dx * 0.5 - dy * 0.12, y + dy * 0.5 + dx * 0.05);
      const nextAngle = (i + 1) * Math.PI * 2 / 9;
      ctx.moveTo(x + dx * 0.16 + 5, y + dy * 0.16 - 4);
      ctx.lineTo(x + Math.cos(nextAngle) * width * 0.104 + 5,
        y + Math.sin(nextAngle) * height * 0.104 - 4);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawViewScale() {
    ctx.strokeStyle = '#95815355';
    ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      const x = side === -1 ? 30 : width - 30;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const y = height / 2 + i * 28;
        ctx.moveTo(x, y);
        ctx.lineTo(x + side * (i === 0 ? -12 : -5), y);
      }
      ctx.stroke();
    }
  }

  function drawCompass() {
    const c = compassCtx;
    const degrees = ((camera.heading * 180 / Math.PI) % 360 + 360) % 360;
    c.clearRect(0, 0, 440, 42);
    c.font = '8px monospace';
    c.textAlign = 'center';
    const center = Math.round(degrees / 5) * 5;
    const directions = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let bearing = center - 75; bearing <= center + 75; bearing += 5) {
      const x = 220 + (bearing - degrees) * 3.6;
      const normalized = (bearing % 360 + 360) % 360;
      const major = normalized % 30 === 0;
      c.strokeStyle = major ? '#b99c64' : '#6b6244';
      c.beginPath();
      c.moveTo(x, 30);
      c.lineTo(x, major ? 21 : 25);
      c.stroke();
      if (major) {
        c.fillStyle = normalized % 90 === 0 ? '#e7cb94' : '#9b8d6c';
        c.fillText(directions[normalized] || String(normalized).padStart(3, '0'), x, 12);
      }
    }
    c.strokeStyle = '#e8b86b';
    c.beginPath();
    c.moveTo(220, 25);
    c.lineTo(220, 36);
    c.stroke();
  }

  function drawRadar() {
    const c = radarCtx;
    const size = 136;
    const center = size / 2;
    const radius = 59;
    c.clearRect(0, 0, size, size);
    c.fillStyle = '#0b110dda';
    c.beginPath();
    c.arc(center, center, radius, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#9aaf8540';
    c.lineWidth = 0.7;
    for (const r of [20, 40, 59]) {
      c.beginPath();
      c.arc(center, center, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = '#8fa07824';
    c.beginPath();
    c.moveTo(center, 9); c.lineTo(center, 127);
    c.moveTo(9, center); c.lineTo(127, center);
    c.moveTo(center, center); c.lineTo(center - 33, 19);
    c.moveTo(center, center); c.lineTo(center + 33, 19);
    c.stroke();
    c.fillStyle = '#8496740b';
    c.beginPath();
    c.moveTo(center, center);
    c.arc(center, center, radius, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
    c.closePath();
    c.fill();
    c.save();
    c.beginPath();
    c.arc(center, center, radius - 2, 0, Math.PI * 2);
    c.clip();
    c.strokeStyle = '#bdaf7e';
    for (const obstacle of world.obstacles) {
      const p = toCamera({ x: obstacle.x, y: 0, z: obstacle.z }, camera);
      const x = center + p.x / RADAR_RANGE * radius;
      const y = center - p.z / RADAR_RANGE * radius;
      if (obstacle.type === 'pyramid') {
        c.beginPath();
        c.moveTo(x, y - 2); c.lineTo(x + 2, y + 2); c.lineTo(x - 2, y + 2);
        c.closePath(); c.stroke();
      } else c.strokeRect(x - 1.7, y - 1.7, 3.4, 3.4);
    }
    const sweep = game.radarAngle - Math.PI / 2;
    c.fillStyle = '#a4c29d16';
    c.beginPath();
    c.moveTo(center, center);
    c.arc(center, center, radius, sweep - 0.5, sweep);
    c.closePath();
    c.fill();
    c.strokeStyle = '#b9daa2';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(center, center);
    c.lineTo(center + Math.cos(sweep) * radius, center + Math.sin(sweep) * radius);
    c.stroke();
    c.restore();
    const contact = radarContact(game.enemy, camera);
    if (contact.inRange) {
      const enemyX = center + contact.x * (radius - 4);
      const enemyY = center + contact.y * (radius - 4);
      c.fillStyle = '#ff8977';
      c.shadowColor = '#ff6857';
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(enemyX, enemyY, 3, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }
    c.fillStyle = '#c2d2af';
    c.beginPath();
    c.moveTo(center, center - 5); c.lineTo(center + 3, center + 4);
    c.lineTo(center, center + 2); c.lineTo(center - 3, center + 4);
    c.closePath(); c.fill();
    c.fillStyle = '#849774';
    c.font = '6px monospace';
    c.textAlign = 'center';
    c.fillText('FWD', center, 5);
    c.fillRect(2, center, 3, 1);
    c.fillRect(131, center, 3, 1);
  }

  function updateHud(controls) {
    const speed = Math.round(actualSpeed);
    const blocked = controls.throttle !== 0 && actualSpeed < 0.01;
    const bearing = ((camera.heading * 180 / Math.PI) % 360 + 360) % 360;
    const signedPosition = value => `${value < 0 ? '−' : '+'}${String(Math.round(Math.abs(value))).padStart(4, '0')}`;
    ui['heading-value'].textContent = `${String(Math.round(bearing) % 360).padStart(3, '0')}°`;
    ui['position-x'].textContent = signedPosition(camera.x);
    ui['position-z'].textContent = signedPosition(camera.z);
    ui.speed.textContent = String(speed).padStart(2, '0');
    ui['speed-kmh'].textContent = String(Math.round(speed * 3.6));
    ui['speed-fill'].style.width = `${speed / DRIVE_SPEED * 100}%`;
    ui.gear.textContent = controls.throttle > 0 ? 'FORWARD' : controls.throttle < 0 ? 'REVERSE' : 'NEUTRAL';
    ui['drive-state'].textContent = paused ? 'ENGINE IDLING' : game.lives === 0 ? 'UNIT DISABLED' : blocked ? 'OBSTACLE CONTACT' : controls.throttle !== 0
      ? 'TRAVERSING TERRAIN' : controls.steer !== 0 ? 'ADJUSTING HEADING' : 'AWAITING INPUT';
    const over = isGameOver(game);
    const contact = radarContact(game.enemy, camera);
    const wave = waveDifficulty(game.enemyNumber - 1).wave;
    ui.score.textContent = String(game.score).padStart(6, '0');
    ui['high-score'].textContent = String(highScore).padStart(6, '0');
    ui['storage-state'].textContent = storageAvailable ? 'BEST SAVED LOCALLY' : 'BEST THIS SESSION ONLY';
    ui.lives.textContent = `${game.lives} / 3`;
    ui['wave-state'].textContent = `WAVE ${String(wave).padStart(2, '0')} / ${(game.enemyNumber - 1) % 5} OF 5 DESTROYED`;
    ui['threat-state'].textContent = over ? 'RADAR / SIGNAL LOST'
      : `ENEMY ${contact.direction}${contact.inRange ? '' : ' / BEYOND SCAN'}`;
    ui['threat-state'].dataset.direction = contact.direction;
    radar.setAttribute('aria-label', `Radar: enemy ${contact.direction.toLowerCase()}, ${Math.round(contact.distance)} metres${contact.inRange ? '' : ', outside scan range'}`);
    ui['weapon-state'].textContent = over ? 'CANNON OFFLINE' : game.playerShell ? 'SHELL IN FLIGHT' : 'SPACE / FIRE READY';
    ui['target-state'].textContent = `ASH WARDEN ${String(game.enemyNumber).padStart(2, '0')} / ${Math.round(contact.distance)} M`;
    ui['combat-state'].textContent = over ? 'GAME OVER — ENTER TO RESTART' : game.damageTime > 0
      ? 'ARMOR HIT — KEEP MOVING' : 'CORAL CONTACT / HOSTILE';
    byId('combat-result').hidden = !over;
    document.body.classList.toggle('round-over', over);
    ui['link-status'].textContent = paused ? 'ENGINE IDLING' : over ? 'SIGNAL LOST' : 'SYSTEM ONLINE';
    pauseButton.disabled = over;
    const activeKeys = {
      W: 'forward', '↑': 'forward', S: 'backward', '↓': 'backward',
      A: 'left', '←': 'left', D: 'right', '→': 'right',
    };
    for (const element of keyElements) element.classList.toggle('pressed', isHeld(activeKeys[element.textContent]));
    for (const button of touchButtons) button.classList.toggle('active', isHeld(button.dataset.control));
  }

  function frame(now) {
    const dt = lastTime === null || document.hidden ? 0 : (now - lastTime) / 1000;
    lastTime = now;
    const wasOver = isGameOver(game);
    const controls = paused || wasOver ? { throttle: 0, steer: 0 } : readControls();
    const previous = camera;
    if (!paused) game = updateGame(game, controls, dt, world.obstacles);
    saveHighScore();
    if (!wasOver && isGameOver(game)) {
      releaseControls();
      lastHudTime = -Infinity;
      byId('combat-result').hidden = false;
      byId('restart-button').focus({ preventScroll: true });
    }
    camera = game.player;
    actualSpeed = !paused && dt > 0 ? Math.hypot(camera.x - previous.x, camera.z - previous.z) / dt : 0;
    drawTerrain();
    drawDamage();
    drawCompass();
    drawRadar();
    if (now - lastHudTime > 60) {
      updateHud(controls);
      lastHudTime = now;
    }
    frames++;
    if (now - fpsTime >= 1000) {
      ui['frame-rate'].textContent = String(Math.round(frames * 1000 / (now - fpsTime)));
      frames = 0;
      fpsTime = now;
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
