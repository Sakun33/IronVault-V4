import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = req.url?.replace(/\?.*$/, "") || "";

  if (path === "/api/health" || path === "/api/health/") {
    return res.json({ status: "ok", timestamp: new Date().toISOString(), env: "vercel" });
  }

  if (path.startsWith("/api/crm/register") && req.method === "POST") {
    const { email, fullName } = req.body || {};
    return res.json({ success: true, message: "Registration received", email, plan: "free" });
  }

  if (path.startsWith("/api/crm/entitlement/")) {
    return res.json({ plan: "free", status: "active", trial_active: false });
  }

  if (path.startsWith("/api/crm/heartbeat") && req.method === "POST") {
    return res.json({ success: true });
  }

  return res.status(404).json({ error: "endpoint not found", path });
}
