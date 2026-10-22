export class EventBus {
  listeners = new Map<string, Function[]>();
  on(name: string, handler: Function) { this.listeners.set(name, [...(this.listeners.get(name) || []), handler]); }
  emit(name: string, data: unknown) { for (const fn of this.listeners.get(name) || []) fn(data); }
  clear() { this.listeners.clear(); }
}
