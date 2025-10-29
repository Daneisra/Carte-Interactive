#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL, pathToFileURL } = require('url');

const loadEnvFile = filePath => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const index = trimmed.indexOf('=');
      if (index === -1) {
        return;
      }
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    // ignore missing .env
  }
};

loadEnvFile(path.join(__dirname, '.env'));

const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve(__dirname);
const ASSETS_PATH = path.join(ROOT, 'assets');
const LOCATIONS_FILE = path.join(ASSETS_PATH, 'locations.json');
const TYPES_FILE = path.join(ASSETS_PATH, 'types.json');
const IMAGES_DIR = path.join(ASSETS_PATH, 'images');
const AUDIO_DIR = path.join(ASSETS_PATH, 'audio');
const AUDIT_DIR = path.join(ASSETS_PATH, 'logs');
const AUDIT_FILE = path.join(AUDIT_DIR, 'locations-audit.jsonl');
const USERS_FILE = path.join(ASSETS_PATH, 'users.json');
const ANNOTATIONS_FILE = path.join(ASSETS_PATH, 'annotations.json');
const QUEST_EVENTS_FILE = path.join(ASSETS_PATH, 'questEvents.json');
const REMOTE_SYNC_URL = (process.env.REMOTE_SYNC_URL || '').trim();
const REMOTE_SYNC_TOKEN = (process.env.REMOTE_SYNC_TOKEN || '').trim();
const rawRemoteSyncMethod = (process.env.REMOTE_SYNC_METHOD || 'POST').trim().toUpperCase();
const REMOTE_SYNC_METHOD = ['POST', 'PUT', 'PATCH'].includes(rawRemoteSyncMethod) ? rawRemoteSyncMethod : 'POST';
const REMOTE_SYNC_TIMEOUT = Math.max(0, Number(process.env.REMOTE_SYNC_TIMEOUT) || 7000);
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const SSE_HEARTBEAT_MS = 30_000;
const sseClients = new Set();

const broadcastSse = (eventName, payload) => {
  if (!sseClients.size) {
    return;
  }
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  sseClients.forEach(client => {
    if (!client.res || client.res.writableEnded) {
      return;
    }
    try {
      client.res.write(`event: ${eventName}\ndata: ${serialized}\n\n`);
    } catch (error) {
      console.warn('[sse] write failed', error);
    }
  });
};

const registerSseClient = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

  const client = { res, heartbeat: null };

  client.heartbeat = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(client.heartbeat);
      return;
    }
    try {
      res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    } catch (error) {
      clearInterval(client.heartbeat);
    }
  }, SSE_HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(client.heartbeat);
    sseClients.delete(client);
  };

  req.on('close', cleanup);
  res.on('close', cleanup);

  sseClients.add(client);
};

const readJsonFile = async (targetPath, fallback) => {
  try {
    const raw = await fs.promises.readFile(targetPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return Array.isArray(fallback) || typeof fallback === 'object' ? JSON.parse(JSON.stringify(fallback)) : fallback;
  }
};

const writeJsonFile = async (targetPath, data) => {
  const directory = path.dirname(targetPath);
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(targetPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
};

const readAnnotationsFile = async () => readJsonFile(ANNOTATIONS_FILE, []);
const writeAnnotationsFile = async annotations => writeJsonFile(ANNOTATIONS_FILE, annotations);

const readQuestEventsFile = async () => readJsonFile(QUEST_EVENTS_FILE, []);
const writeQuestEventsFile = async events => writeJsonFile(QUEST_EVENTS_FILE, events.slice(-200));

let searchFiltersModulePromise = null;
const loadSearchFiltersModule = () => {
  if (!searchFiltersModulePromise) {
    const modulePath = pathToFileURL(path.join(__dirname, 'js', 'shared', 'searchFilters.mjs')).href;
    searchFiltersModulePromise = import(modulePath);
  }
  return searchFiltersModulePromise;
};


const send = (res, status, body = '', headers = {}) => {
  res.writeHead(status, headers);
  if (body === null) {
    res.end();
  } else {
    res.end(body);
  }
};

const serveStatic = (req, res, urlObj) => {
  let pathname = decodeURIComponent(urlObj.pathname);
  if (pathname.includes('..')) {
    send(res, 403, 'Forbidden');
    return;
  }
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }
  if (pathname === '/') {
    pathname = '/index.html';
  }
  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err) {
      send(res, 404, 'Not Found');
      return;
    }
    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (indexErr || !indexStats.isFile()) {
          send(res, 404, 'Not Found');
          return;
        }
        streamFile(indexPath, req, res);
      });
      return;
    }
    streamFile(filePath, req, res);
  });
};

const streamFile = (filePath, req, res) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      send(res, 500, 'Internal Server Error');
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
};

const UPLOAD_RULES = {
  image: {
    directory: IMAGES_DIR,
    extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']
  },
  audio: {
    directory: AUDIO_DIR,
    extensions: ['.mp3', '.ogg', '.wav', '.flac', '.aac', '.m4a']
  }
};

const IMAGE_EXTENSIONS = new Set(UPLOAD_RULES.image.extensions);
const AUDIO_EXTENSIONS = new Set(UPLOAD_RULES.audio.extensions);
let cachedTypes = null;
const canSyncRemote = REMOTE_SYNC_URL.length > 0 && REMOTE_SYNC_METHOD.length;
const ADMIN_API_TOKEN = (process.env.ADMIN_API_TOKEN || '').trim();
const USER_API_TOKENS = (process.env.USER_API_TOKENS || '')
  .split(',')
  .map(token => token.trim())
  .filter(Boolean);
const authEnabled = ADMIN_API_TOKEN.length > 0 || USER_API_TOKENS.length > 0;
const DISCORD_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || '').trim();
const DISCORD_CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || '').trim();
const DISCORD_REDIRECT_URI = (process.env.DISCORD_REDIRECT_URI || '').trim();
const DISCORD_OAUTH_ENABLED = DISCORD_CLIENT_ID.length > 0 && DISCORD_CLIENT_SECRET.length > 0 && DISCORD_REDIRECT_URI.length > 0;
const DISCORD_ADMIN_IDS = (process.env.DISCORD_ADMIN_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);
const authRequired = authEnabled || DISCORD_OAUTH_ENABLED;

const sessionStore = new Map();
const SESSION_COOKIE_NAME = 'map_session';
const oauthStateStore = new Map();
const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.SESSION_TTL_MS) || (12 * 60 * 60 * 1000));
const SESSION_SECRET = (process.env.SESSION_SECRET || 'dev-secret').padEnd(32, '0');

const parseCookies = header => {
  if (!header) {
    return {};
  }
  return header.split(';').map(chunk => chunk.trim()).reduce((acc, item) => {
    if (!item) {
      return acc;
    }
    const idx = item.indexOf('=');
    if (idx === -1) {
      return acc;
    }
    const key = item.slice(0, idx).trim();
    const value = decodeURIComponent(item.slice(idx + 1));
    acc[key] = value;
    return acc;
  }, {});
};

