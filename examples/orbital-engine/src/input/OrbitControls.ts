import { Camera } from '../renderer/Camera';
import { clamp } from '../math/random';
export class OrbitControls {
  rotation = 0;
  zoom = 1;
  constructor(public camera: Camera) {}
  rotate(delta: number) { this.rotation += delta; }
  scale(delta: number) { this.zoom = clamp(this.zoom * delta, 0.1, 10); }
  reset() { this.rotation = 0; this.zoom = 1; }
}
