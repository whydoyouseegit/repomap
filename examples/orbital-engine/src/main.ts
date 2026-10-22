import { Engine } from './core/Engine';
import { Scene } from './scene/Scene';
import { Camera } from './renderer/Camera';
import { ParticleSystem } from './particles/ParticleSystem';
const engine = new Engine(new Scene(), new Camera());
export function start() { engine.scene.add(new ParticleSystem(2400)); engine.start(); }
export function stop() { engine.stop(); }
