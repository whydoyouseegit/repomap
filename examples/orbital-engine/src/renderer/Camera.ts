import { Node } from '../scene/Node';
import { Matrix4 } from '../math/Matrix4';
export class Camera extends Node {
  fov = 60;
  near = 0.1;
  far = 1000;
  projection = new Matrix4();
  setAspect(aspect: number) { return aspect > 0 ? aspect : 1; }
  lookAt(x: number, y: number, z: number) { return [x, y, z]; }
}
