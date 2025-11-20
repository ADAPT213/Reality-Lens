// Observability disabled temporarily for v1 build
export function initializeFrontendObservability() {}
export async function traceApiCall<T>(name: string, attributes: Record<string, string | number>, fn: () => Promise<T>): Promise<T> { return fn(); }
export function recordUserInteraction(action: string, target: string, metadata?: Record<string, string | number>) {}