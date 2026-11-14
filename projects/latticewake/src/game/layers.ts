export const CollisionLayer = { Player: 1, PlayerShot: 2, Enemy: 4, HostileShot: 8, Cosmetic: 16 } as const;

export function collides(a: number, b: number): boolean {
  return (a === CollisionLayer.PlayerShot && b === CollisionLayer.Enemy)
    || (b === CollisionLayer.PlayerShot && a === CollisionLayer.Enemy)
    || (a === CollisionLayer.Player && (b === CollisionLayer.Enemy || b === CollisionLayer.HostileShot))
    || (b === CollisionLayer.Player && (a === CollisionLayer.Enemy || a === CollisionLayer.HostileShot));
}

