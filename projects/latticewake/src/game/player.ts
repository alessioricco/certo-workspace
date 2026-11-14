import { FIELD_WIDTH, PLAYER_ACCELERATION, PLAYER_RADIUS, PLAYER_SPEED, PLAYER_Y, quantize } from './tuning';

export class Player {
  x = FIELD_WIDTH / 2;
  previousX = this.x;
  velocityX = 0;
  readonly y = PLAYER_Y;

  reset(): void {
    this.x = FIELD_WIDTH / 2;
    this.previousX = this.x;
    this.velocityX = 0;
  }

  step(moveX: number): void {
    this.previousX = this.x;
    const target = Math.max(-1, Math.min(1, moveX)) * PLAYER_SPEED;
    const acceleration = PLAYER_ACCELERATION / 60;
    this.velocityX = quantize(this.velocityX + Math.max(-acceleration, Math.min(acceleration, target - this.velocityX)));
    this.x = quantize(this.x + this.velocityX / 60);
    if (this.x < PLAYER_RADIUS) {
      this.x = PLAYER_RADIUS;
      this.velocityX = 0;
    } else if (this.x > FIELD_WIDTH - PLAYER_RADIUS) {
      this.x = FIELD_WIDTH - PLAYER_RADIUS;
      this.velocityX = 0;
    }
  }
}
