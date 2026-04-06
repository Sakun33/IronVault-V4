import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = (req.url || "").replace(/\?.*$/, "");

  // ── Health ──────────────────────────────────────────────────────────────────
  if (path === "/api/health" || path === "/api/health/") {
    return res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: "vercel",
      supabase: !!SUPABASE_URL,
    });
  }

  // Guard: require Supabase config for all other routes
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const supabase = getSupabase();

  // ── /api/crm/register ───────────────────────────────────────────────────────
  if (path === "/api/crm/register" && req.method === "POST") {
    const { email, fullName, country, platform, appVersion, planType } = req.body || {};
    if (!email) return res.status(400).json({ error: "email required" });

    const { data, error } = await supabase
      .from("customers")
      .upsert(
        {
          email,
          full_name: fullName || null,
          country: country || null,
          platform: platform || null,
          app_version: appVersion || null,
          plan_type: planType || "free",
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) {
      console.error("register error:", error);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, message: "Registration received", email, plan: data.plan_type, id: data.id });
  }

  // ── /api/crm/entitlement/:userId ────────────────────────────────────────────
  if (path.startsWith("/api/crm/entitlement/")) {
    const userId = path.replace("/api/crm/entitlement/", "");
    if (!userId) return res.status(400).json({ error: "userId required" });

    // Try by UUID id first, then by email
    let query = supabase.from("customers").select("id,email,plan_type,status,created_at");
    const isUuid = /^[0-9a-f-]{36}$/i.test(userId);
    if (isUuid) {
      query = query.eq("id", userId);
    } else {
      query = query.eq("email", userId);
    }

    const { data, error } = await query.single();
    if (error || !data) {
      return res.json({ plan: "free", status: "active", trial_active: false });
    }
    return res.json({
      plan: data.plan_type,
      status: data.status,
      trial_active: data.plan_type === "trial",
      id: data.id,
      email: data.email,
    });
  }

  // ── /api/crm/heartbeat ──────────────────────────────────────────────────────
  if (path === "/api/crm/heartbeat" && req.method === "POST") {
    const { email, userId } = req.body || {};
    if (!email && !userId) return res.status(400).json({ error: "email or userId required" });

    const filter = email ? { email } : { id: userId };
    const { error } = await supabase
      .from("customers")
      .update({ last_active: new Date().toISOString(), updated_at: new Date().toISOString() })
      .match(filter);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(404).json({ error: "endpoint not found", path });
}
