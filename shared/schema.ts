import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users: any = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  profession: varchar("profession"),
  company: varchar("company"),
  clientBaseSize: varchar("client_base_size"),
  gdprConsent: boolean("gdpr_consent").default(false),
  marketingConsent: boolean("marketing_consent").default(false),
  // Banking information for commission payments
  bankAccountName: varchar("bank_account_name"),
  bankSortCode: varchar("bank_sort_code"),
  bankAccountNumber: varchar("bank_account_number"),
  bankingComplete: boolean("banking_complete").default(false),
  // Company information
  companyNumber: varchar("company_number"),
  vatNumber: varchar("vat_number"),
  businessAddress: text("business_address"),
  // Partner tracking and MLM structure
  partnerId: varchar("partner_id").unique(),
  parentPartnerId: varchar("parent_partner_id").references((): any => users.id, { onDelete: "set null" }), // For MLM structure
  referralCode: varchar("referral_code").unique(),
  partnerLevel: integer("partner_level").default(1), // 1, 2, 3 for commission tiers
  // Team management
  teamRole: varchar("team_role").default("member"), // owner, admin, manager, member
  teamId: varchar("team_id").references(() => teams.id, { onDelete: "set null" }),
  canSubmitReferrals: boolean("can_submit_referrals").default(true),
  canViewCommissions: boolean("can_view_commissions").default(true),
  canManageTeam: boolean("can_manage_team").default(false),
  // Admin access
  isAdmin: boolean("is_admin").default(false),
  // Stripe integration
  stripeAccountId: varchar("stripe_account_id"),
  // Onboarding tracking
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  tourStarted: timestamp("tour_started"),
  tourCompleted: timestamp("tour_completed"),
  tourSkipped: timestamp("tour_skipped"),
  profileCompleted: boolean("profile_completed").default(false),
  firstInviteSent: timestamp("first_invite_sent"),
  onboardingXp: integer("onboarding_xp").default(0),
  country: varchar("country").default("gb"),
  phone: varchar("phone"),
  // Custom auth fields
  passwordHash: varchar("password_hash"), // bcrypt hash - nullable for legacy OAuth users
  emailVerified: boolean("email_verified").default(false),
  verificationToken: varchar("verification_token"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  loginAttempts: integer("login_attempts").default(0),
  lockoutUntil: timestamp("lockout_until"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_partner_id_idx").on(table.partnerId),
  index("users_parent_partner_id_idx").on(table.parentPartnerId),
  index("users_team_id_idx").on(table.teamId),
  index("users_referral_code_idx").on(table.referralCode),
]);

export const businessTypes = pgTable("business_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  baseCommission: decimal("base_commission", { precision: 10, scale: 2 }),
  minVolume: decimal("min_volume", { precision: 15, scale: 2 }),
  maxVolume: decimal("max_volume", { precision: 15, scale: 2 }),
  processingTime: varchar("processing_time"),
});

// Products table for different services offered
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // card_machines, business_funding, utilities, insurance
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id"), // Deal ID from opportunity pipeline
  referrerId: varchar("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  businessName: varchar("business_name").notNull(),
  businessEmail: varchar("business_email").notNull(),
  businessPhone: varchar("business_phone"),
  businessAddress: text("business_address"),
  businessTypeId: varchar("business_type_id").references(() => businessTypes.id, { onDelete: "set null" }),
  currentProcessor: varchar("current_processor"),
  monthlyVolume: varchar("monthly_volume"),
  currentRate: varchar("current_rate"),
  fundingAmount: varchar("funding_amount"), // Required funding amount for business funding
  // Product selection and card machine requirements
  selectedProducts: text("selected_products").array(), // Array of product IDs
  productType: varchar("product_type").default("card_payments"), // card_payments, business_funding, utilities, insurance, custom
  quoteDeliveryMethod: varchar("quote_delivery_method").default("system"), // system (built-in quote builder) or email (manual custom quote)
  cardMachineQuantity: integer("card_machine_quantity").default(1),
  cardMachineProvider: varchar("card_machine_provider"), // Current card machine provider (if applicable)
  // MLM level tracking
  referralLevel: integer("referral_level").notNull().default(1), // 1 = direct (60%), 2 = level 2 (20%), 3 = level 3 (10%)
  parentReferrerId: varchar("parent_referrer_id").references(() => users.id, { onDelete: "set null" }), // Who in the chain gets the commission
  commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 2 }).notNull().default("60.00"), // Commission % for this referral level
  // Quote and commission tracking
  quoteGenerated: boolean("quote_generated").default(false),
  quoteAmount: decimal("quote_amount", { precision: 10, scale: 2 }),
  clientApproved: boolean("client_approved").default(false),
  status: varchar("status").notNull().default("submitted"), // submitted, pending, quoted, approved, rejected, completed
  estimatedCommission: decimal("estimated_commission", { precision: 10, scale: 2 }),
  actualCommission: decimal("actual_commission", { precision: 10, scale: 2 }),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  gdprConsent: boolean("gdpr_consent").default(false),
  // Enhanced admin fields for deal management
  dealStage: varchar("deal_stage").notNull().default("quote_request_received"), // quote_request_received, quote_sent, quote_approved, agreement_sent, signed_awaiting_docs, approved, live_confirm_ltr, invoice_received, completed, declined
  quoteRates: jsonb("quote_rates"), // Store detailed rate information for quotes
  docsOutConfirmed: boolean("docs_out_confirmed").default(false),
  docsOutConfirmedAt: timestamp("docs_out_confirmed_at"),
  signupCompletedAt: timestamp("signup_completed_at"), // Set when client completes signup form after approving quote
  requiredDocuments: text("required_documents").array().default(sql`ARRAY['identification', 'proof_of_bank']::text[]`), // Default required docs
  receivedDocuments: text("received_documents").array().default(sql`ARRAY[]::text[]`), // Docs that have been received
  submittedAt: timestamp("submitted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("deals_referrer_id_idx").on(table.referrerId),
  index("deals_business_type_id_idx").on(table.businessTypeId),
  index("deals_status_idx").on(table.status),
  index("deals_deal_stage_idx").on(table.dealStage),
  index("deals_submitted_at_idx").on(table.submittedAt),
  index("deals_referrer_status_idx").on(table.referrerId, table.status),
  index("deals_level_idx").on(table.referralLevel),
  index("deals_parent_referrer_id_idx").on(table.parentReferrerId),
  index("deals_product_type_idx").on(table.productType),
]);

