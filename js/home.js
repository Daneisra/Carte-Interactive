const dom = {
    year: document.getElementById('home-year'),
    login: document.getElementById('home-login'),
    loginInline: document.getElementById('home-login-inline'),
    logout: document.getElementById('home-logout'),
    authNote: document.getElementById('home-auth-note'),
    username: document.getElementById('home-username'),
    role: document.getElementById('home-role'),
    status: document.getElementById('home-session-status'),
    avatar: document.getElementById('home-avatar'),
    provider: document.getElementById('home-provider'),
    lastLogin: document.getElementById('home-last-login'),
    sessionMap: document.getElementById('home-session-map')
};

const formatLastLogin = value => {
    if (!value || typeof value !== 'string') {
        return '--';
    }
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) {
        return '--';
    }
    try {
        return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
    } catch (_error) {
        return new Date(ts).toLocaleString('fr-FR');
    }
};

const getLoginRedirect = () => '/auth/discord/login?redirect=%2Fmap%2F';

const setAuthNote = (message, tone = 'neutral') => {
    if (!dom.authNote) {
        return;
    }
    dom.authNote.textContent = message;
    dom.authNote.classList.remove('is-error', 'is-ok');
    if (tone === 'error') {
        dom.authNote.classList.add('is-error');
    }
    if (tone === 'ok') {
        dom.authNote.classList.add('is-ok');
    }
};

const applyAvatar = (avatarUrl, fallbackText) => {
    if (!dom.avatar) {
        return;
    }
    const url = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
    if (url) {
        dom.avatar.style.backgroundImage = `url("${url}")`;
        dom.avatar.classList.add('has-avatar');
        dom.avatar.textContent = '';
        return;
    }
    dom.avatar.style.backgroundImage = '';
    dom.avatar.classList.remove('has-avatar');
    dom.avatar.textContent = (fallbackText || '?').charAt(0).toUpperCase();
};

const setGuestState = (options = {}) => {
    const {
        authRequired = true,
        oauthDiscord = true,
        message = 'Connectez-vous pour modifier des lieux, gerer vos personnages et utiliser les outils admin.'
    } = options;
    dom.username.textContent = authRequired ? 'Invite' : 'Mode local';
    dom.role.textContent = authRequired ? 'Mode lecture' : 'Edition locale';
    dom.status.textContent = message;
    dom.provider.textContent = authRequired ? 'Invite' : 'Local';
    dom.lastLogin.textContent = '--';
    applyAvatar('', authRequired ? '?' : 'L');
    dom.logout.hidden = true;
    dom.login.hidden = !authRequired || !oauthDiscord;
    dom.loginInline.hidden = !authRequired || !oauthDiscord;
};

const setAuthenticatedState = payload => {
    const username = (payload?.username || '').trim() || 'Utilisateur';
    const role = (payload?.role || 'user').toLowerCase() === 'admin' ? 'Administrateur' : 'Utilisateur';
    const provider = payload?.provider === 'discord' ? 'Discord' : (payload?.provider || 'manuel');
    dom.username.textContent = username;
    dom.role.textContent = role;
    dom.status.textContent = role === 'Administrateur'
        ? 'Connecte. Vous pouvez acceder a la carte et aux outils d administration.'
        : 'Connecte. Vous pouvez acceder a vos personnages, groupes et a la carte.';
    dom.provider.textContent = provider;
    dom.lastLogin.textContent = formatLastLogin(payload?.account?.lastLoginAt || null);
    applyAvatar(payload?.avatar || '', username);
    dom.logout.hidden = false;
    dom.login.hidden = true;
    dom.loginInline.hidden = true;
};

const fetchSession = async () => {
    setAuthNote('Verification de la session...');
    try {
        const response = await fetch('/auth/session', { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const authRequired = payload?.authRequired !== false;
        const oauthDiscord = Boolean(payload?.oauth?.discord);
        if (payload?.authenticated) {
            setAuthenticatedState(payload);
            setAuthNote('Session active detectee.', 'ok');
        } else {
            const guestMessage = authRequired
                ? 'Connectez-vous via Discord ou entrez directement sur la carte en lecture seule.'
                : 'Mode local detecte: acces direct a la carte disponible.';
            setGuestState({ authRequired, oauthDiscord, message: guestMessage });
            setAuthNote(guestMessage, authRequired ? 'neutral' : 'ok');
        }
        if (authRequired && !oauthDiscord) {
            setAuthNote('Discord OAuth n est pas configure. Acces lecture disponible.', 'error');
        }
    } catch (error) {
        console.error('[home] session fetch failed', error);
        setGuestState({ authRequired: true, oauthDiscord: true });
        setAuthNote('Impossible de verifier la session pour le moment.', 'error');
    }
};

const bindActions = () => {
    const login = () => {
        window.location.href = getLoginRedirect();
    };
    dom.login?.addEventListener('click', login);
    dom.loginInline?.addEventListener('click', login);
    dom.logout?.addEventListener('click', async () => {
        dom.logout.disabled = true;
        try {
            await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (error) {
            console.error('[home] logout failed', error);
        } finally {
            dom.logout.disabled = false;
        }
        await fetchSession();
    });
};

document.addEventListener('DOMContentLoaded', () => {
    if (dom.year) {
        dom.year.textContent = String(new Date().getFullYear());
    }
    if (dom.sessionMap) {
        dom.sessionMap.setAttribute('href', '/map/');
    }
    bindActions();
    fetchSession();
});
