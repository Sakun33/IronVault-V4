import type { VercelRequest, VercelResponse } from "@vercel/node";
export default function handler(req: VercelRequest, res: VercelResponse) {
  const p = req.url || "";
  if (p.includes("/api/health")) return res.json({ status: "ok" });
  if (p.includes("/api/crm/register")) return res.json({ success: true });
  if (p.includes("/api/crm/entitlement")) return res.json({ plan: "free", status: "active" });
  if (p.includes("/api/crm/heartbeat")) return res.json({ success: true });
  return res.status(404).json({ error: "not found" });
}
