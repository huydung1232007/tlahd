import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../api/index.mjs';

test('Vercel rewrite preserves routing, query and same-origin checks', async () => {
  const previous = process.env.CHAM_SESSION_SECRET;
  process.env.CHAM_SESSION_SECRET = 'local-test-secret-never-used-in-production';
  try {
    const base = 'https://cham.example/api/index?__cham_route=';
    const session = await app.fetch(new Request(base + 'session'));
    assert.equal(session.status, 401);
    assert.equal((await session.json()).error.code, 'AUTH_REQUIRED');
    const logout = await app.fetch(new Request(base + 'logout', {
      method: 'POST',
      headers: { Origin: 'https://cham.example', 'Content-Type': 'application/json' },
      body: '{}',
    }));
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    const csrf = await app.fetch(new Request(base + 'logout', {
      method: 'POST',
      headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' },
      body: '{}',
    }));
    assert.equal(csrf.status, 403);
    assert.equal((await csrf.json()).error.code, 'ORIGIN_REJECTED');
    assert.equal((await app.fetch(new Request(base + 'missing'))).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAM_SESSION_SECRET;
    else process.env.CHAM_SESSION_SECRET = previous;
  }
});