export const billUploads = pgTable("bill_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: varchar("business_name").notNull(), // Link to business name only
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  fileContent: text("file_content"), // Base64 encoded file content
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("bill_uploads_business_name_idx").on(table.businessName),
]);

// Teams table for multi-user account management
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("teams_owner_id_idx").on(table.ownerId),
  index("teams_is_active_idx").on(table.isActive),
]);

// Multi-level commission tracking - main payment record per deal
export const commissionPayments = pgTable("commission_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull(),
  recipientId: varchar("recipient_id").notNull(), // User receiving commission
  level: integer("level").notNull(), // 1 = direct (60%), 2 = parent (20%), 3 = grandparent (10%)
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(), // 60.00, 20.00, or 10.00
  totalCommission: decimal("total_commission", { precision: 10, scale: 2 }), // Total commission before split
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }), // Total gross commission for the deal
  currency: varchar("currency").default("GBP"),
  businessName: varchar("business_name"),
  dealStage: varchar("deal_stage"),
  approvalStatus: varchar("approval_status").notNull().default("pending"), // pending, needs_approval, approved, queried
  queryNotes: text("query_notes"),
  paymentStatus: varchar("payment_status").notNull().default("pending"), // pending, needs_approval, approved, paid, failed
  paymentDate: timestamp("payment_date"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  transferReference: varchar("transfer_reference"),
  evidenceUrl: text("evidence_url"), // Link to bill/statement evidence
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }), // Admin who created
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }), // Admin who approved
  paidBy: varchar("paid_by").references(() => users.id, { onDelete: "set null" }), // Admin who marked paid
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("commission_payments_recipient_idx").on(table.recipientId),
  index("commission_payments_deal_idx").on(table.dealId),
  index("commission_payments_status_idx").on(table.approvalStatus, table.paymentStatus),
]);

// Payment splits - fixed ledger entries for each beneficiary's share
export const paymentSplits = pgTable("payment_splits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id").notNull(), // References commissionPayments.id
  dealId: varchar("deal_id").notNull(),
  beneficiaryUserId: varchar("beneficiary_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  level: integer("level").notNull(), // 0 = direct referrer (60%), 1 = upline L1 (20%), 2 = upline L2 (10%)
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(), // 60.00, 20.00, or 10.00
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Fixed amount at creation time
  status: varchar("status").notNull().default("pending"), // pending, approved, paid
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("payment_splits_payment_idx").on(table.paymentId),
  index("payment_splits_beneficiary_idx").on(table.beneficiaryUserId),
  index("payment_splits_deal_idx").on(table.dealId),
]);

// Partner hierarchy for MLM tracking
export const partnerHierarchy = pgTable("partner_hierarchy", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id").notNull(),
  parentId: varchar("parent_id").notNull(),
  level: integer("level").notNull(), // How many levels down
  createdAt: timestamp("created_at").defaultNow(),
});

