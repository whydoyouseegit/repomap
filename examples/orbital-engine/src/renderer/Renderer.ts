import { Scene } from '../scene/Scene';
import { Camera } from './Camera';
import { Material } from './Material';
export class Renderer {
  material = new Material();
  frame = 0;
  render(scene: Scene, camera: Camera) { this.frame++; return { nodes: scene.children.length, fov: camera.fov }; }
  resize(width: number, height: number) { return { width, height }; }
  dispose() { this.frame = 0; }
}
