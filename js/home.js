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
    discord: document.getElementById('home-discord'),
    lastLogin: document.getElementById('home-last-login'),
    sessionMap: document.getElementById('home-session-map'),
    adminLink: document.getElementById('home-admin-link'),
    resumeCard: document.getElementById('home-resume-card'),
    resumeFavorites: document.getElementById('home-resume-favorites'),
    resumeLastLocation: document.getElementById('home-resume-last-location'),
    resumeNote: document.getElementById('home-resume-note'),
    newsStatus: document.getElementById('home-news-status'),
    newsNote: document.getElementById('home-news-note'),
    newsList: document.getElementById('home-news-list'),
    socialYoutube: document.getElementById('home-social-youtube'),
    socialDiscord: document.getElementById('home-social-discord'),
    socialReddit: document.getElementById('home-social-reddit'),
    socialYoutubeCta: document.getElementById('home-social-youtube-cta'),
    socialDiscordCta: document.getElementById('home-social-discord-cta'),
    footerSupport: document.getElementById('home-footer-support'),
    footerContact: document.getElementById('home-footer-contact'),
    footerCredits: document.getElementById('home-footer-credits')
};

const PREFERENCES_STORAGE_KEY = 'interactive-map-preferences';
const SITE_CONFIG_URL = '/assets/site-config.json';

const DEFAULT_SITE_CONFIG = {
    community: {
        youtubeUrl: 'https://www.youtube.com/',
        discordUrl: 'https://discord.com/',
        redditUrl: 'https://www.reddit.com/'
    },
    support: {
        issuesUrl: 'https://github.com/Daneisra/Carte-Interactive/issues',
        contactEmail: 'contact@cartehesta.local'
    },
    legal: {
        creditsUrl: '/docs/credits-assets.md'
    }
};

const isSafeExternalUrl = value => typeof value === 'string' && /^https?:\/\//i.test(value.trim());
const isSafeRelativeUrl = value => typeof value === 'string' && value.trim().startsWith('/');
const isSafeMailto = value => typeof value === 'string' && /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(value.trim());

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

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const setLinkHref = (element, url, fallback) => {
    if (!element) {
        return;
    }
    const next = typeof url === 'string' ? url.trim() : '';
    if (isSafeExternalUrl(next) || isSafeRelativeUrl(next) || isSafeMailto(next)) {
        element.href = next;
        return;
    }
    element.href = fallback;
};

const applySiteConfig = config => {
    const merged = {
        ...DEFAULT_SITE_CONFIG,
        ...(config || {}),
        community: {
            ...DEFAULT_SITE_CONFIG.community,
            ...(config?.community || {})
        },
        support: {
            ...DEFAULT_SITE_CONFIG.support,
            ...(config?.support || {})
        },
        legal: {
            ...DEFAULT_SITE_CONFIG.legal,
            ...(config?.legal || {})
        }
    };

    setLinkHref(dom.socialYoutube, merged.community.youtubeUrl, DEFAULT_SITE_CONFIG.community.youtubeUrl);
    setLinkHref(dom.socialYoutubeCta, merged.community.youtubeUrl, DEFAULT_SITE_CONFIG.community.youtubeUrl);
    setLinkHref(dom.socialDiscord, merged.community.discordUrl, DEFAULT_SITE_CONFIG.community.discordUrl);
    setLinkHref(dom.socialDiscordCta, merged.community.discordUrl, DEFAULT_SITE_CONFIG.community.discordUrl);
    setLinkHref(dom.socialReddit, merged.community.redditUrl, DEFAULT_SITE_CONFIG.community.redditUrl);
    setLinkHref(dom.footerSupport, merged.support.issuesUrl, DEFAULT_SITE_CONFIG.support.issuesUrl);
    setLinkHref(dom.footerContact, `mailto:${merged.support.contactEmail}`, `mailto:${DEFAULT_SITE_CONFIG.support.contactEmail}`);
    setLinkHref(dom.footerCredits, merged.legal.creditsUrl, DEFAULT_SITE_CONFIG.legal.creditsUrl);
};

