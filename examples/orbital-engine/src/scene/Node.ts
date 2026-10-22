import { Vector3 } from '../math/Vector3';
export class Node {
  position = new Vector3();
  children: Node[] = [];
  name = 'node';
  add(node: Node) { this.children.push(node); }
  remove(node: Node) { this.children = this.children.filter(child => child !== node); }
  update(dt: number) { for (const child of this.children) child.update(dt); }
  traverse(fn: (node: Node) => void) { fn(this); for (const child of this.children) child.traverse(fn); }
}
