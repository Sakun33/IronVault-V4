import type { IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import { registerRoutes } from '../server/routes';

let app: express.Express | null = null;

async function getApp() {
  if (app) return app;

  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  await registerRoutes(app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const expressApp = await getApp();
  expressApp(req as any, res as any);
}
