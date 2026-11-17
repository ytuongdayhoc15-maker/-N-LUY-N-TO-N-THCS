import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createStorage } from './ON-LUYEN-TOAN-THCS/core/storage.mjs';
import { createApiHandler } from './ON-LUYEN-TOAN-THCS/core/api-router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = express();
  const baseDir = path.join(__dirname, 'ON-LUYEN-TOAN-THCS');
  const zipPath = path.join(__dirname, 'ON-LUYEN-TOAN-THCS.zip');

  const storage = await createStorage(baseDir);
  const handleApi = createApiHandler(storage, { zipPath });

  // Dinh tuyen tat ca API /api/* qua bo xu ly chung voi ban Windows
  app.use('/api', (req, res) => {
    const originalUrl = req.originalUrl || `/api${req.url}`;
    req.url = originalUrl;
    return handleApi(req, res);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const htmlPath = path.join(__dirname, 'index.html');
        const template = fs.readFileSync(htmlPath, 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`He thong On luyen Toan THCS dang chay tai http://127.0.0.1:${port} (${storage.engine})`);
  });
}

bootstrap().catch((err) => {
  console.error('Loi khoi dong server:', err);
  process.exit(1);
});
