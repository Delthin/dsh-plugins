import { installOrigins } from './origins.js';

export const name = 'tool-discovery-origins';
// Intentionally has no tools dependency: the tools entry waits for this service.
export function apply(ctx) {
  ctx.effect(() => installOrigins(), 'tool-discovery:registration-origins');
  ctx.provide('toolDiscoveryOriginsReady', true);
}
