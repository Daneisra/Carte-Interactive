#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

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
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
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

const resolveRoleFromToken = token => {
  if (!authRequired) {
    return 'admin';
  }
  if (!token) {
    return null;
  }
  if (ADMIN_API_TOKEN && token === ADMIN_API_TOKEN) {
    return 'admin';
  }
  if (USER_API_TOKENS.includes(token)) {
    return 'user';
  }
  return null;
};

const ensureAuthorized = (req, res, minimumRole = 'user') => {
  if (!authRequired) {
    return 'admin';
  }
  let role = null;
  const session = getSession(req);
  if (session?.data?.role) {
    role = session.data.role;
  } else {
    const token = extractBearerToken(req);
    role = resolveRoleFromToken(token);
  }
  if (!role) {
    send(res, 401, JSON.stringify({ status: 'error', message: 'Authorization required.' }), { 'Content-Type': 'application/json' });
    return null;
  }
  if ((AUTH_PRIORITY[role] || 0) < (AUTH_PRIORITY[minimumRole] || 0)) {
    send(res, 403, JSON.stringify({ status: 'error', message: 'Insufficient privileges.' }), { 'Content-Type': 'application/json' });
    return null;
  }
  if (session?.data) {
    req.session = session.data;
  }
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
    if (req.method === 'POST' && urlObj.pathname === '/api/upload') {
      if (!ensureAuthorized(req, res, 'admin')) {
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
      if (!ensureAuthorized(req, res, 'admin')) {
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
        if (!ensureAuthorized(req, res, 'user')) {
          return;
        }
        const dataset = await readLocationsFile();
        send(res, 200, JSON.stringify({ status: 'ok', locations: dataset }), { 'Content-Type': 'application/json' });
        return;
      }

      if (req.method === 'POST') {
        if (!ensureAuthorized(req, res, 'admin')) {
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
        if (!ensureAuthorized(req, res, 'admin')) {
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
        if (!ensureAuthorized(req, res, 'admin')) {
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
        const isAdmin = DISCORD_ADMIN_IDS.length === 0 || DISCORD_ADMIN_IDS.includes(discordId);
        const role = isAdmin ? 'admin' : 'user';
        const displayName = userProfile?.global_name || userProfile?.username || '';
        const signedId = createSession({ role, discordId, username: displayName });
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