const signSessionId = sessionId => {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  return `${sessionId}.${hmac.digest('hex')}`;
};

const verifySessionId = signed => {
  if (!signed || typeof signed !== 'string') {
    return null;
  }
  const parts = signed.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [sessionId, signature] = parts;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  const expected = hmac.digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  return sessionId;
};

const createSession = payload => {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessionStore.set(sessionId, { ...payload, expiresAt });
  return signSessionId(sessionId);
};

const getSession = req => {
  const cookies = parseCookies(req.headers?.cookie);
  const signed = cookies[SESSION_COOKIE_NAME];
  const sessionId = verifySessionId(signed);
  if (!sessionId) {
    return null;
  }
  const record = sessionStore.get(sessionId);
  if (!record) {
    return null;
  }
  if (record.expiresAt <= Date.now()) {
    sessionStore.delete(sessionId);
    return null;
  }
  record.expiresAt = Date.now() + SESSION_TTL_MS;
  sessionStore.set(sessionId, record);
  return { sessionId, data: record };
};

const destroySession = req => {
  const cookies = parseCookies(req.headers?.cookie);
  const signed = cookies[SESSION_COOKIE_NAME];
  const sessionId = verifySessionId(signed);
  if (sessionId) {
    sessionStore.delete(sessionId);
  }
};

const sendSessionCookie = (res, signedId) => {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(signedId)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
  res.setHeader('Set-Cookie', cookie);
};

const clearSessionCookie = res => {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
};

const fetchJson = (url, options = {}) => new Promise((resolve, reject) => {
  const parsed = new URL(url);
  const transport = parsed.protocol === 'https:' ? https : http;
  const requestOptions = {
    method: options.method || 'GET',
    headers: options.headers ? { ...options.headers } : {},
  };
  if (options.body && !requestOptions.headers['Content-Length']) {
    requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
  }
  const request = transport.request(url, requestOptions, response => {
    let body = '';
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`HTTP ${response.statusCode}: ${body}`));
      }
    });
  });
  request.on('error', reject);
  if (options.body) {
    request.write(options.body);
  }
  request.end();
});

const AUTH_PRIORITY = { user: 1, admin: 2 };

const extractBearerToken = req => {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }
  const parts = header.split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1].trim();
  }
  return null;
};

const ensureAuthorized = async (req, res, minimumRole = 'user') => {
  if (!authRequired) {
    req.auth = { role: 'admin' };
    return 'admin';
  }
  let role = null;
  let userRecord = null;
  const session = getSession(req);
  if (session?.data?.userId) {
    const persisted = await findUserById(session.data.userId);
    if (persisted) {
      role = sanitizeRole(persisted.role);
      userRecord = persisted;
      sessionStore.set(session.sessionId, { ...session.data, role, username: persisted.username, expiresAt: session.data.expiresAt });
    } else {
      destroySession(req);
    }
  } else if (session?.data?.role) {
    role = sanitizeRole(session.data.role);
    if (session?.data?.username) {
      userRecord = { username: session.data.username, role };
    }
  }
  if (!role) {
    const tokenResult = await resolveTokenUser(extractBearerToken(req));
    if (tokenResult) {
      role = tokenResult.role;
      userRecord = tokenResult.user || null;
    }
  }
  if (!role) {
    send(res, 401, JSON.stringify({ status: 'error', message: 'Authorization required.' }), { 'Content-Type': 'application/json' });
    return null;
  }
  if ((AUTH_PRIORITY[role] || 0) < (AUTH_PRIORITY[minimumRole] || 0)) {
    send(res, 403, JSON.stringify({ status: 'error', message: 'Insufficient privileges.' }), { 'Content-Type': 'application/json' });
    return null;
  }
  req.auth = { role, user: userRecord, session: session?.data || null };
  return role;
};


