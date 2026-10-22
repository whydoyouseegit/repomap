import { Vector3 } from './Vector3';
export class Matrix4 {
  values = new Float32Array(16);
  identity() { this.values.fill(0); for (let i = 0; i < 4; i++) this.values[i * 5] = 1; return this; }
  translate(v: Vector3) { this.values[12] = v.x; this.values[13] = v.y; this.values[14] = v.z; return this; }
  clone() { const m = new Matrix4(); m.values.set(this.values); return m; }
}
