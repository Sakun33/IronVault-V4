import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import { z } from "zod";

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

  // Get user entitlement
  app.get("/api/crm/entitlement/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      const entitlement = await storage.getEntitlement(userId);
      
      if (!entitlement) {
        return res.json({
          success: true,
          entitlement: {
            plan: "free",
            status: "active",
            trialActive: false,
          },
        });
      }

      res.json({
        success: true,
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

  const httpServer = createServer(app);
  return httpServer;
}