const loadTypeMap = async () => {
  if (cachedTypes) {
    return cachedTypes;
  }
  try {
    const raw = await fs.promises.readFile(TYPES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedTypes = parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    cachedTypes = {};
  }
  return cachedTypes;
};

const normalizeString = value => (value ?? '').toString().trim();
const parseListParam = (searchParams, key) => {
  const rawValues = searchParams.getAll(key) || [];
  const collected = [];
  rawValues.forEach(entry => {
    if (typeof entry !== 'string') {
      return;
    }
    entry.split(/[,;]+/).forEach(chunk => {
      const normalized = normalizeString(chunk);
      if (normalized) {
        collected.push(normalized);
      }
    });
  });
  return collected;
};


const isHttpUrl = value => {
  if (!value || typeof value !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

const resolveAssetPath = relative => {
  const target = path.join(ROOT, relative);
  if (!target.startsWith(ASSETS_PATH)) {
    return null;
  }
  return target;
};

const sanitizeFileName = (value, fallback = 'file') => {
  const base = (value || fallback).toString().toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return base || fallback;
};

const ensureUniqueFilePath = async (directory, name, ext) => {
  let index = 0;
  let candidate;
  do {
    const suffix = index ? `-${index}` : '';
    candidate = path.join(directory, `${name}${suffix}${ext}`);
    index += 1;
  } while (await fs.promises.access(candidate).then(() => true).catch(() => false));
  return candidate;
};

const decodeBase64Payload = data => {
  if (!data || typeof data !== 'string') {
    return null;
  }
  const parts = data.split(',');
  const encoded = parts.length === 2 ? parts[1] : parts[0];
  try {
    return Buffer.from(encoded, 'base64');
  } catch (error) {
    return null;
  }
};

const persistUploadedFile = async ({ type, filename, data }) => {
  const rules = UPLOAD_RULES[type];
  if (!rules) {
    throw new Error('Unsupported upload type');
  }
  const buffer = decodeBase64Payload(data);
  if (!buffer) {
    throw new Error('Invalid file data');
  }
  if (buffer.length > MAX_UPLOAD_SIZE) {
    throw new Error('Fichier trop volumineux (limite 15 Mo).');
  }
  const ext = path.extname(filename || '').toLowerCase();
  if (!rules.extensions.includes(ext)) {
    throw new Error('Invalid file extension');
  }
  const safeName = sanitizeFileName(path.basename(filename, ext));
  await fs.promises.mkdir(rules.directory, { recursive: true });
  const targetPath = await ensureUniqueFilePath(rules.directory, safeName, ext);
  await fs.promises.writeFile(targetPath, buffer);
  const relative = path.relative(ROOT, targetPath).split(path.sep).join('/');
  return relative;
};

const readLocationsFile = async () => {
  try {
    const raw = await fs.promises.readFile(LOCATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch (error) {
    return {};
  }
};

const validateLocationsDataset = async dataset => {
  const errors = [];
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    return { valid: false, errors: ['Le payload \"locations\" doit etre un objet { continent: lieux[] }.'] };
  }
  const typeMap = await loadTypeMap();
  const knownTypes = new Set(Object.keys(typeMap || {}));
  knownTypes.add('default');
  const seenNames = new Map();
  const assetChecks = [];

  Object.entries(dataset).forEach(([continentName, locations]) => {
    const continent = normalizeString(continentName);
    if (!continent) {
      errors.push('Nom de continent manquant ou vide.');
    }
    if (!Array.isArray(locations)) {
      errors.push(`La valeur du continent "${continentName}" doit etre une liste.`);
      return;
    }
    locations.forEach((location, index) => {
      const context = `${continent || continentName}#${index + 1}`;
      if (!location || typeof location !== 'object') {
        errors.push(`Entree invalide pour ${context} (objet attendu).`);
        return;
      }
      const name = normalizeString(location.name);
      if (!name) {
        errors.push(`Nom manquant pour ${context}.`);
      } else {
        const key = name.toLowerCase();
        if (seenNames.has(key)) {
          errors.push(`Nom duplique "${name}" (deja dans ${seenNames.get(key)}).`);
        } else {
          seenNames.set(key, context);
        }
      }

      const type = normalizeString(location.type) || 'default';
      if (type !== 'default' && !knownTypes.has(type)) {
        errors.push(`Type inconnu "${type}" pour ${context}.`);
      }

      const x = Number(location.x);
      const y = Number(location.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        errors.push(`Coordonnees invalides pour ${context}.`);
      }

      const audio = normalizeString(location.audio);
      if (audio) {
        if (audio.startsWith('assets/')) {
          const ext = path.extname(audio).toLowerCase();
          if (!AUDIO_EXTENSIONS.has(ext)) {
            errors.push(`Extension audio non supportee (${audio}) pour ${context}.`);
          } else {
            const resolved = resolveAssetPath(audio);
            if (!resolved) {
              errors.push(`Chemin audio hors assets (${audio}) pour ${context}.`);
            } else {
              assetChecks.push({ path: resolved, original: audio, context });
            }
          }
        } else if (!isHttpUrl(audio)) {
          errors.push(`Audio invalide (${audio}) pour ${context}.`);
        }
      }

      const images = Array.isArray(location.images) ? location.images : [];
      if (!Array.isArray(location.images)) {
        errors.push(`Le champ images doit etre une liste pour ${context}.`);
      }
      images.forEach((entry, imageIndex) => {
        const value = normalizeString(entry);
        if (!value) {
          return;
        }
        if (value.startsWith('assets/')) {
          const ext = path.extname(value).toLowerCase();
          if (!IMAGE_EXTENSIONS.has(ext)) {
        errors.push(`Extension d'image non supportee (${value}) pour ${context}.`);
          } else {
            const resolved = resolveAssetPath(value);
            if (!resolved) {
              errors.push(`Chemin image hors assets (${value}) pour ${context}.`);
            } else {
              assetChecks.push({ path: resolved, original: value, context });
            }
          }
        } else if (!isHttpUrl(value)) {
          errors.push(`Image invalide (${value}) pour ${context} [index ${imageIndex + 1}].`);
        }
      });

      const videos = Array.isArray(location.videos) ? location.videos : [];
      if (location.videos && !Array.isArray(location.videos)) {
        errors.push(`Le champ videos doit etre une liste pour ${context}.`);
      }
      videos.forEach((video, videoIndex) => {
        if (!video || typeof video !== 'object') {
          errors.push(`Video invalide pour ${context} [index ${videoIndex + 1}].`);
          return;
        }
        const url = normalizeString(video.url);
        if (url && !isHttpUrl(url) && !url.startsWith('assets/')) {
          errors.push(`URL video invalide (${url}) pour ${context} [index ${videoIndex + 1}].`);
        }
      });

      const ensureArrayOrStringList = (value, field) => {
        if (!value) {
          return;
        }
        if (Array.isArray(value)) {
          const hasInvalid = value.some(entry => typeof entry !== 'string');
          if (hasInvalid) {
            errors.push(`Le champ ${field} de ${context} doit contenir uniquement des chaines.`);
          }
        } else if (typeof value !== 'string') {
          errors.push(`Le champ ${field} de ${context} doit etre une chaine ou une liste.`);
        }
      };

      ensureArrayOrStringList(location.history, 'history');
      ensureArrayOrStringList(location.quests, 'quests');
      ensureArrayOrStringList(location.lore, 'lore');

      if (location.pnjs && !Array.isArray(location.pnjs)) {
        errors.push(`Le champ pnjs doit etre une liste pour ${context}.`);
      } else if (Array.isArray(location.pnjs)) {
        location.pnjs.forEach((pnj, pnjIndex) => {
          if (!pnj || typeof pnj !== 'object') {
            errors.push(`PNJ invalide pour ${context} [index ${pnjIndex + 1}].`);
            return;
          }
          const pnjName = normalizeString(pnj.name);
          if (!pnjName) {
            errors.push(`PNJ sans nom pour ${context} [index ${pnjIndex + 1}].`);
          }
        });
      }
    });
  });

  const seenAssetPaths = new Set();
  for (const asset of assetChecks) {
    if (seenAssetPaths.has(asset.path)) {
      continue;
    }
    seenAssetPaths.add(asset.path);
    try {
      await fs.promises.access(asset.path);
    } catch (error) {
      errors.push(`Fichier manquant ${asset.original} reference dans ${asset.context}.`);
    }
  }

  return { valid: errors.length === 0, errors };
};

const flattenLocations = dataset => {
  const map = new Map();
  Object.entries(dataset || {}).forEach(([continent, list]) => {
    if (!Array.isArray(list)) {
      return;
    }
    list.forEach(location => {
      if (!location || typeof location !== 'object') {
        return;
      }
      const name = normalizeString(location.name);
      if (!name) {
        return;
      }
      const key = `${normalizeString(continent).toLowerCase()}::${name.toLowerCase()}`;
      map.set(key, {
        continent: continent,
        name: location.name,
        location
      });
    });
  });
  return map;
};

const cloneDataset = dataset => JSON.parse(JSON.stringify(dataset || {}));

const readUsersFile = async () => {
  try {
    const raw = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.users)) {
      return parsed.users;
    }
  } catch (error) {
    // ignore, fallback to empty list
  }
  return [];
};

const writeUsersFile = async users => {
  const directory = path.dirname(USERS_FILE);
  await fs.promises.mkdir(directory, { recursive: true });
  const json = JSON.stringify(users, null, 2) + '\n';
  await fs.promises.writeFile(USERS_FILE, json, 'utf-8');
};

const sanitizeRole = value => (value && value.toLowerCase() === 'admin') ? 'admin' : 'user';

const sanitizeUserRecord = user => ({
  id: user?.id || '',
  provider: user?.provider || 'manual',
  discordId: user?.provider === 'discord' ? user.discordId || null : null,
  username: user?.username || '',
  role: sanitizeRole(user?.role || 'user'),
  apiTokens: Array.isArray(user?.apiTokens) && user?.provider !== 'discord' ? [...user.apiTokens] : undefined
});

const findUserById = async id => {
  const users = await readUsersFile();
  return users.find(user => user.id === id) || null;
};

const findUserByDiscordId = async discordId => {
  const users = await readUsersFile();
  return users.find(user => user.provider === 'discord' && user.discordId === discordId) || null;
};

const resolveTokenUser = async token => {
  if (!token) {
    return null;
  }
  const users = await readUsersFile();
  for (const user of users) {
    if (Array.isArray(user.apiTokens) && user.apiTokens.includes(token)) {
      return { user, role: sanitizeRole(user.role) };
    }
  }
  if (ADMIN_API_TOKEN && token === ADMIN_API_TOKEN) {
    return { user: null, role: 'admin' };
  }
  if (USER_API_TOKENS.includes(token)) {
    return { user: null, role: 'user' };
  }
  return null;
};

const updateSessionsForUser = (userId, updates = {}) => {
  sessionStore.forEach((record, key) => {
    if (record.userId === userId) {
      sessionStore.set(key, { ...record, ...updates });
    }
  });
};

const destroySessionsForUser = userId => {
  sessionStore.forEach((record, key) => {
    if (record.userId === userId) {
      sessionStore.delete(key);
    }
  });
};

const createManualUser = async ({ username = '', role = 'user', token = null }) => {
  const users = await readUsersFile();
  const id = `manual:${crypto.randomUUID()}`;
  const apiToken = token && token.trim() ? token.trim() : crypto.randomBytes(24).toString('hex');
  const user = {
    id,
    provider: 'manual',
    username: username || '',
    role: sanitizeRole(role),
    apiTokens: [apiToken]
  };
  users.push(user);
  await writeUsersFile(users);
  return { user, token: apiToken };
};

const upsertDiscordUser = async ({ discordId, username = '', roleHint = null }) => {
  const users = await readUsersFile();
  let user = users.find(entry => entry.provider === 'discord' && entry.discordId === discordId);
  if (!user) {
    const shouldBeAdmin = roleHint
      ? sanitizeRole(roleHint) === 'admin'
      : DISCORD_ADMIN_IDS.includes(discordId) || users.length === 0;
    user = {
      id: `discord:${discordId}`,
      provider: 'discord',
      discordId,
      username: username || '',
      role: shouldBeAdmin ? 'admin' : 'user',
      apiTokens: []
    };
    users.push(user);
  } else {
    if (username && user.username !== username) {
      user.username = username;
    }
    if (roleHint) {
      const sanitized = sanitizeRole(roleHint);
      if (sanitized !== user.role) {
        user.role = sanitized;
      }
    }
  }
  await writeUsersFile(users);
  updateSessionsForUser(user.id, { role: user.role, username: user.username });
  return user;
};

const updateUser = async (id, { role, username, addToken, removeToken }) => {
  const users = await readUsersFile();
  const user = users.find(entry => entry.id === id);
  if (!user) {
    return null;
  }
  let updated = false;
  if (role) {
    const sanitized = sanitizeRole(role);
    if (sanitized !== user.role) {
      user.role = sanitized;
      updated = true;
    }
  }
  if (typeof username === 'string' && username !== user.username) {
    user.username = username;
    updated = true;
  }
  if (addToken) {
    if (!Array.isArray(user.apiTokens)) {
      user.apiTokens = [];
    }
    if (!user.apiTokens.includes(addToken)) {
      user.apiTokens.push(addToken);
      updated = true;
    }
  }
  if (removeToken && Array.isArray(user.apiTokens)) {
    const index = user.apiTokens.indexOf(removeToken);
    if (index !== -1) {
      user.apiTokens.splice(index, 1);
      updated = true;
    }
  }
  if (updated) {
    await writeUsersFile(users);
    updateSessionsForUser(user.id, { role: user.role, username: user.username });
  }
  return user;
};

const deleteUser = async id => {
  const users = await readUsersFile();
  const index = users.findIndex(entry => entry.id === id);
  if (index === -1) {
    return null;
  }
  const [removed] = users.splice(index, 1);
  await writeUsersFile(users);
  destroySessionsForUser(id);
  return removed;
};

const computeLocationsDiff = (previous, next) => {
  const before = flattenLocations(previous);
  const after = flattenLocations(next);
  const created = [];
  const updated = [];
  const deleted = [];

  after.forEach((entry, key) => {
    if (!before.has(key)) {
      created.push({ continent: entry.continent, name: entry.name });
      return;
    }
    const previousEntry = before.get(key);
    const beforeSnapshot = JSON.stringify(previousEntry.location);
    const afterSnapshot = JSON.stringify(entry.location);
    if (beforeSnapshot !== afterSnapshot) {
      updated.push({ continent: entry.continent, name: entry.name });
    }
  });

  before.forEach((entry, key) => {
    if (!after.has(key)) {
      deleted.push({ continent: entry.continent, name: entry.name });
    }
  });

  return { created, updated, deleted };
};

const appendAuditLog = async ({ dataset, diff }) => {
  try {
    await fs.promises.mkdir(AUDIT_DIR, { recursive: true });
    const totalContinents = Object.keys(dataset || {}).length;
    const totalLocations = Object.values(dataset || {}).reduce(
      (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
      0
    );
    const summarize = entries => ({
      count: entries.length,
      items: entries.slice(0, 10)
    });
    const entry = {
      timestamp: new Date().toISOString(),
      totals: {
        continents: totalContinents,
        locations: totalLocations
      },
      changes: {
        created: summarize(diff.created),
        updated: summarize(diff.updated),
        deleted: summarize(diff.deleted)
      }
    };
    await fs.promises.appendFile(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (error) {
    console.error('[audit] unable to append log', error);
  }
};

const sendRemoteSync = async ({ dataset, diff }) => {
  if (!canSyncRemote) {
    return { status: 'skipped' };
  }
  try {
    const target = new URL(REMOTE_SYNC_URL);
    const transport = target.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      timestamp: new Date().toISOString(),
      locations: dataset,
      diff
    });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    };
    if (REMOTE_SYNC_TOKEN) {
      headers.Authorization = `Bearer ${REMOTE_SYNC_TOKEN}`;
    }
    const options = {
      method: REMOTE_SYNC_METHOD,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers,
      timeout: REMOTE_SYNC_TIMEOUT
    };

    return await new Promise(resolve => {
      const request = transport.request(options, response => {
        let responseBody = '';
        response.on('data', chunk => {
          responseBody += chunk;
        });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({ status: 'ok', statusCode: response.statusCode });
          } else {
            resolve({
              status: 'error',
              statusCode: response.statusCode,
              body: responseBody
            });
          }
        });
      });
      request.on('timeout', () => {
        request.destroy(new Error('timeout'));
      });
      request.on('error', error => {
        resolve({ status: 'error', error: error.message });
      });
      request.write(body);
      request.end();
    });
  } catch (error) {
    return { status: 'error', error: error.message };
  }
};

