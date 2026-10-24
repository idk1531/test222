/**
 * Bounded concurrent sender for transient state. While the transport is full,
 * stale queued values are replaced by the newest value instead of accumulating.
 */
export class LatestValueSendQueue<T> {
  private pendingValue: T | undefined;
  private hasPendingValue = false;
  private inFlightCount = 0;
  private generation = 0;

  constructor(
    private readonly send: (value: T) => Promise<unknown>,
    private readonly maxInFlight = 8
  ) {
    if (!Number.isSafeInteger(maxInFlight) || maxInFlight < 1) {
      throw new Error("maxInFlight must be a positive safe integer.");
    }
  }

  enqueue(value: T): void {
    this.pendingValue = value;
    this.hasPendingValue = true;
    this.pump();
  }

  /** Drop any queued value and invalidate completions from the previous session. */
  clear(): void {
    this.generation += 1;
    this.pendingValue = undefined;
    this.hasPendingValue = false;
    this.inFlightCount = 0;
  }

  private pump(): void {
    while (this.hasPendingValue && this.inFlightCount < this.maxInFlight) {
      const value = this.pendingValue as T;
      const generation = this.generation;
      this.pendingValue = undefined;
      this.hasPendingValue = false;
      this.inFlightCount += 1;

      void Promise.resolve()
        .then(() => this.send(value))
        .catch(() => undefined)
        .finally(() => {
          if (generation !== this.generation) return;
          this.inFlightCount = Math.max(0, this.inFlightCount - 1);
          this.pump();
        });
    }
  }
}
