import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes, createHmac } from "crypto";
import { z } from "zod";
import { sign, verify } from 'jsonwebtoken';

// Admin Console backend URL for forwarding CRM data
const ADMIN_CONSOLE_URL = process.env.ADMIN_CONSOLE_URL || 'http://localhost:3001';

/**
 * Forward CRM registration data to the Admin Console backend.
 * This is fire-and-forget — failures here don't block the main app.
 */
async function forwardToAdminConsole(path: string, data: any): Promise<any> {
  try {
    const url = `${ADMIN_CONSOLE_URL}${path}`;
    console.log(`🔄 Forwarding to Admin Console: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Admin Console forwarding success:`, result);
      return result;
    } else {
      console.warn(`⚠️ Admin Console forwarding failed (${response.status})`);
      return null;
    }
  } catch (error: any) {
    console.warn(`⚠️ Admin Console unreachable (non-critical): ${error.message}`);
    return null;
  }
}

// Zod validation schemas for CRM API
const crmRegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(1, "Full name is required"),
  country: z.string().length(2, "Country must be 2-letter code"),
  phone: z.string().optional(),
  marketingConsent: z.boolean().optional().default(false),
  supportConsent: z.boolean().optional().default(true),
  platform: z.string().optional(),
  appVersion: z.string().optional(),
  vaultCreatedAt: z.string().optional(),
  selectedPlan: z.string().optional().default("free"),
});

