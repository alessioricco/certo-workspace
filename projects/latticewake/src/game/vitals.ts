export const RESPAWN_TICKS = 90;
export const INVULNERABLE_TICKS = 120;

export class Vitals {
  score = 0;
  lives = 3;
  nextLife = 20000;
  respawn = 0;
  invulnerable = 0;
  deaths = 0;

  reset(): void {
    this.score = 0;
    this.lives = 3;
    this.nextLife = 20000;
    this.respawn = this.invulnerable = this.deaths = 0;
  }

  award(points: number): void {
    if (!Number.isSafeInteger(points) || points < 0 || !Number.isSafeInteger(this.score + points)) throw new RangeError('Invalid points.');
    this.score += points;
    while (this.score >= this.nextLife) {
      this.lives = Math.min(5, this.lives + 1);
      this.nextLife += 50000;
    }
  }

  hit(nonlethal = false): boolean {
    if (nonlethal || this.lives === 0 || this.respawn > 0 || this.invulnerable > 0) return false;
    this.lives--;
    this.deaths++;
    this.respawn = this.lives > 0 ? RESPAWN_TICKS : 0;
    return true;
  }

  step(): boolean {
    if (this.respawn > 0) {
      if (--this.respawn === 0) { this.invulnerable = INVULNERABLE_TICKS; return true; }
    } else if (this.invulnerable > 0) this.invulnerable--;
    return false;
  }
}
