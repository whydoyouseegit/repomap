export class Keyboard {
  pressed = new Set<string>();
  down(key: string) { this.pressed.add(key); }
  up(key: string) { this.pressed.delete(key); }
  isPressed(key: string) { return this.pressed.has(key); }
  clear() { this.pressed.clear(); }
}