const loadSiteConfig = async () => {
    try {
        const response = await fetch(SITE_CONFIG_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        applySiteConfig(payload);
    } catch (error) {
        console.warn('[home] site config unavailable, fallback defaults used', error);
        applySiteConfig(DEFAULT_SITE_CONFIG);
    }
};

const readPreferencesSummary = () => {
    try {
        const raw = window.localStorage?.getItem(PREFERENCES_STORAGE_KEY);
        if (!raw) {
            return { favorites: 0, lastLocation: '' };
        }
        const parsed = JSON.parse(raw);
        const favorites = Array.isArray(parsed?.favorites)
            ? parsed.favorites.filter(name => typeof name === 'string' && name.trim())
            : [];
        const uniqueFavorites = Array.from(new Set(favorites.map(name => name.trim()).filter(Boolean)));
        const lastLocation = typeof parsed?.lastLocation === 'string' ? parsed.lastLocation.trim() : '';
        return { favorites: uniqueFavorites.length, lastLocation };
    } catch (_error) {
        return { favorites: 0, lastLocation: '' };
    }
};

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

const setNewsStatus = (message, tone = 'neutral') => {
    if (!dom.newsStatus) {
        return;
    }
    dom.newsStatus.textContent = message;
    dom.newsStatus.classList.remove('is-ok', 'is-error');
    if (tone === 'ok') {
        dom.newsStatus.classList.add('is-ok');
    }
    if (tone === 'error') {
        dom.newsStatus.classList.add('is-error');
    }
};

const renderNewsItems = events => {
    if (!dom.newsList) {
        return;
    }
    if (!Array.isArray(events) || events.length === 0) {
        dom.newsList.innerHTML = '<li class="home-news-empty">Aucune nouveaute recente pour le moment.</li>';
        return;
    }
    dom.newsList.innerHTML = events.map(event => {
        const title = escapeHtml(event?.questId || event?.id || 'Quete');
        const location = escapeHtml(event?.locationName || 'Lieu inconnu');
        const status = escapeHtml(event?.status || 'inconnu');
        const milestone = escapeHtml(event?.milestone || '');
        const note = escapeHtml(event?.note || '');
        const date = escapeHtml(formatLastLogin(event?.updatedAt || event?.createdAt || ''));
        const metaSuffix = milestone ? ` · ${milestone}` : '';
        return `
<li class="home-news-item">
    <div class="home-news-head">
        <strong>${title}</strong>
        <span>${date}</span>
    </div>
    <p class="home-news-meta">${location} · ${status}${metaSuffix}</p>
    <p class="home-news-text">${note || 'Mise a jour de quete enregistree.'}</p>
</li>`;
    }).join('');
};

const fetchQuestNews = async () => {
    setNewsStatus('Chargement...');
    if (dom.newsNote) {
        dom.newsNote.textContent = 'Derniers evenements de quete detectes. Ce bloc reste lisible meme si l API est indisponible.';
    }
    try {
        const response = await fetch('/api/quest-events', { cache: 'no-store', credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const events = Array.isArray(payload?.events) ? payload.events : [];
        const sorted = events
            .slice()
            .sort((a, b) => Date.parse(b?.updatedAt || b?.createdAt || 0) - Date.parse(a?.updatedAt || a?.createdAt || 0))
            .slice(0, 5);
        renderNewsItems(sorted);
        setNewsStatus(sorted.length ? `${sorted.length} recentes` : 'A jour', 'ok');
        if (dom.newsNote) {
            dom.newsNote.textContent = sorted.length
                ? 'Apercu des derniers evenements de quete. Ouvrez la carte pour voir le flux complet.'
                : 'Aucun evenement de quete recent pour le moment.';
        }
    } catch (error) {
        console.error('[home] quest news fetch failed', error);
        renderNewsItems([]);
        setNewsStatus('API indisponible', 'error');
        if (dom.newsNote) {
            dom.newsNote.textContent = 'Impossible de charger les nouveautes (API /api/quest-events indisponible). Vous pouvez quand meme acceder a la carte.';
        }
    }
};

const updateResumeCard = ({ authenticated = false } = {}) => {
    if (!dom.resumeCard) {
        return;
    }
    dom.resumeCard.hidden = !authenticated;
    if (!authenticated) {
        return;
    }
    const summary = readPreferencesSummary();
    if (dom.resumeFavorites) {
        dom.resumeFavorites.textContent = String(summary.favorites);
    }
    if (dom.resumeLastLocation) {
        dom.resumeLastLocation.textContent = summary.lastLocation || '--';
    }
    if (dom.resumeNote) {
        dom.resumeNote.textContent = summary.favorites || summary.lastLocation
            ? 'Favoris et dernier lieu recuperes depuis vos preferences locales.'
            : 'Aucun repere local detecte pour le moment. Ouvrez la carte et ajoutez des favoris.';
    }
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
    dom.discord.textContent = '--';
    dom.lastLogin.textContent = '--';
    applyAvatar('', authRequired ? '?' : 'L');
    dom.logout.hidden = true;
    dom.login.hidden = !authRequired || !oauthDiscord;
    dom.loginInline.hidden = !authRequired || !oauthDiscord;
    dom.adminLink.hidden = true;
    updateResumeCard({ authenticated: false });
};

const setAuthenticatedState = payload => {
    const username = (payload?.username || '').trim() || 'Utilisateur';
    const role = (payload?.role || 'user').toLowerCase() === 'admin' ? 'Administrateur' : 'Utilisateur';
    const isAdmin = role === 'Administrateur';
    const provider = payload?.provider === 'discord' ? 'Discord' : (payload?.provider || 'manuel');
    const discordId = (payload?.discordId || payload?.account?.discordId || '').toString().trim();
    dom.username.textContent = username;
    dom.role.textContent = role;
    dom.status.textContent = isAdmin
        ? 'Connecte. Vous pouvez acceder a la carte et aux outils d administration.'
        : 'Connecte. Vous pouvez acceder a vos personnages, groupes et a la carte.';
    dom.provider.textContent = provider;
    dom.discord.textContent = provider === 'Discord'
        ? (discordId || 'Compte Discord connecte')
        : '--';
    dom.lastLogin.textContent = formatLastLogin(payload?.account?.lastLoginAt || null);
    applyAvatar(payload?.avatar || '', username);
    dom.logout.hidden = false;
    dom.login.hidden = true;
    dom.loginInline.hidden = true;
    dom.adminLink.hidden = !isAdmin;
    if (!dom.adminLink.hidden) {
        dom.adminLink.textContent = 'Acces admin rapide (carte)';
        dom.adminLink.href = '/map/';
    }
    updateResumeCard({ authenticated: true });
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
    applySiteConfig(DEFAULT_SITE_CONFIG);
    bindActions();
    loadSiteConfig();
    fetchSession();
    fetchQuestNews();
});

