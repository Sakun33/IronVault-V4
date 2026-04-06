// Vercel Serverless Function - Express API handler
// Uses static imports so @vercel/ncc can trace dependencies
import express from 'express';
import { createServer } from 'http';
import { storage } from '../server/storage';
import { registerRoutes } from '../server/routes';
import * as schema from '../shared/schema';

// Force ncc to include these files by referencing them
void storage;
void schema;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let initialized = false;

async function ensureInitialized() {
  if (initialized) return;
  await registerRoutes(app);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  });
  initialized = true;
}

module.exports = async (req: any, res: any) => {
  try {
    await ensureInitialized();
    app(req, res);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message, stack: err.stack?.split('\n').slice(0, 3) }));
  }
};
