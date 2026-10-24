export type PublishAcknowledgementPolicy = "all" | "first";

/**
 * Wait for every broker by default, or release latency-sensitive senders after
 * the first QoS 1 PUBACK without cancelling the other in-flight publishes.
 */
export function waitForPublishAcknowledgements<T>(
  attempts: readonly Promise<T>[],
  policy: PublishAcknowledgementPolicy = "all"
): Promise<T[]> {
  if (policy === "first") return Promise.any(attempts).then((acknowledgement) => [acknowledgement]);
  return Promise.all(attempts);
}
