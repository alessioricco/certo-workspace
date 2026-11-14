import { recolor } from './palette';
import type { Palette } from './palette';
import { t } from '../ui/strings';
import type { RunSession } from '../game/run';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport';
import { drawSignature, paintSignatureAtlas } from './signature';
import { Feedback } from './feedback';
import { Starfield } from './starfield';

export interface RangeAssets { grid: HTMLCanvasElement; atlas: HTMLCanvasElement; scanlines: HTMLCanvasElement }

export function createGrid(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = LOGICAL_WIDTH;
  canvas.height = LOGICAL_HEIGHT;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Grid resource could not be created.');
  context.fillStyle = '#09131f';
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  context.strokeStyle = '#172c3b';
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 20; x < LOGICAL_WIDTH; x += 40) {
    context.moveTo(x, 0); context.lineTo(x, LOGICAL_HEIGHT);
  }
  for (let y = 0; y < LOGICAL_HEIGHT; y += 40) {
    context.moveTo(0, y); context.lineTo(LOGICAL_WIDTH, y);
  }
  context.stroke();
  context.strokeStyle = '#537d88';
  context.beginPath();
  context.moveTo(180, 64); context.lineTo(204, 96);
  context.lineTo(180, 128); context.lineTo(156, 96); context.closePath();
  context.stroke();
  return canvas;
}

export function createScanlines(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 360; canvas.height = 640;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Scanline resource could not be created.');
  context.fillStyle = '#00000018';
  for (let y = 0; y < 640; y += 4) context.fillRect(0, y, 360, 1);
  return canvas;
}

export function createAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 704;
  canvas.height = 304;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Ship atlas could not be created.');
  context.scale(2, 2);
  context.fillStyle = '#537d88';
  context.beginPath();
  context.moveTo(20, 4); context.lineTo(34, 38); context.lineTo(20, 31);
  context.lineTo(6, 38); context.closePath(); context.fill();
  context.fillStyle = '#acd9d3';
  context.beginPath();
  context.moveTo(20, 4); context.lineTo(25, 28); context.lineTo(20, 34);
  context.lineTo(15, 28); context.closePath(); context.fill();
  context.fillStyle = '#f1faf6';
  context.fillRect(19, 16, 2, 9);
  context.fillStyle = '#ffd49b';
  context.fillRect(18, 35, 4, 5);
  context.fillRect(42, 4, 4, 12);
  context.fillStyle = '#fff2db';
  context.fillRect(43, 4, 2, 8);
  context.fillStyle = '#537d88';
  context.fillRect(56, 0, 8, 8);
  context.fillStyle = '#ffd49b';
  context.fillRect(68, 0, 4, 4);
  for (let damaged = 0; damaged < 2; damaged++) {
    for (let type = 0; type < 3; type++) {
      context.save();
      context.translate(80 + type * 48, damaged * 48);
      context.strokeStyle = damaged ? '#f1faf6' : type === 0 ? '#8ce6da' : type === 1 ? '#d1bcf5' : '#ffd49b';
      context.fillStyle = damaged ? '#537d88' : '#243d50';
      context.lineWidth = 2;
      context.lineJoin = 'bevel';
      context.beginPath();
      if (type === 0) {
        context.moveTo(22, 7); context.lineTo(8, 24); context.lineTo(22, 38); context.lineTo(18, 24); context.closePath();
        context.moveTo(26, 7); context.lineTo(40, 24); context.lineTo(26, 38); context.lineTo(30, 24); context.closePath();
      } else if (type === 1) {
        context.moveTo(22, 8); context.lineTo(26, 8); context.lineTo(26, 21);
        context.lineTo(39, 28); context.lineTo(37, 32); context.lineTo(24, 25);
        context.lineTo(11, 32); context.lineTo(9, 28); context.lineTo(22, 21); context.closePath();
      } else {
        context.moveTo(7, 36); context.lineTo(7, 15); context.lineTo(17, 7); context.lineTo(31, 7);
        context.lineTo(41, 15); context.lineTo(41, 36); context.lineTo(35, 36);
        context.lineTo(35, 18); context.lineTo(29, 13); context.lineTo(19, 13);
        context.lineTo(13, 18); context.lineTo(13, 36); context.closePath();
      }
      context.fill(); context.stroke();
      context.fillStyle = damaged ? '#f1faf6' : '#acd9d3';
      context.fillRect(22, 21, 4, 6);
      context.restore();
    }
  }
  paintSignatureAtlas(context);
  context.strokeStyle = '#fff2db'; context.lineWidth = 2;
  context.beginPath(); context.moveTo(324, 3); context.lineTo(328, 12); context.lineTo(332, 3); context.stroke();
  const glow = context.createRadialGradient(336, 32, 1, 336, 32, 16);
  glow.addColorStop(0, '#8ce6da50'); glow.addColorStop(1, '#8ce6da00');
  context.fillStyle = glow; context.fillRect(320, 16, 32, 32);
  return canvas;
}

