import { t } from '../ui/strings';
import type { RunSession } from '../game/run';
import { POWER_KINDS } from '../game/powerups';

export function paintSignatureAtlas(context: CanvasRenderingContext2D): void {
  context.lineWidth = 2;
  context.strokeStyle = '#f4b9ef'; context.fillStyle = '#243d50';
  context.beginPath(); context.arc(240, 16, 12, 0, Math.PI * 2); context.stroke();
  context.beginPath(); context.moveTo(240, 9); context.lineTo(246, 16); context.lineTo(240, 23); context.lineTo(234, 16); context.closePath(); context.stroke();
  context.strokeStyle = '#8ce6da';
  context.beginPath(); context.moveTo(272, 4); context.lineTo(283, 17); context.lineTo(272, 27); context.lineTo(261, 17); context.closePath(); context.fill(); context.stroke();
  context.fillStyle = '#f1faf6'; context.fillRect(271, 11, 2, 11);
  for (let index = 0; index < 3; index++) {
    const x = 224 + index * 32;
    context.strokeStyle = '#8ce6da'; context.fillStyle = '#101e2e';
    context.fillRect(x + 3, 43, 26, 26); context.strokeRect(x + 3, 43, 26, 26);
    context.fillStyle = '#f1faf6'; context.font = 'bold 16px system-ui'; context.textAlign = 'center';
    context.fillText(index === 0 ? 'W' : index === 1 ? 'F' : 'O', x + 16, 62);
  }
  for (let index = 0; index < 2; index++) {
    const x = index === 0 ? 224 : 280;
    const size = index === 0 ? 48 : 64;
    context.strokeStyle = '#ffd49b'; context.fillStyle = '#243d50';
    context.beginPath();
    context.moveTo(x + size / 2, 88); context.lineTo(x + size - 3, 102);
    context.lineTo(x + size - 3, 88 + size - 14); context.lineTo(x + size / 2, 88 + size);
    context.lineTo(x + 3, 88 + size - 14); context.lineTo(x + 3, 102); context.closePath();
    context.fill(); context.stroke();
    context.strokeRect(x + 13, 104, size - 26, size - 32);
  }
}

export function drawSignature(session: Readonly<RunSession>, context: CanvasRenderingContext2D, atlas: HTMLCanvasElement,
  blend: number, playerX: number): void {
  const boss = session.boss;
  if (boss.active) {
    context.strokeStyle = '#537d88'; context.lineWidth = 3;
    context.beginPath(); context.moveTo(boss.parts[0]?.x ?? 0, 145); context.lineTo(boss.parts[1]?.x ?? 0, 145); context.stroke();
    for (const part of boss.parts) {
      if (part.id < 2 && part.hp === 0) continue;
      const x = part.previousX + (part.x - part.previousX) * blend;
      const size = part.id === 2 ? 64 : 48;
      context.globalAlpha = boss.vulnerable(part) ? 1 : 0.45;
      context.drawImage(atlas, part.id === 2 ? 560 : 448, 176, size * 2, size * 2, x - size / 2, part.y - size / 2, size, size);
      context.globalAlpha = 1;
      if ((boss.phase === 1 && part.id < 2) || (boss.phase > 1 && part.id === 2)) {
        context.fillStyle = '#34464b'; context.fillRect(x - 22, part.y - size / 2 - 10, 44, 4);
        context.fillStyle = '#f1faf6'; context.fillRect(x - 22, part.y - size / 2 - 10, 44 * part.hp / part.maxHP, 4);
      }
    }
    context.fillStyle = '#f1faf6'; context.font = '12px system-ui'; context.textAlign = 'center';
    context.fillText(t('boss_canvas', { instruction: t(boss.phase === 1 ? 'boss_emitters' : boss.phase === 2 ? 'boss_gate' : 'boss_sweep') }), 180, 64);
    if (boss.warning > 0) {
      context.strokeStyle = '#f4b9ef'; context.lineWidth = 2; context.strokeRect(72, 94, 216, 104);
      context.fillText(t('phase_canvas'), 180, 220);
    }
  }
  for (const drop of session.drops.slots) {
    if (!drop.active) continue;
    const y = drop.previousY + (drop.y - drop.previousY) * blend;
    context.drawImage(atlas, (224 + POWER_KINDS.indexOf(drop.kind) * 32) * 2, 80, 64, 64, drop.x - 16, y - 16, 32, 32);
  }
  if (!session.playerVisible) return;
  context.strokeStyle = '#8ce6da'; context.lineWidth = 2;
  if (session.echo.field > 0) {
    context.beginPath(); context.arc(playerX, session.range.player.y, 32, 0, Math.PI * 2); context.stroke();
    context.strokeRect(playerX - 27, session.range.player.y - 27, 54, 54);
  }
  if (session.powers.ward > 0) context.strokeRect(playerX - 23, session.range.player.y - 26, 46, 52);
  for (let index = 0; index < session.echo.drones.length; index++) {
    if ((session.echo.drones[index] ?? 0) === 0) continue;
    context.drawImage(atlas, 512, 0, 64, 64, playerX + (index === 0 ? -24 : 24) - 10, session.range.player.y - 10, 20, 20);
  }
}
