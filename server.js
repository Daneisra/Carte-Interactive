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

const collectBody = req => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) {
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
