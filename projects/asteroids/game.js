"use strict";

const ROCK_RADII = Object.freeze({ large: 46, medium: 26, small: 14 });
const ROCK_POINTS = Object.freeze({ large: 20, medium: 50, small: 100 });
const STEP = 1 / 120;

function wrap(x, y, width, height) {
  return { x: ((x % width) + width) % width, y: ((y % height) + height) % height };
}

function pointsFor(size) {
  return ROCK_POINTS[size] || 0;
}

function circlesCollide(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.radius + b.radius) ** 2;
}

function splitRock(rock) {
  const size = { large: "medium", medium: "small" }[rock.size];
  if (!size) return [];
  const vx = rock.vx || 0;
  const vy = rock.vy || 0;
  const direction = Math.atan2(vy, vx) + Math.PI / 3;
  const kick = size === "medium" ? 38 : 52;
  return [-1, 1].map(sign => ({
    x: rock.x,
    y: rock.y,
    size,
    radius: ROCK_RADII[size],
    vx: vx + Math.cos(direction) * kick * sign,
    vy: vy + Math.sin(direction) * kick * sign,
    angle: rock.angle || 0,
    spin: sign * 0.65,
  }));
}

class Game {
  constructor(width = 800, height = 600, random = Math.random) {
    this._checkDimensions(width, height);
    this.width = width;
    this.height = height;
    this.random = random;
    this.restart();
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.paused = false;
    this.gameOver = false;
    this.time = 0;
    this.invulnerable = 2.4;
    this.bullets = [];
    this.rocks = [];
    this.events = [];
    this._accumulator = 0;
    this._cooldown = 0;
    this._nextId = 1;
    this._resetShip();
    this._spawnWave();
  }

  _checkDimensions(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new RangeError("The playfield dimensions must be positive finite numbers.");
    }
  }

  resize(width, height) {
    this._checkDimensions(width, height);
    for (const item of [this.ship, ...this.rocks, ...this.bullets]) {
      Object.assign(item, wrap(item.x * width / this.width, item.y * height / this.height, width, height));
    }
    this.width = width;
    this.height = height;
  }

  togglePause() {
    if (!this.gameOver) this.paused = !this.paused;
  }

  shoot() {
    if (this.paused || this.gameOver || this._cooldown > 1e-9 || this.bullets.length >= 5) return false;
    const { x, y, angle, vx, vy } = this.ship;
    const position = wrap(x + Math.cos(angle) * 19, y + Math.sin(angle) * 19, this.width, this.height);
    this.bullets.push({
      ...position,
      vx: vx + Math.cos(angle) * 560,
      vy: vy + Math.sin(angle) * 560,
      radius: 2,
      life: 1.15,
    });
    this._cooldown = 0.18;
    return true;
  }

  update(delta, controls = {}) {
    if (this.paused || this.gameOver || !Number.isFinite(delta) || delta <= 0) return;
    this._accumulator += delta;
    // Fixed simulation steps preserve collisions and firing cadence across render frame rates.
    while (this._accumulator + 1e-12 >= STEP && !this.gameOver) {
      this._accumulator = Math.max(0, this._accumulator - STEP);
      this._step(controls);
    }
  }

  drainEvents() {
    return this.events.splice(0);
  }

  _resetShip() {
    this.ship = { x: this.width / 2, y: this.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 11 };
  }

  _spawnWave() {
    this.bullets = [];
    this.invulnerable = Math.max(this.invulnerable, 1.5);
    this.rocks = Array.from({ length: this.wave + 3 }, () => {
      const location = this.random() * Math.PI * 2;
      const direction = this.random() * Math.PI * 2;
      const speed = 32 + this.random() * 42 + this.wave * 4;
      return {
        id: this._nextId++,
        x: this.width * (0.5 + 0.43 * Math.cos(location)),
        y: this.height * (0.5 + 0.43 * Math.sin(location)),
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        size: "large",
        radius: ROCK_RADII.large,
        angle: this.random() * Math.PI * 2,
        spin: (this.random() - 0.5) * 0.8,
      };
    });
    this.events.push({ type: "wave", wave: this.wave });
  }

  _move(item) {
    Object.assign(item, wrap(item.x + item.vx * STEP, item.y + item.vy * STEP, this.width, this.height));
  }

  _collide(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return circlesCollide(
      { x: 0, y: 0, radius: a.radius },
      { x: Math.min(dx, this.width - dx), y: Math.min(dy, this.height - dy), radius: b.radius },
    );
  }

  _step(controls) {
    this.time += STEP;
    this.invulnerable = Math.max(0, this.invulnerable - STEP);
    this._cooldown = Math.max(0, this._cooldown - STEP);
    const turn = Number(Boolean(controls.right)) - Number(Boolean(controls.left));
    this.ship.angle += turn * 3.8 * STEP;
    if (controls.thrust) {
      this.ship.vx += Math.cos(this.ship.angle) * 290 * STEP;
      this.ship.vy += Math.sin(this.ship.angle) * 290 * STEP;
    }
    const friction = Math.exp(-0.65 * STEP);
    this.ship.vx *= friction;
    this.ship.vy *= friction;
    this._move(this.ship);
    if (controls.shoot) this.shoot();

    for (const rock of this.rocks) {
      this._move(rock);
      rock.angle += rock.spin * STEP;
    }
    for (const bullet of this.bullets) {
      this._move(bullet);
      bullet.life -= STEP;
    }
    this.bullets = this.bullets.filter(bullet => bullet.life > 1e-9);

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const index = this.rocks.findIndex(rock => this._collide(this.bullets[i], rock));
      if (index === -1) continue;
      const [rock] = this.rocks.splice(index, 1);
      this.bullets.splice(i, 1);
      const points = pointsFor(rock.size);
      this.score += points;
      this.rocks.push(...splitRock(rock).map(piece => ({ ...piece, id: this._nextId++ })));
      this.events.push({ type: "rock", x: rock.x, y: rock.y, points });
    }

    if (this.invulnerable <= 0 && this.rocks.some(rock => this._collide(this.ship, rock))) {
      this.events.push({ type: "ship", x: this.ship.x, y: this.ship.y });
      this.lives--;
      this.bullets = [];
      if (this.lives === 0) {
        this.gameOver = true;
      } else {
        this._resetShip();
        this.invulnerable = 2.4;
      }
    }
    if (!this.gameOver && this.rocks.length === 0) {
      this.wave++;
      this._spawnWave();
    }
  }
}

if (typeof module !== "undefined") module.exports = { wrap, splitRock, pointsFor, circlesCollide, Game };