// Rates management table
export const rates = pgTable("rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // payment_processing, business_funding
  rateType: varchar("rate_type").notNull(), // percentage, fixed, tiered
  value: decimal("value", { precision: 10, scale: 4 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Commission approvals - pending approvals for users to accept
export const commissionApprovals = pgTable("commission_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull(),
  userId: varchar("user_id").notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  clientBusinessName: varchar("client_business_name"),
  commissionType: varchar("commission_type").default("direct"), // "direct" (60% to deal creator) or "override" (20%/10% to upline)
  level: integer("level").default(0), // 0 = direct (deal creator), 1 = level 1 up (20%), 2 = level 2 up (10%)
  approvalStatus: varchar("approval_status").notNull().default("pending"), // pending, approved, rejected
  approvedAt: timestamp("approved_at"),
  paymentStatus: varchar("payment_status").notNull().default("pending"), // pending, processing, completed, failed
  paymentDate: timestamp("payment_date"),
  paymentReference: varchar("payment_reference"),
  adminNotes: text("admin_notes"),
  ratesData: jsonb("rates_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment verification codes for 2FA on commission payments
export const paymentVerificationCodes = pgTable("payment_verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull(),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull(), // 6-digit verification code
  actualCommission: decimal("actual_commission", { precision: 10, scale: 2 }).notNull(),
  paymentReference: varchar("payment_reference"),
  paymentMethod: varchar("payment_method"),
  paymentNotes: text("payment_notes"),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(), // 10 minute expiry
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("payment_verification_codes_deal_idx").on(table.dealId),
  index("payment_verification_codes_admin_idx").on(table.adminId),
  index("payment_verification_codes_expires_idx").on(table.expiresAt),
]);

// Partner invoices - for manual invoice-based commission payment workflow
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number").notNull().unique(),
  quoteId: varchar("quote_id").notNull(), // Links to quotes table
  dealId: varchar("deal_id"), // Optional deal ID for reference
  partnerId: varchar("partner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  businessName: varchar("business_name"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default("pending"), // pending, approved, paid
  queryNotes: text("query_notes"), // Notes if partner queried the invoice
  hasQuery: boolean("has_query").default(false),
  adminNotes: text("admin_notes"),
  paymentReference: varchar("payment_reference"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("invoices_partner_id_idx").on(table.partnerId),
  index("invoices_quote_id_idx").on(table.quoteId),
  index("invoices_status_idx").on(table.status),
  index("invoices_invoice_number_idx").on(table.invoiceNumber),
]);

// Team invitations
export const teamInvitations = pgTable("team_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  email: varchar("email").notNull(),
  role: varchar("role").notNull().default("member"),
  invitedBy: varchar("invited_by").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, accepted, declined, expired
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Business owner details captured after client approves quote
export const businessOwners = pgTable("business_owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  dateOfBirth: varchar("date_of_birth"),
  homeAddress: text("home_address"),
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Business information captured after client approves quote
export const businessDetails = pgTable("business_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull(),
  tradingName: varchar("trading_name").notNull(),
  tradingAddress: text("trading_address").notNull(),
  businessDescription: text("business_description"),
  businessStructure: varchar("business_structure").notNull(), // limited_company, sole_trader, partnership
  limitedCompanyName: varchar("limited_company_name"),
  companyNumber: varchar("company_number"),
  // Partnership details (if applicable)
  partnershipContactName: varchar("partnership_contact_name"),
  partnershipContactEmail: varchar("partnership_contact_email"),
  partnershipContactPhone: varchar("partnership_contact_phone"),
  // Banking details
  bankSortCode: varchar("bank_sort_code").notNull(),
  bankAccountNumber: varchar("bank_account_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contacts management for CRM-style contact handling
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who owns this contact
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  company: varchar("company"),
  jobTitle: varchar("job_title"),
  businessType: varchar("business_type"),
  contactSource: varchar("contact_source"), // referral, networking, cold_outreach, website, etc.
  tags: text("tags").array(), // Array of tags for categorization
  notes: text("notes"),
  // Product interests
  interestedProducts: text("interested_products").array(), // Array of product categories
  estimatedMonthlyVolume: varchar("estimated_monthly_volume"),
  // Contact preferences
  preferredContactMethod: varchar("preferred_contact_method").default("email"), // email, phone, meeting
  lastContact: timestamp("last_contact"),
  nextFollowUp: timestamp("next_follow_up"),
  // Address information
  addressLine1: varchar("address_line1"),
  addressLine2: varchar("address_line2"),
  city: varchar("city"),
  postcode: varchar("postcode"),
  country: varchar("country").default("gb"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("contacts_partner_id_idx").on(table.partnerId),
  index("contacts_email_idx").on(table.email),
  index("contacts_next_follow_up_idx").on(table.nextFollowUp),
]);

// Opportunities management (renamed from leads)
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").unique(), // User-friendly Deal ID (e.g., "DEAL-12345")
  partnerId: varchar("partner_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who owns this opportunity
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }), // Link to contact (can be null for legacy data)
  businessName: varchar("business_name").notNull(),
  // Contact information (denormalized for flexibility)
  contactFirstName: varchar("contact_first_name"),
  contactLastName: varchar("contact_last_name"),
  contactName: varchar("contact_name"), // Legacy field, derived from first+last or entered directly
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  businessType: varchar("business_type"),
  // Volume and value fields
  estimatedMonthlyVolume: varchar("estimated_monthly_volume"), // Legacy field
  currentMonthlyVolume: varchar("current_monthly_volume"), // Current processing volume
  estimatedValue: varchar("estimated_value"),
  // Pipeline management
  opportunitySource: varchar("opportunity_source"), // referral, cold_call, networking, etc.
  status: varchar("status").notNull().default("prospect"), // prospect, qualified, proposal, negotiation, closed_won, closed_lost, on_hold
  stage: varchar("stage").notNull().default("initial_contact"), // initial_contact, qualified_lead, needs_analysis, proposal_development, etc.
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  assignedTo: varchar("assigned_to"), // Partner or team member assigned
  expectedCloseDate: timestamp("expected_close_date"),
  // Product and business info
  productInterest: text("product_interest").array(), // Array of interested products
  decisionMakers: text("decision_makers"), // Key decision makers and roles
  painPoints: text("pain_points"), // Business challenges and pain points
  competitorInfo: text("competitor_info"), // Current providers, competitor analysis
  // Notes and actions
  notes: text("notes"),
  nextSteps: text("next_steps"), // Planned next actions
  // Legacy fields (keep for backwards compatibility)
  lastContact: timestamp("last_contact"),
  nextFollowUp: timestamp("next_follow_up"),
  tags: text("tags").array(), // Array of tags for categorization
  probabilityScore: integer("probability_score").default(50), // 0-100 percentage
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("opportunities_partner_id_idx").on(table.partnerId),
  index("opportunities_contact_id_idx").on(table.contactId),
  index("opportunities_status_idx").on(table.status),
  index("opportunities_stage_idx").on(table.stage),
  index("opportunities_priority_idx").on(table.priority),
  index("opportunities_assigned_to_idx").on(table.assignedTo),
  index("opportunities_expected_close_date_idx").on(table.expectedCloseDate),
  index("opportunities_next_follow_up_idx").on(table.nextFollowUp),
  index("opportunities_partner_status_idx").on(table.partnerId, table.status),
]);

// Keep legacy leads table for backward compatibility during migration
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(), // User who owns this lead
  businessName: varchar("business_name").notNull(),
  contactName: varchar("contact_name").notNull(),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  businessType: varchar("business_type"),
  estimatedMonthlyVolume: varchar("estimated_monthly_volume"),
  leadSource: varchar("lead_source"), // referral, cold_call, networking, etc.
  status: varchar("status").notNull().default("uploaded"), // uploaded, contacted, interested, quoted, converted, not_interested
  priority: varchar("priority").default("medium"), // low, medium, high
  notes: text("notes"),
  lastContact: timestamp("last_contact"),
  nextFollowUp: timestamp("next_follow_up"),
  tags: text("tags").array(), // Array of tags for categorization
  estimatedValue: varchar("estimated_value"),
  probabilityScore: integer("probability_score").default(50), // 0-100 percentage
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referrals table (REQUIRED for foreign keys)
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  partnerId: varchar("partner_id").references(() => users.id, { onDelete: "set null" }),

  businessName: varchar("business_name"),
  contactName: varchar("contact_name"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),

  status: varchar("status").default("pending"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact interactions/activity log
export const contactInteractions = pgTable("contact_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  partnerId: varchar("partner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  interactionType: varchar("interaction_type").notNull(), // call, email, meeting, note, status_change
  subject: varchar("subject"),
  details: text("details"),
  outcome: varchar("outcome"), // positive, neutral, negative, follow_up_required
  nextAction: text("next_action"),
  attachments: text("attachments").array(), // File paths or references
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("contact_interactions_contact_id_idx").on(table.contactId),
  index("contact_interactions_partner_id_idx").on(table.partnerId),
  index("contact_interactions_created_at_idx").on(table.createdAt),
  index("contact_interactions_type_idx").on(table.interactionType),
]);

// Opportunity interactions/activity log
export const opportunityInteractions = pgTable("opportunity_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  opportunityId: varchar("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  partnerId: varchar("partner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  interactionType: varchar("interaction_type").notNull(), // call, email, meeting, note, status_change
  subject: varchar("subject"),
  details: text("details"),
  outcome: varchar("outcome"), // positive, neutral, negative, follow_up_required
  nextAction: text("next_action"),
  attachments: text("attachments").array(), // File paths or references
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("opportunity_interactions_opportunity_id_idx").on(table.opportunityId),
  index("opportunity_interactions_partner_id_idx").on(table.partnerId),
  index("opportunity_interactions_created_at_idx").on(table.createdAt),
  index("opportunity_interactions_type_idx").on(table.interactionType),
]);

// Keep legacy lead interactions for backward compatibility
export const leadInteractions = pgTable("lead_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  partnerId: varchar("partner_id").notNull(),
  interactionType: varchar("interaction_type").notNull(), // call, email, meeting, note, status_change
  subject: varchar("subject"),
  details: text("details"),
  outcome: varchar("outcome"), // positive, neutral, negative, follow_up_required
  nextAction: text("next_action"),
  attachments: text("attachments").array(), // File paths or references
  createdAt: timestamp("created_at").defaultNow(),
});

// Email communications for 2-way sync with Outlook
export const emailCommunications = pgTable("email_communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }), // Link to contact
  opportunityId: varchar("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }), // Link to opportunity
  partnerId: varchar("partner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Outlook/Graph API fields
  outlookMessageId: varchar("outlook_message_id").unique(), // Unique ID from Outlook
  conversationId: varchar("conversation_id"), // Groups emails in same thread
  direction: varchar("direction").notNull(), // inbound, outbound
  subject: varchar("subject"),
  fromEmail: varchar("from_email").notNull(),
  toEmails: text("to_emails").array(), // Array of recipient emails
  ccEmails: text("cc_emails").array(), // Array of CC emails
  bccEmails: text("bcc_emails").array(), // Array of BCC emails
  bodyPreview: text("body_preview"), // First few lines of content
  bodyContent: text("body_content"), // Full email content
  isRead: boolean("is_read").default(false),
  hasAttachments: boolean("has_attachments").default(false),
  attachmentInfo: jsonb("attachment_info"), // Metadata about attachments
  outlookCreatedAt: timestamp("outlook_created_at"), // Original timestamp from Outlook
  outlookUpdatedAt: timestamp("outlook_updated_at"), // Last modified in Outlook
  syncedAt: timestamp("synced_at").defaultNow(), // When we synced this email
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("email_communications_partner_id_idx").on(table.partnerId),
  index("email_communications_contact_id_idx").on(table.contactId),
  index("email_communications_opportunity_id_idx").on(table.opportunityId),
  index("email_communications_conversation_id_idx").on(table.conversationId),
  index("email_communications_outlook_message_id_idx").on(table.outlookMessageId),
  index("email_communications_created_at_idx").on(table.createdAt),
  // Ensure at least one of contactId or opportunityId is not null
  check("email_has_link", sql`(contact_id IS NOT NULL OR opportunity_id IS NOT NULL)`),
]);

// Dojo partner information
export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").unique().notNull(),
  description: text("description"),
  logoUrl: varchar("logo_url"),
  website: varchar("website"),
  contactEmail: varchar("contact_email"),
  trustScore: decimal("trust_score", { precision: 3, scale: 2 }).default(sql`4.5`), // Out of 5
  totalReviews: integer("total_reviews").default(0),
  services: text("services").array(), // Array of services offered
  specializations: text("specializations").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Partner reviews
export const partnerReviews = pgTable("partner_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull(),
  reviewerName: varchar("reviewer_name").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  title: varchar("title"),
  content: text("content"),
  businessType: varchar("business_type"),
  isVerified: boolean("is_verified").default(false),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin actions audit table for tracking all admin changes
export const adminActions = pgTable("admin_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Admin user who performed action
  entityType: varchar("entity_type").notNull(), // referral, user, commission, etc.
  entityId: varchar("entity_id").notNull(), // ID of the entity being modified
  action: varchar("action").notNull(), // create, update, delete, status_change, etc.
  fieldChanges: jsonb("field_changes"), // JSON of before/after values
  description: text("description"), // Human-readable description of the action
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("admin_actions_actor_id_idx").on(table.actorId),
  index("admin_actions_entity_idx").on(table.entityType, table.entityId),
  index("admin_actions_created_at_idx").on(table.createdAt),
]);

// Deal stages configuration for workflow management
export const dealStages = pgTable("deal_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  orderIndex: integer("order_index").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("deal_stages_order_idx").on(table.orderIndex),
  index("deal_stages_slug_idx").on(table.slug),
]);

// Document requirements tracking
export const documentRequirements = pgTable("document_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralId: varchar("referral_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  documentType: varchar("document_type").notNull(), // identification, proof_of_bank, business_registration, etc.
  isRequired: boolean("is_required").default(true),
  isReceived: boolean("is_received").default(false),
  receivedAt: timestamp("received_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("document_requirements_referral_id_idx").on(table.referralId),
  index("document_requirements_type_idx").on(table.documentType),
]);

// Enhanced quote management
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").unique(), // Quote ID in format QUOTE-XXXXX (linked to dealId)
  referralId: varchar("referral_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1), // For quote versioning

  // Transaction Rates
  creditCardRate: decimal("credit_card_rate", { precision: 5, scale: 2 }), // e.g., 1.49%
  debitCardRate: decimal("debit_card_rate", { precision: 5, scale: 2 }),
  corporateCardRate: decimal("corporate_card_rate", { precision: 5, scale: 2 }),
  visaBusinessDebitRate: decimal("visa_business_debit_rate", { precision: 5, scale: 2 }).default('1.99'),
  otherBusinessDebitRate: decimal("other_business_debit_rate", { precision: 5, scale: 2 }).default('1.99'),
  amexRate: decimal("amex_rate", { precision: 5, scale: 2 }).default('1.90'),

  // Transaction Fees
  secureTransactionFee: decimal("secure_transaction_fee", { precision: 5, scale: 2 }), // in pence, e.g., 5.00p

  // Buyout & Savings
  buyoutAmount: decimal("buyout_amount", { precision: 10, scale: 2 }), // £3000 or £500
  estimatedMonthlySaving: decimal("estimated_monthly_saving", { precision: 10, scale: 2 }),

  // Card Machines/Devices
  devicePaymentType: varchar("device_payment_type"), // 'pay_once' or 'pay_monthly'
  devices: jsonb("devices").default('[]'), // Array of {type: 'dojo_go'|'dojo_pocket', quantity: number, price: number}

  // Optional Extras
  hardwareCare: boolean("hardware_care").default(false), // £5 per device
  settlementType: varchar("settlement_type").default('5_day'), // '5_day' or '7_day' (7 day = £10pm)
  dojoPlan: boolean("dojo_plan").default(false), // £11.99pm with 3 months free trial

  // Calculated totals
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  monthlyDeviceCost: decimal("monthly_device_cost", { precision: 10, scale: 2 }),
  oneTimeDeviceCost: decimal("one_time_device_cost", { precision: 10, scale: 2 }),

  // Business Type & Commission Tracking
  businessType: varchar("business_type").default("new_to_card"), // switcher, new_to_card
  billUploadRequired: boolean("bill_upload_required").default(false),
  billUploaded: boolean("bill_uploaded").default(false),
  estimatedCommission: decimal("estimated_commission", { precision: 10, scale: 2 }),
  commissionPaid: boolean("commission_paid").default(false),
  commissionPaidDate: timestamp("commission_paid_date"),
  stripePaymentId: varchar("stripe_payment_id"),

  // Legacy field for backwards compatibility
  ratesData: jsonb("rates_data"), // Detailed rate breakdown - keeping for old quotes

  validUntil: timestamp("valid_until"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  status: varchar("status").notNull().default("draft"), // draft, sent, viewed, approved, rejected, expired
  customerJourneyStatus: varchar("customer_journey_status").notNull().default("review_quote"), // review_quote, sent_to_client, awaiting_signup, agreement_sent, docs_out, awaiting_documents, docs_received, approved, live, declined, complete
  // Audit trail for status changes
  docsOutDate: timestamp("docs_out_date"),
  docsOutNotes: text("docs_out_notes"),
  requestDocumentsDate: timestamp("request_documents_date"),
  requestedDocuments: text("requested_documents").array().default(sql`ARRAY[]::text[]`), // Documents requested from customer
  docsReceivedDate: timestamp("docs_received_date"),
  outstandingDocuments: text("outstanding_documents").array().default(sql`ARRAY[]::text[]`), // Documents still outstanding
  finalDecision: varchar("final_decision"), // approved or declined
  finalDecisionDate: timestamp("final_decision_date"),
  finalDecisionNotes: text("final_decision_notes"),
  actualCommission: decimal("actual_commission", { precision: 10, scale: 2 }),
  partnerQuestion: text("partner_question"), // Question from partner
  partnerRateRequest: text("partner_rate_request"), // Request for different rates/offer
  adminNotes: text("admin_notes"),
  clientFeedback: text("client_feedback"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("quotes_referral_id_idx").on(table.referralId),
  index("quotes_status_idx").on(table.status),
  index("quotes_customer_journey_status_idx").on(table.customerJourneyStatus),
  index("quotes_created_by_idx").on(table.createdBy),
]);

// Q&A threads for quotes - customer questions and admin replies
export const quoteQA = pgTable("quote_qa", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  authorType: varchar("author_type").notNull(), // 'customer' or 'admin'
  authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("quote_qa_quote_id_idx").on(table.quoteId),
  index("quote_qa_created_at_idx").on(table.createdAt),
]);

// Bill uploads for switcher businesses
export const quoteBillUploads = pgTable("quote_bill_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  referralId: varchar("referral_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size"),
  fileType: varchar("file_type"),
  fileData: text("file_data"), // Base64 encoded file data
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentType: varchar("document_type").notNull().default("other"), // switcher_statement, proof_of_bank, photo_id, other
  status: varchar("status").notNull().default("pending"), // pending, approved, rejected
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("quote_bill_uploads_quote_id_idx").on(table.quoteId),
  index("quote_bill_uploads_referral_id_idx").on(table.referralId),
  index("quote_bill_uploads_document_type_idx").on(table.documentType),
]);

// Notifications for user activity
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull(), // quote_ready, status_update, commission_paid, team_invite, system_message
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "set null" }), // Optional - for deal-related notifications
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: "set null" }), // Optional - for lead-related notifications
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }), // Optional - for contact-related notifications
  opportunityId: varchar("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }), // Optional - for opportunity-related notifications
  businessName: varchar("business_name"), // For context in notifications
  metadata: jsonb("metadata"), // Additional data like commission amount, etc.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_type_idx").on(table.type),
  index("notifications_read_idx").on(table.read),
  index("notifications_created_at_idx").on(table.createdAt),
  index("notifications_user_read_idx").on(table.userId, table.read),
]);

