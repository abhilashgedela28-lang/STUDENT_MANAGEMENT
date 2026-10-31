import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { apiRouter } from './src/server/api.js';
import { authMiddleware } from './src/server/services/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware);

  // Mount API router
  app.use('/api', apiRouter);

  // Actuator health check at root level as well
  app.get('/actuator/health', (_req, res) => {
    res.json({ status: 'UP', timestamp: new Date().toISOString() });
  });

  if (!isProd) {
    // In development, integrate Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static files from dist
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.resolve(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.warn('[CodeTrack Server] Production build missing: dist/index.html not found. Run npm run build before deploy.');
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (!fs.existsSync(indexPath)) {
        return res.status(500).send('Frontend build missing. Run "npm run build" before deployment.');
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CodeTrack Server] Running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('[CodeTrack Server] Fatal startup error:', err);
  process.exit(1);
});
