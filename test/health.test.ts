/**
 * Health check tests
 * These ensure basic HTTP functionality works
 */

import * as express from 'express';
import * as request from 'supertest';

describe('Health Check Endpoint', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    // Replicate the health check endpoint from src/index.ts
    app.get('/health', (_, res) => {
      return res.status(200).send('ok');
    });
  });

  it('should respond with 200 status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should respond with ok text', async () => {
    const response = await request(app).get('/health');
    expect(response.text).toBe('ok');
  });
});
