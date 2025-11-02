#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');

const STUB_HOST = '127.0.0.1';
const STUB_PORT = Number(process.env.DISCORD_STUB_PORT || 5211);

const tokenResponse = JSON.stringify({
    access_token: 'stub-access-token',
    token_type: 'Bearer',
    expires_in: 3600
});

const userResponse = JSON.stringify({
    id: '1172705521317449809',
    username: 'Test User',
    global_name: 'Test User'
});

const createStubServer = () => {
    return http.createServer((req, res) => {
        const { method, url } = req;
        if (method === 'POST' && url === '/api/oauth2/token') {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                if (body.length > 32 * 1024) {
                    req.socket.destroy();
                }
            });
            req.on('end', () => {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                });
                res.end(tokenResponse);
            });
            return;
        }
        if (method === 'GET' && (url === '/api/v10/users/@me' || url === '/api/v9/users/@me')) {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            });
            res.end(userResponse);
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Not Found' }));
    });
};

const stubServer = createStubServer();

const cleanupAndExit = (child, code = 0) => {
    if (child && !child.killed) {
        child.kill();
    }
    stubServer.close(() => {
        process.exit(code);
    });
};

stubServer.listen(STUB_PORT, STUB_HOST, () => {
    const env = {
        ...process.env,
        DISCORD_API_ORIGIN: `http://${STUB_HOST}:${STUB_PORT}`,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || 'playwright-client',
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || 'playwright-secret',
        DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || 'http://127.0.0.1:4173/auth/discord/callback'
    };

    const child = spawn('node', ['server.js'], {
        stdio: 'inherit',
        env
    });

    const handleSignal = signal => {
        if (child) {
            child.kill(signal);
        }
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);
    process.on('exit', () => cleanupAndExit(child));

    child.on('exit', code => {
        cleanupAndExit(null, code ?? 0);
    });
});
