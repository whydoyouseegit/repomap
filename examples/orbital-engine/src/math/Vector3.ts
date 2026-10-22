export class Vector3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  add(v: Vector3) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
  scale(n: number) { return new Vector3(this.x * n, this.y * n, this.z * n); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const length = this.length(); return length ? this.scale(1 / length) : new Vector3(); }
  clone() { return new Vector3(this.x, this.y, this.z); }
}
