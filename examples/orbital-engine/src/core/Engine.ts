import { Scene } from '../scene/Scene';
import { Camera } from '../renderer/Camera';
import { Renderer } from '../renderer/Renderer';
import { Clock } from './Clock';
import { EventBus } from './EventBus';
export class Engine {
  running = false;
  clock = new Clock();
  renderer = new Renderer();
  events = new EventBus();
  constructor(public scene: Scene, public camera: Camera) {}
  start() { this.running = true; this.events.emit('start', this.clock.now()); }
  stop() { this.running = false; this.events.emit('stop', this.clock.now()); }
  update() { const dt = this.clock.tick(); this.scene.update(dt); }
  render() { this.renderer.render(this.scene, this.camera); }
}
