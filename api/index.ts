import type { IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { storage } from '../server/storage';

let app: any = null;
let initError: Error | null = null;

async function getApp() {
  if (app) return app;
  if (initError) throw initError;

  try {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    await registerRoutes(app);

    app.use((err: any, _req: any, res: any, _next: any) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    return app;
  } catch (err) {
    initError = err as Error;
    throw err;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const expressApp = await getApp();
    expressApp(req, res);
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Function initialization failed',
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5),
    }));
  }
}
