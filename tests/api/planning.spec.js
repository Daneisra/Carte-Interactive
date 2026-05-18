const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const USERS_PATH = path.resolve(__dirname, '../../assets/users.json');
const PLANNING_PATH = path.resolve(__dirname, '../../assets/planning.json');
const SESSIONS_PATH = path.resolve(__dirname, '../../assets/logs/sessions.json');

let usersSnapshot = null;
let planningSnapshot = null;

const loginWithDiscordStub = async request => {
    const loginResponse = await request.get('/auth/discord/login', { maxRedirects: 0 });
    expect(loginResponse.status()).toBe(302);
    const redirect = loginResponse.headers()['location'];
    expect(redirect).toBeTruthy();
    const state = new URL(redirect).searchParams.get('state');
    expect(state).toBeTruthy();

    const callbackResponse = await request.get(`/auth/discord/callback?code=stub-code&state=${state}`, {
        maxRedirects: 0
    });
    expect(callbackResponse.status()).toBe(302);
};

test.describe('Planning - API', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        usersSnapshot = await fs.promises.readFile(USERS_PATH, 'utf8').catch(() => null);
        planningSnapshot = await fs.promises.readFile(PLANNING_PATH, 'utf8').catch(() => null);
        await fs.promises.unlink(SESSIONS_PATH).catch(error => {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        });
    });

    test.afterAll(async () => {
        if (usersSnapshot !== null) {
            await fs.promises.writeFile(USERS_PATH, usersSnapshot, 'utf8');
        }
        if (planningSnapshot !== null) {
            await fs.promises.writeFile(PLANNING_PATH, planningSnapshot, 'utf8');
        }
        await fs.promises.unlink(SESSIONS_PATH).catch(error => {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        });
    });

    test('admin cree une session candidate et un joueur repond a une date precise', async ({ request }) => {
        const publicBefore = await request.get('/api/planning/sessions');
        expect(publicBefore.status()).toBe(200);
        const publicPayload = await publicBefore.json();
        expect(Array.isArray(publicPayload.sessions)).toBeTruthy();

        await loginWithDiscordStub(request);
        const slots = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => null));
        slots[0][2] = 'available';
        slots[6][2] = 'busy';
        const profileResponse = await request.patch('/api/profile', {
            data: {
                availability: {
                    timezone: 'Europe/Warsaw',
                    slots
                }
            }
        });
        expect(profileResponse.status()).toBe(200);

        const createResponse = await request.post('/api/admin/planning/sessions', {
            data: {
                title: 'Session candidate API',
                date: '2026-07-12',
                startTime: '20:45',
                durationMinutes: 180,
                groupName: 'Groupe test',
                status: 'candidate',
                description: 'Date candidate creee par test API.'
            }
        });
        expect(createResponse.status()).toBe(201);
        const createdPayload = await createResponse.json();
        expect(createdPayload.status).toBe('ok');
        expect(createdPayload.session.id).toBeTruthy();
        expect(createdPayload.session.responseSummary.available).toBe(0);
        expect(createdPayload.session.planningInsight.weekly.busy).toBeGreaterThanOrEqual(1);
        expect(createdPayload.session.planningInsight.bestSlots.length).toBeGreaterThanOrEqual(1);

        const sessionId = createdPayload.session.id;
        const response = await request.patch(`/api/planning/sessions/${sessionId}/response`, {
            data: {
                status: 'available',
                comment: 'Disponible pour cette date.'
            }
        });
        expect(response.status()).toBe(200);
        const responsePayload = await response.json();
        expect(responsePayload.status).toBe('ok');
        expect(responsePayload.session.responseSummary.available).toBe(1);
        expect(responsePayload.session.planningInsight.conflicts).toBeGreaterThanOrEqual(1);

        const updateResponse = await request.patch('/api/admin/planning/sessions', {
            data: {
                id: sessionId,
                title: 'Session candidate API confirmee',
                status: 'confirmed'
            }
        });
        expect(updateResponse.status()).toBe(200);
        const updatedPayload = await updateResponse.json();
        expect(updatedPayload.session.title).toBe('Session candidate API confirmee');
        expect(updatedPayload.session.status).toBe('confirmed');
        expect(updatedPayload.session.responseSummary.available).toBe(1);

        const listResponse = await request.get('/api/planning/sessions');
        const listPayload = await listResponse.json();
        expect(listPayload.sessions.some(session => session.id === sessionId && session.status === 'confirmed')).toBeTruthy();

        const deleteResponse = await request.delete('/api/admin/planning/sessions', {
            data: { id: sessionId }
        });
        expect(deleteResponse.status()).toBe(200);
        const deletePayload = await deleteResponse.json();
        expect(deletePayload.removed.id).toBe(sessionId);
    });
});
