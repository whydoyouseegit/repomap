import { Particle } from './Particle';
import { Vector3 } from '../math/Vector3';
import { random } from '../math/random';
export class Emitter {
  rate = 30;
  create() { const p = new Particle(); p.velocity = new Vector3(random(-1, 1), random(-1, 1), random(-1, 1)); return p; }
  setRate(rate: number) { this.rate = Math.max(0, rate); }
}
