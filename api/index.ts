import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url || "";

  if (path.includes("/api/health")) {
    return res.json({ status: "ok", timestamp: new Date().toISOString() });
  }

  if (path.includes("/api/crm/register") && req.method === "POST") {
    return res.json({ success: true, message: "Registration received" });
  }

  if (path.includes("/api/crm/entitlement")) {
    return res.json({ plan: "free", status: "active" });
  }

  if (path.includes("/api/crm/heartbeat") && req.method === "POST") {
    return res.json({ success: true });
  }

  return res.json({ error: "not found", path });
}
