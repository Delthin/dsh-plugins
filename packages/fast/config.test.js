import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredRoute, assertFastProvider, httpEndpoint } from './config.js';

const complete = { provider: 'responses-provider', sourceURL: 'https://responses.example.invalid/v1/responses', targetURL: 'https://priority.example.invalid/backend-api/codex/responses' };

test('Fast has no route unless all three fields are explicitly configured', () => {
  for (const config of [undefined, {}, { provider: complete.provider }, { sourceURL: complete.sourceURL, targetURL: complete.targetURL }, { ...complete, provider: ' ' }, { ...complete, targetURL: '' }]) {
    const route = configuredRoute(config);
    assert.equal(route, undefined);
    assert.throws(() => assertFastProvider(route, complete.provider), /Fast 通道未配置/);
  }
});

test('endpoint configuration rejects embedded credentials, fragments and non-HTTP URLs', () => {
  for (const targetURL of ['not a URL', 'file:///tmp/response', 'https://user:secret@example.invalid/responses', 'https://example.invalid/responses#fragment']) {
    assert.throws(() => configuredRoute({ ...complete, targetURL }), /HTTP\(S\)/);
  }
  assert.throws(() => httpEndpoint(undefined), /HTTP\(S\)/);
  assert.throws(() => configuredRoute({ ...complete, provider: false }), /must be a string/);
});
