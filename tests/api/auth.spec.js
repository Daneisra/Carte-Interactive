const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const USERS_PATH = path.resolve(__dirname, '../../assets/users.json');
const SESSIONS_PATH = path.resolve(__dirname, '../../assets/logs/sessions.json');

let usersSnapshot = null;

test.describe('Integration Auth API', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        try {
            usersSnapshot = await fs.promises.readFile(USERS_PATH, 'utf8');
        } catch (error) {
            usersSnapshot = null;
        }
        try {
            await fs.promises.unlink(SESSIONS_PATH);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    });

    test.afterAll(async () => {
        if (usersSnapshot !== null) {
            await fs.promises.writeFile(USERS_PATH, usersSnapshot, 'utf8');
        }
        try {
            await fs.promises.unlink(SESSIONS_PATH);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    });

    test('session endpoint returns guest when unauthenticated', async ({ request }) => {
        const response = await request.get('/auth/session');
        expect(response.status()).toBe(200);
        const payload = await response.json();
        expect(payload.authenticated).toBeFalsy();
        expect(payload.authRequired).toBeTruthy();
    });

    test('discord login callback creates a session and allows admin access', async ({ request }) => {
        const adminBefore = await request.get('/api/admin/users');
        expect(adminBefore.status()).toBe(401);

        const loginResponse = await request.get('/auth/discord/login', { maxRedirects: 0 });
        expect(loginResponse.status()).toBe(302);
        const redirect = loginResponse.headers()['location'];
        expect(redirect).toBeTruthy();

        const redirectUrl = new URL(redirect);
        const state = redirectUrl.searchParams.get('state');
        expect(state).toBeTruthy();

        const callbackResponse = await request.get(`/auth/discord/callback?code=stub-code&state=${state}`, {
            maxRedirects: 0
        });
        if (callbackResponse.status() !== 302) {
            const body = await callbackResponse.text();
            console.error('callback-error', callbackResponse.status(), body);
        }
        expect(callbackResponse.status()).toBe(302);
        expect(callbackResponse.headers()['location']).toBe('/');

        const sessionResponse = await request.get('/auth/session');
        expect(sessionResponse.status()).toBe(200);
        const sessionPayload = await sessionResponse.json();
        expect(sessionPayload.authenticated).toBeTruthy();
        expect(sessionPayload.provider).toBe('discord');
        expect(sessionPayload.username).toBe('Test User');
        expect(sessionPayload.role === 'admin' || sessionPayload.role === 'user').toBeTruthy();

        const adminResponse = await request.get('/api/admin/users');
        expect(adminResponse.status()).toBe(200);
        const adminPayload = await adminResponse.json();
        expect(adminPayload.status).toBe('ok');
        expect(Array.isArray(adminPayload.users)).toBeTruthy();
    });

    test('logout clears session and protects admin route', async ({ request }) => {
        const logoutResponse = await request.post('/auth/logout');
        expect([200, 204]).toContain(logoutResponse.status());

        const sessionResponse = await request.get('/auth/session');
        const sessionPayload = await sessionResponse.json();
        expect(sessionPayload.authenticated).toBeFalsy();

        const adminResponse = await request.get('/api/admin/users');
        expect(adminResponse.status()).toBe(401);
    });
});
