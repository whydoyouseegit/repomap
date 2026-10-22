import { Node } from './Node';
export class Light extends Node {
  intensity = 1;
  color = '#ffffff';
  setIntensity(value: number) { this.intensity = Math.max(0, value); }
}
