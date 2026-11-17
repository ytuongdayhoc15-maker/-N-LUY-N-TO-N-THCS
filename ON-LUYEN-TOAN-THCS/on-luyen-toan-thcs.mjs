/**
 * HE THONG ON LUYEN TOAN THCS (LOP 6 - 9)
 * May chu Node.js thuan (khong can npm install, chay offline tren Windows 10/11).
 * Khoi dong mac dinh: node on-luyen-toan-thcs.mjs
 * Che do mang LAN lop hoc: node on-luyen-toan-thcs.mjs --lan
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStorage } from './core/storage.mjs';
import { createApiHandler } from './core/api-router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isLanMode = process.argv.includes('--lan') || process.env.LAN_MODE === '1';
const HOST = isLanMode ? '0.0.0.0' : (process.env.HOST || '127.0.0.1');
const START_PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

function getLanIpAddresses() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function serveStaticFile(req, res) {
  const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
  let reqPath = decodeURIComponent(urlObj.pathname);
  if (reqPath === '/') reqPath = '/index.html';

  // Chong Path Traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
  let fullPath = path.join(PUBLIC_DIR, safePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Truy cập bị từ chối.');
    return;
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    // Fallback SPA ve index.html
    fullPath = path.join(PUBLIC_DIR, 'index.html');
  }

  if (!fs.existsSync(fullPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Chưa tìm thấy giao diện trong thư mục public/. Hãy đọc HUONG-DAN.txt.');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=86400'
  });
  fs.createReadStream(fullPath).pipe(res);
}

export async function startServer(customOptions = {}) {
  const baseDir = customOptions.baseDir || __dirname;
  const storage = await createStorage(baseDir);
  const handleApi = createApiHandler(storage, { zipPath: customOptions.zipPath || null });

  const server = http.createServer(async (req, res) => {
    const reqUrl = req.url || '/';
    if (reqUrl.startsWith('/api/')) {
      await handleApi(req, res);
    } else if (reqUrl === '/favicon.ico') {
      res.writeHead(204);
      res.end();
    } else {
      serveStaticFile(req, res);
    }
  });

  const startPort = customOptions.port ?? START_PORT;
  const host = customOptions.host ?? HOST;

  const listenOnPort = (portToTry, retriesLeft) => new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && retriesLeft > 0 && !process.env.STRICT_PORT) {
        console.warn(`[Thong bao] Cong ${portToTry} dang duoc su dung, dang tu dong chuyen sang cong ${portToTry + 1}...`);
        server.removeListener('error', onError);
        resolve(listenOnPort(portToTry + 1, retriesLeft - 1));
      } else {
        reject(err);
      }
    };
    server.once('error', onError);
    server.listen(portToTry, host, () => {
      server.removeListener('error', onError);
      resolve(server.address().port);
    });
  });

  const actualPort = await listenOnPort(startPort, 10);
  return { server, port: actualPort, host, storage };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  startServer()
    .then(({ port, host, storage }) => {
      const localUrl = `http://127.0.0.1:${port}/`;
      console.log('====================================================');
      console.log('  HE THONG ON LUYEN TOAN THCS - LOP 6, 7, 8, 9');
      console.log('====================================================');
      console.log(`  Co so du lieu : ${storage.engine === 'sqlite' ? 'SQLite (toan_thcs.db)' : 'JSON Atomic (toan_thcs_store.json)'}`);
      console.log(`  Dia chi cuc bo: ${localUrl}`);
      if (host === '0.0.0.0') {
        const lanIps = getLanIpAddresses();
        console.log('  Che do LAN    : DANG BAT (chi dung trong mang noi bo lop hoc)');
        for (const ip of lanIps) {
          console.log(`  May hoc sinh  : http://${ip}:${port}/`);
        }
      } else {
        console.log('  Che do mang   : Cuc bo an toan (127.0.0.1)');
      }
      console.log('  Nhan Ctrl+C de dung may chu.');
      console.log('====================================================');

      if (process.platform === 'win32' && !process.env.NO_BROWSER) {
        execFile('cmd.exe', ['/c', 'start', '', localUrl], { windowsHide: true }, (error) => {
          if (error) console.log('Hay mo trinh duyet va truy cap: ' + localUrl);
        });
      }
    })
    .catch((err) => {
      console.error('Khong khoi dong duoc website:', err.message);
      console.error('Neu cong 3000 dang ban, ban co the thu: set PORT=3005 && node on-luyen-toan-thcs.mjs');
      process.exitCode = 1;
    });
}
