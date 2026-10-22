import { Vector3 } from '../math/Vector3';
export class Particle {
  position = new Vector3();
  velocity = new Vector3();
  life = 1;
  update(dt: number) { this.position = this.position.add(this.velocity.scale(dt)); this.life -= dt; }
  reset() { this.life = 1; this.position = new Vector3(); }
}
