/**
 * Minimal synchronous observer used by the puzzle model.
 *
 * Exceptions thrown by a connected callback propagate to the code that emitted the signal.
 * The solver relies on this to notice contradictions found while constraints react to a
 * changed cell.
 */
export class Signal<Args extends unknown[]> {
  private callbacks: ((...args: Args) => void)[] = [];

  connect(callback: (...args: Args) => void): void {
    this.callbacks.push(callback);
  }

  disconnect(callback: (...args: Args) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index < 0) throw new Error('callback is not connected');
    this.callbacks.splice(index, 1);
  }

  emit(...args: Args): void {
    for (const callback of [...this.callbacks]) callback(...args);
  }
}
