export interface MaterialOptions { color: string; opacity: number; }
export class Material {
  color = '#ffffff';
  opacity = 1;
  transparent = false;
  set(options: Partial<MaterialOptions>) { Object.assign(this, options); }
  clone() { const copy = new Material(); copy.set(this); return copy; }
}
