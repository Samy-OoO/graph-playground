import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './test/createTestApp';

describe('app basics', () => {
  const testApp = createTestApp();
  afterAll(() => testApp.close());

  it('answers the health check', async () => {
    const response = await request(testApp.app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('answers unknown /api URLs with a JSON 404', async () => {
    const response = await request(testApp.app).get('/api/nothing-here');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found.' });
  });
});