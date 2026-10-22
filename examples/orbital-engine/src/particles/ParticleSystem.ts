import { Node } from '../scene/Node';
import { Particle } from './Particle';
import { Emitter } from './Emitter';
export class ParticleSystem extends Node {
  particles: Particle[];
  emitter = new Emitter();
  constructor(count: number) { super(); this.particles = Array.from({ length: count }, () => new Particle()); }
  update(dt: number) { this.particles.forEach(particle => particle.update(dt)); }
  emit() { const particle = this.emitter.create(); this.particles.push(particle); }
}