const collectBody = req => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 25 * 1024 * 1024) {
      reject(new Error('Payload too large'));
      req.destroy();
    }
  });
  req.on('end', () => resolve(body));
  req.on('error', reject);
});

const persistLocations = async payload => {
  const directory = path.dirname(LOCATIONS_FILE);
  await fs.promises.mkdir(directory, { recursive: true });
  const json = JSON.stringify(payload, null, 2) + '\n';
  await fs.promises.writeFile(LOCATIONS_FILE, json, 'utf-8');
};

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && urlObj.pathname === '/api/events/stream') {
      registerSseClient(req, res);
      return;
    }
    if (req.method === 'GET' && urlObj.pathname === '/api/locations/search') {
      try {
        const {
          normalizeFilterState,
          buildLocationIndex,
          prepareFilters,
          locationMatchesFilters,
          buildFilterFacets
        } = await loadSearchFiltersModule();

        const [locationsData, questEvents, typeData] = await Promise.all([
          readLocationsFile(),
          readQuestEventsFile(),
          readJsonFile(TYPES_FILE, {})
        ]);

        const questEventsByLocation = new Map();
        questEvents.forEach(event => {
          const key = normalizeString(event?.locationName).toLowerCase();
          if (!key) {
            return;
          }
          if (!questEventsByLocation.has(key)) {
            questEventsByLocation.set(key, []);
          }
          questEventsByLocation.get(key).push(event);
        });

        const entries = [];
        Object.entries(locationsData || {}).forEach(([continent, rawLocations]) => {
          if (!Array.isArray(rawLocations)) {
            return;
          }
          rawLocations.forEach(location => {
            const nameKey = normalizeString(location?.name).toLowerCase();
            const relatedEvents = nameKey ? questEventsByLocation.get(nameKey) || [] : [];
            const index = buildLocationIndex(location, { continent, questEvents: relatedEvents });
            entries.push({
              location,
              continent,
              index,
              questEvents: relatedEvents
            });
          });
        });

        const filters = normalizeFilterState({
          text: urlObj.searchParams.get('text') || '',
          types: parseListParam(urlObj.searchParams, 'types'),
          tags: parseListParam(urlObj.searchParams, 'tags'),
          statuses: parseListParam(urlObj.searchParams, 'statuses'),
          quests: urlObj.searchParams.get('quests') || undefined
        });

        const prepared = prepareFilters(filters);
        const matchedEntries = entries.filter(entry => locationMatchesFilters(entry.index, prepared));

        const limitParam = Number(urlObj.searchParams.get('limit')) || 100;
        const limit = Math.max(0, Math.min(250, limitParam));
        const sliced = matchedEntries.slice(0, limit);

        const typeLabels = new Map(Object.entries(typeData || {}));
        const datasetFacets = buildFilterFacets(entries.map(entry => entry.index), { typeLabels });
        const matchedFacets = buildFilterFacets(matchedEntries.map(entry => entry.index), { typeLabels });

        const results = sliced.map(entry => ({
          name: entry.index.name,
          type: entry.index.type,
          continent: entry.index.continent,
          tags: entry.index.tags,
          hasQuests: entry.index.hasQuests,
          eventStatuses: entry.index.eventStatuses,
          coordinates: entry.index.coords,
          quests: Array.isArray(entry.location.quests) ? entry.location.quests : [],
          questEvents: entry.questEvents,
          location: entry.location
        }));

        send(res, 200, JSON.stringify({
          status: 'ok',
          filters,
          total: entries.length,
          matched: matchedEntries.length,
          count: results.length,
          limit,
          facets: {
            dataset: datasetFacets,
            matched: matchedFacets
          },
          results
        }), { 'Content-Type': 'application/json' });
      } catch (error) {
        console.error('[search] failed', error);
        send(res, 500, JSON.stringify({ status: 'error', message: 'Recherche indisponible.' }), { 'Content-Type': 'application/json' });
      }
      return;
    }
    if (req.method === 'GET' && urlObj.pathname === '/api/annotations') {
      const annotations = await readAnnotationsFile();
      send(res, 200, JSON.stringify({ status: 'ok', annotations }), { 'Content-Type': 'application/json' });
      return;
    }
    if (req.method === 'POST' && urlObj.pathname === '/api/annotations') {
      if (!(await ensureAuthorized(req, res, 'user'))) {
        return;
      }
      const rawBody = await collectBody(req);
      let payload;
      try {
        payload = JSON.parse(rawBody || '{}');
      } catch (error) {
        send(res, 400, 'Invalid JSON');
        return;
      }

      const rawX = payload?.x ?? payload?.coords?.x;
      const rawY = payload?.y ?? payload?.coords?.y;
      const x = Number(rawX);
      const y = Number(rawY);
      const label = normalizeString(payload?.label);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !label) {
        send(res, 400, JSON.stringify({ status: 'error', message: 'Annotation invalide: champs x, y et label requis.' }), { 'Content-Type': 'application/json' });
        return;
      }

      const color = normalizeString(payload?.color) || '#ff8a00';
      const icon = normalizeString(payload?.icon) || null;
      const scope = normalizeString(payload?.scope) || 'public';
      const expiresAt = payload?.expiresAt ? new Date(payload.expiresAt).toISOString() : null;
      const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      const now = new Date().toISOString();

      const annotation = {
        id: payload?.id && normalizeString(payload.id) ? normalizeString(payload.id) : `ann_${crypto.randomUUID()}`,
        x,
        y,
        label,
        color,
        icon,
        scope,
        locationName: normalizeString(payload?.locationName) || null,
        metadata,
        author: req.auth?.user?.username || req.auth?.session?.username || 'system',
        createdAt: now,
        updatedAt: now,
        expiresAt
      };

      const annotations = await readAnnotationsFile();
      annotations.push(annotation);
      await writeAnnotationsFile(annotations);
      broadcastSse('annotation.created', { annotation });
      send(res, 201, JSON.stringify({ status: 'ok', annotation }), { 'Content-Type': 'application/json' });
      return;
    }
    const annotationIdMatch = urlObj.pathname.match(/^\/api\/annotations\/([^/]+)$/);
    if (annotationIdMatch) {
      const annotationId = annotationIdMatch[1];
      if (req.method === 'DELETE') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const annotations = await readAnnotationsFile();
        const next = annotations.filter(item => item?.id !== annotationId);
        if (next.length === annotations.length) {
          send(res, 404, JSON.stringify({ status: 'error', message: 'Annotation introuvable.' }), { 'Content-Type': 'application/json' });
          return;
        }
        await writeAnnotationsFile(next);
        broadcastSse('annotation.deleted', { id: annotationId });
        send(res, 204, null);
        return;
      }
    }
    if (urlObj.pathname === '/api/quest-events') {
      if (req.method === 'GET') {
        if (!(await ensureAuthorized(req, res, 'user'))) {
          return;
        }
        const events = await readQuestEventsFile();
        send(res, 200, JSON.stringify({ status: 'ok', events }), { 'Content-Type': 'application/json' });
        return;
      }
      if (req.method === 'POST') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const rawBody = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(rawBody || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const questId = normalizeString(payload?.questId);
        const locationName = normalizeString(payload?.locationName);
        const status = normalizeString(payload?.status);
        const milestone = normalizeString(payload?.milestone);
        if (!questId || !locationName || !status) {
          send(res, 400, JSON.stringify({ status: 'error', message: 'Champs questId, locationName et status requis.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const progress = payload?.progress && typeof payload.progress === 'object'
          ? {
              current: Number(payload.progress.current) || 0,
              max: Number(payload.progress.max) || null
            }
          : null;
        const note = normalizeString(payload?.note) || '';
        const event = {
          id: payload?.id && normalizeString(payload.id) ? normalizeString(payload.id) : `quest_${crypto.randomUUID()}`,
          questId,
          locationName,
          status,
          milestone: milestone || null,
          progress,
          note,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        const events = await readQuestEventsFile();
        events.push(event);
        await writeQuestEventsFile(events);
        broadcastSse('quest.updated', { event });
        send(res, 201, JSON.stringify({ status: 'ok', event }), { 'Content-Type': 'application/json' });
        return;
      }
    }
    const questEventMatch = urlObj.pathname.match(/^\/api\/quest-events\/([^/]+)$/);
    if (questEventMatch) {
      const questEventId = questEventMatch[1];
      if (req.method === 'PATCH') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const rawBody = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(rawBody || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const events = await readQuestEventsFile();
        const index = events.findIndex(event => event?.id === questEventId);
        if (index === -1) {
          send(res, 404, JSON.stringify({ status: 'error', message: 'Evenement de quete introuvable.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const current = events[index];
        const partial = typeof payload === 'object' ? payload : {};
        const questId = normalizeString(partial.questId) || current.questId;
        const locationName = normalizeString(partial.locationName) || current.locationName;
        const status = normalizeString(partial.status) || current.status;
        if (!questId || !locationName || !status) {
          send(res, 400, JSON.stringify({ status: 'error', message: 'Champs questId, locationName et status requis.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const milestone = normalizeString(partial.milestone);
        const note = normalizeString(partial.note);
        let progress = null;
        if (partial.progress && typeof partial.progress === 'object') {
          const currentValue = Number(partial.progress.current);
          const maxValue = Number(partial.progress.max);
          progress = {
            current: Number.isFinite(currentValue) ? currentValue : null,
            max: Number.isFinite(maxValue) ? maxValue : null
          };
        } else if (partial.progress === null) {
          progress = null;
        } else {
          progress = current.progress || null;
        }
        const updated = {
          ...current,
          questId,
          locationName,
          status,
          milestone: milestone !== undefined ? milestone || null : current.milestone || null,
          note: note !== undefined ? note || '' : current.note || '',
          progress,
          updatedAt: new Date().toISOString()
        };
        events[index] = updated;
        await writeQuestEventsFile(events);
        broadcastSse('quest.updated', { event: updated });
        send(res, 200, JSON.stringify({ status: 'ok', event: updated }), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'DELETE') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const events = await readQuestEventsFile();
        const next = events.filter(event => event?.id !== questEventId);
        if (next.length === events.length) {
          send(res, 404, JSON.stringify({ status: 'error', message: 'Evenement de quete introuvable.' }), { 'Content-Type': 'application/json' });
          return;
        }
        await writeQuestEventsFile(next);
        broadcastSse('quest.deleted', { id: questEventId });
        send(res, 204, null);
        return;
      }
    }
    if (req.method === 'POST' && urlObj.pathname === '/api/upload') {
      if (!(await ensureAuthorized(req, res, 'admin'))) {
        return;
      }
      const body = await collectBody(req);
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch (error) {
        send(res, 400, 'Invalid JSON');
        return;
      }
      try {
        const relativePath = await persistUploadedFile({
          type: payload?.type,
          filename: payload?.filename,
          data: payload?.data
        });
        send(res, 200, JSON.stringify({ status: 'ok', path: relativePath }), { 'Content-Type': 'application/json' });
      } catch (error) {
        console.error('[upload] error', error);
        send(res, 400, JSON.stringify({ status: 'error', message: error.message }), { 'Content-Type': 'application/json' });
      }
      return;
    }

    if (req.method === 'POST' && urlObj.pathname === '/api/locations') {
      if (!(await ensureAuthorized(req, res, 'admin'))) {
        return;
      }
      const body = await collectBody(req);
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch (error) {
        send(res, 400, 'Invalid JSON');
        return;
      }
      if (!data || typeof data !== 'object' || typeof data.locations !== 'object') {
        send(res, 400, JSON.stringify({ status: 'error', errors: ['Payload must contain a "locations" object.'] }), { 'Content-Type': 'application/json' });
        return;
      }

      const dataset = data.locations;
      const validation = await validateLocationsDataset(dataset);
      if (!validation.valid) {
        const errors = validation.errors.slice(0, 50);
        send(res, 400, JSON.stringify({ status: 'error', errors }), { 'Content-Type': 'application/json' });
        return;
      }

      const previous = await readLocationsFile();
      const diff = computeLocationsDiff(previous, dataset);

      await persistLocations(dataset);
      await appendAuditLog({ dataset, diff });
      const syncResult = await sendRemoteSync({ dataset, diff });
      const totals = {
        continents: Object.keys(dataset || {}).length,
        locations: Object.values(dataset || {}).reduce(
          (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
          0
        )
      };
      broadcastSse('locations.sync', {
        timestamp: new Date().toISOString(),
        diff,
        totals,
        sync: syncResult.status
      });
      if (syncResult.status === 'error') {
        const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
        console.error('[sync] remote export failed', details);
      }

      send(res, 200, JSON.stringify({
        status: 'ok',
        changes: {
          created: diff.created.length,
          updated: diff.updated.length,
          deleted: diff.deleted.length
        },
        sync: syncResult.status,
        syncStatusCode: syncResult.statusCode ?? null,
        syncError: syncResult.status === 'error'
          ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
          : null
      }), { 'Content-Type': 'application/json' });
      return;
    }

    if (urlObj.pathname === '/api/admin/locations') {
      if (req.method === 'GET') {
        if (!(await ensureAuthorized(req, res, 'user'))) {
          return;
        }
        const dataset = await readLocationsFile();
        send(res, 200, JSON.stringify({ status: 'ok', locations: dataset }), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'POST') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const body = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const continentRaw = normalizeString(payload?.continent);
        const location = payload?.location;
        if (!continentRaw || !location || typeof location !== 'object') {
          send(res, 400, JSON.stringify({ status: 'error', message: 'continent and location are required.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const name = normalizeString(location.name);
        if (!name) {
          send(res, 400, JSON.stringify({ status: 'error', message: 'location.name is required.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const previous = await readLocationsFile();
        const dataset = cloneDataset(previous);
        const continent = continentRaw;
        const targetList = Array.isArray(dataset[continent]) ? [...dataset[continent]] : [];
        const nameKey = name.toLowerCase();
        if (targetList.some(entry => normalizeString(entry?.name).toLowerCase() === nameKey)) {
          send(res, 409, JSON.stringify({ status: 'error', message: 'Location already exists in this continent.' }), { 'Content-Type': 'application/json' });
          return;
        }
        targetList.push(location);
        dataset[continent] = targetList;

        const validation = await validateLocationsDataset(dataset);
        if (!validation.valid) {
          const errors = validation.errors.slice(0, 50);
          send(res, 400, JSON.stringify({ status: 'error', errors }), { 'Content-Type': 'application/json' });
          return;
        }

        const diff = computeLocationsDiff(previous, dataset);
        await persistLocations(dataset);
        await appendAuditLog({ dataset, diff });
        const syncResult = await sendRemoteSync({ dataset, diff });
        if (syncResult.status === 'error') {
          const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
          console.error('[sync] remote export failed', details);
        }
        send(res, 201, JSON.stringify({
          status: 'ok',
          continent,
          location,
          changes: diff,
          sync: syncResult.status,
          syncStatusCode: syncResult.statusCode ?? null,
          syncError: syncResult.status === 'error'
            ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
            : null
        }), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const body = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const originalContinent = normalizeString(payload?.originalContinent);
        const originalName = normalizeString(payload?.originalName);
        const newContinent = normalizeString(payload?.continent) || originalContinent;
        const location = payload?.location;
        if (!originalContinent || !originalName || !location || typeof location !== 'object') {
          send(res, 400, JSON.stringify({ status: 'error', message: 'originalContinent, originalName et location sont requis.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const newName = normalizeString(location.name);
        if (!newName) {
          send(res, 400, JSON.stringify({ status: 'error', message: 'location.name est requis.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const previous = await readLocationsFile();
        const dataset = cloneDataset(previous);
        const sourceList = Array.isArray(dataset[originalContinent]) ? [...dataset[originalContinent]] : [];
        const sourceIndex = sourceList.findIndex(entry => normalizeString(entry?.name).toLowerCase() === originalName.toLowerCase());
        if (sourceIndex === -1) {
          send(res, 404, JSON.stringify({ status: 'error', message: 'Location not found.' }), { 'Content-Type': 'application/json' });
          return;
        }
        sourceList.splice(sourceIndex, 1);
        if (sourceList.length) {
          dataset[originalContinent] = sourceList;
        } else {
          delete dataset[originalContinent];
        }
        const targetList = Array.isArray(dataset[newContinent]) ? [...dataset[newContinent]] : [];
        const newNameKey = newName.toLowerCase();
        if (targetList.some(entry => normalizeString(entry?.name).toLowerCase() === newNameKey)) {
          send(res, 409, JSON.stringify({ status: 'error', message: 'Location already exists in target continent.' }), { 'Content-Type': 'application/json' });
          return;
        }
        targetList.push(location);
        dataset[newContinent] = targetList;

        const validation = await validateLocationsDataset(dataset);
        if (!validation.valid) {
          const errors = validation.errors.slice(0, 50);
          send(res, 400, JSON.stringify({ status: 'error', errors }), { 'Content-Type': 'application/json' });
          return;
        }

        const diff = computeLocationsDiff(previous, dataset);
        await persistLocations(dataset);
        await appendAuditLog({ dataset, diff });
        const syncResult = await sendRemoteSync({ dataset, diff });
        if (syncResult.status === 'error') {
          const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
          console.error('[sync] remote export failed', details);
        }
        send(res, 200, JSON.stringify({
          status: 'ok',
          continent: newContinent,
          location,
          changes: diff,
          sync: syncResult.status,
          syncStatusCode: syncResult.statusCode ?? null,
          syncError: syncResult.status === 'error'
            ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
            : null
        }), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'DELETE') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const body = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const continent = normalizeString(payload?.continent);
        const name = normalizeString(payload?.name);
        if (!continent || !name) {
          send(res, 400, JSON.stringify({ status: 'error', message: 'continent et name sont requis.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const previous = await readLocationsFile();
        const dataset = cloneDataset(previous);
        const list = Array.isArray(dataset[continent]) ? [...dataset[continent]] : [];
        const index = list.findIndex(entry => normalizeString(entry?.name).toLowerCase() === name.toLowerCase());
        if (index === -1) {
          send(res, 404, JSON.stringify({ status: 'error', message: 'Location not found.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const removed = list.splice(index, 1)[0];
        if (list.length) {
          dataset[continent] = list;
        } else {
          delete dataset[continent];
        }

        const validation = await validateLocationsDataset(dataset);
        if (!validation.valid) {
          const errors = validation.errors.slice(0, 50);
          send(res, 400, JSON.stringify({ status: 'error', errors }), { 'Content-Type': 'application/json' });
          return;
        }

        const diff = computeLocationsDiff(previous, dataset);
        await persistLocations(dataset);
        await appendAuditLog({ dataset, diff });
        const syncResult = await sendRemoteSync({ dataset, diff });
        if (syncResult.status === 'error') {
          const details = (syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`;
          console.error('[sync] remote export failed', details);
        }
        send(res, 200, JSON.stringify({
          status: 'ok',
          continent,
          removed,
          changes: diff,
          sync: syncResult.status,
          syncStatusCode: syncResult.statusCode ?? null,
          syncError: syncResult.status === 'error'
            ? ((syncResult.error || syncResult.body) || `HTTP ${syncResult.statusCode || 'unknown'}`)
            : null
        }), { 'Content-Type': 'application/json' });
        return;
      }

      send(res, 405, JSON.stringify({ status: 'error', message: 'Method Not Allowed' }), { 'Content-Type': 'application/json', 'Allow': 'GET,POST,PATCH,PUT,DELETE' });
      return;
    }

    if (urlObj.pathname === '/auth/session') {
      if (!DISCORD_OAUTH_ENABLED) {
        const response = authEnabled
          ? { status: 'ok', authenticated: false, role: 'guest', username: '', authRequired: false }
          : { status: 'ok', authenticated: true, role: 'admin', username: '', authRequired: false };
        send(res, 200, JSON.stringify(response), { 'Content-Type': 'application/json' });
        return;
      }
      const session = getSession(req);
      if (session?.data) {
        const payload = session.data;
        send(res, 200, JSON.stringify({
          status: 'ok',
          authenticated: true,
          role: payload.role || 'user',
          username: payload.username || '',
          authRequired: true
        }), { 'Content-Type': 'application/json' });
      } else {
        send(res, 200, JSON.stringify({ status: 'ok', authenticated: false, role: 'guest', username: '', authRequired: true }), { 'Content-Type': 'application/json' });
      }
      return;
    }

    if (urlObj.pathname === '/auth/discord/login') {
      if (!DISCORD_OAUTH_ENABLED) {
        send(res, 503, JSON.stringify({ status: 'error', message: 'Discord OAuth not configured.' }), { 'Content-Type': 'application/json' });
        return;
      }
      const state = crypto.randomUUID();
      const now = Date.now();
      oauthStateStore.set(state, now + OAUTH_STATE_TTL_MS);
      for (const [key, value] of oauthStateStore.entries()) {
        if (value <= now) {
          oauthStateStore.delete(key);
        }
      }
      const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        response_type: 'code',
        scope: 'identify',
        redirect_uri: DISCORD_REDIRECT_URI,
        state
      });
      const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
      send(res, 302, '', { Location: url });
      return;
    }

    if (urlObj.pathname === '/auth/discord/callback') {
      if (!DISCORD_OAUTH_ENABLED) {
        send(res, 503, JSON.stringify({ status: 'error', message: 'Discord OAuth not configured.' }), { 'Content-Type': 'application/json' });
        return;
      }
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      if (!code) {
        send(res, 400, JSON.stringify({ status: 'error', message: 'Missing code parameter.' }), { 'Content-Type': 'application/json' });
        return;
      }
      if (!state || !oauthStateStore.has(state)) {
        send(res, 400, JSON.stringify({ status: 'error', message: 'Invalid state parameter.' }), { 'Content-Type': 'application/json' });
        return;
      }
      const stateExpiry = oauthStateStore.get(state);
      oauthStateStore.delete(state);
      if (stateExpiry <= Date.now()) {
        send(res, 400, JSON.stringify({ status: 'error', message: 'Expired state parameter.' }), { 'Content-Type': 'application/json' });
        return;
      }
      try {
        const tokenResponse = await fetchJson('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: DISCORD_REDIRECT_URI
          }).toString()
        });
        const accessToken = tokenResponse?.access_token;
        if (!accessToken) {
          throw new Error('Missing access_token from Discord response.');
        }
        const userProfile = await fetchJson('https://discord.com/api/users/@me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const discordId = userProfile?.id;
        if (!discordId) {
          throw new Error('Unable to resolve Discord user id.');
        }
        const displayName = userProfile?.global_name || userProfile?.username || '';
        const user = await upsertDiscordUser({
          discordId,
          username: displayName,
          roleHint: DISCORD_ADMIN_IDS.length === 0 || DISCORD_ADMIN_IDS.includes(discordId) ? 'admin' : null
        });
        const signedId = createSession({
          userId: user.id,
          role: user.role,
          username: user.username || displayName,
          discordId
        });
        sendSessionCookie(res, signedId);
        send(res, 302, '', { Location: '/' });
      } catch (error) {
        console.error('[auth] discord callback error', error);
        send(res, 500, JSON.stringify({ status: 'error', message: 'Discord OAuth failed.' }), { 'Content-Type': 'application/json' });
      }
      return;
    }

    if (urlObj.pathname === '/auth/logout') {
      destroySession(req);
      clearSessionCookie(res);
      send(res, 204, null);
      return;
    }

    if (urlObj.pathname === '/api/admin/users') {
      if (req.method === 'GET') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const users = await readUsersFile();
        send(res, 200, JSON.stringify({
          status: 'ok',
          users: users.map(user => sanitizeUserRecord(user))
        }), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'POST') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const body = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const provider = normalizeString(payload?.provider) || 'manual';
        if (provider === 'discord') {
          const discordId = normalizeString(payload?.discordId);
          if (!discordId) {
            send(res, 400, JSON.stringify({ status: 'error', message: 'discordId is required.' }), { 'Content-Type': 'application/json' });
            return;
          }
          const existing = await findUserByDiscordId(discordId);
          if (existing) {
            send(res, 409, JSON.stringify({ status: 'error', message: 'Discord user already exists.' }), { 'Content-Type': 'application/json' });
            return;
          }
          const user = await upsertDiscordUser({
            discordId,
            username: normalizeString(payload?.username),
            roleHint: sanitizeRole(payload?.role || 'user')
          });
          send(res, 201, JSON.stringify({
            status: 'ok',
            user: sanitizeUserRecord(user)
          }), { 'Content-Type': 'application/json' });
          return;
        }

        const { user, token } = await createManualUser({
          username: normalizeString(payload?.username),
          role: sanitizeRole(payload?.role || 'user'),
          token: payload?.token
        });
        send(res, 201, JSON.stringify({
          status: 'ok',
          user: sanitizeUserRecord(user),
          token
        }), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'PATCH' || req.method === 'PUT') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const body = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const id = normalizeString(payload?.id);
        if (!id) {
          send(res, 400, JSON.stringify({ status: 'error', message: 'id is required.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const updates = {};
        if (payload?.role) {
          updates.role = sanitizeRole(payload.role);
        }
        if (typeof payload?.username === 'string') {
          updates.username = payload.username;
        }
        let generatedToken = null;
        if (payload?.generateToken) {
          generatedToken = crypto.randomBytes(24).toString('hex');
          updates.addToken = generatedToken;
        }
        if (payload?.removeToken) {
          updates.removeToken = payload.removeToken;
        }
        const user = await updateUser(id, updates);
        if (!user) {
          send(res, 404, JSON.stringify({ status: 'error', message: 'User not found.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const response = {
          status: 'ok',
          user: sanitizeUserRecord(user)
        };
        if (generatedToken) {
          response.token = generatedToken;
        }
        send(res, 200, JSON.stringify(response), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'DELETE') {
        if (!(await ensureAuthorized(req, res, 'admin'))) {
          return;
        }
        const body = await collectBody(req);
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch (error) {
          send(res, 400, 'Invalid JSON');
          return;
        }
        const id = normalizeString(payload?.id);
        if (!id) {
          send(res, 400, JSON.stringify({ status: 'error', message: 'id is required.' }), { 'Content-Type': 'application/json' });
          return;
        }
        const removed = await deleteUser(id);
        if (!removed) {
          send(res, 404, JSON.stringify({ status: 'error', message: 'User not found.' }), { 'Content-Type': 'application/json' });
          return;
        }
        send(res, 200, JSON.stringify({
          status: 'ok',
          removed: sanitizeUserRecord(removed)
        }), { 'Content-Type': 'application/json' });
        return;
      }

      send(res, 405, JSON.stringify({ status: 'error', message: 'Method Not Allowed' }), { 'Content-Type': 'application/json', 'Allow': 'GET,POST,PATCH,PUT,DELETE' });
      return;
    }

    if (req.method === 'OPTIONS') {
      send(res, 204, null, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method Not Allowed', {'Allow': 'GET,HEAD,POST,OPTIONS'});
      return;
    }

    serveStatic(req, res, urlObj);
  } catch (error) {
    console.error('[server] Error:', error);
    if (!res.headersSent) {
      send(res, 500, 'Internal Server Error');
    } else {
      res.destroy();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] Running at http://${HOST}:${PORT}`);
});