const crmHeartbeatSchema = z.object({
  userId: z.string().min(1, "User ID required"),
  appVersion: z.string().optional(),
  platform: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Minimal server routes - most functionality is client-side
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "IronVault server is running" });
  });

  // Extension API endpoints (requires authentication in production)

  // Middleware to authenticate extension requests
  const authenticateExtension = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Authentication token required" });
    }
    
    const token = authHeader.substring(7);
    const tokenData = extensionTokens.get(token);
    
    if (!tokenData) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }
    
    if (Date.now() > tokenData.expiresAt) {
      extensionTokens.delete(token);
      return res.status(401).json({ error: "Authentication token expired" });
    }
    
    // Add extension info to request
    req.extensionId = tokenData.extensionId;
    req.extensionName = tokenData.name;
    
    next();
  };
  
  // Get passwords for a specific domain (requires authentication)
  app.get("/api/extension/passwords", authenticateExtension, (req: any, res) => {
    const { domain } = req.query;
    
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: "Domain parameter is required" });
    }
    
    // TODO: In a production system, this would:
    // 1. Check if the main vault application is unlocked
    // 2. Query the actual encrypted password database
    // 3. Filter passwords matching the domain
    // 4. Return only necessary fields (no plaintext passwords without explicit user action)
    
    // For now, return mock data that simulates the filtering
    const mockPasswords = [
      {
        id: `mock-${domain}-1`,
        name: `Login for ${domain}`,
        url: `https://${domain}`,
        username: "user@example.com", 
        // Note: In production, password would be encrypted and require separate unlock
        category: "personal",
        lastUsed: new Date().toISOString()
      }
    ];
    
    res.json({ 
      success: true,
      passwords: mockPasswords,
      extensionId: req.extensionId,
      message: "Authenticated request - production would require vault unlock verification" 
    });
  });
  
  // Sync extension with vault
  app.post("/api/extension/sync", (req, res) => {
    const { extensionId, timestamp } = req.body;
    
    // For now, return success
    // In production, this would sync with the actual vault
    res.json({
      success: true,
      synced: true,
      timestamp: new Date().toISOString(),
      message: "Mock sync - requires secure vault integration"
    });
  });
  
  // In-memory storage for pairing codes and tokens (in production, use Redis or database)
  const pairingCodes = new Map<string, { expiresAt: number, used: boolean }>();
  const extensionTokens = new Map<string, { 
    extensionId: string, 
    token: string, 
    expiresAt: number, 
    pairedAt: string,
    name: string 
  }>();

  // Generate pairing code
  app.post("/api/extension/generate-pairing-code", (req, res) => {
    const { code, expiresIn = 300 } = req.body; // Default 5 minutes
    
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }
    
    const expiresAt = Date.now() + (expiresIn * 1000);
    pairingCodes.set(code, { expiresAt, used: false });
    
    // Clean up expired codes
    setTimeout(() => {
      pairingCodes.delete(code);
    }, expiresIn * 1000);
    
    res.json({ 
      success: true, 
      code, 
      expiresAt: new Date(expiresAt).toISOString() 
    });
  });

  // Pair extension using pairing code
  app.post("/api/extension/pair", (req, res) => {
    const { extensionId, pairingCode, extensionName = "IronVault Extension" } = req.body;
    
    if (!extensionId || !pairingCode) {
      return res.status(400).json({ error: "Extension ID and pairing code are required" });
    }
    
    const codeData = pairingCodes.get(pairingCode);
    
    if (!codeData) {
      return res.status(404).json({ error: "Invalid pairing code" });
    }
    
    if (codeData.used) {
      return res.status(409).json({ error: "Pairing code already used" });
    }
    
    if (Date.now() > codeData.expiresAt) {
      pairingCodes.delete(pairingCode);
      return res.status(410).json({ error: "Pairing code expired" });
    }
    
    // Generate secure authentication token
    const token = generateSecureToken();
    const tokenExpiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    extensionTokens.set(token, {
      extensionId,
      token,
      expiresAt: tokenExpiresAt,
      pairedAt: new Date().toISOString(),
      name: extensionName
    });
    
    // Mark pairing code as used
    codeData.used = true;
    
    res.json({
      success: true,
      token,
      expiresAt: new Date(tokenExpiresAt).toISOString(),
      message: "Extension paired successfully"
    });
  });

  // Get paired extensions/devices
  app.get("/api/extension/paired-devices", (req, res) => {
    const devices = Array.from(extensionTokens.values()).map(tokenData => ({
      id: tokenData.extensionId,
      name: tokenData.name,
      pairedAt: tokenData.pairedAt,
      expiresAt: new Date(tokenData.expiresAt).toISOString()
    }));
    
    res.json({ success: true, devices });
  });

  // Revoke extension pairing
  app.post("/api/extension/revoke-pairing", (req, res) => {
    const { extensionId } = req.body;
    
    if (!extensionId) {
      return res.status(400).json({ error: "Extension ID is required" });
    }
    
    // Find and remove the token
    let removed = false;
    extensionTokens.forEach((data, token) => {
      if (data.extensionId === extensionId && !removed) {
        extensionTokens.delete(token);
        removed = true;
      }
    });
    
    if (removed) {
      res.json({ success: true, message: "Extension access revoked" });
    } else {
      res.status(404).json({ error: "Extension not found" });
    }
  });

  // Helper function to generate cryptographically secure tokens
  function generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  // ============================================
  // CRM API Routes
  // ============================================

  // Register a new customer
  app.post("/api/crm/register", async (req, res) => {
    try {
      // Validate request body with Zod
      const parseResult = crmRegisterSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false, 
          message: parseResult.error.errors.map(e => e.message).join(", "),
          errors: parseResult.error.errors,
        });
      }

      const { email, fullName, country, phone, marketingConsent, supportConsent, platform, appVersion, vaultCreatedAt, selectedPlan } = parseResult.data;

      // Check if user already exists
      let crmUser = await storage.getCrmUserByEmail(email);
      
      if (crmUser) {
        // Update existing user
        await storage.updateCrmUser(crmUser.id, {
          fullName,
          country,
          phone,
          marketingConsent,
          lastActiveAt: new Date(),
          appVersion,
          platform,
        });
        
        // Get their entitlement
        const entitlement = await storage.getEntitlement(crmUser.id);
        
        // Forward to Admin Console (non-blocking)
        forwardToAdminConsole('/api/crm/register', {
          email, fullName, country, phone, marketingConsent, supportConsent,
          platform, appVersion, selectedPlan, vaultCreatedAt,
        }).catch(() => {});

        return res.json({
          success: true,
          message: "User updated",
          userId: crmUser.id,
          entitlement: entitlement ? {
            plan: entitlement.plan,
            status: entitlement.status,
            trialActive: entitlement.trialActive,
            trialEndsAt: entitlement.trialEndsAt?.toISOString(),
          } : {
            plan: "free",
            status: "active",
            trialActive: false,
          },
        });
      }

      // Create new CRM user
      crmUser = await storage.createCrmUser({
        email,
        fullName,
        country,
        phone,
        marketingConsent: marketingConsent ?? false,
        supportConsent: supportConsent ?? true,
        vaultCreatedAt: vaultCreatedAt ? new Date(vaultCreatedAt) : new Date(),
        lastActiveAt: new Date(),
        appVersion,
        platform,
      });

      // Determine plan details based on selected plan
      let plan: "free" | "premium" | "lifetime" = "free";
      let trialActive = false;
      let trialDays = 0;
      
      if (selectedPlan === 'pro_monthly' || selectedPlan === 'pro_yearly') {
        plan = 'premium';
        trialActive = true;
        trialDays = 7;
      } else if (selectedPlan === 'lifetime') {
        plan = 'lifetime';
        trialActive = false;
        trialDays = 0;
      }
      
      const trialEndsAt = trialActive 
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : undefined;
      
      // Create entitlement for new user based on selected plan
      const entitlement = await storage.createEntitlement({
        userId: crmUser.id,
        plan: plan,
        status: trialActive ? "trial" : "active",
        trialActive: trialActive,
        trialEndsAt: trialEndsAt,
        willRenew: selectedPlan === 'pro_monthly' || selectedPlan === 'pro_yearly',
        adminOverride: false,
      });

      // Log billing event
      await storage.logBillingEvent({
        userId: crmUser.id,
        eventType: "user_registered",
        platform: platform || "web",
      });

      // Forward registration to Admin Console backend (non-blocking)
      forwardToAdminConsole('/api/crm/register', {
        email,
        fullName,
        country,
        phone,
        marketingConsent,
        supportConsent,
        platform: platform || "web",
        appVersion,
        selectedPlan,
        vaultCreatedAt,
      }).catch(() => {}); // Swallow errors – admin console may be down

      res.json({
        success: true,
        message: "User registered successfully",
        userId: crmUser.id,
        entitlement: {
          plan: entitlement.plan,
          status: entitlement.status,
          trialActive: entitlement.trialActive,
          trialEndsAt: entitlement.trialEndsAt?.toISOString(),
        },
      });
    } catch (error) {
      console.error("CRM registration error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Registration failed" 
      });
    }
  });

  // Get user entitlement — accepts either a UUID userId or an email address
  app.get("/api/crm/entitlement/:userId", async (req, res) => {
    try {
      let { userId } = req.params;

      // If the caller passed an email, resolve it to the internal userId first
      if (userId.includes('@')) {
        const crmUser = await storage.getCrmUserByEmail(userId);
        if (!crmUser) {
          return res.json({
            success: true,
            plan: "free",
            entitlement: { plan: "free", status: "active", trialActive: false },
          });
        }
        userId = crmUser.id;
      }

      const entitlement = await storage.getEntitlement(userId);

      if (!entitlement) {
        return res.json({
          success: true,
          plan: "free",
          entitlement: { plan: "free", status: "active", trialActive: false },
        });
      }

      res.json({
        success: true,
        // Top-level `plan` for direct reads (e.g. usePlanFeatures hook)
        plan: entitlement.plan,
        entitlement: {
          plan: entitlement.plan,
          status: entitlement.status,
          trialActive: entitlement.trialActive,
          trialEndsAt: entitlement.trialEndsAt?.toISOString(),
          currentPeriodEndsAt: entitlement.currentPeriodEndsAt?.toISOString(),
          willRenew: entitlement.willRenew,
          subscriptionPlatform: entitlement.subscriptionPlatform,
        },
      });
    } catch (error) {
      console.error("Entitlement fetch error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch entitlement"
      });
    }
  });

  // Admin: one-time migration — push all existing IronVault users to Zoho CRM
  app.post("/api/admin/migrate-to-crm", async (req, res) => {
    const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
    if (adminKey !== (process.env.ADMIN_SECRET_KEY || 'admin')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { createCrmContact } = await import('./lib/zoho-crm');

    try {
      const users = await storage.getAllCrmUsers();
      const results: { email: string; action?: string; error?: string }[] = [];

      for (const user of users) {
        try {
          const entitlement = await storage.getEntitlement(user.id);
          const result = await createCrmContact({
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
            country: user.country,
            plan: entitlement?.plan ?? 'free',
            createdAt: user.createdAt,
          });
          results.push({ email: user.email, action: result.action });
        } catch (err: any) {
          results.push({ email: user.email, error: err.message });
        }
      }

      const succeeded = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;
      res.json({ success: true, total: users.length, succeeded, failed, results });
    } catch (error: any) {
      console.error('CRM migration error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Admin: update user's entitlement/plan by email
  app.post("/api/crm/admin/set-plan", async (req, res) => {
    try {
      const { email, plan } = req.body;
      if (!email || !plan) {
        return res.status(400).json({ success: false, message: "email and plan required" });
      }

      const validPlans = ["free", "pro", "premium", "lifetime", "family"];
      if (!validPlans.includes(plan.toLowerCase())) {
        return res.status(400).json({ success: false, message: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
      }

      const crmUser = await storage.getCrmUserByEmail(email);
      if (!crmUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const existing = await storage.getEntitlement(crmUser.id);
      if (existing) {
        await storage.updateEntitlement(crmUser.id, {
          plan: plan.toLowerCase(),
          status: "active",
        });
      } else {
        await storage.createEntitlement({
          userId: crmUser.id,
          plan: plan.toLowerCase(),
          status: "active",
          trialActive: false,
          willRenew: true,
          adminOverride: false,
        });
      }

      const updated = await storage.getEntitlement(crmUser.id);
      res.json({
        success: true,
        message: `Plan updated to ${plan} for ${email}`,
        entitlement: {
          plan: updated?.plan,
          status: updated?.status,
        },
      });
    } catch (error) {
      console.error("Admin set-plan error:", error);
      res.status(500).json({ success: false, message: "Failed to update plan" });
    }
  });

  // Update user's last active time
  app.post("/api/crm/heartbeat", async (req, res) => {
    try {
      // Validate request body with Zod
      const parseResult = crmHeartbeatSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false, 
          message: parseResult.error.errors.map(e => e.message).join(", "),
        });
      }

      const { userId, appVersion, platform } = parseResult.data;

      await storage.updateCrmUser(userId, {
        lastActiveAt: new Date(),
        appVersion,
        platform,
      });

      // Forward heartbeat to Admin Console (non-blocking)
      forwardToAdminConsole('/api/crm/heartbeat', { userId, appVersion, platform }).catch(() => {});

      res.json({ success: true });
    } catch (error) {
      console.error("Heartbeat error:", error);
      res.status(500).json({ success: false });
    }
  });

  // Sync vault metadata from mobile app
  app.post("/api/crm/vaults/sync", async (req, res) => {
    try {
      const { email, vaultCount, defaultVaultId, defaultVaultName, vaults } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, message: "Email required" });
      }

      // Find user by email
      const user = await storage.getCrmUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Update user with vault metadata
      // Store vault info as JSON in a metadata field or separate table
      // For now, we'll log this - in production, extend the schema
      console.log(`📦 Vault sync for ${email}:`, {
        vaultCount,
        defaultVaultId,
        defaultVaultName,
        vaults: vaults?.length || 0,
      });

      // Update last active time
      await storage.updateCrmUser(user.id, {
        lastActiveAt: new Date(),
      });

      res.json({ 
        success: true, 
        message: "Vaults synced",
        vaultCount,
      });
    } catch (error) {
      console.error("Vault sync error:", error);
      res.status(500).json({ success: false, message: "Sync failed" });
    }
  });

  // ============================================
  // Support Ticket Submission (from App)
  // ============================================

  app.post("/api/crm/tickets", async (req, res) => {
    try {
      const { email, subject, description, priority = "normal", category = "general" } = req.body;

      if (!email || !subject || !description) {
        return res.status(400).json({
          success: false,
          message: "email, subject, and description are required"
        });
      }

      // Find user by email
      const user = await storage.getCrmUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found. Please create a vault first." });
      }

      // Insert ticket into support_tickets table
      const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Use raw SQL for support_tickets since it's not in our Drizzle schema
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      await pool.query(`
        INSERT INTO support_tickets (id, user_id, subject, description, priority, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'open', NOW(), NOW())
      `, [ticketId, user.id, subject, description, priority]);

      // Log billing event for ticket creation
      await storage.logBillingEvent({
        userId: user.id,
        eventType: "support_ticket_created",
        platform: "app",
      });

      res.json({
        success: true,
        message: "Support ticket submitted successfully",
        ticketId,
      });
    } catch (error) {
      console.error("Ticket submission error:", error);
      res.status(500).json({ success: false, message: "Failed to submit ticket" });
    }
  });

  // Get user's tickets
  app.get("/api/crm/tickets/:email", async (req, res) => {
    try {
      const { email } = req.params;

      const user = await storage.getCrmUserByEmail(email);
      if (!user) {
        return res.json({ success: true, tickets: [] });
      }

      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      const result = await pool.query(`
        SELECT id, subject, description, status, priority, created_at, updated_at
        FROM support_tickets
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [user.id]);

      res.json({
        success: true,
        tickets: result.rows,
      });
    } catch (error) {
      console.error("Get tickets error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch tickets" });
    }
  });

  // Account deletion endpoint
  app.post("/api/account/delete", async (req, res) => {
    try {
      const { userId, email, deleteLocalData, reason, requestedAt } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "Email is required" });
      }

      const requestId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Forward to admin console for tracking
      forwardToAdminConsole('/api/public/customers/update', {
        email,
        status: 'deletion_requested',
      }).catch(() => {});

      // If user exists in CRM, log the event
      const user = await storage.getCrmUserByEmail(email);
      if (user) {
        await storage.logBillingEvent({
          userId: user.id,
          eventType: "account_deletion_requested",
          platform: "app",
        });
      }

      res.json({
        success: true,
        requestId,
        estimatedCompletionDays: 30,
        message: "Account deletion request submitted successfully",
      });
    } catch (error) {
      console.error("Account deletion error:", error);
      res.status(500).json({ success: false, message: "Failed to process deletion request" });
    }
  });

  app.get("/api/account/delete/status/:requestId", (req, res) => {
    res.json({
      requestId: req.params.requestId,
      status: "pending",
      requestedAt: new Date().toISOString(),
      deletedData: {
        crmRecord: false,
        subscriptions: false,
        supportTickets: false,
        activityLog: false,
        localVault: false,
      },
    });
  });

  // Proxy /api/public/* requests to admin console backend
  app.post("/api/public/customers/update", async (req, res) => {
    try {
      const result = await forwardToAdminConsole('/api/public/customers/update', req.body);
      if (result) {
        res.json(result);
      } else {
        res.json({ success: true, message: "Profile saved locally (admin console unavailable)" });
      }
    } catch (error) {
      console.error("Profile update proxy error:", error);
      res.json({ success: true, message: "Profile saved locally" });
    }
  });

  app.post("/api/public/customers/register", async (req, res) => {
    try {
      const result = await forwardToAdminConsole('/api/public/customers/register', req.body);
      if (result) {
        res.json(result);
      } else {
        res.json({ success: false, message: "Admin console unavailable" });
      }
    } catch (error) {
      console.error("Public register proxy error:", error);
      res.status(500).json({ success: false, message: "Registration proxy failed" });
    }
  });

  app.post("/api/public/tickets/create", async (req, res) => {
    try {
      const result = await forwardToAdminConsole('/api/public/tickets/create', req.body);
      if (result) {
        res.json(result);
      } else {
        res.json({ success: false, message: "Admin console unavailable" });
      }
    } catch (error) {
      console.error("Ticket create proxy error:", error);
      res.status(500).json({ success: false, message: "Ticket proxy failed" });
    }
  });

  // ============================================
  // Cloud Vault Auth + CRUD Routes
  // ============================================

  const JWT_SECRET = process.env.JWT_SECRET || 'ironvault-dev-secret';
  const JWT_EXPIRY = '30d';

  function signCloudToken(userId: string, email: string): string {
    return sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }

  function verifyCloudToken(token: string): { userId: string; email: string } | null {
    try {
      return verify(token, JWT_SECRET) as { userId: string; email: string };
    } catch {
      return null;
    }
  }

  const requireCloudAuth = (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required' });
    const payload = verifyCloudToken(auth.substring(7));
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
    req.cloudUser = payload;
    next();
  };

  // POST /api/auth/token — trust-on-first-use: stores hash if not set, verifies if set
  app.post('/api/auth/token', async (req, res) => {
    try {
      const { email, accountPasswordHash } = req.body;
      if (!email || !accountPasswordHash) {
        return res.status(400).json({ error: 'email and accountPasswordHash required' });
      }
      const normalizedEmail = email.toLowerCase().trim();
      let user = await storage.getCrmUserByEmail(normalizedEmail);
      if (!user) {
        // Auto-register minimal CRM user for cloud-only users
        user = await storage.createCrmUser({
          email: normalizedEmail,
          fullName: normalizedEmail.split('@')[0],
          country: 'US',
          marketingConsent: false,
          supportConsent: true,
        });
        await storage.createEntitlement({ userId: user.id, plan: 'free', status: 'active', trialActive: false, willRenew: false, adminOverride: false });
      }
      // Trust-on-first-use: store hash if not set; verify if already stored
      if (!user.accountPasswordHash) {
        await storage.updateCrmUserPasswordHash(user.id, accountPasswordHash);
      } else if (user.accountPasswordHash !== accountPasswordHash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = signCloudToken(user.id, normalizedEmail);
      res.json({ success: true, token, userId: user.id, email: normalizedEmail });
    } catch (err) {
      console.error('Auth token error:', err);
      res.status(500).json({ error: 'Auth failed' });
    }
  });

  // GET /api/vaults/cloud — list vaults (metadata only, no blob)
  app.get('/api/vaults/cloud', requireCloudAuth, async (req: any, res) => {
    try {
      const vaults = await storage.getCloudVaultsByUser(req.cloudUser.userId);
      res.json({ success: true, vaults: vaults.map(v => ({
        vaultId: v.vaultId, vaultName: v.vaultName, isDefault: v.isDefault,
        clientModifiedAt: v.clientModifiedAt?.toISOString(),
        serverUpdatedAt: v.serverUpdatedAt?.toISOString(),
        createdAt: v.createdAt?.toISOString(),
      }))});
    } catch (err) {
      res.status(500).json({ error: 'Failed to list vaults' });
    }
  });

  // GET /api/vaults/cloud/:vaultId — download blob
  app.get('/api/vaults/cloud/:vaultId', requireCloudAuth, async (req: any, res) => {
    try {
      const vault = await storage.getCloudVault(req.cloudUser.userId, req.params.vaultId);
      if (!vault) return res.status(404).json({ error: 'Vault not found' });
      res.json({ success: true, vault: {
        vaultId: vault.vaultId, vaultName: vault.vaultName, isDefault: vault.isDefault,
        encryptedBlob: vault.encryptedBlob,
        clientModifiedAt: vault.clientModifiedAt?.toISOString(),
        serverUpdatedAt: vault.serverUpdatedAt?.toISOString(),
      }});
    } catch (err) {
      res.status(500).json({ error: 'Failed to get vault' });
    }
  });

  // POST /api/vaults/cloud — create vault (plan-gated: Free = max 0 cloud vaults)
  app.post('/api/vaults/cloud', requireCloudAuth, async (req: any, res) => {
    try {
      const { vaultId, vaultName, encryptedBlob, isDefault = false, clientModifiedAt } = req.body;
      if (!vaultId || !vaultName || !encryptedBlob) {
        return res.status(400).json({ error: 'vaultId, vaultName, encryptedBlob required' });
      }
      // Plan check: free users cannot create cloud vaults
      const entitlement = await storage.getEntitlement(req.cloudUser.userId);
      const plan = entitlement?.plan || 'free';
      if (plan === 'free') {
        return res.status(403).json({ error: 'Cloud vaults require a Pro or Lifetime plan', code: 'PLAN_UPGRADE_REQUIRED' });
      }
      // Check for duplicate vaultId
      const existing = await storage.getCloudVault(req.cloudUser.userId, vaultId);
      if (existing) {
        return res.status(409).json({ error: 'Vault already exists in cloud. Use PUT to update.' });
      }
      const vault = await storage.createCloudVault({
        userId: req.cloudUser.userId, vaultId, vaultName, encryptedBlob,
        isDefault, clientModifiedAt: clientModifiedAt ? new Date(clientModifiedAt) : new Date(),
      });
      if (isDefault) await storage.setCloudVaultDefault(req.cloudUser.userId, vaultId);
      res.json({ success: true, vault: {
        vaultId: vault.vaultId, vaultName: vault.vaultName, isDefault: vault.isDefault,
        serverUpdatedAt: vault.serverUpdatedAt?.toISOString(),
      }});
    } catch (err) {
      console.error('Cloud vault create error:', err);
      res.status(500).json({ error: 'Failed to create cloud vault' });
    }
  });

  // PUT /api/vaults/cloud/:vaultId — sync update (last-write-wins)
  app.put('/api/vaults/cloud/:vaultId', requireCloudAuth, async (req: any, res) => {
    try {
      const { encryptedBlob, vaultName, isDefault, clientModifiedAt } = req.body;
      if (!encryptedBlob) return res.status(400).json({ error: 'encryptedBlob required' });
      const existing = await storage.getCloudVault(req.cloudUser.userId, req.params.vaultId);
      if (!existing) return res.status(404).json({ error: 'Vault not found' });
      // Plan check for updates: free users are read-only
      const entitlement = await storage.getEntitlement(req.cloudUser.userId);
      const plan = entitlement?.plan || 'free';
      if (plan === 'free') {
        return res.status(403).json({ error: 'Cloud vault sync requires Pro or Lifetime plan', code: 'PLAN_UPGRADE_REQUIRED' });
      }
      // Last-write-wins: accept if clientModifiedAt is newer than stored
      const incomingTs = clientModifiedAt ? new Date(clientModifiedAt) : new Date();
      const storedTs = existing.clientModifiedAt;
      if (storedTs && incomingTs < storedTs) {
        // Server has newer data — return it for client to merge
        return res.json({ success: true, merged: false, serverNewer: true, vault: {
          vaultId: existing.vaultId, encryptedBlob: existing.encryptedBlob,
          clientModifiedAt: existing.clientModifiedAt?.toISOString(),
          serverUpdatedAt: existing.serverUpdatedAt?.toISOString(),
        }});
      }
      const updated = await storage.updateCloudVault(req.cloudUser.userId, req.params.vaultId, {
        encryptedBlob,
        ...(vaultName && { vaultName }),
        ...(isDefault !== undefined && { isDefault }),
        clientModifiedAt: incomingTs,
      });
      if (isDefault) await storage.setCloudVaultDefault(req.cloudUser.userId, req.params.vaultId);
      res.json({ success: true, merged: true, vault: {
        vaultId: updated?.vaultId, serverUpdatedAt: updated?.serverUpdatedAt?.toISOString(),
      }});
    } catch (err) {
      console.error('Cloud vault update error:', err);
      res.status(500).json({ error: 'Failed to update cloud vault' });
    }
  });

  // DELETE /api/vaults/cloud/:vaultId
  app.delete('/api/vaults/cloud/:vaultId', requireCloudAuth, async (req: any, res) => {
    try {
      const deleted = await storage.deleteCloudVault(req.cloudUser.userId, req.params.vaultId);
      if (!deleted) return res.status(404).json({ error: 'Vault not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete vault' });
    }
  });

  // PATCH /api/vaults/cloud/:vaultId/default
  app.patch('/api/vaults/cloud/:vaultId/default', requireCloudAuth, async (req: any, res) => {
    try {
      const vault = await storage.getCloudVault(req.cloudUser.userId, req.params.vaultId);
      if (!vault) return res.status(404).json({ error: 'Vault not found' });
      await storage.setCloudVaultDefault(req.cloudUser.userId, req.params.vaultId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to set default' });
    }
  });

  // ============================================
  // Razorpay Payment Endpoints
  // ============================================

  const RAZORPAY_PLAN_CONFIG: Record<string, { amount: number; currency: string; tier: string; isLifetime: boolean; periodMonths: number }> = {
    pro_monthly:       { amount: 14900,  currency: 'INR', tier: 'pro',      isLifetime: false, periodMonths: 1  },
    pro_yearly:        { amount: 149900, currency: 'INR', tier: 'pro',      isLifetime: false, periodMonths: 12 },
    pro_family:        { amount: 29900,  currency: 'INR', tier: 'family',   isLifetime: false, periodMonths: 1  },
    pro_family_yearly: { amount: 299900, currency: 'INR', tier: 'family',   isLifetime: false, periodMonths: 12 },
    lifetime:          { amount: 999900, currency: 'INR', tier: 'lifetime', isLifetime: true,  periodMonths: 0  },
  };

  // POST /api/payments/create-order
  app.post('/api/payments/create-order', async (req: any, res: any) => {
    try {
      const { plan, email } = req.body;
      if (!plan || !RAZORPAY_PLAN_CONFIG[plan]) {
        return res.status(400).json({ error: 'Invalid plan' });
      }
      const cfg = RAZORPAY_PLAN_CONFIG[plan];
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RazorpayClient = require('razorpay');
      const rzp = new RazorpayClient({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const order = await rzp.orders.create({
        amount: cfg.amount,
        currency: cfg.currency,
        receipt: `iv_${plan}_${Date.now()}`,
        notes: { email: email || '', plan },
      });
      res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
    } catch (err: any) {
      console.error('[Razorpay] create-order error:', err);
      res.status(500).json({ error: err.message || 'Failed to create order' });
    }
  });

  // POST /api/payments/verify
  app.post('/api/payments/verify', async (req: any, res: any) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, email } = req.body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const expectedSig = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (expectedSig !== razorpay_signature) {
        console.warn('[Razorpay] Signature mismatch for payment:', razorpay_payment_id);
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      const cfg = RAZORPAY_PLAN_CONFIG[plan];
      if (!cfg) return res.status(400).json({ error: 'Invalid plan' });

      const crmUser = await storage.getCrmUserByEmail(email);
      if (!crmUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const now = new Date();
      let periodEndsAt: Date | null = null;
      if (!cfg.isLifetime) {
        periodEndsAt = new Date(now);
        periodEndsAt.setMonth(periodEndsAt.getMonth() + cfg.periodMonths);
      }

      await storage.updateEntitlement(crmUser.id, {
        plan: cfg.tier,
        status: 'active',
        trialActive: false,
        trialEndsAt: null,
        currentPeriodEndsAt: periodEndsAt,
        willRenew: !cfg.isLifetime,
        subscriptionPlatform: 'razorpay',
        subscriptionId: razorpay_payment_id,
      });

      await storage.logBillingEvent({
        userId: crmUser.id,
        eventType: 'payment_success',
        platform: 'zoho_billing',
        subscriptionId: razorpay_payment_id,
        productId: plan,
      });

      console.log(`[Razorpay] Payment verified: ${email} → ${cfg.tier} (${plan})`);
      res.json({ success: true, plan: cfg.tier });
    } catch (err: any) {
      console.error('[Razorpay] verify error:', err);
      res.status(500).json({ error: err.message || 'Verification failed' });
    }
  });

  // ============================================
  // Zoho Billing Webhook
  // POST /api/webhooks/zoho-billing
  // ============================================

  // Map Zoho plan codes → internal tier names
  const ZOHO_PLAN_TO_TIER: Record<string, string> = {
    'ironvault-pro-monthly': 'pro',
    'ironvault-pro-yearly': 'pro',
    'ironvault-pro-family': 'family',
    'ironvault-pro-family-yearly': 'family',
    'ironvault-lifetime': 'lifetime',
  };

  app.post('/api/webhooks/zoho-billing', async (req: any, res: any) => {
    try {
      // Optional token verification (set ZOHO_BILLING_WEBHOOK_TOKEN in Vercel env)
      const expectedToken = process.env.ZOHO_BILLING_WEBHOOK_TOKEN;
      if (expectedToken) {
        const incoming = req.headers['x-zoho-webhook-token'] || req.query.token;
        if (incoming !== expectedToken) {
          console.warn('[ZohoBilling] Invalid webhook token');
          return res.status(401).json({ error: 'Invalid token' });
        }
      }

      const { event_type, data } = req.body;
      console.log('[ZohoBilling] Webhook received:', event_type);

      if (!event_type || !data) {
        return res.status(400).json({ error: 'Missing event_type or data' });
      }

      const sub = data.subscription;
      if (!sub) return res.json({ received: true, skipped: true });

      const customerEmail = sub.customer?.email || sub.email;
      const planCode = sub.plan?.plan_code || sub.plan_code;
      const subId = sub.subscription_id;
      const periodEndsAt = sub.current_term_ends_at ? new Date(sub.current_term_ends_at) : undefined;

      if (!customerEmail) {
        console.warn('[ZohoBilling] No customer email in payload');
        return res.json({ received: true, skipped: true });
      }

      // Find user in our DB
      const crmUser = await storage.getCrmUserByEmail(customerEmail);
      if (!crmUser) {
        console.warn('[ZohoBilling] No user found for email:', customerEmail);
        return res.json({ received: true, user_not_found: true });
      }

      switch (event_type) {
        case 'subscription_created':
        case 'subscription_activated':
        case 'subscription_renewed':
        case 'payment_success': {
          const tier = ZOHO_PLAN_TO_TIER[planCode] || 'pro';
          const isLifetime = planCode === 'ironvault-lifetime';
          await storage.updateEntitlement(crmUser.id, {
            plan: tier,
            status: 'active',
            trialActive: false,
            trialEndsAt: null,
            currentPeriodEndsAt: isLifetime ? null : (periodEndsAt || null),
            willRenew: !isLifetime,
            subscriptionPlatform: 'zoho_billing',
            subscriptionId: subId || null,
          });
          console.log(`[ZohoBilling] Upgraded ${customerEmail} → ${tier} (${planCode})`);

          // Log the billing event
          await storage.logBillingEvent({
            userId: crmUser.id,
            eventType: event_type,
            platform: 'zoho_billing',
            subscriptionId: subId || undefined,
            productId: planCode || undefined,
          });
          break;
        }

        case 'subscription_upgraded':
        case 'subscription_downgraded': {
          // Plan change — new plan_code is in the payload
          const newTier = ZOHO_PLAN_TO_TIER[planCode] || 'pro';
          const isLifetime = planCode === 'ironvault-lifetime';
          await storage.updateEntitlement(crmUser.id, {
            plan: newTier,
            status: 'active',
            trialActive: false,
            trialEndsAt: null,
            currentPeriodEndsAt: isLifetime ? null : (periodEndsAt || null),
            willRenew: !isLifetime,
            subscriptionPlatform: 'zoho_billing',
            subscriptionId: subId || null,
          });
          console.log(`[ZohoBilling] Plan changed ${customerEmail} → ${newTier} (${planCode})`);
          await storage.logBillingEvent({
            userId: crmUser.id,
            eventType: event_type,
            platform: 'zoho_billing',
            subscriptionId: subId || undefined,
            productId: planCode || undefined,
          });
          break;
        }

        case 'subscription_cancelled':
        case 'subscription_expired': {
          await storage.updateEntitlement(crmUser.id, {
            plan: 'free',
            status: 'cancelled',
            willRenew: false,
            subscriptionPlatform: 'zoho_billing',
          });
          console.log(`[ZohoBilling] Cancelled/expired → downgraded ${customerEmail} to free`);

          await storage.logBillingEvent({
            userId: crmUser.id,
            eventType: event_type,
            platform: 'zoho_billing',
            subscriptionId: subId || undefined,
            productId: planCode || undefined,
          });
          break;
        }

        default:
          console.log('[ZohoBilling] Unhandled event:', event_type);
      }

      return res.json({ received: true });
    } catch (err: any) {
      console.error('[ZohoBilling] Webhook error:', err);
      return res.status(500).json({ error: err.message || 'Webhook processing failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
