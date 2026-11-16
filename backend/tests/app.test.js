import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import app from '../src/app.js';
import { AppError } from '../src/lib/errors.js';
import { notFound, errorHandler } from '../src/middleware/errorHandler.js';

// A small app with the real error middleware and routes made to fail on purpose
function makeTestApp() {
    const testApp = express();
    testApp.get('/known-error', () => {
        throw new AppError(409, 'Email already in use');
    });
    testApp.get('/crash', async () => {
        throw new Error('database password is hunter2');
    });
    testApp.use(notFound);
    testApp.use(errorHandler);
    return testApp;
}

describe('error handling', () => {
    it('sends an AppError with its own status and message', async () => {
        const res = await request(makeTestApp()).get('/known-error');
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: { message: 'Email already in use' } });
    });

    it('hides an unexpected error behind a generic 500', async () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await request(makeTestApp()).get('/crash');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: { message: 'Something went wrong' } });
        expect(JSON.stringify(res.body)).not.toContain('hunter2');
        quiet.mockRestore();
    });

    it('answers an unknown address with a 404 in the error shape', async () => {
        const res = await request(app).get('/api/v1/nowhere');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { message: 'Not found: GET /api/v1/nowhere' } });
    });
});
