export class Clock {
  last = performance.now();
  elapsed = 0;
  now() { return performance.now(); }
  tick() { const now = this.now(); const dt = now - this.last; this.elapsed += dt; this.last = now; return dt; }
  reset() { this.last = this.now(); this.elapsed = 0; }
}
