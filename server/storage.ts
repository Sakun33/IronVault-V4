import { type User, type InsertUser, type CrmUser, type InsertCrmUser, type Entitlement, type InsertEntitlement, type BillingEvent, type InsertBillingEvent, crmUsers, entitlements, billingEvents } from "../shared/schema";
import { randomUUID } from "crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // CRM operations
  getCrmUser(id: string): Promise<CrmUser | undefined>;
  getCrmUserByEmail(email: string): Promise<CrmUser | undefined>;
  createCrmUser(data: InsertCrmUser): Promise<CrmUser>;
  updateCrmUser(id: string, data: Partial<InsertCrmUser>): Promise<CrmUser | undefined>;
  
  // Entitlements
  getEntitlement(userId: string): Promise<Entitlement | undefined>;
  createEntitlement(data: InsertEntitlement): Promise<Entitlement>;
  updateEntitlement(userId: string, data: Partial<InsertEntitlement>): Promise<Entitlement | undefined>;
  
  // Billing events
  logBillingEvent(data: InsertBillingEvent): Promise<BillingEvent>;
}

// Database storage using Drizzle
export class DatabaseStorage implements IStorage {
  private db!: PostgresJsDatabase;
  private users: Map<string, User>;
  private ready: Promise<void>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for database storage");
    }

    this.users = new Map(); // In-memory for legacy user table
    // Lazy-import postgres and drizzle to avoid bundling issues on Vercel
    this.ready = this.init();
  }

  private async init() {
    const pg = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = pg(process.env.DATABASE_URL!);
    this.db = drizzle(client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // CRM User operations
  async getCrmUser(id: string): Promise<CrmUser | undefined> {
    await this.ensureReady();
    const result = await this.db.select().from(crmUsers).where(eq(crmUsers.id, id)).limit(1);
    return result[0];
  }

  async getCrmUserByEmail(email: string): Promise<CrmUser | undefined> {
    await this.ensureReady();
    const result = await this.db.select().from(crmUsers).where(eq(crmUsers.email, email.toLowerCase())).limit(1);
    return result[0];
  }

  async createCrmUser(data: InsertCrmUser): Promise<CrmUser> {
    await this.ensureReady();
    const result = await this.db.insert(crmUsers).values({
      ...data,
      email: data.email.toLowerCase(),
    }).returning();
    return result[0];
  }

  async updateCrmUser(id: string, data: Partial<InsertCrmUser>): Promise<CrmUser | undefined> {
    await this.ensureReady();
    const result = await this.db.update(crmUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crmUsers.id, id))
      .returning();
    return result[0];
  }

  // Entitlement operations
  async getEntitlement(userId: string): Promise<Entitlement | undefined> {
    await this.ensureReady();
    const result = await this.db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
    return result[0];
  }

  async createEntitlement(data: InsertEntitlement): Promise<Entitlement> {
    await this.ensureReady();
    const result = await this.db.insert(entitlements).values(data).returning();
    return result[0];
  }

  async updateEntitlement(userId: string, data: Partial<InsertEntitlement>): Promise<Entitlement | undefined> {
    await this.ensureReady();
    const result = await this.db.update(entitlements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(entitlements.userId, userId))
      .returning();
    return result[0];
  }

  // Billing event operations
  async logBillingEvent(data: InsertBillingEvent): Promise<BillingEvent> {
    await this.ensureReady();
    const insertData = {
      eventType: data.eventType,
      platform: data.platform,
      userId: data.userId,
      subscriptionId: data.subscriptionId,
      productId: data.productId,
      amount: data.amount ? String(data.amount) : undefined,
      currency: data.currency,
      rawEvent: data.rawEvent,
    };
    const result = await this.db.insert(billingEvents).values(insertData).returning();
    return result[0];
  }
}

// Memory storage for development/testing
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private crmUsersMap: Map<string, CrmUser>;
  private entitlementsMap: Map<string, Entitlement>;
  private billingEventsMap: Map<string, BillingEvent>;

  constructor() {
    this.users = new Map();
    this.crmUsersMap = new Map();
    this.entitlementsMap = new Map();
    this.billingEventsMap = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCrmUser(id: string): Promise<CrmUser | undefined> {
    return this.crmUsersMap.get(id);
  }

  async getCrmUserByEmail(email: string): Promise<CrmUser | undefined> {
    return Array.from(this.crmUsersMap.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createCrmUser(data: InsertCrmUser): Promise<CrmUser> {
    const id = randomUUID();
    const user: CrmUser = {
      id,
      email: data.email.toLowerCase(),
      fullName: data.fullName,
      country: data.country,
      phone: data.phone || null,
      marketingConsent: data.marketingConsent ?? false,
      supportConsent: data.supportConsent ?? true,
      vaultCreatedAt: data.vaultCreatedAt || null,
      lastActiveAt: data.lastActiveAt || null,
      appVersion: data.appVersion || null,
      platform: data.platform || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.crmUsersMap.set(id, user);
    return user;
  }

  async updateCrmUser(id: string, data: Partial<InsertCrmUser>): Promise<CrmUser | undefined> {
    const existing = this.crmUsersMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.crmUsersMap.set(id, updated);
    return updated;
  }

  async getEntitlement(userId: string): Promise<Entitlement | undefined> {
    return Array.from(this.entitlementsMap.values()).find(
      (ent) => ent.userId === userId,
    );
  }

  async createEntitlement(data: InsertEntitlement): Promise<Entitlement> {
    const id = randomUUID();
    const entitlement: Entitlement = {
      id,
      userId: data.userId || null,
      plan: data.plan || 'free',
      status: data.status || 'active',
      trialActive: data.trialActive ?? false,
      trialEndsAt: data.trialEndsAt || null,
      subscriptionPlatform: data.subscriptionPlatform || null,
      subscriptionId: data.subscriptionId || null,
      productId: data.productId || null,
      currentPeriodEndsAt: data.currentPeriodEndsAt || null,
      willRenew: data.willRenew ?? true,
      cancelledAt: data.cancelledAt || null,
      adminOverride: data.adminOverride ?? false,
      adminOverrideBy: data.adminOverrideBy || null,
      adminOverrideReason: data.adminOverrideReason || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.entitlementsMap.set(id, entitlement);
    return entitlement;
  }

  async updateEntitlement(userId: string, data: Partial<InsertEntitlement>): Promise<Entitlement | undefined> {
    const existing = Array.from(this.entitlementsMap.values()).find(
      (ent) => ent.userId === userId,
    );
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.entitlementsMap.set(existing.id, updated);
    return updated;
  }

  async logBillingEvent(data: InsertBillingEvent): Promise<BillingEvent> {
    const id = randomUUID();
    const event: BillingEvent = {
      id,
      userId: data.userId || null,
      eventType: data.eventType,
      platform: data.platform,
      subscriptionId: data.subscriptionId || null,
      productId: data.productId || null,
      amount: data.amount ? String(data.amount) : null,
      currency: data.currency || null,
      rawEvent: data.rawEvent || null,
      createdAt: new Date(),
    };
    this.billingEventsMap.set(id, event);
    return event;
  }
}

// Use memory storage for local development, database storage for production
// In development, the admin console (port 3001) is the source of truth for CRM data
function createStorage(): IStorage {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    try {
      console.log('📦 Using database storage (production)');
      return new DatabaseStorage();
    } catch (error) {
      console.warn('⚠️ Database storage failed, falling back to memory storage:', (error as Error).message);
      return new MemStorage();
    }
  }
  console.log('📦 Using in-memory storage (development)');
  return new MemStorage();
}

export const storage: IStorage = createStorage();