// Push subscriptions for Web Push notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(), // Push subscription endpoint URL
  p256dh: text("p256dh").notNull(), // Public key for encryption
  auth: text("auth").notNull(), // Auth secret
  userAgent: text("user_agent"), // Browser/device info for debugging
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
  index("push_subscriptions_endpoint_idx").on(table.endpoint),
  index("push_subscriptions_is_active_idx").on(table.isActive),
]);

// Deal messages - for admin/partner communication on specific deals
export const dealMessages = pgTable("deal_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderName: varchar("sender_name"),
  senderEmail: varchar("sender_email"),
  isAdminMessage: boolean("is_admin_message").default(false),
  messageType: varchar("message_type").notNull().default("chat"), // 'chat' | 'quote_qa'
  message: text("message").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("deal_messages_deal_id_idx").on(table.dealId),
  index("deal_messages_sender_id_idx").on(table.senderId),
  index("deal_messages_created_at_idx").on(table.createdAt),
  index("deal_messages_type_idx").on(table.messageType),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  deals: many(deals),
  leads: many(leads),
  opportunities: many(opportunities),
  contacts: many(contacts),
  leadInteractions: many(leadInteractions),
  contactInteractions: many(contactInteractions),
  opportunityInteractions: many(opportunityInteractions),
  emailCommunications: many(emailCommunications),
  notifications: many(notifications),
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  ownedTeams: many(teams),
  parentPartner: one(users, {
    fields: [users.parentPartnerId],
    references: [users.id],
  }),
  childPartners: many(users),
  sentInvitations: many(teamInvitations),
  commissionPayments: many(commissionPayments),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, {
    fields: [teams.ownerId],
    references: [users.id],
  }),
  members: many(users),
  invitations: many(teamInvitations),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  inviter: one(users, {
    fields: [teamInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const partnerHierarchyRelations = relations(partnerHierarchy, ({ one }) => ({
  child: one(users, {
    fields: [partnerHierarchy.childId],
    references: [users.id],
  }),
  parent: one(users, {
    fields: [partnerHierarchy.parentId],
    references: [users.id],
  }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  referrer: one(users, {
    fields: [deals.referrerId],
    references: [users.id],
  }),
  parentReferrer: one(users, {
    fields: [deals.parentReferrerId],
    references: [users.id],
  }),
  businessType: one(businessTypes, {
    fields: [deals.businessTypeId],
    references: [businessTypes.id],
  }),
  billUploads: many(billUploads),
  commissionPayments: many(commissionPayments),
  businessOwner: one(businessOwners, {
    fields: [deals.id],
    references: [businessOwners.dealId],
  }),
  businessDetails: one(businessDetails, {
    fields: [deals.id],
    references: [businessDetails.dealId],
  }),
}));

// billUploads now links to business name only, no direct relations

export const commissionPaymentsRelations = relations(commissionPayments, ({ one }) => ({
  deal: one(deals, {
    fields: [commissionPayments.dealId],
    references: [deals.id],
  }),
  recipient: one(users, {
    fields: [commissionPayments.recipientId],
    references: [users.id],
  }),
}));

export const businessOwnersRelations = relations(businessOwners, ({ one }) => ({
  deal: one(deals, {
    fields: [businessOwners.dealId],
    references: [deals.id],
  }),
}));

export const businessDetailsRelations = relations(businessDetails, ({ one }) => ({
  deal: one(deals, {
    fields: [businessDetails.dealId],
    references: [deals.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  partner: one(users, {
    fields: [contacts.partnerId],
    references: [users.id],
  }),
  interactions: many(contactInteractions),
  emailCommunications: many(emailCommunications),
  opportunities: many(opportunities),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  partner: one(users, {
    fields: [opportunities.partnerId],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [opportunities.contactId],
    references: [contacts.id],
  }),
  interactions: many(opportunityInteractions),
  emailCommunications: many(emailCommunications),
}));

export const contactInteractionsRelations = relations(contactInteractions, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactInteractions.contactId],
    references: [contacts.id],
  }),
  partner: one(users, {
    fields: [contactInteractions.partnerId],
    references: [users.id],
  }),
}));

export const opportunityInteractionsRelations = relations(opportunityInteractions, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityInteractions.opportunityId],
    references: [opportunities.id],
  }),
  partner: one(users, {
    fields: [opportunityInteractions.partnerId],
    references: [users.id],
  }),
}));

