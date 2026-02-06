import {
  users,
  deals,
  businessTypes,
  billUploads,
  commissionPayments,
  leads,
  leadInteractions,
  contacts,
  contactInteractions,
  opportunities,
  opportunityInteractions,
  emailCommunications,
  partners,
  partnerReviews,
  notifications,
  dealMessages,
  rates,
  commissionApprovals,
  invoices,
  audits,
  requestLogs,
  webhookLogs,
  adminAuditLogs,
  waitlist,
  partnerHierarchy,
  pushSubscriptions,
  quotes,
  businessOwners,
  businessDetails,
  type User,
  type UpsertUser,
  type Audit,
  type InsertAudit,
  type RequestLog,
  type InsertRequestLog,
  type WebhookLog,
  type InsertWebhookLog,
  type InsertDeal,
  type Deal,
  type BusinessType,
  type BillUpload,
  type Contact,
  type InsertContact,
  type ContactInteraction,
  type InsertContactInteraction,
  type Opportunity,
  type InsertOpportunity,
  type OpportunityInteraction,
  type InsertOpportunityInteraction,
  type EmailCommunication,
  type InsertEmailCommunication,
  type Notification,
  type InsertNotification,
  type InsertRate,
  type Rate,
  type InsertCommissionApproval,
  type CommissionApproval,
  type InsertInvoice,
  type Invoice,
  type InsertAdminAuditLog,
  type AdminAuditLog,
  type Waitlist,
  type InsertWaitlist,
  type PushSubscription,
  type InsertPushSubscription,
  mapDealStageToCustomerJourney,
  accountingIntegrations,
  type AccountingIntegration,
  type InsertAccountingIntegration,
} from "@shared/schema";
import { googleSheetsService, type DealSheetData } from "./googleSheets";
import { db } from "./db";
import { eq, desc, and, sql, gte, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations - Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser, referralCode?: string): Promise<User>;
  createUserWithCredentials(email: string, password: string, userData: Partial<UpsertUser>, referralCode?: string): Promise<User>;
  verifyLogin(email: string, password: string): Promise<User | null>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  setupReferralHierarchy(newUserId: string, referrerUserId: string): Promise<void>;

  // Business type operations
  getBusinessTypes(): Promise<BusinessType[]>;
  seedBusinessTypes(): Promise<void>;

  // Deal operations
  createDeal(deal: InsertDeal): Promise<Deal>;
  getDealById(id: string): Promise<Deal | undefined>;
  getDealsByUserId(userId: string): Promise<Deal[]>;
  getDealsWithQuotes(userId: string): Promise<any[]>;
  updateDealStatus(id: string, status: string): Promise<void>;
  searchBusinessNames(userId: string, query: string): Promise<Array<{
    businessName: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }>>;

  // Dashboard stats
  getUserStats(userId: string): Promise<{
    dealsSubmitted: number;
    commissionPending: number;
    totalDeals: number;
    totalValueEarned: number;
  }>;

  // Bill upload operations
  createBillUpload(businessName: string, fileName: string, fileSize: number, mimeType?: string, fileContent?: string): Promise<BillUpload>;
  getBillUploadById(billId: string): Promise<BillUpload | undefined>;
  getBillUploadsByBusinessName(businessName: string): Promise<BillUpload[]>;

  // Partner ID operations
  generatePartnerId(userId: string, parentPartnerId?: string): Promise<string>;
  getUserByPartnerId(partnerId: string): Promise<User | undefined>;

  // MLM level tracking operations
  calculateReferralLevel(referrerId: string): Promise<number>;
  getCommissionPercentage(level: number): number;
  getMlmHierarchy(userId: string): Promise<{ children: User[]; parents: User[]; level: number }>;
  getDealsByLevel(userId: string): Promise<{ [key: number]: Deal[] }>;
  createDealWithLevel(dealData: InsertDeal, referrerId: string): Promise<Deal>;

  // Admin operations
  getAdminStats(): Promise<{
    totalUsers: number;
    totalDeals: number;
    pendingDeals: number;
    totalCommissions: number;
  }>;
  getAllUsers(): Promise<User[]>;
  getAllDeals(): Promise<Deal[]>;
  updateUser(userId: string, data: Partial<User>): Promise<User>;
  updateDeal(dealId: string, data: Partial<Deal>): Promise<Deal>;

  // Admin audit logging
  createAdminAuditLog(auditLog: InsertAdminAuditLog): Promise<AdminAuditLog>;
  getAdminAuditLogs(limit?: number): Promise<AdminAuditLog[]>;

  // Contacts operations
  createContact(contact: InsertContact): Promise<Contact>;
  getContactsByUserId(userId: string): Promise<Contact[]>;
  getContactById(contactId: string, userId: string): Promise<Contact | undefined>;
  updateContact(contactId: string, userId: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(contactId: string, userId: string): Promise<void>;
  addContactInteraction(contactId: string, userId: string, interaction: InsertContactInteraction): Promise<ContactInteraction>;
  getContactInteractions(contactId: string, userId: string): Promise<ContactInteraction[]>;

  // Opportunities operations
  createOpportunity(opportunity: InsertOpportunity): Promise<Opportunity>;
  getOpportunitiesByUserId(userId: string): Promise<Opportunity[]>;
  getOpportunityById(opportunityId: string, userId: string): Promise<Opportunity | undefined>;
  updateOpportunity(opportunityId: string, userId: string, updates: Partial<InsertOpportunity>): Promise<Opportunity>;
  deleteOpportunity(opportunityId: string, userId: string): Promise<void>;
  addOpportunityInteraction(opportunityId: string, userId: string, interaction: InsertOpportunityInteraction): Promise<OpportunityInteraction>;
  getOpportunityInteractions(opportunityId: string, userId: string): Promise<OpportunityInteraction[]>;

  // Email communications operations
  createEmailCommunication(email: InsertEmailCommunication): Promise<EmailCommunication>;
  getEmailCommunicationsByContact(contactId: string): Promise<EmailCommunication[]>;
  getEmailCommunicationsByOpportunity(opportunityId: string): Promise<EmailCommunication[]>;
  syncOutlookEmails(partnerId: string): Promise<void>;

  // Leads operations (legacy)
  createLead(lead: any): Promise<any>;
  createLeadsBulk(leads: any[]): Promise<{ count: number }>;
  getLeadsByUserId(userId: string): Promise<any[]>;
  updateLeadStatus(leadId: string, status: string): Promise<any>;
  addLeadInteraction(leadId: string, interaction: any): Promise<any>;

  // Partner operations  
  getPartners(): Promise<any[]>;
  getPartnerBySlug(slug: string): Promise<any>;
  seedPartners(): Promise<void>;

  // Notification operations
  getNotificationsByUserId(userId: string): Promise<any[]>;
  createNotification(notification: any): Promise<any>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Deal messages operations
  getDealMessages(dealId: string): Promise<any[]>;
  getDealMessagesByType(dealId: string, messageType: string): Promise<any[]>;
  createDealMessage(message: any): Promise<any>;
  getUnifiedDealMessages(dealId: string): Promise<any[]>;

  // Push subscription operations
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined>;
  getUserPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  updatePushSubscription(id: string, updates: Partial<InsertPushSubscription>): Promise<PushSubscription>;
  deletePushSubscription(id: string): Promise<void>;

  // Rates management operations
  getRates(): Promise<Rate[]>;
  createRate(rate: InsertRate): Promise<Rate>;
  updateRate(id: string, rate: Partial<InsertRate>): Promise<Rate>;
  deleteRate(id: string): Promise<void>;
  seedRates(): Promise<void>;

  // Commission approval operations
  createCommissionApproval(approval: InsertCommissionApproval): Promise<CommissionApproval>;
  getCommissionApprovalsByUserId(userId: string): Promise<CommissionApproval[]>;
  getAllCommissionApprovals(): Promise<CommissionApproval[]>;
  updateCommissionApprovalStatus(approvalId: string, status: string): Promise<CommissionApproval>;
  processCommissionPayment(approvalId: string, paymentReference: string): Promise<void>;
  distributeUplineCommissions(dealId: string, totalCommission: number, paymentReference: string, paymentMethod: string): Promise<CommissionApproval[]>;

  // Payment verification operations (2FA)
  createPaymentVerificationCode(verificationData: InsertPaymentVerificationCode): Promise<PaymentVerificationCode>;
  getPaymentVerificationCode(dealId: string, code: string): Promise<PaymentVerificationCode | undefined>;
  markVerificationCodeAsUsed(verificationId: string): Promise<void>;
  checkDealPaymentLock(dealId: string): Promise<boolean>; // Returns true if payment is locked/in-progress

  // Audit trail operations
  createAudit(auditData: InsertAudit): Promise<Audit>;
  getAudits(limit?: number): Promise<Audit[]>;
  getUserAudits(userId: string, limit?: number): Promise<Audit[]>;

  // Request logs operations
  createRequestLog(logData: InsertRequestLog): Promise<RequestLog>;
  getRequestLogs(limit?: number): Promise<RequestLog[]>;
  getErrorLogs(limit?: number): Promise<RequestLog[]>;

  // Webhook logs operations
  createWebhookLog(logData: InsertWebhookLog): Promise<WebhookLog>;
  getWebhookLogs(limit?: number): Promise<WebhookLog[]>;
  getFailedWebhooks(): Promise<WebhookLog[]>;

  // Waitlist operations
  createWaitlistEntry(waitlistData: InsertWaitlist): Promise<Waitlist>;
  getWaitlistEntries(): Promise<Waitlist[]>;
  getWaitlistEntryByEmail(email: string): Promise<Waitlist | undefined>;
  updateWaitlistStatus(id: string, status: string): Promise<Waitlist>;

  // Team referral statistics operations
  getTeamReferralStats(userId: string): Promise<{
    sent: number;
    opened: number;
    clicked: number;
    registered: number;
    active: number;
  }>;
  getTeamReferrals(userId: string): Promise<Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    joinedAt: Date;
    referralCode: string | null;
    hasSubmittedDeals: number;
  }>>;
  getProgressionData(userId: string): Promise<{
    partnerLevel: string;
    teamSize: number;
    totalRevenue: number;
    directRevenue: number;
    overrideRevenue: number;
    totalInvites: number;
    successfulInvites: number;
  }>;

  // Quotes operations
  getQuotesByUserId(userId: string): Promise<any[]>;
  getAllQuotesForAdmin(): Promise<any[]>;
  getQuoteById(quoteId: string): Promise<any | undefined>;
  updateQuoteJourneyStatus(quoteId: string, status: string): Promise<void>;
  addQuoteQuestion(quoteId: string, question: string): Promise<void>;
  addQuoteRateRequest(quoteId: string, request: string): Promise<void>;
  approveQuoteByPartner(quoteId: string): Promise<{ referralId: string } | null>;
  sendQuoteToClient(quoteId: string): Promise<{ referralId: string } | null>;
  saveQuoteSignupInfo(quoteId: string, dealId: string, signupData: any): Promise<void>;
  getPendingSignups(): Promise<any[]>;
  getCompletedDeals(): Promise<any[]>;
  getSignupDetails(quoteId: string): Promise<any>;
  getSignupDetailsByDealId(dealId: string): Promise<any>;
  updateQuoteCommission(quoteId: string, estimatedCommission: number): Promise<void>;
  updateQuoteBusinessType(quoteId: string, businessType: string, billUploadRequired: boolean): Promise<void>;
  recordCommissionPayment(quoteId: string, stripePaymentId: string): Promise<void>;

  // Quote Q&A operations
  addQuoteQAMessage(quoteId: string, authorType: string, authorId: string | null, message: string): Promise<any>;
  getQuoteQA(quoteId: string): Promise<any[]>;
  getAllQuoteMessages(): Promise<any[]>;
  getAllUnifiedMessages(): Promise<any[]>;

  // Quote bill upload operations
  createQuoteBillUpload(quoteId: string, dealId: string, fileName: string, fileSize: number, fileType: string, uploadedBy: string, documentType?: string, fileData?: string): Promise<any>;
  getQuoteBillUploads(quoteId: string): Promise<any[]>;
  getQuoteBillUploadById(billId: string): Promise<any | undefined>;
  approveQuoteBill(billId: string, adminNotes?: string): Promise<void>;
  rejectQuoteBill(billId: string, adminNotes: string): Promise<void>;

  // Invoice operations
  createInvoice(quoteId: string, partnerId: string, amount: number, businessName?: string, dealId?: string): Promise<any>;
  getInvoicesByPartnerId(partnerId: string): Promise<any[]>;
  getAllInvoices(): Promise<any[]>;
  getInvoiceById(invoiceId: string): Promise<any | undefined>;
  addInvoiceQuery(invoiceId: string, queryNotes: string): Promise<void>;
  markInvoiceAsPaid(invoiceId: string, paymentReference: string, adminNotes?: string): Promise<void>;
  updateInvoiceStatus(invoiceId: string, status: string): Promise<void>;

  // Commission payment operations
  getCommissionPaymentsByRecipient(recipientId: string): Promise<any[]>;
  getCommissionPaymentsByDeal(dealId: string): Promise<any[]>;
  getTeamCommissionPayments(userId: string): Promise<any[]>;
  updateCommissionPaymentApproval(paymentId: string, approvalStatus: string, queryNotes: string | null): Promise<any>;
  getDownlineUsers(userId: string): Promise<any[]>;
  createCommissionPayment(paymentData: any): Promise<any>;

  // Test data seeding
  seedTestDeals(): Promise<void>;

  // Accounting integrations operations
  getAccountingIntegrations(userId: string): Promise<any[]>;
  getAccountingIntegrationByProvider(userId: string, provider: string): Promise<any | undefined>;
  createAccountingIntegration(integrationData: any): Promise<any>;
  updateAccountingIntegration(integrationId: string, updates: any): Promise<any>;
  deleteAccountingIntegration(integrationId: string): Promise<void>;
  findIntegrationByState(state: string): Promise<any | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isAdmin, true));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user;
  }

  async createUserWithCredentials(
    email: string,
    password: string,
    userData: Partial<UpsertUser>,
    referralCode?: string
  ): Promise<User> {
    const bcrypt = await import('bcrypt');
    const crypto = await import('crypto');

    // Check if email already exists
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error('Email already registered');
    }

    // Validate password strength (min 8 chars, at least 1 letter and 1 number)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one letter and one number');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // In development, auto-verify emails for testing convenience
    const isDevelopment = process.env.NODE_ENV === 'development';
    const emailVerified = isDevelopment ? true : false;

    if (isDevelopment) {
      console.log('[AUTH] ⚠️  Development mode: Auto-verifying email for', email);
    }

    // Create user
    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      emailVerified,
      verificationToken,
      ...userData,
    }).returning();

    console.log('[AUTH] New user created:', user.id, user.email);

    // Setup referral hierarchy if referral code provided
    let referrerPartnerId: string | undefined;
    if (referralCode) {
      console.log('[AUTH] Setting up referral hierarchy for:', user.email);
      try {
        const referrer = await this.getUserByReferralCode(referralCode);
        if (referrer && referrer.id !== user.id) {
          referrerPartnerId = referrer.partnerId;
          await this.setupReferralHierarchy(user.id, referrer.id);
          console.log('[AUTH] Referral hierarchy created successfully');
        }
      } catch (error) {
        console.error('[AUTH] Error setting up referral hierarchy:', error);
      }
    }

    // Generate partner ID and referral code (with parent context if available)
    if (!user.partnerId || !user.referralCode) {
      await this.generatePartnerId(user.id, referrerPartnerId);
    }

    // Send verification email via GHL
    const { ghlEmailService } = await import('./ghlEmailService');
    await ghlEmailService.sendEmailVerification(
      user.email!,
      verificationToken,
      userData.firstName || undefined,
      userData.lastName || undefined
    );

    return await this.getUser(user.id) as User;
  }

  async verifyLogin(email: string, password: string): Promise<User | null> {
    const bcrypt = await import('bcrypt');

    const user = await this.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    return user;
  }

  async upsertUser(userData: UpsertUser, referralCode?: string): Promise<User> {
    // Check for existing user by ID first
    let existingUser = await this.getUser(userData.id);

    // If no user by ID, check by email (to handle email unique constraint)
    if (!existingUser && userData.email) {
      const [userByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      existingUser = userByEmail;
    }

    const isNewUser = !existingUser;

    let result;
    if (existingUser) {
      // Update existing user - preserve the original ID to maintain foreign key relationships
      const { id, ...updateData } = userData;
      result = await db
        .update(users)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
    } else {
      // Insert new user
      result = await db
        .insert(users)
        .values(userData)
        .returning();
    }

    let user = (result as User[])[0];

    // For new users with referral code, set up hierarchy first to get parent info
    let referrerPartnerId: string | undefined;
    if (isNewUser && referralCode) {
      console.log('[REFERRAL] New user detected. Setting up referral hierarchy...');
      console.log('[REFERRAL] User ID:', user.id, 'Email:', user.email);
      console.log('[REFERRAL] Referral code:', referralCode);

      try {
        const referrer = await this.getUserByReferralCode(referralCode);
        console.log('[REFERRAL] Referrer found:', referrer ? `${referrer.email} (${referrer.id})` : 'NOT FOUND');

        if (referrer && referrer.id !== user.id) {
          console.log('[REFERRAL] Linking user to referrer...');
          referrerPartnerId = referrer.partnerId;
          await this.setupReferralHierarchy(user.id, referrer.id);
        } else if (!referrer) {
          console.error('[REFERRAL] ERROR: Referral code not found in database:', referralCode);
        } else if (referrer.id === user.id) {
          console.log('[REFERRAL] Self-referral detected, skipping');
        }
      } catch (error) {
        console.error('[REFERRAL] Error setting up referral hierarchy:', error);
      }
    } else {
      if (!isNewUser) {
        console.log('[REFERRAL] Existing user login - no referral setup needed');
      } else if (!referralCode) {
        console.log('[REFERRAL] New user but no referral code provided');
      }
    }

    // Safety check: Ensure all new users have partnerId and referralCode (with parent context if available)
    if (isNewUser && (!user.partnerId || !user.referralCode)) {
      console.log('[SAFETY] New user missing partnerId or referralCode, generating...');
      await this.generatePartnerId(user.id, referrerPartnerId);
      const updatedUser = await this.getUser(user.id);
      if (updatedUser) {
        user = updatedUser;
        console.log('[SAFETY] Generated partnerId:', user.partnerId);
      }
    }

    return user;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    // Case-insensitive lookup to handle "UU001" matching "uu001"
    const [user] = await db
      .select()
      .from(users)
      .where(sql`UPPER(${users.referralCode}) = UPPER(${referralCode})`);
    return user;
  }

  async setupReferralHierarchy(newUserId: string, referrerUserId: string): Promise<void> {
    const newUser = await this.getUser(newUserId);
    const referrer = await this.getUser(referrerUserId);

    if (!newUser || !referrer) {
      throw new Error('User or referrer not found');
    }

    if (newUser.id === referrer.id) {
      console.log('Self-referral detected, skipping hierarchy setup');
      return;
    }

    const referralChain: { userId: string; level: number; commissionPercentage: number }[] = [];

    // Level 1: Direct referrer gets 20% override commission
    referralChain.push({
      userId: referrerUserId,
      level: 1,
      commissionPercentage: 20.00  // Override for level 1 up
    });

    // Level 2: Referrer's referrer gets 10% override commission
    if (referrer.parentPartnerId) {
      const level2User = await this.getUser(referrer.parentPartnerId);
      if (level2User) {
        referralChain.push({
          userId: level2User.id,
          level: 2,
          commissionPercentage: 10.00  // Override for level 2 up
        });

        // No level 3 - only 2 levels of override commissions
        // Deal creator gets 60% directly (not tracked in hierarchy)
      }
    }

    for (const entry of referralChain) {
      await db.insert(partnerHierarchy).values({
        childId: newUserId,
        parentId: entry.userId,
        level: entry.level,
      });
    }

    let referralCodeToSet = newUser.referralCode;
    if (!referralCodeToSet) {
      if (!newUser.partnerId) {
        await this.generatePartnerId(newUserId, referrer.partnerId);
        const updatedUser = await this.getUser(newUserId);
        referralCodeToSet = updatedUser?.partnerId || `REF-${Date.now().toString().slice(-8)}`;
      } else {
        referralCodeToSet = newUser.partnerId;
      }
    }

    let partnerLevel = 1;
    if (referrer.partnerLevel) {
      partnerLevel = Math.min(referrer.partnerLevel + 1, 3);
    }

    await db
      .update(users)
      .set({
        parentPartnerId: referrerUserId,
        referralCode: referralCodeToSet,
        partnerLevel,
        updatedAt: new Date(),
      })
      .where(eq(users.id, newUserId));

    console.log(`Referral hierarchy set up for user ${newUserId} with referrer ${referrerUserId}. Chain length: ${referralChain.length}`);
  }

  async getBusinessTypes(): Promise<BusinessType[]> {
    return await db.select().from(businessTypes);
  }

  // Leads operations
  async createLead(leadData: any): Promise<any> {
    const [lead] = await db
      .insert(leads)
      .values(leadData)
      .returning();
    return lead;
  }

  async createLeadsBulk(leadsData: any[]): Promise<{ count: number }> {
    const results = await db
      .insert(leads)
      .values(leadsData)
      .returning();
    return { count: results.length };
  }

  async getLeadsByUserId(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.partnerId, userId))
      .orderBy(desc(leads.createdAt));
  }

  async updateLeadStatus(leadId: string, status: string): Promise<any> {
    const [lead] = await db
      .update(leads)
      .set({ status, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();
    return lead;
  }

  async updateLead(leadId: string, updates: any): Promise<any> {
    const [lead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();
    return lead;
  }

  async getLeadInteractions(leadId: string): Promise<any[]> {
    return await db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, leadId))
      .orderBy(desc(leadInteractions.createdAt));
  }

  async addLeadInteraction(leadId: string, interactionData: any): Promise<any> {
    const [interaction] = await db
      .insert(leadInteractions)
      .values({
        leadId,
        ...interactionData,
      })
      .returning();
    return interaction;
  }

  // Contacts operations
  async createContact(contactData: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(contactData)
      .returning();
    return contact;
  }

  async getContactsByUserId(userId: string): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.partnerId, userId))
      .orderBy(desc(contacts.createdAt));
  }

  async getContactById(contactId: string, userId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.partnerId, userId)));
    return contact;
  }

  async updateContact(contactId: string, userId: string, updates: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(contacts.id, contactId), eq(contacts.partnerId, userId)))
      .returning();
    if (!contact) {
      throw new Error('Contact not found or access denied');
    }
    return contact;
  }

  async deleteContact(contactId: string, userId: string): Promise<void> {
    const result = await db
      .delete(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.partnerId, userId)))
      .returning({ id: contacts.id });
    if (result.length === 0) {
      throw new Error('Contact not found or access denied');
    }
  }

  async addContactInteraction(contactId: string, userId: string, interactionData: InsertContactInteraction): Promise<ContactInteraction> {
    // First verify the contact belongs to the user
    const contact = await this.getContactById(contactId, userId);
    if (!contact) {
      throw new Error('Contact not found or access denied');
    }

    const [interaction] = await db
      .insert(contactInteractions)
      .values({
        ...interactionData,
        contactId,
      })
      .returning();
    return interaction;
  }

  async getContactInteractions(contactId: string, userId: string): Promise<ContactInteraction[]> {
    // First verify the contact belongs to the user
    const contact = await this.getContactById(contactId, userId);
    if (!contact) {
      throw new Error('Contact not found or access denied');
    }

    return await db
      .select()
      .from(contactInteractions)
      .where(eq(contactInteractions.contactId, contactId))
      .orderBy(desc(contactInteractions.createdAt));
  }

  // Opportunities operations
  async createOpportunity(opportunityData: InsertOpportunity): Promise<Opportunity> {
    // Generate a unique Deal ID if not provided
    let dealId = opportunityData.dealId;
    if (!dealId) {
      // Generate a unique Deal ID in format DEAL-12345
      const timestamp = Date.now().toString().slice(-5);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      dealId = `DEAL-${timestamp}${random}`;

      // Check for uniqueness and regenerate if needed
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db
          .select()
          .from(opportunities)
          .where(eq(opportunities.dealId, dealId))
          .limit(1);

        if (existing.length === 0) break;

        // Regenerate if duplicate
        const newRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        dealId = `DEAL-${Date.now().toString().slice(-4)}${newRandom}`;
        attempts++;
      }
    }

    const [opportunity] = await db
      .insert(opportunities)
      .values({ ...opportunityData, dealId })
      .returning();
    return opportunity;
  }

  async getOpportunitiesByUserId(userId: string): Promise<Opportunity[]> {
    return await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.partnerId, userId))
      .orderBy(desc(opportunities.createdAt));
  }

  async getOpportunityById(opportunityId: string, userId: string): Promise<Opportunity | undefined> {
    const [opportunity] = await db
      .select()
      .from(opportunities)
      .where(and(eq(opportunities.id, opportunityId), eq(opportunities.partnerId, userId)));
    return opportunity;
  }

  async updateOpportunity(opportunityId: string, userId: string, updates: Partial<InsertOpportunity>): Promise<Opportunity> {
    const [opportunity] = await db
      .update(opportunities)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(opportunities.id, opportunityId), eq(opportunities.partnerId, userId)))
      .returning();
    if (!opportunity) {
      throw new Error('Opportunity not found or access denied');
    }
    return opportunity;
  }

  async deleteOpportunity(opportunityId: string, userId: string): Promise<void> {
    const result = await db
      .delete(opportunities)
      .where(and(eq(opportunities.id, opportunityId), eq(opportunities.partnerId, userId)))
      .returning({ id: opportunities.id });
    if (result.length === 0) {
      throw new Error('Opportunity not found or access denied');
    }
  }

  async addOpportunityInteraction(opportunityId: string, userId: string, interactionData: InsertOpportunityInteraction): Promise<OpportunityInteraction> {
    // First verify the opportunity belongs to the user
    const opportunity = await this.getOpportunityById(opportunityId, userId);
    if (!opportunity) {
      throw new Error('Opportunity not found or access denied');
    }

    const [interaction] = await db
      .insert(opportunityInteractions)
      .values({
        ...interactionData,
        opportunityId,
      })
      .returning();
    return interaction;
  }

  async getOpportunityInteractions(opportunityId: string, userId: string): Promise<OpportunityInteraction[]> {
    // First verify the opportunity belongs to the user
    const opportunity = await this.getOpportunityById(opportunityId, userId);
    if (!opportunity) {
      throw new Error('Opportunity not found or access denied');
    }

    return await db
      .select()
      .from(opportunityInteractions)
      .where(eq(opportunityInteractions.opportunityId, opportunityId))
      .orderBy(desc(opportunityInteractions.createdAt));
  }

  // Email communications operations
  async createEmailCommunication(emailData: InsertEmailCommunication): Promise<EmailCommunication> {
    const [email] = await db
      .insert(emailCommunications)
      .values(emailData)
      .returning();
    return email;
  }

  async getEmailCommunicationsByContact(contactId: string): Promise<EmailCommunication[]> {
    return await db
      .select()
      .from(emailCommunications)
      .where(eq(emailCommunications.contactId, contactId))
      .orderBy(desc(emailCommunications.outlookCreatedAt));
  }

  async getEmailCommunicationsByOpportunity(opportunityId: string): Promise<EmailCommunication[]> {
    return await db
      .select()
      .from(emailCommunications)
      .where(eq(emailCommunications.opportunityId, opportunityId))
      .orderBy(desc(emailCommunications.outlookCreatedAt));
  }

  async syncOutlookEmails(partnerId: string): Promise<void> {
    // TODO: Implement Outlook email sync using the integration
    // This will be implemented when we integrate the email functionality
    console.log('Outlook email sync not yet implemented for partner:', partnerId);
  }

  // Partner operations
  async getPartners(): Promise<any[]> {
    return await db
      .select()
      .from(partners)
      .where(eq(partners.isActive, true))
      .orderBy(partners.name);
  }

  async getPartnerBySlug(slug: string): Promise<any> {
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.slug, slug));
    return partner;
  }

  async seedPartners(): Promise<void> {
    const existingPartners = await db.select().from(partners);
    if (existingPartners.length > 0) return;

    const strategicPartner = {
      name: "FinanceFlow Solutions",
      slug: "financeflow",
      description: "Your strategic partner for comprehensive business financial services. We specialize in payment processing solutions and business funding, helping companies of all sizes streamline their operations and access the capital they need to grow.",
      logoUrl: "/assets/financeflow-logo.svg",
      website: "https://financeflow.co.uk",
      contactEmail: "partners@financeflow.co.uk",
      trustScore: "4.9",
      totalReviews: 2847,
      services: [
        "Card Payment Processing",
        "Business Funding Solutions",
        "Equipment Finance",
        "Working Capital Loans",
        "Merchant Cash Advances",
        "Invoice Factoring",
        "24/7 Support & Consulting"
      ],
      specializations: [
        "Payment Processing",
        "Business Funding",
        "Equipment Finance",
        "Cash Flow Solutions"
      ],
      isActive: true,
    };

    const [insertedPartner] = await db.insert(partners).values(strategicPartner).returning();

    // Add some reviews for Dojo
    const dojoReviews = [
      {
        partnerId: insertedPartner.id,
        reviewerName: "Sarah Mitchell",
        rating: 5,
        title: "Excellent service and support",
        content: "Dojo has transformed our payment processing. The setup was seamless, rates are competitive, and their support team is outstanding. Highly recommend for any business looking to modernize their payments.",
        businessType: "Retail",
        isVerified: true,
        helpfulCount: 23,
      },
      {
        partnerId: insertedPartner.id,
        reviewerName: "Marcus Thompson",
        rating: 5,
        title: "Game changer for our restaurant",
        content: "The mobile terminals have been perfect for table service. Fast transactions, reliable connection, and the analytics help us understand our business better. Great investment.",
        businessType: "Hospitality",
        isVerified: true,
        helpfulCount: 18,
      },
      {
        partnerId: insertedPartner.id,
        reviewerName: "Jennifer Adams",
        rating: 4,
        title: "Solid payment solution",
        content: "Very happy with Dojo's service. Professional setup, competitive rates, and good customer service. The only minor issue was the initial learning curve with the POS system.",
        businessType: "Professional Services",
        isVerified: true,
        helpfulCount: 12,
      },
      {
        partnerId: insertedPartner.id,
        reviewerName: "David Chen",
        rating: 5,
        title: "Perfect for mobile business",
        content: "As a mobile barber, I needed reliable payment processing on the go. Dojo's mobile readers are perfect - fast, secure, and never let me down. Client feedback has been very positive.",
        businessType: "Mobile Services",
        isVerified: true,
        helpfulCount: 15,
      },
    ];

    await db.insert(partnerReviews).values(dojoReviews);
  }

  async seedBusinessTypes(): Promise<void> {
    const existingTypes = await this.getBusinessTypes();
    if (existingTypes.length > 0) return;

    await db.insert(businessTypes).values([
      {
        name: "Small Business and Traders",
        description: "Independent shops, small retailers, sole traders",
        baseCommission: "150",
        minVolume: "5000",
        maxVolume: "50000",
        processingTime: "24-48 hours",
      },
      {
        name: "Cafes, Restaurants and Hospitality",
        description: "Restaurants, bars, cafes, hospitality venues",
        baseCommission: "500",
        minVolume: "50000",
        maxVolume: "500000",
        processingTime: "48-72 hours",
      },
      {
        name: "Multisite Business and Group Locations",
        description: "Multi-location businesses, franchises, corporate groups",
        baseCommission: "5000",
        minVolume: "500000",
        maxVolume: "10000000",
        processingTime: "3-5 days",
      },
    ]);
  }

  async createDeal(dealData: InsertDeal): Promise<Deal> {
    const [deal] = await db
      .insert(deals)
      .values(dealData)
      .returning();

    // Sync with Google Sheets
    try {
      let referrer = await this.getUser(deal.referrerId);

      // Auto-generate partner ID if user doesn't have one (root partner - no parent)
      if (referrer && !referrer.partnerId && referrer.firstName && referrer.lastName) {
        console.log('Generating partner ID for user:', referrer.id);
        await this.generatePartnerId(referrer.id); // No parent, will be root partner
        referrer = await this.getUser(deal.referrerId); // Refresh user data
      }

      const businessType = await db.select().from(businessTypes).where(eq(businessTypes.id, deal.businessTypeId));

      if (referrer && businessType[0]) {
        const sheetData: DealSheetData = {
          partnerId: referrer.partnerId || 'No Partner ID',
          partnerName: `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() || 'Unknown',
          partnerEmail: referrer.email || '',
          businessName: deal.businessName,
          businessEmail: deal.businessEmail,
          businessPhone: deal.businessPhone || '',
          businessAddress: deal.businessAddress || '',
          businessType: businessType[0].name,
          currentProcessor: deal.currentProcessor || '',
          monthlyVolume: deal.monthlyVolume || '',
          currentRate: deal.currentRate || '',
          selectedProducts: deal.selectedProducts?.join(', ') || '',
          cardMachineQuantity: deal.cardMachineQuantity || 1,
          status: deal.status,
          estimatedCommission: deal.estimatedCommission || '',
          submittedAt: deal.submittedAt?.toISOString() || new Date().toISOString(),
          notes: deal.notes || ''
        };

        console.log('Syncing referral to Google Sheets for partner:', sheetData.partnerId);
        await googleSheetsService.addDeal(sheetData);
        console.log('Successfully synced referral to Google Sheets');
      }
    } catch (error) {
      console.error('Failed to sync referral with Google Sheets:', error);
      // Don't throw - we don't want to fail referral creation if sheets sync fails
    }

    return deal;
  }

  async getDealById(id: string): Promise<Referral | undefined> {
    const result = await db
      .select()
      .from(deals)
      .where(eq(deals.id, id))
      .limit(1);
    return result[0];
  }

  async getDealsByUserId(userId: string): Promise<Referral[]> {
    const results = await db
      .select()
      .from(deals)
      .where(eq(deals.referrerId, userId))
      .orderBy(desc(deals.submittedAt));

    // Fetch billUploads and quoteId for each referral
    const referralsWithData = await Promise.all(
      results.map(async (referral) => {
        const uploads = await db
          .select()
          .from(billUploads)
          .where(eq(billUploads.businessName, referral.businessName));

        // Get the quote for this deal to include quoteId
        const [quote] = await db
          .select({ id: quotes.id })
          .from(quotes)
          .where(eq(quotes.referralId, referral.id))
          .limit(1);

        return {
          ...referral,
          billUploads: uploads,
          quoteId: quote?.id || null
        };
      })
    );

    return referralsWithData as any;
  }

  async getDealsWithQuotes(userId: string): Promise<any[]> {
    // Get all deals for the user
    const userDeals = await db
      .select()
      .from(deals)
      .where(eq(deals.referrerId, userId))
      .orderBy(desc(deals.submittedAt));

    // For each deal, fetch the quote data and bill uploads
    const dealsWithQuotes = await Promise.all(
      userDeals.map(async (deal) => {
        // Get the quote for this deal
        const [quoteData] = await db
          .select()
          .from(quotes)
          .where(eq(quotes.referralId, deal.id))
          .limit(1);

        // Get bill uploads
        const uploads = await db
          .select()
          .from(billUploads)
          .where(eq(billUploads.businessName, deal.businessName));

        return {
          ...deal,
          quote: quoteData || null,
          billUploads: uploads,
          // Copy key quote fields to top level for easier access
          quoteId: quoteData?.id || null,
          customerJourneyStatus: quoteData?.customerJourneyStatus || null,
          debitCardRate: quoteData?.debitCardRate || null,
          creditCardRate: quoteData?.creditCardRate || null,
          corporateCardRate: quoteData?.corporateCardRate || null,
          visaBusinessDebitRate: quoteData?.visaBusinessDebitRate || null,
          otherBusinessDebitRate: quoteData?.otherBusinessDebitRate || null,
          amexRate: quoteData?.amexRate || null,
          secureTransactionFee: quoteData?.secureTransactionFee || null,
          estimatedMonthlySaving: quoteData?.estimatedMonthlySaving || null,
          buyoutAmount: quoteData?.buyoutAmount || null,
          totalAmount: quoteData?.totalAmount || null,
          monthlyDeviceCost: quoteData?.monthlyDeviceCost || null,
          oneTimeDeviceCost: quoteData?.oneTimeDeviceCost || null,
          devices: quoteData?.devices || null,
          devicePaymentType: quoteData?.devicePaymentType || null,
          hardwareCare: quoteData?.hardwareCare || null,
          settlementType: quoteData?.settlementType || null,
          dojoPlan: quoteData?.dojoPlan || null,
          validUntil: quoteData?.validUntil || null,
          version: quoteData?.version || 1,
          adminNotes: quoteData?.adminNotes || deal.adminNotes,
        };
      })
    );

    return dealsWithQuotes;
  }

  async searchBusinessNames(userId: string, query: string): Promise<Array<{
    businessName: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }>> {
    // Search both opportunities and referrals for business names
    const opportunityResults = await db
      .select({
        businessName: opportunities.businessName,
        contactName: opportunities.contactName,
        contactEmail: opportunities.contactEmail,
        contactPhone: opportunities.contactPhone
      })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.partnerId, userId),
          sql`LOWER(${opportunities.businessName}) LIKE LOWER(${'%' + query + '%'})`
        )
      )
      .limit(10);

    // Also search referrals
    const referralResults = await db
      .select({
        businessName: deals.businessName,
        businessEmail: deals.businessEmail,
        businessPhone: deals.businessPhone
      })
      .from(deals)
      .where(
        and(
          eq(deals.referrerId, userId),
          sql`LOWER(${deals.businessName}) LIKE LOWER(${'%' + query + '%'})`
        )
      )
      .limit(10);

    // Combine and deduplicate results
    const combined = new Map<string, {
      businessName: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    }>();

    // Add opportunities first (they have more detailed contact info)
    opportunityResults.forEach(r => {
      combined.set(r.businessName.toLowerCase(), {
        businessName: r.businessName,
        contactName: r.contactName || undefined,
        contactEmail: r.contactEmail || undefined,
        contactPhone: r.contactPhone || undefined
      });
    });

    // Add referrals if not already present
    referralResults.forEach(r => {
      const key = r.businessName.toLowerCase();
      if (!combined.has(key)) {
        combined.set(key, {
          businessName: r.businessName,
          contactEmail: r.businessEmail || undefined,
          contactPhone: r.businessPhone || undefined
        });
      }
    });

    return Array.from(combined.values()).slice(0, 10);
  }

  async updateDealStatus(id: string, status: string): Promise<void> {
    // Get referral and user info for Google Sheets update
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));

    if (referral) {
      const referrer = await this.getUser(deal.referrerId);

      // Update in database
      await db
        .update(deals)
        .set({ status, updatedAt: new Date() })
        .where(eq(deals.id, id));

      // Sync status update with Google Sheets
      try {
        if (referrer?.partnerId) {
          await googleSheetsService.updateReferralStatus(
            referrer.partnerId,
            deal.businessName,
            status
          );
        }
      } catch (error) {
        console.error('Failed to update referral status in Google Sheets:', error);
        // Don't throw - we don't want to fail status update if sheets sync fails
      }
    }
  }

  async getUserStats(userId: string): Promise<{
    dealsSubmitted: number;
    commissionPending: number;
    totalDeals: number;
    totalValueEarned: number;
  }> {
    // Get all referrals submitted by this user
    const userReferrals = await db
      .select()
      .from(deals)
      .where(eq(deals.referrerId, userId));

    const dealsSubmitted = userReferrals.length;

    // Get pending commissions from commissionPayments table
    const pendingCommissions = await db
      .select()
      .from(commissionPayments)
      .where(
        and(
          eq(commissionPayments.recipientId, userId),
          eq(commissionPayments.paymentStatus, 'pending')
        )
      );

    const commissionPending = pendingCommissions.reduce(
      (sum, payment) => sum + parseFloat(payment.amount || "0"),
      0
    );

    // Get total referrals (people who signed up using this user's referral code)
    const referredUsers = await db
      .select()
      .from(partnerHierarchy)
      .where(eq(partnerHierarchy.parentId, userId));

    const totalDeals = referredUsers.length;

    // Get total value earned from paid commissions
    const paidCommissions = await db
      .select()
      .from(commissionPayments)
      .where(
        and(
          eq(commissionPayments.recipientId, userId),
          eq(commissionPayments.paymentStatus, 'paid')
        )
      );

    const totalValueEarned = paidCommissions.reduce(
      (sum, payment) => sum + parseFloat(payment.amount || "0"),
      0
    );

    return {
      dealsSubmitted,
      commissionPending,
      totalDeals,
      totalValueEarned,
    };
  }

  async createBillUpload(businessName: string, fileName: string, fileSize: number, mimeType?: string, fileContent?: string): Promise<BillUpload> {
    const [upload] = await db
      .insert(billUploads)
      .values({
        businessName,
        fileName,
        fileSize,
        mimeType,
        fileContent,
      })
      .returning();
    return upload;
  }

  async generatePartnerId(userId: string, parentPartnerId?: string): Promise<string> {
    // Generate simple referral code based on first + last name initials
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    // Extract initials from first and last name
    const firstInitial = (user.firstName?.[0] || 'x').toLowerCase();
    const lastInitial = (user.lastName?.[0] || 'x').toLowerCase();
    const prefix = `${firstInitial}${lastInitial}`;

    // Count existing codes with this prefix to get next sequential number
    const existingCodesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`partner_id LIKE ${prefix + '%'}`);

    const nextNumber = (existingCodesCount[0]?.count || 0) + 1;
    const partnerId = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    // Update user with partner ID and use it as referral code
    // Note: The hierarchy is tracked separately in partner_hierarchy table
    await db
      .update(users)
      .set({
        partnerId,
        referralCode: partnerId, // Simple code like "ds001"
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    console.log(`[PARTNER_ID] Generated ${partnerId} for user ${userId} (${user.firstName} ${user.lastName})${parentPartnerId ? ` - parent: ${parentPartnerId}` : ' (root)'}`);

    return partnerId;
  }

  async getUserByPartnerId(partnerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.partnerId, partnerId));
    return user;
  }

  async getBillUploadById(billId: string): Promise<BillUpload | undefined> {
    const [bill] = await db.select().from(billUploads).where(eq(billUploads.id, billId));
    return bill;
  }

  async getBillUploadsByBusinessName(businessName: string): Promise<BillUpload[]> {
    // Fetch all documents for a specific business name
    return await db.select().from(billUploads)
      .where(eq(billUploads.businessName, businessName));
  }

  // Admin operations
  async getAdminStats(): Promise<{
    totalUsers: number;
    totalDeals: number;
    pendingDeals: number;
    totalCommissions: number;
  }> {
    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalDeals = await db.select({ count: sql<number>`count(*)` }).from(deals);
    const pendingDeals = await db.select({ count: sql<number>`count(*)` }).from(deals)
      .where(eq(deals.status, "pending"));

    const commissionData = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)`
    }).from(deals).where(sql`actual_commission IS NOT NULL`);

    return {
      totalUsers: totalUsers[0]?.count || 0,
      totalDeals: totalDeals[0]?.count || 0,
      pendingDeals: pendingDeals[0]?.count || 0,
      totalCommissions: commissionData[0]?.total || 0,
    };
  }

  async getAllUsers(filters?: { limit?: number; offset?: number; search?: string }): Promise<User[]> {
    let query = db.select().from(users);

    if (filters?.search) {
      query = query.where(sql`
        ${users.firstName} ILIKE ${'%' + filters.search + '%'} OR
        ${users.lastName} ILIKE ${'%' + filters.search + '%'} OR
        ${users.email} ILIKE ${'%' + filters.search + '%'} OR
        ${users.partnerId} ILIKE ${'%' + filters.search + '%'}
      `);
    }

    query = query.orderBy(desc(users.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async getAllReferrals(filters?: {
    limit?: number;
    offset?: number;
    status?: string;
    userId?: string;
    businessType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<any[]> {
    // Get all deals first
    const allDeals = await db.select().from(deals).orderBy(desc(deals.submittedAt));

    // Enrich with user and business type info
    const enrichedDeals = await Promise.all(allDeals.map(async (deal) => {
      // Get referrer info
      let partnerName = '';
      let partnerEmail = '';
      let partnerId = '';
      if (deal.referrerId) {
        const [user] = await db.select().from(users).where(eq(users.id, deal.referrerId));
        if (user) {
          partnerName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
          partnerEmail = user.email || '';
          partnerId = user.partnerId || '';
        }
      }

      // Get business type name
      let businessTypeName = 'N/A';
      if (deal.businessTypeId) {
        const [bt] = await db.select().from(businessTypes).where(eq(businessTypes.id, deal.businessTypeId));
        if (bt) {
          businessTypeName = bt.name;
        }
      }

      return {
        ...deal,
        businessTypeName,
        partnerName,
        partnerEmail,
        partnerId,
      };
    }));

    let result = enrichedDeals;

    // Apply filters in JavaScript
    if (filters?.status) {
      result = result.filter(d => d.status === filters.status);
    }

    if (filters?.userId) {
      result = result.filter(d => d.referrerId === filters.userId);
    }

    if (filters?.businessType) {
      result = result.filter(d => d.businessTypeId === filters.businessType);
    }

    if (filters?.dateFrom) {
      result = result.filter(d => d.submittedAt && d.submittedAt >= filters.dateFrom!);
    }

    if (filters?.dateTo) {
      result = result.filter(d => d.submittedAt && d.submittedAt <= filters.dateTo!);
    }

    // Apply pagination
    if (filters?.offset) {
      result = result.slice(filters.offset);
    }

    if (filters?.limit) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  async getAllDeals(): Promise<Deal[]> {
    return await this.getAllReferrals();
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateDeal(dealId: string, data: Partial<Deal>): Promise<Deal> {
    const [deal] = await db
      .update(deals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deals.id, dealId))
      .returning();

    // If dealStage was updated, sync customerJourneyStatus in any associated quotes
    if (data.dealStage && deal) {
      const customerJourneyStatus = mapDealStageToCustomerJourney(data.dealStage);
      await db
        .update(quotes)
        .set({
          customerJourneyStatus,
          updatedAt: new Date()
        })
        .where(eq(quotes.referralId, dealId));
    }

    return deal;
  }

  async getAnalyticsOverview(): Promise<{
    totalRevenue: number;
    activePartners: number;
    avgDealSize: number;
    conversionRate: number;
    monthlyGrowth: number;
    topProducts: Array<{ name: string; count: number }>;
  }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Total revenue from completed deals
    const [revenueData] = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)` })
      .from(deals)
      .where(eq(deals.status, 'won'));

    // Active partners (submitted referrals in last 30 days)
    const [activeData] = await db
      .select({ count: sql<number>`COUNT(DISTINCT referrer_id)` })
      .from(deals)
      .where(sql`${deals.submittedAt} >= ${thirtyDaysAgo}`);

    // Average deal size
    const [avgDealData] = await db
      .select({ avg: sql<number>`COALESCE(AVG(CAST(actual_commission AS DECIMAL)), 0)` })
      .from(deals)
      .where(sql`actual_commission IS NOT NULL`);

    // Conversion rate
    const [totalDeals] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deals);
    const [wonDeals] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deals)
      .where(eq(deals.status, 'won'));

    const conversionRate = totalDeals[0]?.count > 0
      ? (wonDeals[0]?.count / totalDeals[0]?.count) * 100
      : 0;

    // Monthly growth comparison
    const [currentMonthRevenue] = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)` })
      .from(deals)
      .where(and(
        sql`${deals.submittedAt} >= ${thirtyDaysAgo}`,
        eq(deals.status, 'won')
      ));

    const [previousMonthRevenue] = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)` })
      .from(deals)
      .where(and(
        sql`${deals.submittedAt} >= ${sixtyDaysAgo}`,
        sql`${deals.submittedAt} < ${thirtyDaysAgo}`,
        eq(deals.status, 'won')
      ));

    const monthlyGrowth = previousMonthRevenue[0]?.total > 0
      ? ((currentMonthRevenue[0]?.total - previousMonthRevenue[0]?.total) / previousMonthRevenue[0]?.total) * 100
      : 0;

    // Top products by count
    const topProducts = await db
      .select({
        name: deals.businessTypeId,
        count: sql<number>`count(*)`
      })
      .from(deals)
      .groupBy(deals.businessTypeId)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    return {
      totalRevenue: revenueData?.total || 0,
      activePartners: activeData?.count || 0,
      avgDealSize: avgDealData?.avg || 0,
      conversionRate: Number(conversionRate.toFixed(2)),
      monthlyGrowth: Number(monthlyGrowth.toFixed(2)),
      topProducts: topProducts || []
    };
  }

  async getRevenueMetrics(): Promise<{
    currentMonth: number;
    previousMonth: number;
    yearToDate: number;
    projectedAnnual: number;
    byProduct: Array<{ product: string; revenue: number }>;
    byPartner: Array<{ partnerId: string; partnerName: string; revenue: number }>;
  }> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Current month revenue
    const [currentMonthData] = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)` })
      .from(deals)
      .where(and(
        sql`${deals.submittedAt} >= ${currentMonthStart}`,
        eq(deals.status, 'won')
      ));

    // Previous month revenue
    const [previousMonthData] = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)` })
      .from(deals)
      .where(and(
        sql`${deals.submittedAt} >= ${previousMonthStart}`,
        sql`${deals.submittedAt} < ${currentMonthStart}`,
        eq(deals.status, 'won')
      ));

    // Year to date revenue
    const [yearToDateData] = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)` })
      .from(deals)
      .where(and(
        sql`${deals.submittedAt} >= ${yearStart}`,
        eq(deals.status, 'won')
      ));

    // Projected annual (based on YTD average)
    const monthsElapsed = now.getMonth() + (now.getDate() / 30);
    const projectedAnnual = monthsElapsed > 0 ? (yearToDateData?.total || 0) / monthsElapsed * 12 : 0;

    // Revenue by product
    const byProduct = await db
      .select({
        product: deals.businessTypeId,
        revenue: sql<number>`COALESCE(SUM(CAST(actual_commission AS DECIMAL)), 0)`
      })
      .from(deals)
      .where(eq(deals.status, 'won'))
      .groupBy(deals.businessTypeId)
      .orderBy(sql`SUM(CAST(actual_commission AS DECIMAL)) DESC`)
      .limit(10);

    // Revenue by partner
    const byPartner = await db
      .select({
        partnerId: users.partnerId,
        firstName: users.firstName,
        lastName: users.lastName,
        revenue: sql<number>`COALESCE(SUM(CAST(${deals.actualCommission} AS DECIMAL)), 0)`
      })
      .from(deals)
      .leftJoin(users, eq(deals.referrerId, users.id))
      .where(eq(deals.status, 'won'))
      .groupBy(users.partnerId, users.firstName, users.lastName)
      .orderBy(sql`SUM(CAST(${deals.actualCommission} AS DECIMAL)) DESC`)
      .limit(10);

    return {
      currentMonth: currentMonthData?.total || 0,
      previousMonth: previousMonthData?.total || 0,
      yearToDate: yearToDateData?.total || 0,
      projectedAnnual: Number(projectedAnnual.toFixed(2)),
      byProduct: byProduct || [],
      byPartner: byPartner.map(p => ({
        partnerId: p.partnerId || '',
        partnerName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        revenue: p.revenue
      }))
    };
  }

  async getUserGrowthMetrics(): Promise<{
    totalUsers: number;
    newThisMonth: number;
    newLastMonth: number;
    activeUsers: number;
    growthRate: number;
    usersByMonth: Array<{ month: string; count: number }>;
  }> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total users
    const [totalData] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // New users this month
    const [newThisMonthData] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.createdAt} >= ${currentMonthStart}`);

    // New users last month
    const [newLastMonthData] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        sql`${users.createdAt} >= ${previousMonthStart}`,
        sql`${users.createdAt} < ${currentMonthStart}`
      ));

    // Active users (submitted referrals in last 30 days)
    const [activeData] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${deals.referrerId})` })
      .from(deals)
      .where(sql`${deals.submittedAt} >= ${thirtyDaysAgo}`);

    // Growth rate
    const growthRate = newLastMonthData?.count > 0
      ? ((newThisMonthData?.count - newLastMonthData?.count) / newLastMonthData?.count) * 100
      : 0;

    // Users by month (last 6 months)
    const usersByMonth: Array<{ month: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const [monthData] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(
          sql`${users.createdAt} >= ${monthStart}`,
          sql`${users.createdAt} < ${monthEnd}`
        ));

      usersByMonth.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count: monthData?.count || 0
      });
    }

    return {
      totalUsers: totalData?.count || 0,
      newThisMonth: newThisMonthData?.count || 0,
      newLastMonth: newLastMonthData?.count || 0,
      activeUsers: activeData?.count || 0,
      growthRate: Number(growthRate.toFixed(2)),
      usersByMonth
    };
  }

  async getTopPerformers(): Promise<Array<{
    userId: string;
    name: string;
    partnerId: string;
    totalDeals: number;
    wonDeals: number;
    totalRevenue: number;
    conversionRate: number;
    rank: number;
  }>> {
    const performers = await db
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        partnerId: users.partnerId,
        totalDeals: sql<number>`COUNT(${deals.id})`,
        wonDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'won' THEN 1 END)`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${deals.status} = 'won' THEN CAST(${deals.actualCommission} AS DECIMAL) END), 0)`
      })
      .from(users)
      .leftJoin(deals, eq(deals.referrerId, users.id))
      .groupBy(users.id, users.firstName, users.lastName, users.partnerId)
      .having(sql`COUNT(${deals.id}) > 0`)
      .orderBy(sql`SUM(CASE WHEN ${deals.status} = 'won' THEN CAST(${deals.actualCommission} AS DECIMAL) END) DESC NULLS LAST`)
      .limit(20);

    return performers.map((p, index) => ({
      userId: p.userId,
      name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown',
      partnerId: p.partnerId || '',
      totalDeals: p.totalDeals,
      wonDeals: p.wonDeals,
      totalRevenue: p.totalRevenue,
      conversionRate: p.totalDeals > 0 ? Number(((p.wonDeals / p.totalDeals) * 100).toFixed(2)) : 0,
      rank: index + 1
    }));
  }

  async updateDealStage(dealId: string, stage: string): Promise<Deal> {
    const [deal] = await db
      .update(deals)
      .set({ status: stage, updatedAt: new Date() })
      .where(eq(deals.id, dealId))
      .returning();
    return deal;
  }

  async exportUsersCSV(): Promise<string> {
    const allUsers = await this.getAllUsers();

    const headers = ['ID', 'Email', 'Name', 'Partner ID', 'Company', 'Created At', 'Is Admin'];
    const rows = allUsers.map(user => [
      user.id,
      user.email || '',
      `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      user.partnerId || '',
      user.company || '',
      user.createdAt?.toISOString() || '',
      user.isAdmin ? 'Yes' : 'No'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csv;
  }

  async exportReferralsCSV(): Promise<string> {
    const allDeals = await this.getAllReferrals();

    const headers = ['ID', 'Business Name', 'Business Type', 'Status', 'Monthly Volume', 'Submitted At', 'Commission'];
    const rows = allDeals.map(ref => [
      ref.id,
      ref.businessName,
      ref.businessTypeId || '',
      ref.status,
      ref.monthlyVolume || '',
      ref.submittedAt?.toISOString() || '',
      ref.actualCommission || '0'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csv;
  }

  async exportPaymentsCSV(): Promise<string> {
    const payments = await db
      .select({
        id: commissionPayments.id,
        dealId: commissionPayments.dealId,
        recipientId: commissionPayments.recipientId,
        amount: commissionPayments.amount,
        status: commissionPayments.status,
        processedAt: commissionPayments.paymentDate,
        paymentReference: commissionPayments.transferReference
      })
      .from(commissionPayments)
      .orderBy(desc(commissionPayments.paymentDate));

    const headers = ['ID', 'Deal ID', 'Recipient ID', 'Amount', 'Status', 'Processed At', 'Payment Reference'];
    const rows = payments.map(payment => [
      payment.id,
      payment.dealId || '',
      payment.recipientId || '',
      payment.amount || '0',
      payment.status,
      payment.processedAt?.toISOString() || '',
      payment.paymentReference || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csv;
  }

  async getPendingPayments(): Promise<Array<{
    id: string;
    dealId: string;
    businessName: string;
    partnerId: string;
    partnerName: string;
    amount: string;
    status: string;
    submittedAt: Date;
  }>> {
    const pendingPayments = await db
      .select({
        dealId: deals.id,
        businessName: deals.businessName,
        actualCommission: deals.actualCommission,
        status: deals.status,
        submittedAt: deals.submittedAt,
        partnerId: users.partnerId,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(deals)
      .leftJoin(users, eq(deals.referrerId, users.id))
      .where(and(
        eq(deals.status, 'won'),
        sql`${deals.actualCommission} IS NOT NULL`,
        sql`${deals.actualCommission}::decimal > 0`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${commissionPayments}
          WHERE ${commissionPayments.dealId} = ${deals.id}
          AND ${commissionPayments.status} = 'paid'
        )`
      ));

    return pendingPayments.map(payment => ({
      id: payment.dealId,
      dealId: payment.dealId,
      businessName: payment.businessName,
      partnerId: payment.partnerId || '',
      partnerName: `${payment.firstName || ''} ${payment.lastName || ''}`.trim(),
      amount: payment.actualCommission || '0',
      status: 'pending',
      submittedAt: payment.submittedAt
    }));
  }

  async getPaymentHistory(): Promise<Array<{
    id: string;
    dealId: string;
    businessName: string;
    partnerId: string;
    partnerName: string;
    amount: string;
    status: string;
    processedAt: Date | null;
    paymentReference: string | null;
  }>> {
    const history = await db
      .select({
        id: commissionPayments.id,
        dealId: commissionPayments.dealId,
        amount: commissionPayments.amount,
        status: commissionPayments.status,
        processedAt: commissionPayments.paymentDate,
        paymentReference: commissionPayments.transferReference,
        businessName: deals.businessName,
        partnerId: users.partnerId,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(commissionPayments)
      .leftJoin(deals, eq(commissionPayments.dealId, deals.id))
      .leftJoin(users, eq(commissionPayments.recipientId, users.id))
      .orderBy(desc(commissionPayments.paymentDate));

    return history.map(payment => ({
      id: payment.id,
      dealId: payment.dealId || '',
      businessName: payment.businessName || '',
      partnerId: payment.partnerId || '',
      partnerName: `${payment.firstName || ''} ${payment.lastName || ''}`.trim(),
      amount: payment.amount || '0',
      status: payment.status,
      processedAt: payment.processedAt,
      paymentReference: payment.paymentReference
    }));
  }

  async processStripePayment(dealId: string, recipientId: string, amount: number, stripeTransferId: string): Promise<void> {
    // Create commission payment record
    await db.insert(commissionPayments).values({
      dealId,
      recipientId,
      amount: amount.toString(),
      status: 'paid',
      processedAt: new Date(),
      paymentReference: stripeTransferId,
      paymentMethod: 'stripe',
      level: 1,
      percentage: '100'
    });

    // Update deal status
    await db
      .update(deals)
      .set({
        paymentStatus: 'paid',
        updatedAt: new Date()
      })
      .where(eq(deals.id, dealId));
  }

  // Notification operations
  async getNotificationsByUserId(userId: string): Promise<any[]> {
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
    return userNotifications;
  }

  async createNotification(notificationData: any): Promise<any> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }

  // Deal messages operations
  async getDealMessages(dealId: string): Promise<any[]> {
    return await db
      .select()
      .from(dealMessages)
      .where(eq(dealMessages.dealId, dealId))
      .orderBy(dealMessages.createdAt);
  }

  async getDealMessagesByType(dealId: string, messageType: string): Promise<any[]> {
    return await db
      .select({
        id: dealMessages.id,
        dealId: dealMessages.dealId,
        senderId: dealMessages.senderId,
        senderName: dealMessages.senderName,
        authorType: sql<string>`CASE WHEN ${dealMessages.isAdminMessage} THEN 'admin' ELSE 'customer' END`,
        authorId: dealMessages.senderId,
        authorName: dealMessages.senderName,
        message: dealMessages.message,
        createdAt: dealMessages.createdAt,
      })
      .from(dealMessages)
      .where(and(
        eq(dealMessages.dealId, dealId),
        eq(dealMessages.messageType, messageType)
      ))
      .orderBy(dealMessages.createdAt);
  }

  async createDealMessage(messageData: any): Promise<any> {
    const [message] = await db.insert(dealMessages).values(messageData).returning();
    return message;
  }

  async getUnifiedDealMessages(dealId: string): Promise<any[]> {
    const { quoteQA, quotes } = await import("@shared/schema");

    const dealMsgs = await db
      .select({
        id: dealMessages.id,
        dealId: dealMessages.dealId,
        senderId: dealMessages.senderId,
        senderName: dealMessages.senderName,
        isAdmin: dealMessages.isAdminMessage,
        message: dealMessages.message,
        createdAt: dealMessages.createdAt,
        source: sql<string>`'deal'`,
      })
      .from(dealMessages)
      .where(eq(dealMessages.dealId, dealId));

    const quote = await db
      .select()
      .from(quotes)
      .where(eq(quotes.referralId, dealId))
      .limit(1);

    let quoteMsgs: any[] = [];
    if (quote.length > 0) {
      quoteMsgs = await db
        .select({
          id: quoteQA.id,
          dealId: sql<string>`${dealId}`,
          senderId: quoteQA.authorId,
          senderName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Unknown')`,
          isAdmin: sql<boolean>`${quoteQA.authorType} = 'admin'`,
          message: quoteQA.message,
          createdAt: quoteQA.createdAt,
          source: sql<string>`'quote'`,
        })
        .from(quoteQA)
        .leftJoin(users, eq(quoteQA.authorId, users.id))
        .where(eq(quoteQA.quoteId, quote[0].id));
    }

    const allMessages = [...dealMsgs, ...quoteMsgs];
    allMessages.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

    return allMessages;
  }

  // Rates management operations
  async getRates(): Promise<Rate[]> {
    return await db.select().from(rates).where(eq(rates.isActive, true)).orderBy(rates.name);
  }

  async createRate(rateData: InsertRate): Promise<Rate> {
    const [rate] = await db.insert(rates).values(rateData).returning();
    return rate;
  }

  async updateRate(id: string, rateData: Partial<InsertRate>): Promise<Rate> {
    const [rate] = await db
      .update(rates)
      .set({ ...rateData, updatedAt: new Date() })
      .where(eq(rates.id, id))
      .returning();
    return rate;
  }

  async deleteRate(id: string): Promise<void> {
    await db.update(rates).set({ isActive: false }).where(eq(rates.id, id));
  }

  async seedRates(): Promise<void> {
    const existingRates = await this.getRates();
    if (existingRates.length > 0) return;

    const defaultRates = [
      {
        name: "Headline Debit Rate",
        category: "payment_processing",
        rateType: "percentage",
        value: "1.5",
        description: "Standard debit card processing rate for transactions",
        isActive: true,
      },
      {
        name: "Credit Card Rate",
        category: "payment_processing",
        rateType: "percentage",
        value: "2.1",
        description: "Standard credit card processing rate for transactions",
        isActive: true,
      },
      {
        name: "Business Funding Commission",
        category: "business_funding",
        rateType: "percentage",
        value: "60.0",
        description: "Commission rate for successful business funding referrals",
        isActive: true,
      },
      {
        name: "Equipment Finance Commission",
        category: "business_funding",
        rateType: "percentage",
        value: "55.0",
        description: "Commission rate for equipment financing referrals",
        isActive: true,
      }
    ];

    await db.insert(rates).values(defaultRates);
  }

  async getTeamReferralStats(userId: string): Promise<{
    sent: number;
    opened: number;
    clicked: number;
    registered: number;
    active: number;
    inactive: number;
    teamMembers: number;
  }> {
    // Efficient SQL: Single query with aggregations
    // Active = has at least one approved deal in the last 6 months
    // Inactive = had approved deals but none in last 6 months (churn tracking)
    // Approval check: status OR dealStage indicates approval or beyond

    // Use raw SQL to avoid Drizzle ORM issues with complex subqueries
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN partner_id IS NOT NULL OR referral_code IS NOT NULL THEN 1 END) as registered,
        -- Active = has approved deal in last 6 months
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM deals
          WHERE deals.referrer_id = users.id
            AND (
              deals.status IN ('approved', 'live', 'completed')
              OR deals.deal_stage IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
            )
            AND deals.submitted_at >= NOW() - INTERVAL '6 months'
        ) THEN 1 END) as active,
        -- Inactive = had approved deals but none in last 6 months
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM deals
          WHERE deals.referrer_id = users.id
            AND (
              deals.status IN ('approved', 'live', 'completed')
              OR deals.deal_stage IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
            )
        ) AND NOT EXISTS (
          SELECT 1 FROM deals
          WHERE deals.referrer_id = users.id
            AND (
              deals.status IN ('approved', 'live', 'completed')
              OR deals.deal_stage IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
            )
            AND deals.submitted_at >= NOW() - INTERVAL '6 months'
        ) THEN 1 END) as inactive
      FROM users
      WHERE parent_partner_id = ${userId}
    `);

    const stats = result.rows[0] || { total: 0, registered: 0, active: 0, inactive: 0 };

    return {
      sent: Number(stats.total),
      opened: Number(stats.registered),
      clicked: Number(stats.registered),
      registered: Number(stats.registered),
      active: Number(stats.active),
      inactive: Number(stats.inactive),
      teamMembers: Number(stats.total)
    };
  }

  async getTeamReferrals(userId: string): Promise<Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    joinedAt: Date;
    referralCode: string | null;
    hasSubmittedDeals: number;
  }>> {
    // Efficient SQL: Single query with LEFT JOIN to get deal counts
    const teamReferrals = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        createdAt: users.createdAt,
        partnerId: users.partnerId,
        referralCode: users.referralCode,
        totalDeals: sql<number>`COUNT(${deals.id})`,
        // Approved deals (any time)
        approvedDealsAllTime: sql<number>`COUNT(CASE WHEN (
          ${deals.status} IN ('approved', 'live', 'completed')
          OR ${deals.dealStage} IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
        ) THEN 1 END)`,
        // Approved deals in last 6 months
        approvedDealsRecent: sql<number>`COUNT(CASE WHEN (
          ${deals.status} IN ('approved', 'live', 'completed')
          OR ${deals.dealStage} IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
        ) AND ${deals.submittedAt} >= NOW() - INTERVAL '6 months' THEN 1 END)`,
        hasChildren: sql<number>`(SELECT COUNT(*) FROM ${users} children WHERE children.parent_partner_id = ${users.id})`
      })
      .from(users)
      .leftJoin(deals, eq(deals.referrerId, users.id))
      .where(eq(users.parentPartnerId, userId))
      .groupBy(users.id, users.firstName, users.lastName, users.email, users.createdAt, users.partnerId, users.referralCode);

    return teamReferrals.map((member) => {
      // 3-tier status system:
      // 1. Active: Has approved deals in last 6 months
      // 2. Inactive: Had approved deals but none in last 6 months
      // 3. Registered: Never had an approved deal
      let status = 'registered';

      if (member.approvedDealsRecent > 0) {
        status = 'active';
      } else if (member.approvedDealsAllTime > 0) {
        status = 'inactive'; // Was active but hasn't submitted in 6 months
      }

      return {
        id: member.id,
        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
        email: member.email,
        status,
        joinedAt: member.createdAt,
        referralCode: member.referralCode,
        hasSubmittedDeals: member.totalDeals
      };
    });
  }

  // Admin-level: Get stats for ALL users (not just team members)
  // Used for platform-wide churn analytics
  async getAllUsersStats(): Promise<{
    totalUsers: number;
    active: number;
    inactive: number;
    registered: number;
  }> {
    const stats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        // Active = has approved deal in last 6 months
        active: sql<number>`COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM ${deals}
          WHERE ${deals.referrerId} = ${users.id}
            AND (
              ${deals.status} IN ('approved', 'live', 'completed')
              OR ${deals.dealStage} IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
            )
            AND ${deals.submittedAt} >= NOW() - INTERVAL '6 months'
        ) THEN 1 END)`,
        // Inactive = had approved deals but none in last 6 months
        inactive: sql<number>`COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM ${deals}
          WHERE ${deals.referrerId} = ${users.id}
            AND (
              ${deals.status} IN ('approved', 'live', 'completed')
              OR ${deals.dealStage} IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
            )
        ) AND NOT EXISTS (
          SELECT 1 FROM ${deals}
          WHERE ${deals.referrerId} = ${users.id}
            AND (
              ${deals.status} IN ('approved', 'live', 'completed')
              OR ${deals.dealStage} IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
            )
            AND ${deals.submittedAt} >= NOW() - INTERVAL '6 months'
        ) THEN 1 END)`,
        // Registered = never had an approved deal
        registered: sql<number>`COUNT(CASE WHEN NOT EXISTS (
          SELECT 1 FROM ${deals}
          WHERE ${deals.referrerId} = ${users.id}
            AND (
              ${deals.status} IN ('approved', 'live', 'completed')
              OR ${deals.dealStage} IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed')
            )
        ) THEN 1 END)`
      })
      .from(users);

    const result = stats[0] || { total: 0, active: 0, inactive: 0, registered: 0 };

    return {
      totalUsers: result.total,
      active: result.active,
      inactive: result.inactive,
      registered: result.registered
    };
  }

  async getTeamHierarchy(userId: string): Promise<any[]> {
    // Get all team members referred by this user (direct and indirect, up to 3 levels)
    try {
      // Get direct team members (Level 1)
      const directTeam = await db
        .select()
        .from(users)
        .where(eq(users.referredBy, userId));

      // Process team member data with additional metrics
      const teamWithMetrics = await Promise.all(directTeam.map(async (member) => {
        // Get team size for this member
        const [teamSizeResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(users)
          .where(eq(users.referredBy, member.id));

        // Get deals submitted by this member
        const [dealsResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(deals)
          .where(eq(deals.userId, member.id));

        // Get total revenue for this member
        const [revenueResult] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${commissionPayments.amount}), 0)`
          })
          .from(commissionPayments)
          .where(eq(commissionPayments.recipientId, member.id));

        // Get monthly revenue for this member
        const [monthlyResult] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${commissionPayments.amount}), 0)`
          })
          .from(commissionPayments)
          .where(
            and(
              eq(commissionPayments.recipientId, member.id),
              gte(commissionPayments.createdAt, sql`CURRENT_DATE - INTERVAL '30 days'`)
            )
          );

        return {
          id: member.id,
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          createdAt: member.createdAt,
          referredBy: member.referredBy,
          partnerLevel: 1, // Direct referrals are L1
          teamSize: (teamSizeResult as any)?.count || 0,
          activeTeamMembers: 0, // TODO: Calculate active members
          hasSubmittedDeals: (dealsResult as any)?.count || 0,
          totalRevenue: Number((revenueResult as any)?.total || 0),
          monthlyRevenue: Number((monthlyResult as any)?.total || 0),
          lastActiveAt: null // TODO: Calculate last activity
        };
      }));

      return teamWithMetrics;
    } catch (error) {
      console.error("Error fetching team hierarchy:", error);
      return [];
    }
  }

  async getProgressionData(userId: string): Promise<{
    partnerLevel: string;
    teamSize: number;
    totalRevenue: number;
    directRevenue: number;
    overrideRevenue: number;
    totalInvites: number;
    successfulInvites: number;
    currentXP: number;
    xpToNextLevel: number;
    revenueGrowthPercent: number;
  }> {
    // Get user's partner level
    const user = await this.getUser(userId);
    const partnerLevel = user?.partnerLevel || 1;

    // Map numeric level to string
    const levelMap: Record<number, string> = {
      1: 'Bronze Partner',
      2: 'Silver Partner',
      3: 'Gold Partner',
      4: 'Platinum Partner'
    };

    // Get team stats
    const teamStats = await this.getTeamReferralStats(userId);

    // Get revenue from commission approvals
    const commissions = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${commissionApprovals.paymentStatus} = 'completed' THEN ${commissionApprovals.commissionAmount} ELSE 0 END), 0)`,
        directRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${commissionApprovals.paymentStatus} = 'completed' THEN ${commissionApprovals.commissionAmount} ELSE 0 END), 0)`,
      })
      .from(commissionApprovals)
      .where(eq(commissionApprovals.userId, userId));

    const revenue = commissions[0] || { totalRevenue: 0, directRevenue: 0 };

    // Get override revenue (from team members' sales)
    const overrideCommissions = await db
      .select({
        overrideRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${commissionPayments.status} = 'paid' AND ${commissionPayments.level} > 1 THEN ${commissionPayments.amount} ELSE 0 END), 0)`
      })
      .from(commissionPayments)
      .where(eq(commissionPayments.recipientId, userId));

    const override = overrideCommissions[0] || { overrideRevenue: 0 };

    const totalRev = Number(revenue.totalRevenue) + Number(override.overrideRevenue);

    // Calculate XP from real metrics
    // - 100 XP per completed deal
    // - 50 XP per team member
    // - 1 XP per £10 revenue
    const completedDeals = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(deals)
      .where(eq(deals.referrerId, userId));

    const dealsCount = completedDeals[0]?.count || 0;
    const currentXP = (dealsCount * 100) + (teamStats.active * 50) + Math.floor(totalRev / 10);

    // Calculate XP needed for next level
    const levels = [0, 500, 1500, 3500, 7500];
    const currentLevelIndex = levels.findIndex((xp, i) => currentXP < (levels[i + 1] || Infinity));
    const xpToNextLevel = (levels[currentLevelIndex + 1] || 0) - currentXP;

    // Calculate revenue growth (last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentRevenue = await db
      .select({
        total: sql<number>`COALESCE(SUM(${commissionApprovals.commissionAmount}), 0)`
      })
      .from(commissionApprovals)
      .where(
        and(
          eq(commissionApprovals.userId, userId),
          eq(commissionApprovals.paymentStatus, 'completed'),
          sql`${commissionApprovals.createdAt} >= ${thirtyDaysAgo}`
        )
      );

    const previousRevenue = await db
      .select({
        total: sql<number>`COALESCE(SUM(${commissionApprovals.commissionAmount}), 0)`
      })
      .from(commissionApprovals)
      .where(
        and(
          eq(commissionApprovals.userId, userId),
          eq(commissionApprovals.paymentStatus, 'completed'),
          sql`${commissionApprovals.createdAt} >= ${sixtyDaysAgo}`,
          sql`${commissionApprovals.createdAt} < ${thirtyDaysAgo}`
        )
      );

    const recent = Number(recentRevenue[0]?.total || 0);
    const previous = Number(previousRevenue[0]?.total || 0);
    const revenueGrowthPercent = previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 0;

    return {
      partnerLevel: levelMap[partnerLevel] || 'Bronze Partner',
      teamSize: teamStats.active,
      totalRevenue: totalRev,
      directRevenue: Number(revenue.directRevenue),
      overrideRevenue: Number(override.overrideRevenue),
      totalInvites: teamStats.sent,
      successfulInvites: teamStats.registered,
      currentXP,
      xpToNextLevel,
      revenueGrowthPercent
    };
  }

  // Quotes operations
  async createQuote(quoteData: any): Promise<any> {
    // Accept both dealId (new) and referralId (legacy) for backward compatibility
    const resolvedDealId = quoteData.dealId ?? quoteData.referralId;

    // Guard: ensure we have a deal ID before attempting insert
    if (!resolvedDealId) {
      throw new Error('Quote creation requires dealId or referralId');
    }

    // Generate a unique Quote ID if not provided
    let quoteId = quoteData.quoteId;
    if (!quoteId) {
      // Generate a unique Quote ID in format QUOTE-12345
      const timestamp = Date.now().toString().slice(-5);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      quoteId = `QUOTE-${timestamp}${random}`;

      // Check for uniqueness and regenerate if needed
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db
          .select()
          .from(quotes)
          .where(eq(quotes.quoteId, quoteId))
          .limit(1);

        if (existing.length === 0) break;

        const newRandom = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        quoteId = `QUOTE-${timestamp}${newRandom}`;
        attempts++;
      }
    }

    // Extract known fields and map dealId -> referralId for DB insert
    // This prevents spreading unknown keys and ensures referralId is set correctly
    const { dealId, referralId, ...restData } = quoteData;

    const insertPayload = {
      ...restData,
      referralId: resolvedDealId,  // Map to correct schema field name
      quoteId,
      createdBy: quoteData.createdBy,
    };

    const [quote] = await db
      .insert(quotes)
      .values(insertPayload)
      .returning();
    return quote;
  }

  async getQuotesByUserId(userId: string): Promise<any[]> {
    const result = await db
      .select({
        quote: quotes,
        deal: deals,
      })
      .from(quotes)
      .innerJoin(deals, eq(quotes.referralId, deals.id))
      .where(eq(deals.referrerId, userId))
      .orderBy(desc(quotes.createdAt));

    return result.map(row => ({
      ...row.quote,
      businessName: row.deal.businessName,
    }));
  }

  async getQuoteById(quoteId: string): Promise<any | undefined> {
    const result = await db
      .select({
        quote: quotes,
        deal: deals,
      })
      .from(quotes)
      .innerJoin(deals, eq(quotes.referralId, deals.id))
      .where(eq(quotes.id, quoteId));

    if (result.length === 0) return undefined;

    return {
      ...result[0].quote,
      businessName: result[0].deal.businessName,
      businessEmail: result[0].deal.businessEmail,
      businessPhone: result[0].deal.businessPhone,
    };
  }

  async updateQuoteJourneyStatus(quoteId: string, status: string): Promise<void> {
    const updateData: any = {
      customerJourneyStatus: status,
      updatedAt: new Date()
    };

    // Add audit trail dates for specific statuses
    if (status === 'docs_out') {
      updateData.docsOutDate = new Date();
    } else if (status === 'request_documents' || status === 'awaiting_docs') {
      updateData.requestDocumentsDate = new Date();
    }

    await db
      .update(quotes)
      .set(updateData)
      .where(eq(quotes.id, quoteId));
  }

  async addQuoteQuestion(quoteId: string, question: string): Promise<void> {
    await db
      .update(quotes)
      .set({
        partnerQuestion: question,
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId));
  }

  async addQuoteRateRequest(quoteId: string, request: string): Promise<void> {
    await db
      .update(quotes)
      .set({
        partnerRateRequest: request,
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId));
  }

  async approveQuoteByPartner(quoteId: string): Promise<{ referralId: string } | null> {
    // Update quote with approval timestamp
    const [updatedQuote] = await db
      .update(quotes)
      .set({
        customerJourneyStatus: 'awaiting_signup',
        approvedAt: new Date(),
        viewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId))
      .returning({ referralId: quotes.referralId });

    // Also update the deal stage to quote_approved
    if (updatedQuote?.referralId) {
      await db
        .update(deals)
        .set({
          dealStage: 'quote_approved',
          updatedAt: new Date()
        })
        .where(eq(deals.id, updatedQuote.referralId));
    }

    return updatedQuote || null;
  }

  async sendQuoteToClient(quoteId: string): Promise<{ referralId: string } | null> {
    // Update quote with sent timestamp
    const [updatedQuote] = await db
      .update(quotes)
      .set({
        customerJourneyStatus: 'sent_to_client',
        sentAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId))
      .returning({ referralId: quotes.referralId });

    // Also update the deal stage to quote_sent
    if (updatedQuote?.referralId) {
      await db
        .update(deals)
        .set({
          dealStage: 'quote_sent',
          updatedAt: new Date()
        })
        .where(eq(deals.id, updatedQuote.referralId));
    }

    return updatedQuote || null;
  }

  async saveQuoteSignupInfo(quoteId: string, dealId: string, signupData: any): Promise<void> {
    // Save director/owner information
    await db.insert(businessOwners).values({
      dealId: dealId,
      firstName: signupData.firstName,
      lastName: signupData.lastName,
      homeAddress: signupData.homeAddress,
      email: signupData.email,
      phone: signupData.phone,
    });

    // Save business details
    await db.insert(businessDetails).values({
      dealId: dealId,
      tradingName: signupData.tradingName,
      tradingAddress: signupData.tradingAddress,
      businessDescription: signupData.businessDescription,
      businessStructure: signupData.legalEntity,
      limitedCompanyName: signupData.limitedCompanyName || null,
      bankSortCode: signupData.sortCode,
      bankAccountNumber: signupData.bankAccountNumber,
    });

    // Update the quote to mark signup as completed
    await db
      .update(quotes)
      .set({
        customerJourneyStatus: 'signup_submitted',
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId));

    // Update deal stage to signup_submitted and mark signup as completed
    await db
      .update(deals)
      .set({
        dealStage: 'signup_submitted',
        status: 'quote_approved',
        signupCompletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(deals.id, dealId));
  }

  async getAllQuotesForAdmin(): Promise<any[]> {
    const { quoteQA } = await import("@shared/schema");
    const result = await db
      .select({
        id: quotes.id,
        dealId: quotes.referralId,
        businessName: deals.businessName,
        businessEmail: deals.businessEmail,
        customerJourneyStatus: quotes.customerJourneyStatus,
        status: quotes.status,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
        createdBy: quotes.createdBy,
        partnerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        partnerEmail: users.email,
        estimatedCommission: quotes.estimatedCommission,
        businessType: quotes.businessType,
        billUploadRequired: quotes.billUploadRequired,
        billUploaded: quotes.billUploaded,
        commissionPaid: quotes.commissionPaid,
      })
      .from(quotes)
      .leftJoin(deals, eq(quotes.referralId, deals.id))
      .leftJoin(users, eq(quotes.createdBy, users.id))
      .orderBy(desc(quotes.createdAt));

    return result;
  }

  async getPendingSignups(): Promise<any[]> {
    const result = await db
      .select({
        quoteId: quotes.id,
        dealId: quotes.referralId,
        businessName: deals.businessName,
        businessEmail: deals.businessEmail,
        customerJourneyStatus: quotes.customerJourneyStatus,
        createdAt: quotes.createdAt,
        docsOutDate: quotes.docsOutDate,
        requestDocumentsDate: quotes.requestDocumentsDate,
        partnerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        partnerEmail: users.email,
        ownerId: businessOwners.id,
        ownerFirstName: businessOwners.firstName,
        ownerLastName: businessOwners.lastName,
        ownerEmail: businessOwners.email,
        ownerPhone: businessOwners.phone,
        ownerHomeAddress: businessOwners.homeAddress,
        detailsId: businessDetails.id,
        tradingName: businessDetails.tradingName,
        tradingAddress: businessDetails.tradingAddress,
        businessDescription: businessDetails.businessDescription,
        businessStructure: businessDetails.businessStructure,
        limitedCompanyName: businessDetails.limitedCompanyName,
        bankSortCode: businessDetails.bankSortCode,
        bankAccountNumber: businessDetails.bankAccountNumber,
        estimatedCommission: quotes.estimatedCommission,
        businessType: quotes.businessType,
        billUploadRequired: quotes.billUploadRequired,
        billUploaded: quotes.billUploaded,
        commissionPaid: quotes.commissionPaid,
      })
      .from(quotes)
      .leftJoin(deals, eq(quotes.referralId, deals.id))
      .leftJoin(users, eq(quotes.createdBy, users.id))
      .leftJoin(businessOwners, eq(businessOwners.dealId, quotes.referralId))
      .leftJoin(businessDetails, eq(businessDetails.dealId, quotes.referralId))
      .where(
        sql`${quotes.commissionPaid} = false OR ${quotes.commissionPaid} IS NULL`
      )
      .orderBy(desc(quotes.createdAt));

    return result;
  }

  async getCompletedDeals(): Promise<any[]> {
    const result = await db
      .select({
        quoteId: quotes.id,
        dealId: quotes.referralId,
        businessName: deals.businessName,
        businessEmail: deals.businessEmail,
        customerJourneyStatus: quotes.customerJourneyStatus,
        createdAt: quotes.createdAt,
        partnerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        partnerEmail: users.email,
        ownerId: businessOwners.id,
        ownerFirstName: businessOwners.firstName,
        ownerLastName: businessOwners.lastName,
        ownerEmail: businessOwners.email,
        ownerPhone: businessOwners.phone,
        ownerHomeAddress: businessOwners.homeAddress,
        detailsId: businessDetails.id,
        tradingName: businessDetails.tradingName,
        tradingAddress: businessDetails.tradingAddress,
        businessDescription: businessDetails.businessDescription,
        businessStructure: businessDetails.businessStructure,
        limitedCompanyName: businessDetails.limitedCompanyName,
        bankSortCode: businessDetails.bankSortCode,
        bankAccountNumber: businessDetails.bankAccountNumber,
        estimatedCommission: quotes.estimatedCommission,
        businessType: quotes.businessType,
        billUploadRequired: quotes.billUploadRequired,
        billUploaded: quotes.billUploaded,
        commissionPaid: quotes.commissionPaid,
      })
      .from(quotes)
      .leftJoin(deals, eq(quotes.referralId, deals.id))
      .leftJoin(users, eq(quotes.createdBy, users.id))
      .leftJoin(businessOwners, eq(businessOwners.dealId, quotes.referralId))
      .leftJoin(businessDetails, eq(businessDetails.dealId, quotes.referralId))
      .where(and(
        sql`${businessOwners.id} IS NOT NULL`,
        sql`${quotes.commissionPaid} = true`
      ))
      .orderBy(desc(quotes.createdAt));

    return result;
  }

  async getSignupDetails(quoteId: string): Promise<any> {
    const [result] = await db
      .select({
        quoteId: quotes.id,
        dealId: quotes.referralId,
        businessName: deals.businessName,
        businessEmail: deals.businessEmail,
        customerJourneyStatus: quotes.customerJourneyStatus,
        createdAt: quotes.createdAt,
        partnerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        partnerEmail: users.email,
        ownerFirstName: businessOwners.firstName,
        ownerLastName: businessOwners.lastName,
        ownerEmail: businessOwners.email,
        ownerPhone: businessOwners.phone,
        ownerHomeAddress: businessOwners.homeAddress,
        tradingName: businessDetails.tradingName,
        tradingAddress: businessDetails.tradingAddress,
        businessDescription: businessDetails.businessDescription,
        businessStructure: businessDetails.businessStructure,
        limitedCompanyName: businessDetails.limitedCompanyName,
        bankSortCode: businessDetails.bankSortCode,
        bankAccountNumber: businessDetails.bankAccountNumber,
      })
      .from(quotes)
      .leftJoin(deals, eq(quotes.referralId, deals.id))
      .leftJoin(users, eq(quotes.createdBy, users.id))
      .leftJoin(businessOwners, eq(businessOwners.dealId, quotes.referralId))
      .leftJoin(businessDetails, eq(businessDetails.dealId, quotes.referralId))
      .where(eq(quotes.id, quoteId));

    return result;
  }

  async getSignupDetailsByDealId(dealId: string): Promise<any> {
    const [result] = await db
      .select({
        dealId: businessOwners.dealId,
        ownerFirstName: businessOwners.firstName,
        ownerLastName: businessOwners.lastName,
        ownerEmail: businessOwners.email,
        ownerPhone: businessOwners.phone,
        ownerHomeAddress: businessOwners.homeAddress,
        tradingName: businessDetails.tradingName,
        tradingAddress: businessDetails.tradingAddress,
        businessDescription: businessDetails.businessDescription,
        businessStructure: businessDetails.businessStructure,
        limitedCompanyName: businessDetails.limitedCompanyName,
        bankSortCode: businessDetails.bankSortCode,
        bankAccountNumber: businessDetails.bankAccountNumber,
      })
      .from(businessOwners)
      .leftJoin(businessDetails, eq(businessDetails.dealId, businessOwners.dealId))
      .where(eq(businessOwners.dealId, dealId));

    return result;
  }

  async updateQuoteCommission(quoteId: string, estimatedCommission: number): Promise<void> {
    await db
      .update(quotes)
      .set({
        estimatedCommission: estimatedCommission.toString(),
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId));
  }

  async updateQuoteBusinessType(quoteId: string, businessType: string, billUploadRequired: boolean): Promise<void> {
    await db
      .update(quotes)
      .set({
        businessType,
        billUploadRequired,
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId));
  }

  async recordCommissionPayment(quoteId: string, stripePaymentId: string): Promise<void> {
    await db
      .update(quotes)
      .set({
        commissionPaid: true,
        commissionPaidDate: new Date(),
        stripePaymentId,
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId));
  }

  async addQuoteQAMessage(quoteId: string, authorType: string, authorId: string | null, message: string): Promise<any> {
    const { quoteQA } = await import("@shared/schema");
    const [qaMessage] = await db
      .insert(quoteQA)
      .values({
        quoteId,
        authorType,
        authorId,
        message
      })
      .returning();
    return qaMessage;
  }

  async getQuoteQA(quoteId: string): Promise<any[]> {
    const { quoteQA } = await import("@shared/schema");
    const result = await db
      .select({
        id: quoteQA.id,
        quoteId: quoteQA.quoteId,
        authorType: quoteQA.authorType,
        authorId: quoteQA.authorId,
        authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Customer')`,
        message: quoteQA.message,
        createdAt: quoteQA.createdAt,
      })
      .from(quoteQA)
      .leftJoin(users, eq(quoteQA.authorId, users.id))
      .where(eq(quoteQA.quoteId, quoteId))
      .orderBy(quoteQA.createdAt);

    return result;
  }

  async getAllQuoteMessages(): Promise<any[]> {
    const { quoteQA, quotes, deals } = await import("@shared/schema");
    const result = await db
      .select({
        id: quoteQA.id,
        quoteId: quoteQA.quoteId,
        authorType: quoteQA.authorType,
        authorId: quoteQA.authorId,
        authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Customer')`,
        message: quoteQA.message,
        createdAt: quoteQA.createdAt,
        dealId: deals.id,
        businessName: deals.businessName,
      })
      .from(quoteQA)
      .leftJoin(users, eq(quoteQA.authorId, users.id))
      .leftJoin(quotes, eq(quoteQA.quoteId, quotes.id))
      .leftJoin(deals, eq(quotes.referralId, deals.id))
      .orderBy(desc(quoteQA.createdAt));

    return result;
  }

  async getAllUnifiedMessages(): Promise<any[]> {
    const { quoteQA, quotes, deals } = await import("@shared/schema");

    // Get deal messages
    const dealMsgs = await db
      .select({
        id: dealMessages.id,
        authorType: sql<string>`CASE WHEN ${dealMessages.isAdminMessage} THEN 'admin' ELSE 'partner' END`,
        authorId: dealMessages.senderId,
        authorName: dealMessages.senderName,
        message: dealMessages.message,
        createdAt: dealMessages.createdAt,
        dealId: dealMessages.dealId,
        businessName: deals.businessName,
        source: sql<string>`'deal'`,
      })
      .from(dealMessages)
      .leftJoin(deals, eq(dealMessages.dealId, deals.id))
      .orderBy(desc(dealMessages.createdAt));

    // Get quote Q&A messages
    const quoteMsgs = await db
      .select({
        id: quoteQA.id,
        authorType: quoteQA.authorType,
        authorId: quoteQA.authorId,
        authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Customer')`,
        message: quoteQA.message,
        createdAt: quoteQA.createdAt,
        dealId: deals.id,
        businessName: deals.businessName,
        source: sql<string>`'quote'`,
      })
      .from(quoteQA)
      .leftJoin(users, eq(quoteQA.authorId, users.id))
      .leftJoin(quotes, eq(quoteQA.quoteId, quotes.id))
      .leftJoin(deals, eq(quotes.referralId, deals.id))
      .orderBy(desc(quoteQA.createdAt));

    // Merge and sort by most recent first
    const allMessages = [...dealMsgs, ...quoteMsgs];
    allMessages.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Most recent first
    });

    return allMessages;
  }

  async createQuoteBillUpload(quoteId: string, dealId: string, fileName: string, fileSize: number, fileType: string, uploadedBy: string, documentType?: string, fileData?: string): Promise<any> {
    const { quoteBillUploads } = await import("@shared/schema");
    const [upload] = await db
      .insert(quoteBillUploads)
      .values({
        quoteId,
        dealId,
        fileName,
        fileSize,
        fileType,
        fileData,
        uploadedBy,
        documentType: documentType || 'switcher_statement',
        status: 'pending'
      })
      .returning();

    // Mark the quote as having bill uploaded
    await db
      .update(quotes)
      .set({
        billUploaded: true,
        updatedAt: new Date()
      })
      .where(eq(quotes.id, quoteId));

    // Return upload without fileData to reduce payload
    const { fileData: _, ...uploadWithoutData } = upload;
    return uploadWithoutData;
  }

  async getQuoteBillUploads(quoteId: string): Promise<any[]> {
    const { quoteBillUploads } = await import("@shared/schema");
    const result = await db
      .select({
        id: quoteBillUploads.id,
        quoteId: quoteBillUploads.quoteId,
        dealId: quoteBillUploads.dealId,
        fileName: quoteBillUploads.fileName,
        fileSize: quoteBillUploads.fileSize,
        fileType: quoteBillUploads.fileType,
        uploadedBy: quoteBillUploads.uploadedBy,
        documentType: quoteBillUploads.documentType,
        status: quoteBillUploads.status,
        adminNotes: quoteBillUploads.adminNotes,
        createdAt: quoteBillUploads.createdAt,
      })
      .from(quoteBillUploads)
      .where(eq(quoteBillUploads.quoteId, quoteId))
      .orderBy(desc(quoteBillUploads.createdAt));

    return result;
  }

  async getQuoteBillUploadById(billId: string): Promise<any | undefined> {
    const { quoteBillUploads } = await import("@shared/schema");
    const [result] = await db
      .select()
      .from(quoteBillUploads)
      .where(eq(quoteBillUploads.id, billId))
      .limit(1);

    return result;
  }

  async approveQuoteBill(billId: string, adminNotes?: string): Promise<void> {
    const { quoteBillUploads } = await import("@shared/schema");
    await db
      .update(quoteBillUploads)
      .set({
        status: 'approved',
        adminNotes
      })
      .where(eq(quoteBillUploads.id, billId));
  }

  async rejectQuoteBill(billId: string, adminNotes: string): Promise<void> {
    const { quoteBillUploads } = await import("@shared/schema");
    await db
      .update(quoteBillUploads)
      .set({
        status: 'rejected',
        adminNotes
      })
      .where(eq(quoteBillUploads.id, billId));
  }

  // Test data seeding function for demonstrating referral system functionality
  async seedTestDeals(): Promise<void> {
    try {
      // Get a test user (preferably admin) to assign referrals to
      const [testUser] = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);
      if (!testUser) {
        console.log('No admin user found - skipping test referral seeding');
        return;
      }

      // Check if test referrals already exist
      const existingTestReferrals = await db.select()
        .from(deals)
        .where(eq(deals.referrerId, testUser.id))
        .limit(1);

      if (existingTestReferrals.length > 0) {
        console.log('Test referrals already exist - skipping seeding');
        return;
      }

      // Get business types for referral assignment
      const businessTypes = await this.getBusinessTypes();
      if (businessTypes.length === 0) {
        await this.seedBusinessTypes();
      }
      const updatedBusinessTypes = await this.getBusinessTypes();

      const testReferrals = [
        {
          referrerId: testUser.id,
          businessName: "Bella Vista Italian Restaurant",
          businessEmail: "owner@bellavistaitalia.co.uk",
          businessPhone: "+44 20 7123 4567",
          businessAddress: "15 High Street, London, SW1A 1AA",
          businessTypeId: updatedBusinessTypes[1]?.id || updatedBusinessTypes[0]?.id, // Restaurant
          currentProcessor: "Square",
          monthlyVolume: "£85,000",
          currentRate: "2.2%",
          referralLevel: 1,
          commissionPercentage: "60.00",
          dealStage: "quote_sent",
          status: "quoted",
          estimatedCommission: "500.00",
          quoteAmount: "5000.00",
          quoteGenerated: true,
          notes: "High volume restaurant looking for better rates on card processing",
          adminNotes: "Competitive quote sent - strong conversion potential",
          gdprConsent: true,
          quoteRates: {
            debitRate: "1.4%",
            creditRate: "1.9%",
            monthlyFee: "£25",
            terminalRental: "£15/month"
          },
          requiredDocuments: ["identification", "proof_of_bank", "business_registration"],
          receivedDocuments: [],
        },
        {
          referrerId: testUser.id,
          businessName: "TechStart Solutions Ltd",
          businessEmail: "finance@techstartsolutions.com",
          businessPhone: "+44 161 789 1234",
          businessAddress: "45 Innovation Drive, Manchester, M1 4AX",
          businessTypeId: updatedBusinessTypes[0]?.id, // Small Business
          currentProcessor: "Worldpay",
          monthlyVolume: "£25,000",
          currentRate: "2.5%",
          referralLevel: 1,
          commissionPercentage: "60.00",
          dealStage: "quote_approved",
          status: "approved",
          estimatedCommission: "150.00",
          actualCommission: "150.00",
          quoteAmount: "2500.00",
          clientApproved: true,
          quoteGenerated: true,
          notes: "Tech startup looking for competitive processing rates",
          adminNotes: "Client approved quote - awaiting documentation",
          gdprConsent: true,
          quoteRates: {
            debitRate: "1.5%",
            creditRate: "2.1%",
            monthlyFee: "£20",
            terminalRental: "£12/month"
          },
          requiredDocuments: ["identification", "proof_of_bank"],
          receivedDocuments: ["identification"],
          docsOutConfirmed: true,
          docsOutConfirmedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        {
          referrerId: testUser.id,
          businessName: "Green Garden Center",
          businessEmail: "info@greengardencenter.co.uk",
          businessPhone: "+44 1234 567890",
          businessAddress: "78 Garden Road, Birmingham, B15 3TG",
          businessTypeId: updatedBusinessTypes[0]?.id, // Small Business
          currentProcessor: "Stripe",
          monthlyVolume: "£15,000",
          currentRate: "2.9%",
          referralLevel: 1,
          commissionPercentage: "60.00",
          dealStage: "processing",
          status: "approved",
          estimatedCommission: "150.00",
          actualCommission: "150.00",
          quoteAmount: "2000.00",
          clientApproved: true,
          quoteGenerated: true,
          notes: "Garden center seeking better processing rates for seasonal business",
          adminNotes: "All documentation received - processing application",
          gdprConsent: true,
          quoteRates: {
            debitRate: "1.6%",
            creditRate: "2.2%",
            monthlyFee: "£18",
            terminalRental: "£10/month"
          },
          requiredDocuments: ["identification", "proof_of_bank", "business_registration"],
          receivedDocuments: ["identification", "proof_of_bank", "business_registration"],
          docsOutConfirmed: true,
          docsOutConfirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
        {
          referrerId: testUser.id,
          businessName: "Premium Fitness Studio",
          businessEmail: "admin@premiumfitness.co.uk",
          businessPhone: "+44 207 987 6543",
          businessAddress: "92 Wellness Avenue, London, EC2A 1BB",
          businessTypeId: updatedBusinessTypes[1]?.id || updatedBusinessTypes[0]?.id, // Hospitality
          currentProcessor: "iZettle",
          monthlyVolume: "£45,000",
          currentRate: "2.3%",
          referralLevel: 1,
          commissionPercentage: "60.00",
          dealStage: "completed",
          status: "paid",
          estimatedCommission: "300.00",
          actualCommission: "300.00",
          quoteAmount: "4000.00",
          clientApproved: true,
          quoteGenerated: true,
          notes: "Fitness studio looking for reliable payment processing for memberships",
          adminNotes: "Successfully onboarded - commission paid",
          gdprConsent: true,
          quoteRates: {
            debitRate: "1.3%",
            creditRate: "1.8%",
            monthlyFee: "£22",
            terminalRental: "£14/month"
          },
          requiredDocuments: ["identification", "proof_of_bank"],
          receivedDocuments: ["identification", "proof_of_bank"],
          docsOutConfirmed: true,
          docsOutConfirmedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
        {
          referrerId: testUser.id,
          businessName: "City Electronics Repair",
          businessEmail: "service@cityelectronics.co.uk",
          businessPhone: "+44 141 555 7890",
          businessAddress: "23 Repair Street, Glasgow, G1 2HF",
          businessTypeId: updatedBusinessTypes[0]?.id, // Small Business
          currentProcessor: "PayPal Here",
          monthlyVolume: "£8,000",
          currentRate: "3.4%",
          referralLevel: 1,
          commissionPercentage: "60.00",
          dealStage: "quote_request_received",
          status: "pending",
          estimatedCommission: "100.00",
          quoteGenerated: false,
          notes: "Small repair shop looking to reduce high processing fees",
          adminNotes: "New referral - need to prepare competitive quote",
          gdprConsent: true,
          requiredDocuments: ["identification", "proof_of_bank"],
          receivedDocuments: [],
        },
      ];

      // Insert test referrals
      const insertedReferrals = await db.insert(deals).values(testReferrals).returning();

      // Create commission approvals for completed referrals
      const commissionApprovalsData = insertedReferrals
        .filter(r => r.status === 'paid' && r.actualCommission)
        .map(referral => ({
          dealId: deal.id,
          userId: testUser.id,
          commissionAmount: deal.actualCommission!,
          clientBusinessName: deal.businessName,
          approvalStatus: 'approved' as const,
          approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          paymentStatus: 'completed' as const,
          paymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          paymentReference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          adminNotes: 'Commission processed via automated system',
          ratesData: {
            baseCommission: deal.actualCommission,
            commissionRate: '60%',
            level: 1
          }
        }));

      if (commissionApprovalsData.length > 0) {
        await db.insert(commissionApprovals).values(commissionApprovalsData);
      }

      console.log(`Successfully seeded ${insertedReferrals.length} test referrals and ${commissionApprovalsData.length} commission approvals`);
    } catch (error) {
      console.error('Error seeding test referrals:', error);
      throw error;
    }
  }

  // Commission approval operations
  async createCommissionApproval(approvalData: InsertCommissionApproval): Promise<CommissionApproval> {
    const [approval] = await db.insert(commissionApprovals).values(approvalData).returning();
    return approval;
  }

  async getUserCommissionApprovals(userId: string): Promise<CommissionApproval[]> {
    return await db.select().from(commissionApprovals).where(eq(commissionApprovals.userId, userId));
  }

  async getCommissionApprovalsByUserId(userId: string): Promise<CommissionApproval[]> {
    return await db
      .select()
      .from(commissionApprovals)
      .where(eq(commissionApprovals.userId, userId))
      .orderBy(desc(commissionApprovals.createdAt));
  }

  async getAllCommissionApprovals(): Promise<CommissionApproval[]> {
    return await db
      .select()
      .from(commissionApprovals)
      .orderBy(desc(commissionApprovals.createdAt));
  }

  /**
   * Distribute commissions for a deal across the referral hierarchy
   * Creates commission approvals for:
   * - Deal creator: 60% (direct commission)
   * - Level 1 up (referrer): 20% (override commission)
   * - Level 2 up (referrer's referrer): 10% (override commission)
   * 
   * @param dealId - The deal ID
   * @param totalCommission - Total commission amount from the deal
   * @param dealCreatorId - User who created the deal
   * @param clientBusinessName - Business name for the deal
   * @param adminNotes - Optional admin notes
   * @param ratesData - Optional rates data
   * @returns Array of created commission approvals
   */
  async distributeCommissions(
    dealId: string,
    totalCommission: number,
    dealCreatorId: string,
    clientBusinessName?: string,
    adminNotes?: string | null,
    ratesData?: any
  ): Promise<CommissionApproval[]> {
    const approvals: CommissionApproval[] = [];

    // 1. Create commission for deal creator (60%)
    const creatorCommissionAmount = Number((totalCommission * 0.60).toFixed(2));
    const creatorApproval = await this.createCommissionApproval({
      dealId,
      userId: dealCreatorId,
      commissionAmount: creatorCommissionAmount,
      clientBusinessName,
      commissionType: 'direct',  // Direct commission
      level: 0,  // Deal creator = level 0
      adminNotes,
      ratesData: ratesData ? JSON.stringify(ratesData) : null,
    });
    approvals.push(creatorApproval);

    console.log(`[COMMISSION] Created direct commission: £${creatorCommissionAmount} (60%) for user ${dealCreatorId}`);

    // 2. Get upline from partner_hierarchy
    const uplineEntries = await db
      .select()
      .from(partnerHierarchy)
      .where(eq(partnerHierarchy.childId, dealCreatorId))
      .orderBy(partnerHierarchy.level);

    // 3. Create override commissions for upline
    for (const entry of uplineEntries) {
      let overridePercentage = 0;

      if (entry.level === 1) {
        overridePercentage = 0.20;  // 20% for level 1 up
      } else if (entry.level === 2) {
        overridePercentage = 0.10;  // 10% for level 2 up
      }
      // Level 3+ gets 0%

      if (overridePercentage > 0) {
        const overrideCommissionAmount = Number((totalCommission * overridePercentage).toFixed(2));
        const overrideApproval = await this.createCommissionApproval({
          dealId,
          userId: entry.parentId,
          commissionAmount: overrideCommissionAmount,
          clientBusinessName,
          commissionType: 'override',  // Override commission
          level: entry.level,
          adminNotes: `Level ${entry.level} override commission`,
          ratesData: ratesData ? JSON.stringify(ratesData) : null,
        });
        approvals.push(overrideApproval);

        console.log(`[COMMISSION] Created level ${entry.level} override: £${overrideCommissionAmount} (${overridePercentage * 100}%) for user ${entry.parentId}`);
      }
    }

    // 4. Calculate and log company revenue
    const totalPaid = approvals.reduce((sum, a) => sum + Number(a.commissionAmount), 0);
    const companyRevenue = Number((totalCommission - totalPaid).toFixed(2));

    console.log(`[COMMISSION] Deal ${dealId} - Total: £${totalCommission}, Paid: £${totalPaid} (${approvals.length} recipients), Company Revenue: £${companyRevenue}`);

    return approvals;
  }

  async updateCommissionApprovalStatus(approvalId: string, status: string): Promise<CommissionApproval> {
    const updateData: any = {
      approvalStatus: status,
      updatedAt: new Date()
    };

    if (status === 'approved') {
      updateData.approvedAt = new Date();
    }

    const [approval] = await db
      .update(commissionApprovals)
      .set(updateData)
      .where(eq(commissionApprovals.id, approvalId))
      .returning();
    return approval;
  }

  async createCommissionPayment(paymentData: {
    dealId: string;
    recipientId: string;
    level: number;
    amount: string;
    percentage: string;
    totalCommission?: string;
    businessName?: string;
    dealStage?: string;
    approvalStatus?: string;
    paymentStatus?: string;
    paymentDate?: Date;
    transferReference?: string;
    notes?: string;
  }): Promise<any> {
    const [payment] = await db.insert(commissionPayments).values({
      dealId: paymentData.dealId,
      recipientId: paymentData.recipientId,
      level: paymentData.level,
      amount: paymentData.amount,
      percentage: paymentData.percentage,
      totalCommission: paymentData.totalCommission || null,
      businessName: paymentData.businessName || null,
      dealStage: paymentData.dealStage || null,
      approvalStatus: paymentData.approvalStatus || 'pending',
      paymentStatus: paymentData.paymentStatus || 'pending',
      paymentDate: paymentData.paymentDate || null,
      transferReference: paymentData.transferReference || null,
      notes: paymentData.notes || null,
    }).returning();
    return payment;
  }

  async getCommissionPaymentsByRecipient(recipientId: string): Promise<any[]> {
    return await db
      .select()
      .from(commissionPayments)
      .where(eq(commissionPayments.recipientId, recipientId))
      .orderBy(desc(commissionPayments.createdAt));
  }

  async getCommissionPaymentsByDeal(dealId: string): Promise<any[]> {
    return await db
      .select()
      .from(commissionPayments)
      .where(eq(commissionPayments.dealId, dealId))
      .orderBy(desc(commissionPayments.createdAt));
  }

  async getTeamCommissionPayments(userId: string): Promise<any[]> {
    // Get commission payments where the user is recipient and level is 2 or 3 (override payments)
    return await db
      .select()
      .from(commissionPayments)
      .where(eq(commissionPayments.recipientId, userId))
      .orderBy(desc(commissionPayments.createdAt));
  }

  async updateCommissionPaymentApproval(paymentId: string, approvalStatus: string, queryNotes: string | null): Promise<any> {
    const updateData: any = {
      approvalStatus,
      updatedAt: new Date()
    };

    if (approvalStatus === 'approved') {
      updateData.approvedAt = new Date();
      updateData.paymentStatus = 'approved_pending';
    }

    if (queryNotes) {
      updateData.queryNotes = queryNotes;
    }

    const [payment] = await db
      .update(commissionPayments)
      .set(updateData)
      .where(eq(commissionPayments.id, paymentId))
      .returning();
    return payment;
  }

  async getDownlineUsers(userId: string): Promise<any[]> {
    // Get all users who have this user in their parent chain
    const allUsers = await this.getAllUsers();
    const downline: any[] = [];

    // Find direct children (level 1)
    const directChildren = allUsers.filter((u: any) => u.parentPartnerId === userId);
    downline.push(...directChildren);

    // Find grandchildren (level 2)
    for (const child of directChildren) {
      const grandchildren = allUsers.filter((u: any) => u.parentPartnerId === child.id);
      downline.push(...grandchildren);
    }

    return downline;
  }

  async processCommissionPayment(approvalId: string, paymentReference: string): Promise<void> {
    await db
      .update(commissionApprovals)
      .set({
        paymentStatus: 'completed',
        paymentDate: new Date(),
        paymentReference,
        updatedAt: new Date()
      })
      .where(eq(commissionApprovals.id, approvalId));
  }

  async distributeUplineCommissions(
    dealId: string,
    totalCommission: number,
    paymentReference: string,
    paymentMethod: string
  ): Promise<CommissionApproval[]> {
    // Get the deal to find the submitter
    const allDeals = await this.getAllReferrals();
    const deal = allDeals.find((r: any) => r.id === dealId);

    if (!deal) {
      throw new Error('Deal not found');
    }

    const submitterId = deal.referrerId;
    const businessName = deal.businessName;
    const createdApprovals: CommissionApproval[] = [];

    // Commission distribution:
    // - Submitter gets 60%
    // - Parent (1 level up) gets 20%
    // - Grandparent (2 levels up) gets 10%
    // - Great-grandparent (3+ levels up) gets 0%

    const commissionTiers = [
      { level: 0, percentage: 60, label: 'Direct Commission' },      // Submitter
      { level: 1, percentage: 20, label: 'Level 1 Override' },        // Parent
      { level: 2, percentage: 10, label: 'Level 2 Override' },        // Grandparent
    ];

    // Start with the submitter and walk up the chain
    let currentUserId = submitterId;

    for (let i = 0; i < commissionTiers.length; i++) {
      if (!currentUserId) break; // No more people in the chain

      const tier = commissionTiers[i];
      const commissionAmount = (totalCommission * tier.percentage) / 100;

      // Create commission approval for this person
      const approval = await this.createCommissionApproval({
        dealId: dealId,
        userId: currentUserId,
        commissionAmount: commissionAmount.toString(),
        clientBusinessName: businessName,
        approvalStatus: 'approved',
        approvedAt: new Date(),
        paymentStatus: 'completed',
        paymentDate: new Date(),
        paymentReference: `${paymentReference}-L${i}`,
        adminNotes: `${tier.label} (${tier.percentage}% of £${totalCommission.toFixed(2)})`,
        ratesData: {
          baseCommission: totalCommission.toString(),
          commissionRate: `${tier.percentage}%`,
          level: i + 1,
          paymentMethod: paymentMethod,
          commissionType: i === 0 ? 'direct' : 'override'
        }
      });

      createdApprovals.push(approval);

      // Get the next person in the chain (parent)
      if (i < commissionTiers.length - 1) {
        const currentUser = await this.getUser(currentUserId);
        currentUserId = currentUser?.parentPartnerId || null;
      }
    }

    return createdApprovals;
  }

  // Audit trail operations
  async createAudit(auditData: InsertAudit): Promise<Audit> {
    const [audit] = await db.insert(audits).values(auditData).returning();
    return audit;
  }

  async getAudits(limit: number = 100): Promise<Audit[]> {
    return await db
      .select()
      .from(audits)
      .orderBy(desc(audits.timestamp))
      .limit(limit);
  }

  async getUserAudits(userId: string, limit: number = 50): Promise<Audit[]> {
    return await db
      .select()
      .from(audits)
      .where(eq(audits.actorUserId, userId))
      .orderBy(desc(audits.timestamp))
      .limit(limit);
  }

  // Request logs operations
  async createRequestLog(logData: InsertRequestLog): Promise<RequestLog> {
    const [log] = await db.insert(requestLogs).values(logData).returning();
    return log;
  }

  async getRequestLogs(limit: number = 100): Promise<RequestLog[]> {
    return await db
      .select()
      .from(requestLogs)
      .orderBy(desc(requestLogs.timestamp))
      .limit(limit);
  }

  async getErrorLogs(limit: number = 50): Promise<RequestLog[]> {
    return await db
      .select()
      .from(requestLogs)
      .where(sql`status_code >= 400`)
      .orderBy(desc(requestLogs.timestamp))
      .limit(limit);
  }

  // Webhook logs operations
  async createWebhookLog(logData: InsertWebhookLog): Promise<WebhookLog> {
    const [log] = await db.insert(webhookLogs).values(logData).returning();
    return log;
  }

  async getWebhookLogs(limit: number = 100): Promise<WebhookLog[]> {
    return await db
      .select()
      .from(webhookLogs)
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit);
  }

  async getFailedWebhooks(): Promise<WebhookLog[]> {
    return await db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.delivered, false))
      .orderBy(desc(webhookLogs.createdAt));
  }

  // Account management operations
  async updateUserProfile(userId: string, profileData: any): Promise<void> {
    await db
      .update(users)
      .set({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateBankingDetails(userId: string, bankingData: any): Promise<void> {
    // In a real implementation, this would store encrypted banking details
    // For now, we'll just log that banking details were updated
    console.log(`Banking details updated for user ${userId}:`, Object.keys(bankingData));
  }

  async createFeedback(feedbackData: any): Promise<string> {
    // In a real implementation, this would create a feedback record
    // For now, we'll just return a mock ID and log the feedback
    const feedbackId = `feedback_${Date.now()}`;
    console.log(`Feedback submitted:`, feedbackData);
    return feedbackId;
  }

  // Admin audit logging operations
  async createAdminAuditLog(auditLog: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const [log] = await db.insert(adminAuditLogs).values(auditLog).returning();
    return log;
  }

  async getAdminAuditLogs(limit: number = 100): Promise<AdminAuditLog[]> {
    return await db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);
  }

  // MLM level tracking operations
  async calculateReferralLevel(referrerId: string): Promise<number> {
    // Get the referrer's information
    const referrer = await this.getUser(referrerId);
    if (!referrer) return 1;

    // Calculate the referrer's level in the MLM hierarchy
    // Level 1 = direct (original partner), Level 2 = partner's referral, Level 3 = level 2's referral
    let level = 1;
    let currentUserId = referrerId;

    // Traverse up the MLM chain to find the level
    while (level < 3) {
      const currentUser = await this.getUser(currentUserId);
      if (!currentUser?.parentPartnerId) break;

      level++;
      currentUserId = currentUser.parentPartnerId;
    }

    return Math.min(level, 3); // Cap at level 3
  }

  getCommissionPercentage(level: number): number {
    const commissionRates: { [key: number]: number } = {
      1: 60.00, // Level 1 - Direct referrals get 60%
      2: 20.00, // Level 2 - Second level gets 20%  
      3: 10.00  // Level 3 - Third level gets 10%
    };
    return commissionRates[level] || 0;
  }

  async getMlmHierarchy(userId: string): Promise<{ children: User[]; parents: User[]; level: number }> {
    // Get direct children (users who have this user as parent)
    const children = await db
      .select()
      .from(users)
      .where(eq(users.parentPartnerId, userId));

    // Get parent chain
    const parents: User[] = [];
    let currentUserId = userId;
    let level = 1;

    while (parents.length < 3) { // Limit to 3 levels
      const currentUser = await this.getUser(currentUserId);
      if (!currentUser?.parentPartnerId) break;

      const parent = await this.getUser(currentUser.parentPartnerId);
      if (!parent) break;

      parents.push(parent);
      currentUserId = parent.id;
      level++;
    }

    return { children, parents, level };
  }

  async getDealsByLevel(userId: string): Promise<{ [key: number]: Referral[] }> {
    const allDeals = await db
      .select()
      .from(deals)
      .where(eq(deals.referrerId, userId))
      .orderBy(desc(deals.submittedAt));

    // Group referrals by level
    const referralsByLevel: { [key: number]: Referral[] } = { 1: [], 2: [], 3: [] };

    allDeals.forEach(deal => {
      const level = deal.referralLevel || 1;
      if (referralsByLevel[level]) {
        referralsByLevel[level].push(deal);
      }
    });

    return referralsByLevel;
  }

  async createDealWithLevel(dealData: InsertDeal, referrerId: string): Promise<Deal> {
    // Calculate the referral level based on MLM hierarchy
    const referralLevel = await this.calculateReferralLevel(referrerId);
    const commissionPercentage = this.getCommissionPercentage(referralLevel);

    // Find the parent referrer (who will get commission for this referral)
    const referrer = await this.getUser(referrerId);
    let parentReferrerId = null;

    if (referrer?.parentPartnerId && referralLevel > 1) {
      parentReferrerId = referrer.parentPartnerId;
    }

    // Generate a unique deal/quote ID (format: QR-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const dealId = `QR-${dateStr}-${randomSuffix}`;

    // Create the deal with level information
    const dealWithLevel = {
      ...dealData,
      dealId,
      referralLevel,
      parentReferrerId,
      commissionPercentage: commissionPercentage.toString(),
      status: 'submitted',
      dealStage: 'quote_request_received'
    };

    return this.createDeal(dealWithLevel);
  }

  // Waitlist operations
  async createWaitlistEntry(waitlistData: InsertWaitlist): Promise<Waitlist> {
    const [entry] = await db
      .insert(waitlist)
      .values(waitlistData)
      .returning();
    return entry;
  }

  async getWaitlistEntries(): Promise<Waitlist[]> {
    return await db
      .select()
      .from(waitlist)
      .orderBy(desc(waitlist.createdAt));
  }

  async getWaitlistEntryByEmail(email: string): Promise<Waitlist | undefined> {
    const [entry] = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email));
    return entry;
  }

  async updateWaitlistStatus(id: string, status: string): Promise<Waitlist> {
    const [entry] = await db
      .update(waitlist)
      .set({ status, updatedAt: new Date() })
      .where(eq(waitlist.id, id))
      .returning();
    if (!entry) {
      throw new Error('Waitlist entry not found');
    }
    return entry;
  }

  // Push subscription operations
  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [created] = await db
      .insert(pushSubscriptions)
      .values(subscription)
      .returning();
    return created;
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return subscription;
  }

  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      ))
      .orderBy(desc(pushSubscriptions.createdAt));
  }

  async updatePushSubscription(id: string, updates: Partial<InsertPushSubscription>): Promise<PushSubscription> {
    const [updated] = await db
      .update(pushSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pushSubscriptions.id, id))
      .returning();
    if (!updated) {
      throw new Error('Push subscription not found');
    }
    return updated;
  }

  async deletePushSubscription(id: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, id));
  }

  // Invoice operations
  async createInvoice(quoteId: string, partnerId: string, amount: number, businessName?: string, dealId?: string): Promise<Invoice> {
    // Generate invoice number in format INV-YYYY-NNNN
    const year = new Date().getFullYear();
    const count = await db.select({ count: sql<number>`count(*)` }).from(invoices);
    const nextNumber = (parseInt(count[0]?.count?.toString() || '0') + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${year}-${nextNumber}`;

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        quoteId,
        partnerId,
        amount: amount.toString(),
        businessName,
        dealId,
        status: 'pending',
      })
      .returning();
    return invoice;
  }

  async getInvoicesByPartnerId(partnerId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.partnerId, partnerId))
      .orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoiceById(invoiceId: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId));
    return invoice;
  }

  async addInvoiceQuery(invoiceId: string, queryNotes: string): Promise<void> {
    await db
      .update(invoices)
      .set({
        queryNotes,
        hasQuery: true,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId));
  }

  async markInvoiceAsPaid(invoiceId: string, paymentReference: string, adminNotes?: string): Promise<void> {
    await db
      .update(invoices)
      .set({
        status: 'paid',
        paymentReference,
        adminNotes,
        paidAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId));
  }

  async updateInvoiceStatus(invoiceId: string, status: string): Promise<void> {
    await db
      .update(invoices)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId));
  }

  // Accounting Integrations
  async getAccountingIntegrations(userId: string): Promise<AccountingIntegration[]> {
    return await db
      .select()
      .from(accountingIntegrations)
      .where(eq(accountingIntegrations.userId, userId));
  }

  async getAccountingIntegrationByProvider(userId: string, provider: string): Promise<AccountingIntegration | undefined> {
    const [integration] = await db
      .select()
      .from(accountingIntegrations)
      .where(and(
        eq(accountingIntegrations.userId, userId),
        eq(accountingIntegrations.provider, provider)
      ));
    return integration;
  }

  async createAccountingIntegration(integrationData: InsertAccountingIntegration): Promise<AccountingIntegration> {
    // Check if integration already exists for this user and provider
    const existing = await this.getAccountingIntegrationByProvider(
      integrationData.userId,
      integrationData.provider
    );

    if (existing) {
      // Update existing integration - preserve existing values if not provided
      const updates = {
        ...integrationData,
        settings: integrationData.settings ?? existing.settings,
        accessToken: integrationData.accessToken ?? existing.accessToken,
        refreshToken: integrationData.refreshToken ?? existing.refreshToken,
      };
      const [updated] = await db
        .update(accountingIntegrations)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(accountingIntegrations.id, existing.id))
        .returning();
      return updated;
    }

    const [integration] = await db
      .insert(accountingIntegrations)
      .values(integrationData)
      .returning();
    return integration;
  }

  async updateAccountingIntegration(integrationId: string, updates: Partial<AccountingIntegration>): Promise<AccountingIntegration> {
    const [integration] = await db
      .update(accountingIntegrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accountingIntegrations.id, integrationId))
      .returning();
    return integration;
  }

  async deleteAccountingIntegration(integrationId: string): Promise<void> {
    await db
      .delete(accountingIntegrations)
      .where(eq(accountingIntegrations.id, integrationId));
  }

  async findIntegrationByState(state: string): Promise<AccountingIntegration | undefined> {
    // Query for integration with matching state using SQL JSON operator
    const integrations = await db
      .select()
      .from(accountingIntegrations)
      .where(sql`${accountingIntegrations.settings}->>'oauthState' = ${state}`)
      .limit(1);

    return integrations[0];
  }
}

export const storage = new DatabaseStorage();
