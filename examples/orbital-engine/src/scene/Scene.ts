import { Node } from './Node';
import { Light } from './Light';
export class Scene extends Node {
  lights: Light[] = [];
  background = '#090909';
  clear() { this.children = []; this.lights = []; }
  addLight(light: Light) { this.lights.push(light); }
  find(name: string) { return this.children.find(node => node.name === name); }
}