export const emailCommunicationsRelations = relations(emailCommunications, ({ one }) => ({
  contact: one(contacts, {
    fields: [emailCommunications.contactId],
    references: [contacts.id],
  }),
  opportunity: one(opportunities, {
    fields: [emailCommunications.opportunityId],
    references: [opportunities.id],
  }),
  partner: one(users, {
    fields: [emailCommunications.partnerId],
    references: [users.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  partner: one(users, {
    fields: [leads.partnerId],
    references: [users.id],
  }),
  interactions: many(leadInteractions),
}));

export const leadInteractionsRelations = relations(leadInteractions, ({ one }) => ({
  lead: one(leads, {
    fields: [leadInteractions.leadId],
    references: [leads.id],
  }),
  partner: one(users, {
    fields: [leadInteractions.partnerId],
    references: [users.id],
  }),
}));

export const partnersRelations = relations(partners, ({ many }) => ({
  reviews: many(partnerReviews),
}));

export const partnerReviewsRelations = relations(partnerReviews, ({ one }) => ({
  partner: one(partners, {
    fields: [partnerReviews.partnerId],
    references: [partners.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  deal: one(deals, {
    fields: [notifications.dealId],
    references: [deals.id],
  }),
  lead: one(leads, {
    fields: [notifications.leadId],
    references: [leads.id],
  }),
  contact: one(contacts, {
    fields: [notifications.contactId],
    references: [contacts.id],
  }),
  opportunity: one(opportunities, {
    fields: [notifications.opportunityId],
    references: [opportunities.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  submittedAt: true,
  updatedAt: true,
  actualCommission: true,
  quoteGenerated: true,
  clientApproved: true,
});

export const insertBusinessTypeSchema = createInsertSchema(businessTypes).omit({
  id: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertBusinessOwnerSchema = createInsertSchema(businessOwners).omit({
  id: true,
  createdAt: true,
});

export const insertBusinessDetailsSchema = createInsertSchema(businessDetails).omit({
  id: true,
  createdAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({
  id: true,
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Handle empty string dates by transforming to null
  expectedCloseDate: z.union([
    z.string().transform((val) => val === "" ? null : new Date(val)),
    z.date(),
    z.null()
  ]).optional(),
  // Handle number values for estimatedValue by converting to string
  estimatedValue: z.union([
    z.string(),
    z.number().transform((val) => val.toString())
  ]).optional(),
  // Handle array fields that might be undefined
  productInterest: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const insertContactInteractionSchema = createInsertSchema(contactInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertOpportunityInteractionSchema = createInsertSchema(opportunityInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertEmailCommunicationSchema = createInsertSchema(emailCommunications).omit({
  id: true,
  syncedAt: true,
  createdAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadInteractionSchema = createInsertSchema(leadInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartnerReviewSchema = createInsertSchema(partnerReviews).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertDealMessageSchema = createInsertSchema(dealMessages).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type ContactInteraction = typeof contactInteractions.$inferSelect;
export type InsertContactInteraction = z.infer<typeof insertContactInteractionSchema>;
export type OpportunityInteraction = typeof opportunityInteractions.$inferSelect;
export type InsertOpportunityInteraction = z.infer<typeof insertOpportunityInteractionSchema>;
export type EmailCommunication = typeof emailCommunications.$inferSelect;
export type InsertEmailCommunication = z.infer<typeof insertEmailCommunicationSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

// Audit trail table for tracking important actions
export const audits = pgTable("audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  actorUserId: varchar("actor_user_id"),
  action: varchar("action").notNull(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id"),
  metadata: jsonb("metadata"),
  requestId: varchar("request_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Request logs table for storing HTTP request data
export const requestLogs = pgTable("request_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().unique(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id"),
  method: varchar("method").notNull(),
  route: varchar("route").notNull(),
  statusCode: integer("status_code").notNull(),
  duration: integer("duration").notNull(), // milliseconds
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Webhook delivery logs
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookType: varchar("webhook_type").notNull(),
  targetUrl: varchar("target_url").notNull(),
  payload: jsonb("payload").notNull(),
  responseCode: integer("response_code"),
  responseBody: text("response_body"),
  deliveryAttempt: integer("delivery_attempt").default(1),
  delivered: boolean("delivered").default(false),
  deliveredAt: timestamp("delivered_at"),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;
export type RequestLog = typeof requestLogs.$inferSelect;
export type InsertRequestLog = typeof requestLogs.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;

// Rate types and schemas
export const insertRateSchema = createInsertSchema(rates);
export type InsertRate = z.infer<typeof insertRateSchema>;
export type Rate = typeof rates.$inferSelect;

// Commission approval types and schemas
export const insertCommissionApprovalSchema = createInsertSchema(commissionApprovals);
export type InsertCommissionApproval = z.infer<typeof insertCommissionApprovalSchema>;
export type CommissionApproval = typeof commissionApprovals.$inferSelect;

// Payment verification code types and schemas
export const insertPaymentVerificationCodeSchema = createInsertSchema(paymentVerificationCodes).omit({
  id: true,
  createdAt: true,
});
export type InsertPaymentVerificationCode = z.infer<typeof insertPaymentVerificationCodeSchema>;
export type PaymentVerificationCode = typeof paymentVerificationCodes.$inferSelect;

// Invoice types and schemas
export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;
export type BusinessType = typeof businessTypes.$inferSelect;
export type Product = typeof products.$inferSelect;
export type BillUpload = typeof billUploads.$inferSelect;
export const insertCommissionPaymentSchema = createInsertSchema(commissionPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCommissionPayment = z.infer<typeof insertCommissionPaymentSchema>;
export type CommissionPayment = typeof commissionPayments.$inferSelect;

export const insertPaymentSplitSchema = createInsertSchema(paymentSplits).omit({
  id: true,
  createdAt: true,
});
export type InsertPaymentSplit = z.infer<typeof insertPaymentSplitSchema>;
export type PaymentSplit = typeof paymentSplits.$inferSelect;
export type BusinessOwner = typeof businessOwners.$inferSelect;
export type BusinessDetails = typeof businessDetails.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertBusinessOwner = z.infer<typeof insertBusinessOwnerSchema>;
export type InsertBusinessDetails = z.infer<typeof insertBusinessDetailsSchema>;
export type Team = typeof teams.$inferSelect;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type PartnerHierarchy = typeof partnerHierarchy.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type LeadInteraction = typeof leadInteractions.$inferSelect;
export type InsertLeadInteraction = z.infer<typeof insertLeadInteractionSchema>;
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type PartnerReview = typeof partnerReviews.$inferSelect;
export type InsertPartnerReview = z.infer<typeof insertPartnerReviewSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type DealMessage = typeof dealMessages.$inferSelect;
export type InsertDealMessage = z.infer<typeof insertDealMessageSchema>;

// Waitlist table for partnership lead generation
export const waitlist = pgTable("waitlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull().unique(),
  phone: varchar("phone"),
  companyName: varchar("company_name"),
  businessType: varchar("business_type"),
  currentClientBase: varchar("current_client_base"), // Small, Medium, Large
  experienceLevel: varchar("experience_level"), // New to partnerships, Some experience, Experienced
  interests: text("interests").array(), // What they're interested in
  howDidYouHear: varchar("how_did_you_hear"), // Referral, Online search, Social media, etc.
  additionalInfo: text("additional_info"), // Optional additional information
  marketingConsent: boolean("marketing_consent").default(false),
  status: varchar("status").notNull().default("pending"), // pending, contacted, qualified, enrolled, not_interested
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("waitlist_email_idx").on(table.email),
  index("waitlist_status_idx").on(table.status),
  index("waitlist_created_at_idx").on(table.createdAt),
]);

// Admin audit logging table for tracking admin actions
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: varchar("action").notNull(), // 'send_quote', 'update_stage', 'update_documents', etc.
  entityType: varchar("entity_type").notNull(), // 'deal', 'user', etc.
  entityId: varchar("entity_id").notNull(),
  actorId: varchar("actor_id").notNull(), // The admin user who performed the action
  metadata: jsonb("metadata"), // Additional context about the action
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin-specific Zod schemas for type safety
export const insertAdminAction = createInsertSchema(adminActions);
export const selectAdminAction = adminActions.$inferSelect;
export type InsertAdminAction = z.infer<typeof insertAdminAction>;
export type AdminAction = typeof adminActions.$inferSelect;

export const insertDealStage = createInsertSchema(dealStages);
export const selectDealStage = dealStages.$inferSelect;
export type InsertDealStage = z.infer<typeof insertDealStage>;
export type DealStage = typeof dealStages.$inferSelect;

export const insertDocumentRequirement = createInsertSchema(documentRequirements);
export const selectDocumentRequirement = documentRequirements.$inferSelect;
export type InsertDocumentRequirement = z.infer<typeof insertDocumentRequirement>;
export type DocumentRequirement = typeof documentRequirements.$inferSelect;

export const insertQuote = createInsertSchema(quotes);
export const selectQuote = quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuote>;
export type Quote = typeof quotes.$inferSelect;

export const insertQuoteQA = createInsertSchema(quoteQA);
export const selectQuoteQA = quoteQA.$inferSelect;
export type InsertQuoteQA = z.infer<typeof insertQuoteQA>;
export type QuoteQA = typeof quoteQA.$inferSelect;

export const insertQuoteBillUpload = createInsertSchema(quoteBillUploads);
export const selectQuoteBillUpload = quoteBillUploads.$inferSelect;
export type InsertQuoteBillUpload = z.infer<typeof insertQuoteBillUpload>;
export type QuoteBillUpload = typeof quoteBillUploads.$inferSelect;

// Enhanced deal update schema for admin use
export const adminDealUpdateSchema = createInsertSchema(deals).omit({
  id: true,
  referrerId: true,
  submittedAt: true,
  updatedAt: true,
}).partial();

export type AdminDealUpdate = z.infer<typeof adminDealUpdateSchema>;

// Waitlist schemas
export const insertWaitlistSchema = createInsertSchema(waitlist).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type Waitlist = typeof waitlist.$inferSelect;

// Admin audit log types
export const insertAdminAuditLog = createInsertSchema(adminAuditLogs);
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLog>;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// Push subscription schemas
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// Accounting Integrations table for QuickBooks, Xero, etc.
export const accountingIntegrations = pgTable("accounting_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider").notNull(), // 'quickbooks', 'xero', 'sage', 'freshbooks'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  realmId: varchar("realm_id"), // QuickBooks company ID
  tenantId: varchar("tenant_id"), // Xero organization ID
  companyName: varchar("company_name"),
  isConnected: boolean("is_connected").default(false),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: varchar("sync_status").default("idle"), // 'idle', 'syncing', 'success', 'error'
  syncError: text("sync_error"),
  settings: jsonb("settings"), // Provider-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("accounting_integrations_user_id_idx").on(table.userId),
  index("accounting_integrations_provider_idx").on(table.provider),
]);

export const insertAccountingIntegration = createInsertSchema(accountingIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAccountingIntegration = z.infer<typeof insertAccountingIntegration>;
export type AccountingIntegration = typeof accountingIntegrations.$inferSelect;

// Utility function to map dealStage to customerJourneyStatus for quotes table sync
// dealStage is the single source of truth, customerJourneyStatus mirrors it for backward compatibility
export function mapDealStageToCustomerJourney(dealStage: string): string {
  const mapping: Record<string, string> = {
    'quote_request_received': 'review_quote',
    'quote_sent': 'quote_sent',
    'quote_approved': 'awaiting_signup',
    'agreement_sent': 'agreement_sent',
    'signed_awaiting_docs': 'awaiting_docs',
    'approved': 'approved',
    'live_confirm_ltr': 'live',
    'invoice_received': 'live',
    'completed': 'complete',
    'declined': 'declined',
  };

  return mapping[dealStage] || 'review_quote';
}
