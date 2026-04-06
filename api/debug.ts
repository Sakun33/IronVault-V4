export default async function handler(req: any, res: any) {
  const results: Record<string, string> = {};

  try {
    results.step1 = 'importing express...';
    const express = await import('express');
    results.step1 = 'ok: ' + typeof express.default;
  } catch (e: any) {
    results.step1 = 'FAIL: ' + e.message;
    return respond(res, results);
  }

  try {
    results.step2 = 'importing shared/schema...';
    const schema = await import('../shared/schema');
    results.step2 = 'ok: keys=' + Object.keys(schema).slice(0, 3).join(',');
  } catch (e: any) {
    results.step2 = 'FAIL: ' + e.message;
    return respond(res, results);
  }

  try {
    results.step3 = 'importing server/storage...';
    const storage = await import('../server/storage');
    results.step3 = 'ok: ' + typeof storage.storage;
  } catch (e: any) {
    results.step3 = 'FAIL: ' + e.message;
    return respond(res, results);
  }

  try {
    results.step4 = 'importing server/routes...';
    const routes = await import('../server/routes');
    results.step4 = 'ok: ' + typeof routes.registerRoutes;
  } catch (e: any) {
    results.step4 = 'FAIL: ' + e.message;
    return respond(res, results);
  }

  respond(res, results);
}

function respond(res: any, data: any) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}
