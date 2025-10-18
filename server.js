#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve(__dirname);
const ASSETS_PATH = path.join(ROOT, 'assets');
const LOCATIONS_FILE = path.join(ASSETS_PATH, 'locations.json');
const IMAGES_DIR = path.join(ASSETS_PATH, 'images');
const AUDIO_DIR = path.join(ASSETS_PATH, 'audio');
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
      const body = await collectBody(req);
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch (error) {
        send(res, 400, 'Invalid JSON');
        return;
      }
      if (!data || typeof data !== 'object' || typeof data.locations !== 'object') {
        send(res, 400, 'Payload must contain a "locations" object');
        return;
      }
      await persistLocations(data.locations);
      send(res, 200, JSON.stringify({ status: 'ok' }), { 'Content-Type': 'application/json' });
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
