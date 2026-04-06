import type { IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import { registerRoutes } from '../server/routes';

let app: ReturnType<typeof express> | null = null;

async function getApp() {
  if (app) return app;

  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  await registerRoutes(app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  });

  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const expressApp = await getApp();
    expressApp(req as any, res as any);
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}
