const crypto = require('crypto');

const DISCORD_API_VERSION = 'v10';
const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = `https://discord.com/api/${DISCORD_API_VERSION}/users/@me`;
const DEFAULT_REDIRECT_PATH = '/';
const SCOPE = 'identify';

const sanitizeRedirectTarget = value => {
    if (typeof value !== 'string') {
        return DEFAULT_REDIRECT_PATH;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 512) {
        return DEFAULT_REDIRECT_PATH;
    }
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return DEFAULT_REDIRECT_PATH;
    }
    return trimmed;
};

module.exports = (register, context) => {
    const {
        logger,
        json,
        send,
        authRequired,
        discordOauth,
        oauthStateStore,
        oauthStateTtlMs,
        createSession,
        getSession,
        sendSessionCookie,
        clearSessionCookie,
        destroySession,
        findUserById,
        sanitizeRole,
        sanitizeUserRecord,
        upsertDiscordUser,
        normalizeString,
        fetchJson
    } = context;

    const log = logger.child('[auth]');
    const discordEnabled = Boolean(
        discordOauth &&
        discordOauth.enabled &&
        discordOauth.clientId &&
        discordOauth.clientSecret &&
        discordOauth.redirectUri
    );

    const rememberState = (state, payload) => {
        const ttl = Math.max(0, Number(oauthStateTtlMs) || 0);
        const entry = {
            ...payload
        };
        if (ttl > 0) {
            entry.expiresAt = Date.now() + ttl;
        }
        if (ttl > 0) {
            entry.timeout = setTimeout(() => {
                oauthStateStore.delete(state);
            }, ttl);
            if (entry.timeout && typeof entry.timeout.unref === 'function') {
                entry.timeout.unref();
            }
        }
        oauthStateStore.set(state, entry);
        return entry;
    };

    const consumeState = state => {
        if (!state) {
            return null;
        }
        const entry = oauthStateStore.get(state);
        if (!entry) {
            return null;
        }
        oauthStateStore.delete(state);
        if (entry.timeout) {
            clearTimeout(entry.timeout);
        }
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            return null;
        }
        return entry;
    };

    const resolveSessionUser = async (req, res) => {
        const session = getSession(req);
        if (!session) {
            return { user: null };
        }
        const data = session.data || {};
        if (data.userId) {
            const persisted = await findUserById(data.userId);
            if (!persisted) {
                destroySession(req);
                clearSessionCookie(res);
                return { user: null };
            }
            const sanitized = sanitizeUserRecord(persisted);
            if (session.data) {
                session.data.role = sanitized.role;
                session.data.username = sanitized.username;
                session.data.provider = sanitized.provider;
            }
            return { user: sanitized };
        }
        if (data.role) {
            const role = sanitizeRole(data.role);
            const user = {
                id: data.userId || '',
                provider: data.provider || 'manual',
                discordId: data.discordId || null,
                username: data.username || '',
                role
            };
            if (session.data) {
                session.data.role = role;
            }
            return { user };
        }
        return { user: null };
    };

    const createAuthResponse = user => {
        if (!authRequired) {
            return {
                status: 'ok',
                authenticated: true,
                role: 'admin',
                username: '',
                authRequired: false,
                oauth: { discord: discordEnabled }
            };
        }
        if (!user) {
            return {
                status: 'ok',
                authenticated: false,
                role: 'guest',
                username: '',
                authRequired: true,
                oauth: { discord: discordEnabled }
            };
        }
        return {
            status: 'ok',
            authenticated: true,
            role: sanitizeRole(user.role),
            username: user.username || '',
            provider: user.provider || 'manual',
            authRequired: true,
            oauth: { discord: discordEnabled }
        };
    };

    const buildAuthorizeUrl = (state, prompt = null) => {
        const authorizeUrl = new URL(DISCORD_AUTHORIZE_URL);
        authorizeUrl.searchParams.set('client_id', discordOauth.clientId);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('scope', SCOPE);
        authorizeUrl.searchParams.set('state', state);
        authorizeUrl.searchParams.set('redirect_uri', discordOauth.redirectUri);
        if (prompt) {
            authorizeUrl.searchParams.set('prompt', prompt);
        }
        return authorizeUrl.toString();
    };

    const requestDiscordTokens = async code => {
        const body = new URLSearchParams({
            client_id: discordOauth.clientId,
            client_secret: discordOauth.clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: discordOauth.redirectUri
        }).toString();
        return await fetchJson(DISCORD_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body
        });
    };

    const fetchDiscordProfile = async accessToken => {
        return await fetchJson(DISCORD_USER_URL, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
    };

    register('GET', '/auth/session', async (req, res) => {
        try {
            const { user } = await resolveSessionUser(req, res);
            json(res, 200, createAuthResponse(user));
        } catch (error) {
            log.error('Failed to resolve session', { error: error.message });
            json(res, 500, { status: 'error', message: 'Session lookup failed.' });
        }
    });

    register('POST', '/auth/logout', async (req, res) => {
        try {
            destroySession(req);
            clearSessionCookie(res);
            json(res, 204, null);
        } catch (error) {
            log.error('Logout failed', { error: error.message });
            json(res, 500, { status: 'error', message: 'Logout failed.' });
        }
    });

    register('GET', '/auth/discord/login', async (req, res, urlObj) => {
        if (!discordEnabled) {
            log.warn('Discord login attempted but OAuth is disabled');
            json(res, 503, { status: 'error', message: 'Discord OAuth is not configured.' });
            return;
        }
        const redirectTarget = sanitizeRedirectTarget(urlObj.searchParams.get('redirect') || '');
        const prompt = normalizeString(urlObj.searchParams.get('prompt')) || null;
        const state = crypto.randomBytes(24).toString('hex');
        rememberState(state, { redirect: redirectTarget });
        const location = buildAuthorizeUrl(state, prompt);
        log.info('Redirecting to Discord authorization', { redirect: redirectTarget });
        send(res, 302, '', {
            Location: location,
            'Cache-Control': 'no-store'
        });
    });

    register('GET', '/auth/discord/callback', async (req, res, urlObj) => {
        if (!discordEnabled) {
            json(res, 503, { status: 'error', message: 'Discord OAuth is not configured.' });
            return;
        }

        const params = urlObj.searchParams;
        const error = params.get('error');
        const code = params.get('code');
        const state = params.get('state');

        if (error) {
            log.warn('Discord returned error', { error });
            const message = error === 'access_denied' ? 'Acces refuse par Discord.' : 'Erreur lors de la connexion Discord.';
            send(res, 400, `<!DOCTYPE html><html><body><p>${message}</p><p><a href="${DEFAULT_REDIRECT_PATH}">Retour</a></p></body></html>`, {
                'Content-Type': 'text/html; charset=utf-8'
            });
            return;
        }

        const entry = consumeState(state);
        if (!entry) {
            log.warn('OAuth state mismatch or expired', { state });
            send(res, 400, '<!DOCTYPE html><html><body><p>Session OAuth invalide ou expiree. Veuillez relancer la connexion.</p></body></html>', {
                'Content-Type': 'text/html; charset=utf-8'
            });
            return;
        }

        if (!code) {
            log.warn('Missing authorization code from Discord');
            send(res, 400, '<!DOCTYPE html><html><body><p>Code d\'autorisation manquant. Veuillez reessayer.</p></body></html>', {
                'Content-Type': 'text/html; charset=utf-8'
            });
            return;
        }

        try {
            const tokenResponse = await requestDiscordTokens(code);
            const accessToken = tokenResponse?.access_token;
            if (!accessToken) {
                throw new Error('Missing access token in response');
            }

            const profile = await fetchDiscordProfile(accessToken);
            if (!profile?.id) {
                throw new Error('Invalid Discord profile payload');
            }

            const displayName = profile.global_name || profile.username || '';
            const user = await upsertDiscordUser({
                discordId: normalizeString(profile.id),
                username: displayName,
                roleHint: null
            });

            const sessionId = createSession({
                userId: user.id,
                provider: 'discord',
                role: user.role,
                username: user.username || displayName,
                discordId: user.discordId
            });
            sendSessionCookie(res, sessionId);

            const redirectTarget = entry.redirect || DEFAULT_REDIRECT_PATH;
            send(res, 302, '', {
                Location: redirectTarget,
                'Cache-Control': 'no-store'
            });
        } catch (error) {
            log.error('Discord OAuth callback failed', { error: error.message });
            clearSessionCookie(res);
            send(res, 500, '<!DOCTYPE html><html><body><p>Impossible de terminer la connexion Discord. Veuillez reessayer.</p></body></html>', {
                'Content-Type': 'text/html; charset=utf-8'
            });
        }
    });
};