export class RangeRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly starfield = new Starfield(0);
  readonly feedback = new Feedback();
  private palette: Palette = 'default';

  constructor(private readonly canvas: HTMLCanvasElement, private readonly assets: RangeAssets) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable.');
    this.context = context;
  }

  setPalette(palette: Palette): void {
    if (this.palette === palette) return;
    this.palette = palette;
    this.assets.atlas = createAtlas(); this.assets.grid = createGrid();
    recolor(this.assets.atlas, palette); recolor(this.assets.grid, palette);
  }

  reset(seed: number): void { this.starfield.reset(seed); this.feedback.reset(); }

  draw(session: Readonly<RunSession>, alpha: number, running: boolean, reducedMotion: boolean): void {
    const range = session.range;
    const settings = this.feedback.settings;
    const quietMotion = reducedMotion || settings.low;
    const context = this.context;
    context.setTransform(this.canvas.width / LOGICAL_WIDTH, 0, 0, this.canvas.height / LOGICAL_HEIGHT, 0, 0);
    context.drawImage(this.assets.grid, 0, 0);
    const blend = running ? alpha : 1;
    const time = quietMotion ? 0 : running ? Math.max(0, range.ticks - 1 + alpha) : range.ticks;
    const playerX = range.player.previousX + (range.player.x - range.player.previousX) * blend;
    for (const star of this.starfield.stars) {
      const size = star.layer + 1;
      context.drawImage(this.assets.atlas, 112, 0, 16, 16,
        this.starfield.x(star, quietMotion ? 180 : playerX), this.starfield.y(star, time), size, size);
    }
    context.save();
    const shake = this.feedback.shake(range.ticks, quietMotion);
    context.translate(shake, shake * 0.5);
    if (settings.glow && !settings.low && session.playerVisible) {
      context.drawImage(this.assets.atlas, 640, 32, 64, 64, playerX - 32, range.player.y - 32, 64, 64);
    }
    for (const enemy of session.formation.enemies.slots) {
      if (!enemy.active || enemy.state === 'queued') continue;
      const x = enemy.previousX + (enemy.x - enemy.previousX) * blend;
      const y = enemy.previousY + (enemy.y - enemy.previousY) * blend;
      context.save();
      context.translate(x, y);
      if (enemy.kind === 'spindle' && !quietMotion) context.rotate(time / 120);
      context.drawImage(this.assets.atlas, 160 + enemy.sprite * 96, enemy.hitTicks > 0 ? 96 : 0, 96, 96, -24, -24, 48, 48);
      context.restore();
      if (enemy.state === 'warning') {
        context.strokeStyle = '#fff2db';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x - 23, y - 10); context.lineTo(x - 23, y - 22); context.lineTo(x - 12, y - 22);
        context.moveTo(x + 23, y - 10); context.lineTo(x + 23, y - 22); context.lineTo(x + 12, y - 22);
        context.moveTo(x - 7, y + 24); context.lineTo(x, y + 32); context.lineTo(x + 7, y + 24);
        context.stroke();
      }
      const maxHP = session.config.kind === 'bonus' ? 1 : enemy.maxHP;
      for (let hp = 0; hp < maxHP; hp++) {
        context.fillStyle = hp < enemy.hp ? '#f1faf6' : '#34464b';
        context.fillRect(x - maxHP * 3 + hp * 6, y - 29, 4, 3);
      }
    }
    if (!quietMotion && settings.particles) {
      for (const particle of session.particles.slots) {
        if (!particle.active) continue;
        const x = particle.previousX + (particle.x - particle.previousX) * blend;
        const y = particle.previousY + (particle.y - particle.previousY) * blend;
        context.globalAlpha = particle.remaining / 30;
        context.drawImage(this.assets.atlas, 136, 0, 8, 8, x - 2, y - 2, 4, 4);
      }
      context.globalAlpha = 1;
    }
    for (const bullet of range.bullets.slots) {
      if (!bullet.active) continue;
      const x = bullet.previousX + (bullet.x - bullet.previousX) * blend;
      const y = bullet.previousY + (bullet.y - bullet.previousY) * blend;
      context.drawImage(this.assets.atlas, 80, 0, 16, 40, x - 4, y - 10, 8, 20);
    }
    drawSignature(session, context, this.assets.atlas, blend, playerX);
    context.strokeStyle = '#fff2db';
    context.lineWidth = 2;
    for (const shot of session.hostiles.slots) {
      if (!shot.active) continue;
      const x = shot.previousX + (shot.x - shot.previousX) * blend;
      const y = shot.previousY + (shot.y - shot.previousY) * blend;
      if (shot.marked) {
        context.drawImage(this.assets.atlas, 448, 0, 64, 64, x - 12, y - 12, 24, 24);
        continue;
      }
      context.drawImage(this.assets.atlas, 640, 0, 32, 32, x - 8, y - 8, 16, 16);
    }
    if (session.playerVisible) {
      context.drawImage(this.assets.atlas, 0, 0, 80, 96, playerX - 20, range.player.y - 24, 40, 48);
      if (session.vitals.invulnerable > 0) {
        context.beginPath(); context.arc(playerX, range.player.y, 26, 0, Math.PI * 2); context.stroke();
      }
    }
    for (const mark of this.feedback.marks) {
      if (mark.until <= range.ticks) continue;
      context.strokeStyle = mark.kind === 'damage' ? '#ffd49b' : '#f1faf6';
      context.lineWidth = 2;
      const size = quietMotion ? 22 : 22 + (10 - mark.until + range.ticks) * 0.7;
      context.strokeRect(mark.x - size, mark.y - size, size * 2, size * 2);
    }
    context.restore();
    if (settings.scanlines && !settings.low && !reducedMotion) context.drawImage(this.assets.scanlines, 0, 0);
    if (session.tally > 0 || session.vitals.respawn > 0) {
      context.fillStyle = '#101e2e'; context.fillRect(10, 310, 340, 52);
      context.fillStyle = '#f1faf6'; context.font = '13px system-ui'; context.textAlign = 'center';
      context.fillText(session.tally > 0 ? session.lastTally : t('respawn_canvas'), 180, 340);
    }
  }
}
