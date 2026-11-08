import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, updateConfig } from './src/config';
import { db } from './src/database/db';
import { vintedScanner } from './src/services/vintedScanner';
import { client, getBotStatus, startBot, stopBot } from './src/index';
import { logger, LogEntry } from './src/services/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// API Routes
app.get('/api/status', (req: Request, res: Response) => {
  const botStatus = getBotStatus();
  const scannerStatus = vintedScanner.getStatus();
  const stats = db.getStats();

  res.json({
    bot: botStatus,
    scanner: scannerStatus,
    stats,
    hasTokenInEnv: !!config.token && config.token !== 'ton_token_de_bot_ici',
    clientId: config.clientId,
  });
});

app.post('/api/bot/start', async (req: Request, res: Response) => {
  const { token, clientId } = req.body;
  if (token) {
    updateConfig({ token, clientId });
  }

  const result = await startBot(token, clientId);
  res.json(result);
});

app.post('/api/bot/stop', async (req: Request, res: Response) => {
  const result = await stopBot();
  res.json(result);
});

// Logs API
app.get('/api/logs', (req: Request, res: Response) => {
  res.json(logger.getLogs());
});

app.post('/api/logs/clear', (req: Request, res: Response) => {
  logger.clear();
  res.json({ success: true });
});

// Server-Sent Events (SSE) stream for real-time live console in browser
app.get('/api/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onNewLog = (entry: LogEntry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };

  logger.on('new_log', onNewLog);

  req.on('close', () => {
    logger.off('new_log', onNewLog);
  });
});

async function startServer() {
  // Start background scanner
  vintedScanner.start();

  // Auto-connect discord bot if token is present
  if (config.token && config.token !== 'ton_token_de_bot_ici') {
    logger.log('info', 'Jeton Discord détecté dans l\'environnement, tentative de connexion...');
    startBot().catch((err) => {
      logger.log('warn', `Connexion automatique non aboutie: ${err.message}`);
    });
  }

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.log('info', `Panneau de Contrôle Web DJEY démarré sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
