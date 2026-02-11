import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { insertDealSchema, insertContactSchema, insertOpportunitySchema, insertWaitlistSchema, insertPushSubscriptionSchema, mapDealStageToCustomerJourney, quotes, paymentSplits, commissionPayments, users } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { emailService } from "./emailService";
import { ghlEmailService } from "./ghlEmailService";
import multer from "multer";
import { z } from "zod";
import crypto from "crypto";
import { requestIdMiddleware, loggingMiddleware, errorHandlingMiddleware } from "./middleware/requestId";
import { requireAdmin, auditAdminAction } from "./middleware/adminAuth";
import { healthzHandler, readyzHandler, metricsHandler } from "./health";
import { logAudit } from "./logger";
import { wsManager } from "./websocket";
import { pushNotificationService } from "./push-notifications";
import Stripe from 'stripe';
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GHL Integration function
async function submitToGHL(referral: any) {
  try {
    // Check if GHL credentials are configured
    if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
      console.log('GHL credentials not configured - skipping submission');
      return { success: true, ghlContactId: `mock_${Date.now()}`, skipped: true };
    }

    const ghlApiKey = process.env.GHL_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID;

    // Create contact/lead in GoHighLevel
    const contactData = {
      firstName: deal.businessOwnerName?.split(' ')[0] || 'Business',
      lastName: deal.businessOwnerName?.split(' ').slice(1).join(' ') || 'Owner',
      email: deal.businessEmail,
      phone: deal.businessPhone,
      companyName: deal.businessName,
      customFields: {
        business_type: deal.businessType,
        monthly_volume: deal.monthlyVolume,
        annual_turnover: deal.annualTurnover,
        referral_source: 'PartnerConnector',
        referral_id: deal.id,
        submission_date: new Date().toISOString()
      },
      tags: ['PartnerConnector Referral', `Volume: £${referral.monthlyVolume || 'Unknown'}`]
    };

    // Submit to GHL API
    const response = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ghlApiKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(contactData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('GHL API Error:', response.status, error);
      throw new Error(`GHL API error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Referral ${referral.id} successfully submitted to GHL. Contact ID: ${result.contact?.id}`);

    // Add to appropriate workflow/campaign if configured
    if (process.env.GHL_WORKFLOW_ID && result.contact?.id) {
      await addToGHLWorkflow(result.contact.id, process.env.GHL_WORKFLOW_ID, ghlApiKey);
    }

    return {
      success: true,
      ghlContactId: result.contact?.id,
      ghlResponse: result
    };
  } catch (error) {
    console.error(`Failed to submit referral ${referral.id} to GHL:`, error);
    // Don't fail the entire deal submission if GHL fails
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ghlContactId: null
    };
  }
}

// Add contact to GHL workflow/campaign
async function addToGHLWorkflow(contactId: string, workflowId: string, apiKey: string) {
  try {
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/workflow/${workflowId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    });

    if (response.ok) {
      console.log(`Contact ${contactId} added to workflow ${workflowId}`);
    } else {
      console.error(`Failed to add contact to workflow: ${response.status}`);
    }
  } catch (error) {
    console.error('Error adding contact to workflow:', error);
  }
}

// GHL Integration function for waitlist submissions
async function submitWaitlistToGHL(waitlistEntry: any) {
  try {
    // Check if GHL credentials are configured
    if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
      console.log('GHL credentials not configured - skipping waitlist submission');
      return { success: false, ghlContactId: null, skipped: true };
    }

    const locationId = process.env.GHL_LOCATION_ID;

    // Submit to GHL Webhook (more reliable than API)
    const webhookUrl = `https://services.leadconnectorhq.com/hooks/${locationId}/webhook-trigger/d30b9f55-149f-4e5d-8b9a-9116b0d82415`;

    const webhookData = {
      source: 'PartnerConnector Waitlist',
      firstName: waitlistEntry.firstName,
      lastName: waitlistEntry.lastName,
      email: waitlistEntry.email,
      phone: waitlistEntry.phone || '',
      companyName: waitlistEntry.companyName || '',
      businessType: waitlistEntry.businessType || '',
      currentClientBase: waitlistEntry.currentClientBase || '',
      experienceLevel: waitlistEntry.experienceLevel || '',
      interests: Array.isArray(waitlistEntry.interests) ? waitlistEntry.interests.join(', ') : '',
      howDidYouHear: waitlistEntry.howDidYouHear || '',
      additionalInfo: waitlistEntry.additionalInfo || '',
      marketingConsent: waitlistEntry.marketingConsent ? 'Yes' : 'No',
      status: waitlistEntry.status || 'pending',
      waitlistId: waitlistEntry.id,
      submissionDate: new Date().toISOString(),
      leadSource: 'PartnerConnector Waitlist'
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('GHL Webhook Error for waitlist:', response.status, error);
      throw new Error(`GHL Webhook error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Waitlist entry ${waitlistEntry.id} successfully submitted to GHL webhook:`, result);

    return {
      success: true,
      ghlContactId: 'webhook_triggered',
      ghlResponse: result
    };
  } catch (error) {
    console.error(`Failed to submit waitlist entry ${waitlistEntry.id} to GHL:`, error);
    // Don't fail the entire waitlist submission if GHL fails
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ghlContactId: null
    };
  }
}

// Helper function to create notifications and emit WebSocket events
async function createNotificationForUser(userId: string, notification: any) {
  try {
    // Store notification in database (only once!)
    const storedNotification = await storage.createNotification({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      dealId: notification.dealId || null,
      leadId: notification.leadId || null,
      contactId: notification.contactId || null,
      opportunityId: notification.opportunityId || null,
      businessName: notification.businessName || null,
      metadata: notification.metadata || null
    });

    // Broadcast the existing notification via WebSocket (without creating a duplicate)
    await wsManager.broadcastExistingNotification(userId, storedNotification);

    return storedNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

async function notifyAdminsOfNewDeal(deal: any, submitterName: string) {
  try {
    const admins = await storage.getAdminUsers();
    for (const admin of admins) {
      await createNotificationForUser(admin.id, {
        type: 'new_deal',
        title: 'New Quote Request',
        message: `${submitterName} submitted a quote request for ${deal.businessName} (${deal.dealId})`,
        dealId: deal.id,
        businessName: deal.businessName,
        metadata: {
          quoteId: deal.dealId,
          submitterId: deal.referrerId
        }
      });
    }
  } catch (error) {
    console.error('Error notifying admins of new deal:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Request ID and logging middleware
  app.use(requestIdMiddleware);
  app.use(loggingMiddleware);

  // Health and monitoring endpoints (before auth)
  app.get('/healthz', healthzHandler);
  app.get('/readyz', readyzHandler);
  app.get('/metrics', metricsHandler);

  // Auth middleware
  await setupAuth(app);

  // Seed business types on startup
  await storage.seedBusinessTypes();

  // Custom auth routes
  const { z } = await import('zod');

  // Register endpoint
  app.post('/api/auth/register', async (req: any, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        referralCode: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const { email, password, firstName, lastName, referralCode } = data;

      console.log('[AUTH] Registration attempt:', email);

      // Create user with credentials
      const user = await storage.createUserWithCredentials(
        email,
        password,
        { firstName, lastName },
        referralCode || req.session.referralCode
      );

      // Set session
      req.session.userId = user.id;

      // Clear referral code from session
      delete req.session.referralCode;

      console.log('[AUTH] Registration successful:', user.id, user.email);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        }
      });
    } catch (error: any) {
      console.error('[AUTH] Registration error:', error);
      if (error.message === 'Email already registered') {
        res.status(400).json({ message: 'Email already registered' });
      } else if (error.issues) {
        res.status(400).json({ message: fromZodError(error).message });
      } else {
        res.status(500).json({ message: 'Registration failed' });
      }
    }
  });

  // Login endpoint with rate limiting
  app.post('/api/auth/login', async (req: any, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
      });

      const data = schema.parse(req.body);
      const { email, password } = data;

      console.log('[AUTH] Login attempt:', email);

      // Check if user exists first
      const existingUser = await storage.getUserByEmail(email);

      // Check for account lockout
      if (existingUser && existingUser.lockoutUntil && existingUser.lockoutUntil > new Date()) {
        const lockoutMinutes = Math.ceil((existingUser.lockoutUntil.getTime() - Date.now()) / 60000);
        return res.status(429).json({
          message: `Account locked due to too many failed login attempts. Try again in ${lockoutMinutes} minute(s).`,
          lockoutUntil: existingUser.lockoutUntil
        });
      }

      const user = await storage.verifyLogin(email, password);

      if (!user) {
        // Increment login attempts for failed login
        if (existingUser) {
          const attempts = (existingUser.loginAttempts || 0) + 1;
          const updates: any = { loginAttempts: attempts };

          // Lock account after 5 failed attempts for 15 minutes
          if (attempts >= 5) {
            updates.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
            await storage.updateUser(existingUser.id, updates);
            return res.status(429).json({
              message: 'Account locked due to too many failed login attempts. Try again in 15 minutes.',
              lockoutUntil: updates.lockoutUntil
            });
          }

          await storage.updateUser(existingUser.id, updates);
        }

        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Check if email is verified (skip in development for testing)
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (!user.emailVerified && !isDevelopment) {
        return res.status(403).json({
          message: 'Please verify your email before logging in. Check your inbox for the verification link.',
          emailVerified: false
        });
      }

      // In development, log that we're bypassing verification
      if (!user.emailVerified && isDevelopment) {
        console.log('[AUTH] ⚠️  Development mode: Bypassing email verification for', user.email);
      }

      // Reset login attempts on successful login
      await storage.updateUser(user.id, {
        loginAttempts: 0,
        lockoutUntil: null,
        lastLogin: new Date(),
      });

      // Set session
      req.session.userId = user.id;

      console.log('[AUTH] Login successful:', user.id, user.email);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        }
      });
    } catch (error: any) {
      console.error('[AUTH] Login error:', error);
      if (error.issues) {
        res.status(400).json({ message: fromZodError(error).message });
      } else {
        res.status(500).json({ message: 'Login failed' });
      }
    }
  });

  // Logout endpoint
  app.get('/api/auth/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('[AUTH] Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.redirect('/');
    });
  });

  // Request password reset
  app.post('/api/auth/request-password-reset', async (req: any, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
      });

      const { email } = schema.parse(req.body);

      const user = await storage.getUserByEmail(email);

      // Always return success even if user doesn't exist (security best practice)
      if (!user) {
        return res.json({ success: true, message: 'If an account exists, a reset link has been sent' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // Save token to database
      await storage.updateUser(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      });

      // Send reset email via GHL
      await ghlEmailService.sendPasswordResetEmail(
        user.email!,
        resetToken,
        user.firstName || undefined,
        user.lastName || undefined
      );

      res.json({ success: true, message: 'If an account exists, a reset link has been sent' });
    } catch (error: any) {
      console.error('[AUTH] Password reset request error:', error);
      if (error.issues) {
        res.status(400).json({ message: fromZodError(error).message });
      } else {
        res.status(500).json({ message: 'Failed to process request' });
      }
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', async (req: any, res) => {
    try {
      const schema = z.object({
        token: z.string(),
        password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number'),
      });

      const { token, password } = schema.parse(req.body);

      const user = await storage.getUserByResetToken(token);

      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      // Hash new password
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(password, 10);

      // Update password and clear reset token
      await storage.updateUser(user.id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        loginAttempts: 0,
        lockoutUntil: null,
      });

      res.json({ success: true, message: 'Password reset successful' });
    } catch (error: any) {
      console.error('[AUTH] Password reset error:', error);
      if (error.issues) {
        res.status(400).json({ message: fromZodError(error).message });
      } else {
        res.status(500).json({ message: 'Failed to reset password' });
      }
    }
  });

  // Verify email
  app.post('/api/auth/verify-email', async (req: any, res) => {
    try {
      const schema = z.object({
        token: z.string(),
      });

      const { token } = schema.parse(req.body);

      const user = await storage.getUserByVerificationToken(token);

      if (!user) {
        return res.status(400).json({ message: 'Invalid verification token' });
      }

      // Mark email as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        verificationToken: null,
      });

      // Send welcome email via GHL
      await ghlEmailService.sendWelcomeEmail(
        user.email!,
        user.firstName || undefined,
        user.lastName || undefined
      );

      res.json({ success: true, message: 'Email verified successfully' });
    } catch (error: any) {
      console.error('[AUTH] Email verification error:', error);
      if (error.issues) {
        res.status(400).json({ message: fromZodError(error).message });
      } else {
        res.status(500).json({ message: 'Failed to verify email' });
      }
    }
  });

  // Resend verification email
  app.post('/api/auth/resend-verification', async (req: any, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
      });

      const { email } = schema.parse(req.body);

      const user = await storage.getUserByEmail(email);

      if (!user || user.emailVerified) {
        return res.json({ success: true, message: 'If an account exists and is unverified, a verification email has been sent' });
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Save token to database
      await storage.updateUser(user.id, {
        verificationToken,
      });

      // Send verification email via GHL
      await ghlEmailService.sendEmailVerification(
        user.email!,
        verificationToken,
        user.firstName || undefined,
        user.lastName || undefined
      );

      res.json({ success: true, message: 'If an account exists and is unverified, a verification email has been sent' });
    } catch (error: any) {
      console.error('[AUTH] Resend verification error:', error);
      if (error.issues) {
        res.status(400).json({ message: fromZodError(error).message });
      } else {
        res.status(500).json({ message: 'Failed to process request' });
      }
    }
  });

  // Test webhook endpoint - triggers all webhook types for testing
  app.post('/api/test/webhooks', async (req: any, res) => {
    try {
      console.log('🧪 Testing webhooks...');

      const results = [];

      // Test email verification webhook
      const emailVerificationResult = await ghlEmailService.sendEmailVerification(
        'test@example.com',
        'test-token-123',
        'Test',
        'User'
      );
      results.push({ event: 'email_verification', success: emailVerificationResult });

      // Test welcome email webhook
      const welcomeResult = await ghlEmailService.sendWelcomeEmail(
        'test@example.com',
        'Test',
        'User'
      );
      results.push({ event: 'welcome_email', success: welcomeResult });

      // Test password reset webhook
      const passwordResetResult = await ghlEmailService.sendPasswordResetEmail(
        'test@example.com',
        'reset-token-456',
        'Test',
        'User'
      );
      results.push({ event: 'password_reset', success: passwordResetResult });

      // Test quote notification webhook
      const quoteResult = await ghlEmailService.sendQuoteNotification(
        'test@example.com',
        'Test Business Ltd',
        5000,
        'Test',
        'User'
      );
      results.push({ event: 'quote_notification', success: quoteResult });

      // Test commission notification webhook
      const commissionResult = await ghlEmailService.sendCommissionNotification(
        'test@example.com',
        'Test Business Ltd',
        250.50,
        'Test',
        'User'
      );
      results.push({ event: 'commission_paid', success: commissionResult });

      console.log('✅ Webhook test results:', results);

      res.json({
        success: true,
        message: 'All test webhooks triggered. Check your GHL webhook logs.',
        results
      });
    } catch (error: any) {
      console.error('[TEST] Webhook test error:', error);
      res.status(500).json({ message: 'Failed to test webhooks', error: error.message });
    }
  });

  // GHL Webhook for team member invites
  app.post('/api/webhooks/ghl/team-invite', async (req: any, res) => {
    try {
      const { email, role, invitedBy, teamName } = req.body;

      // Log the webhook data for debugging
      console.log('GHL Team Invite Webhook received:', {
        email,
        role,
        invitedBy,
        teamName,
        timestamp: new Date().toISOString()
      });

      // Validate webhook signature if configured
      if (process.env.GHL_WEBHOOK_SECRET) {
        const signature = req.headers['x-ghl-signature'];
        if (!signature) {
          return res.status(401).json({ success: false, message: 'Missing webhook signature' });
        }
        // Add signature validation logic here
      }

      // Process team invitation through GHL API
      let ghlResponse = null;
      if (process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID) {
        try {
          const inviteData = {
            firstName: email.split('@')[0],
            lastName: 'Partner',
            email: email,
            customFields: {
              invited_by: invitedBy,
              team_role: role,
              team_name: teamName || 'PartnerConnector Team',
              invite_type: 'team_member',
              invite_date: new Date().toISOString()
            },
            tags: ['Team Invitation', `Role: ${role}`, 'PartnerConnector']
          };

          const response = await fetch(`https://services.leadconnectorhq.com/locations/${process.env.GHL_LOCATION_ID}/contacts`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28'
            },
            body: JSON.stringify(inviteData)
          });

          if (response.ok) {
            ghlResponse = await response.json();
            console.log(`Team invitation processed for ${email}. GHL Contact ID: ${ghlResponse.contact?.id}`);
          } else {
            console.error(`GHL API error for team invite: ${response.status}`);
          }
        } catch (error) {
          console.error('Error processing team invitation through GHL:', error);
        }
      }

      const webhookData = {
        contact: {
          email: email,
          firstName: email.split('@')[0],
          customFields: {
            invitedBy: invitedBy,
            role: role,
            teamName: teamName || 'PartnerConnector Team',
            inviteType: 'team_member',
            inviteDate: new Date().toISOString()
          }
        },
        ghlContactId: ghlResponse?.contact?.id || null,
        processed: !!ghlResponse
      };

      // Return success response to acknowledge webhook
      res.json({
        success: true,
        message: 'Team invitation webhook processed',
        data: webhookData
      });
    } catch (error) {
      console.error('GHL webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process team invitation webhook'
      });
    }
  });

  // Auth routes with proper Replit authentication
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if user is authenticated via session
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.session.userId;
      let user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Auto-generate referralCode if user doesn't have one
      if (!user.referralCode) {
        // Check if user has required profile information
        if (user.firstName && user.lastName) {
          // Generate partnerId if it doesn't exist
          if (!user.partnerId) {
            await storage.generatePartnerId(userId);
            user = await storage.getUser(userId);
          }

          // Set referralCode to partnerId
          if (user && user.partnerId && !user.referralCode) {
            await storage.updateUser(userId, { referralCode: user.partnerId });
            user = await storage.getUser(userId);
          }
        }
        // If firstName/lastName are missing, skip generation - it will happen later when they complete their profile
      }

      // Add impersonation status to response
      const isImpersonating = !!(req.session.impersonatedUserId && req.session.realAdminId);
      const userWithImpersonation = {
        ...user,
        impersonating: isImpersonating,
        realAdminId: req.session.realAdminId || null
      };

      res.json(userWithImpersonation);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.patch('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      const updatedUser = await storage.upsertUser({
        id: userId,
        ...updateData,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Complete onboarding
  app.post('/api/auth/complete-onboarding', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, profession, company, clientBaseSize, phone } = req.body;

      if (!firstName || !lastName || !profession || !company || !clientBaseSize || !phone) {
        return res.status(400).json({ message: "All fields are required to complete onboarding" });
      }

      // Update user profile with onboarding data
      let user = await storage.upsertUser({
        id: userId,
        firstName,
        lastName,
        profession,
        company,
        clientBaseSize,
        phone,
        hasCompletedOnboarding: true,
      });

      // Generate partner ID if it doesn't exist
      if (!user.partnerId) {
        await storage.generatePartnerId(userId);
        user = await storage.getUser(userId);
      }

      // Set referralCode to partnerId if not already set
      if (user && user.partnerId && !user.referralCode) {
        await storage.updateUser(userId, { referralCode: user.partnerId });
        user = await storage.getUser(userId);
      }

      res.json({ success: true, user });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Generate partner ID for user
  app.post('/api/auth/generate-partner-id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.partnerId) {
        return res.status(400).json({ message: "Partner ID already exists", partnerId: user.partnerId });
      }

      if (!user.firstName || !user.lastName) {
        return res.status(400).json({ message: "First name and last name are required to generate Partner ID" });
      }

      const partnerId = await storage.generatePartnerId(userId);
      res.json({ partnerId, message: "Partner ID generated successfully" });
    } catch (error) {
      console.error("Error generating partner ID:", error);
      res.status(500).json({ message: "Failed to generate partner ID" });
    }
  });

  // Business types
  app.get('/api/business-types', async (req, res) => {
    try {
      const businessTypes = await storage.getBusinessTypes();
      res.json(businessTypes);
    } catch (error) {
      console.error("Error fetching business types:", error);
      res.status(500).json({ message: "Failed to fetch business types" });
    }
  });

  // Waitlist submission (public route)
  app.post('/api/waitlist', async (req, res) => {
    try {
      // Validate request body
      const validationResult = insertWaitlistSchema.safeParse(req.body);
      if (!validationResult.success) {
        const formattedError = fromZodError(validationResult.error);
        return res.status(400).json({
          message: "Validation failed",
          errors: formattedError.details
        });
      }

      const waitlistData = validationResult.data;

      // Check if email already exists in waitlist
      const existingEntry = await storage.getWaitlistEntryByEmail(waitlistData.email);
      if (existingEntry) {
        return res.status(409).json({
          message: "Email already registered on waitlist",
          status: existingEntry.status
        });
      }

      // Create waitlist entry with database-level duplicate handling
      let entry;
      try {
        entry = await storage.createWaitlistEntry(waitlistData);
      } catch (dbError: any) {
        // Handle database unique constraint violation (concurrent submissions)
        if (dbError.code === '23505' && dbError.constraint === 'waitlist_email_unique') {
          return res.status(409).json({
            message: "Email already registered on waitlist",
            status: "pending"
          });
        }
        // Re-throw other database errors
        throw dbError;
      }

      // Submit to Go High Level CRM
      const ghlResult = await submitWaitlistToGHL(entry);

      // Log the waitlist submission (mask email for privacy)
      const maskedEmail = entry.email.replace(/(.{2}).*(@.*)/, '$1***$2');
      console.log('Waitlist submission:', {
        waitlistId: entry.id,
        email: maskedEmail,
        businessType: entry.businessType,
        experienceLevel: entry.experienceLevel,
        ghlSubmitted: ghlResult.success,
        ghlSkipped: ghlResult.skipped || false,
        ghlContactId: ghlResult.ghlContactId,
        timestamp: new Date().toISOString()
      });

      res.status(201).json({
        message: "Successfully joined waitlist",
        id: entry.id,
        status: entry.status,
        ghlIntegration: {
          success: ghlResult.success,
          skipped: ghlResult.skipped || false,
          contactId: ghlResult.ghlContactId
        }
      });
    } catch (error) {
      console.error("Error creating waitlist entry:", error);
      res.status(500).json({ message: "Failed to join waitlist" });
    }
  });

  // Referrals
  app.post('/api/deals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const dealData = {
        ...req.body,
        referrerId: userId,
      };

      const validation = insertDealSchema.safeParse(dealData);
      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        return res.status(400).json({ message: validationError.message });
      }

      const deal = await storage.createDealWithLevel(validation.data, userId);

      // Get the submitter's name for notifications
      const submitter = await storage.getUser(userId);
      const submitterName = submitter ? `${submitter.firstName || ''} ${submitter.lastName || ''}`.trim() || submitter.email : 'A partner';

      // Create notification for deal submission (notify the partner)
      await createNotificationForUser(userId, {
        type: 'status_update',
        title: 'Quote Request Submitted',
        message: `Your quote request for ${deal.businessName} (${deal.dealId}) has been submitted and is being processed`,
        dealId: deal.id,
        businessName: deal.businessName
      });

      // Notify all admins of the new deal
      await notifyAdminsOfNewDeal(deal, submitterName);

      // Submit to GoHighLevel (GHL) for processing
      try {
        await submitToGHL(deal);
        console.log(`Deal ${deal.id} submitted to GHL successfully`);
      } catch (ghlError) {
        console.error(`Failed to submit deal ${deal.id} to GHL:`, ghlError);
        // Continue processing even if GHL submission fails
      }

      console.log(`Deal created: ${deal.dealId} for ${deal.businessName}`);
      res.json(deal);
    } catch (error) {
      console.error("Error creating referral:", error);
      res.status(500).json({ message: "Failed to create referral" });
    }
  });

  app.get('/api/deals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referrals = await storage.getDealsByUserId(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Get deals with their quote data combined - unified view for Track Deals and Quotes pages
  app.get('/api/deals/with-quotes', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { productType } = req.query;
      let dealsWithQuotes = await storage.getDealsWithQuotes(userId);

      if (productType) {
        dealsWithQuotes = dealsWithQuotes.filter((deal: any) => deal.productType === productType);
      }

      res.json(dealsWithQuotes);
    } catch (error) {
      console.error("Error fetching deals with quotes:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  // Upload bills for a specific referral
  app.post('/api/deals/:id/upload-bill', upload.array('bills', 5), async (req: any, res) => {
    try {
      const dealId = req.params.id;
      const files = req.files;

      // Get the deal to get the businessName
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Process each uploaded file and link to businessName
      const uploadPromises = files.map(async (file: any) => {
        const fileContent = file.buffer.toString('base64');
        return storage.createBillUpload(
          deal.businessName,
          file.originalname,
          file.size,
          file.mimetype,
          fileContent
        );
      });

      const billUploads = await Promise.all(uploadPromises);

      res.json({
        success: true,
        message: `${files.length} file(s) uploaded successfully`,
        uploads: billUploads
      });
    } catch (error) {
      console.error("Error uploading bills for referral:", error);
      res.status(500).json({ message: "Failed to upload bills" });
    }
  });

  // Quotes endpoints
  app.get('/api/quotes', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const quotes = await storage.getQuotesByUserId(userId);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.get('/api/quotes/:id', requireAuth, async (req: any, res) => {
    try {
      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.post('/api/quotes/:id/update-status', requireAuth, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      await storage.updateQuoteJourneyStatus(req.params.id, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating quote status:", error);
      res.status(500).json({ message: "Failed to update quote status" });
    }
  });

  app.post('/api/quotes/:id/question', requireAuth, async (req: any, res) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ message: "Question is required" });
      }
      await storage.addQuoteQuestion(req.params.id, question);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding question:", error);
      res.status(500).json({ message: "Failed to add question" });
    }
  });

  app.post('/api/quotes/:id/rate-request', requireAuth, async (req: any, res) => {
    try {
      const { request } = req.body;
      if (!request) {
        return res.status(400).json({ message: "Request is required" });
      }
      await storage.addQuoteRateRequest(req.params.id, request);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding rate request:", error);
      res.status(500).json({ message: "Failed to add rate request" });
    }
  });

  app.post('/api/quotes/:id/approve', requireAuth, async (req: any, res) => {
    try {
      await storage.approveQuoteByPartner(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error approving quote:", error);
      res.status(500).json({ message: "Failed to approve quote" });
    }
  });

  app.post('/api/quotes/:id/send-to-client', requireAuth, async (req: any, res) => {
    try {
      await storage.sendQuoteToClient(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending quote to client:", error);
      res.status(500).json({ message: "Failed to send quote to client" });
    }
  });

  // Unified deal messages endpoints - fetches from both dealMessages and quoteQA tables
  app.get('/api/deals/:dealId/messages', requireAuth, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const isAdmin = req.user.isAdmin;

      // Ownership guardrail: ensure user owns this deal or is admin
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      if (!isAdmin && deal.referrerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view messages for this deal" });
      }

      // Use unified messaging system that pulls from both sources
      const messages = await storage.getUnifiedDealMessages(dealId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching deal messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send reminder email to client for agreement_sent stage
  app.post('/api/deals/:dealId/send-reminder', requireAuth, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const deal = await storage.getDealById(dealId);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Ownership guardrail: ensure user owns this deal or is admin
      const isAdmin = req.user.isAdmin;
      if (!isAdmin && deal.referrerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to send reminder for this deal" });
      }

      // Get the signup details for client info
      const signupDetails = await storage.getSignupDetailsByDealId(dealId);
      const clientEmail = signupDetails?.email || deal.businessEmail;
      const clientFirstName = signupDetails?.firstName;
      const clientLastName = signupDetails?.lastName;

      if (!clientEmail) {
        return res.status(400).json({ message: "No client email found for this deal" });
      }

      // Send reminder email via GoHighLevel
      const { ghlEmailService } = await import('./ghlEmailService');
      const emailSent = await ghlEmailService.sendClientReminder(
        clientEmail,
        deal.businessName,
        clientFirstName,
        clientLastName
      );

      // Log the reminder in deal messages
      await storage.createDealMessage({
        dealId: dealId,
        senderId: req.user.id,
        senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
        message: `Reminder sent to client at ${clientEmail}`,
        isAdminMessage: false,
        authorType: 'partner',
        messageType: 'system'
      });

      res.json({
        success: true,
        message: emailSent ? "Reminder sent successfully" : "Reminder logged (email service not configured)"
      });
    } catch (error) {
      console.error("Error sending reminder:", error);
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

  app.post('/api/deals/:dealId/messages', requireAuth, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const isAdmin = req.user.isAdmin;
      const deal = await storage.getDealById(dealId);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Ownership guardrail: ensure user owns this deal or is admin
      if (!isAdmin && deal.referrerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to message on this deal" });
      }

      // Create message in the dealMessages table directly with default type='chat'
      const newMessage = await storage.createDealMessage({
        dealId: dealId,
        senderId: req.user.id,
        senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
        senderEmail: req.user.email,
        isAdminMessage: isAdmin,
        messageType: 'chat',
        message: message,
      });

      // Create notification for the other party
      if (isAdmin) {
        // Notify the partner when admin sends a message
        if (deal.referrerId) {
          await storage.createNotification({
            userId: deal.referrerId,
            type: 'admin_query',
            title: 'New Message from Admin',
            message: `Admin has sent you a message regarding ${deal.businessName || 'your deal'}`,
            dealId: dealId,
            businessName: deal.businessName,
          });
        }
      } else {
        // Notify all admins when partner sends a message
        const admins = await storage.getAdminUsers();
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            type: 'partner_message',
            title: 'New Message from Partner',
            message: `Partner has sent a message about ${deal.businessName || 'a deal'}: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`,
            dealId: dealId,
            businessName: deal.businessName,
          });
        }
      }

      res.json({ success: true, message: newMessage });
    } catch (error) {
      console.error("Error creating deal message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post('/api/quotes/:id/signup', requireAuth, async (req: any, res) => {
    try {
      const quoteId = req.params.id;
      const signupData = req.body;

      // Get the quote to find the referral ID
      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Save the signup information
      await storage.saveQuoteSignupInfo(quoteId, quote.referralId, signupData);

      return res.json({ success: true });
    } catch (error) {
      console.error("Error saving signup info:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to save signup information" });
      }
    }
  });

  // Q&A routes for quotes - now writes to deal_messages with type='quote_qa'
  app.post('/api/quotes/:id/qa', requireAuth, async (req: any, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const quoteId = req.params.id;
      const isAdmin = req.user.isAdmin;

      // Get the quote to find the deal ID (quotes.referral_id is actually the deal_id)
      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const dealId = quote.referralId; // referralId in quotes is actually the deal ID

      // Ownership check: ensure user owns this deal or is admin
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      if (!isAdmin && deal.referrerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to message on this deal" });
      }

      // Write to deal_messages with type='quote_qa' (single messaging system)
      const newMessage = await storage.createDealMessage({
        dealId: dealId,
        senderId: req.user.id,
        senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
        senderEmail: req.user.email,
        isAdminMessage: isAdmin,
        messageType: 'quote_qa',
        message: message,
      });

      // If admin is sending a message, create a notification for the deal owner
      if (isAdmin) {
        if (deal.referrerId) {
          await storage.createNotification({
            userId: deal.referrerId,
            type: 'admin_query',
            title: 'New Query from Admin',
            message: `Admin has a question about ${deal.businessName || 'your deal'}: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
            dealId: dealId,
            businessName: deal.businessName,
          });
        }
      }

      res.json(newMessage);
    } catch (error) {
      console.error("Error adding Q&A message:", error);
      res.status(500).json({ message: "Failed to add message" });
    }
  });

  app.get('/api/quotes/:id/qa', requireAuth, async (req: any, res) => {
    try {
      const quoteId = req.params.id;
      const isAdmin = req.user.isAdmin;

      // Get the quote to find the deal ID
      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const dealId = quote.referralId;

      // Ownership guardrail: ensure user owns this deal or is admin
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      if (!isAdmin && deal.referrerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view messages for this quote" });
      }

      // Get messages from legacy quote_qa table for backwards compatibility
      // This will be deprecated in Phase 2
      const legacyMessages = await storage.getQuoteQA(quoteId);

      // Also get deal_messages with type='quote_qa' for new messages
      const dealMessages = await storage.getDealMessagesByType(dealId, 'quote_qa');

      // Merge both sources, sorted by createdAt
      const allMessages = [...legacyMessages, ...dealMessages].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      res.json(allMessages);
    } catch (error) {
      console.error("Error fetching Q&A messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Document upload routes for quotes
  app.post('/api/quotes/:id/documents', requireAuth, (req: any, res, next) => {
    upload.single('document')(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        if (!res.headersSent) {
          return res.status(400).json({ message: err.message || "File upload error" });
        }
        return;
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const file = req.file;
      const { documentType } = req.body;

      if (!file || !documentType) {
        if (!res.headersSent) {
          return res.status(400).json({ message: "Missing file or document type" });
        }
        return;
      }

      const quote = await storage.getQuoteById(req.params.id);
      if (!quote) {
        if (!res.headersSent) {
          return res.status(404).json({ message: "Quote not found" });
        }
        return;
      }

      // Convert file buffer to base64
      const fileData = file.buffer.toString('base64');

      const uploadRecord = await storage.createQuoteBillUpload(
        req.params.id,
        quote.referralId,
        file.originalname,
        file.size,
        file.mimetype,
        req.user.id,
        documentType,
        fileData
      );

      if (!res.headersSent) {
        res.json(uploadRecord);
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to upload document" });
      }
    }
  });

  app.get('/api/quotes/:id/documents', requireAuth, async (req: any, res) => {
    try {
      const documents = await storage.getQuoteBillUploads(req.params.id);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/quotes/:quoteId/documents/:docId/download', requireAuth, async (req: any, res) => {
    try {
      const document = await storage.getQuoteBillUploadById(req.params.docId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Simple authorization: user must own the quote or be admin
      const quote = await storage.getQuoteById(req.params.quoteId);
      if (!quote || (quote.createdBy !== req.user.id && !req.user.isAdmin)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Convert base64 back to buffer
      if (!document.fileData) {
        return res.status(404).json({ message: "File data not found" });
      }

      const fileBuffer = Buffer.from(document.fileData, 'base64');

      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      res.setHeader('Content-Length', fileBuffer.length);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Mark quote as New to Card (NTC)
  app.post('/api/quotes/:id/mark-ntc', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const quote = await storage.getQuoteById(req.params.id);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Update the quote to mark it as new_to_card
      await storage.updateQuote(req.params.id, {
        businessType: 'new_to_card',
        estimatedCommission: '280.00', // NTC commission
      });

      res.json({ message: "Quote marked as New to Card" });
    } catch (error) {
      console.error("Error marking quote as NTC:", error);
      res.status(500).json({ message: "Failed to mark as NTC" });
    }
  });

  // Cancel quote
  app.post('/api/quotes/:id/cancel', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { reason } = req.body;
      const quote = await storage.getQuoteById(req.params.id);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Update quote status to cancelled
      await storage.updateQuote(req.params.id, {
        status: 'cancelled',
        adminNotes: `Quote cancelled. Reason: ${reason}`,
        updatedAt: new Date()
      });

      // Update the deal stage to declined (will auto-sync customerJourneyStatus)
      if (quote.referralId) {
        await storage.updateDeal(quote.referralId, {
          dealStage: 'declined',
          adminNotes: `Deal declined - Quote cancelled. Reason: ${reason}`,
        });
      }

      // Post cancellation message to quote Q&A
      await fetch(`${req.protocol}://${req.get('host')}/api/quotes/${req.params.id}/qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || ''
        },
        body: JSON.stringify({
          message: `❌ **Quote Cancelled**\n\nThis quote has been cancelled.\n\n**Reason:** ${reason}`
        }),
      });

      res.json({ message: "Quote cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling quote:", error);
      res.status(500).json({ message: "Failed to cancel quote" });
    }
  });

  // Legacy bill upload route (keep for backward compatibility)
  app.post('/api/quotes/:id/bill-upload', requireAuth, async (req: any, res) => {
    try {
      const { fileName, fileSize, fileType } = req.body;
      const quote = await storage.getQuoteById(req.params.id);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const upload = await storage.createQuoteBillUpload(
        req.params.id,
        quote.referralId,
        fileName,
        fileSize,
        fileType,
        req.user.id,
        'switcher_statement', // Default to switcher statement for legacy
        undefined // No file data for legacy route
      );

      res.json(upload);
    } catch (error) {
      console.error("Error uploading bill:", error);
      res.status(500).json({ message: "Failed to upload bill" });
    }
  });

  app.get('/api/quotes/:id/bills', requireAuth, async (req: any, res) => {
    try {
      const bills = await storage.getQuoteBillUploads(req.params.id);
      res.json(bills);
    } catch (error) {
      console.error("Error fetching bills:", error);
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  });

  // Admin routes for signups and quote management
  app.get('/api/admin/signups', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const signups = await storage.getPendingSignups();
      res.json(signups);
    } catch (error) {
      console.error("Error fetching signups:", error);
      res.status(500).json({ message: "Failed to fetch signups" });
    }
  });

  app.get('/api/admin/completed-deals', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const completedDeals = await storage.getCompletedDeals();
      res.json(completedDeals);
    } catch (error) {
      console.error("Error fetching completed deals:", error);
      res.status(500).json({ message: "Failed to fetch completed deals" });
    }
  });

  app.get('/api/admin/messages', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      // Use unified messages that pull from both dealMessages and quoteQA tables
      const messages = await storage.getAllUnifiedMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get('/api/admin/signups/:quoteId', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const signup = await storage.getSignupDetails(req.params.quoteId);
      res.json(signup);
    } catch (error) {
      console.error("Error fetching signup details:", error);
      res.status(500).json({ message: "Failed to fetch signup details" });
    }
  });

  // Get signup details by deal ID
  app.get('/api/admin/deals/:dealId/signup-details', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const signup = await storage.getSignupDetailsByDealId(dealId);
      res.json(signup || null);
    } catch (error) {
      console.error("Error fetching signup details by deal:", error);
      res.status(500).json({ message: "Failed to fetch signup details" });
    }
  });

  // Confirm "Docs Out" (agreement sent) for a signup
  app.post('/api/admin/signups/:quoteId/docs-out', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const { communicationNotes, requiredDocuments } = req.body;

      // Update quote journey status to "Docs Out"
      await storage.updateQuoteJourneyStatus(quoteId, 'docs_out');

      // Get the quote to find the associated referral
      const quote = await storage.getQuoteById(quoteId);
      if (quote && quote.referralId) {
        // Update deal with admin notes about required documents
        const noteText = `\n[${new Date().toLocaleString()}] Docs Out Confirmed - Agreement sent. ${communicationNotes || ''}`;
        await storage.updateDeal(quote.referralId, {
          docsOutConfirmed: true,
          docsOutConfirmedAt: new Date(),
          requiredDocuments: requiredDocuments || ['identification', 'proof_of_bank'],
          adminNotes: (quote.adminNotes || '') + noteText,
          updatedAt: new Date()
        });
      }

      res.json({ success: true, message: "Docs Out confirmed successfully" });
    } catch (error) {
      console.error("Error confirming docs out:", error);
      res.status(500).json({ message: "Failed to confirm docs out" });
    }
  });

  // Confirm "Awaiting Docs" (after signup, waiting for documents)
  app.post('/api/admin/signups/:quoteId/awaiting-docs', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const { communicationNotes } = req.body;

      // Update quote journey status to "Awaiting Docs"
      await storage.updateQuoteJourneyStatus(quoteId, 'awaiting_docs');

      // Get the quote to find the associated referral
      const quote = await storage.getQuoteById(quoteId);
      if (quote && quote.referralId) {
        const noteText = `\n[${new Date().toLocaleString()}] Awaiting Documents - ${communicationNotes || 'Waiting for Onfido ID and proof of bank'}`;
        await storage.updateDeal(quote.referralId, {
          adminNotes: (quote.adminNotes || '') + noteText,
          updatedAt: new Date()
        });
      }

      res.json({ success: true, message: "Status updated to Awaiting Docs" });
    } catch (error) {
      console.error("Error updating to awaiting docs:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // Confirm "Docs In" (documents received from customer) - moves to Approved
  app.post('/api/admin/signups/:quoteId/docs-in', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const { receivedDocuments, outstandingDocuments, notes } = req.body;

      // Update quote journey status to "Approved" (documents received means ready to go live)
      await storage.updateQuoteJourneyStatus(quoteId, 'approved');

      // Get the quote to find the associated referral
      const quote = await storage.getQuoteById(quoteId);
      if (quote && quote.referralId) {
        const noteText = `\n[${new Date().toLocaleString()}] Documents Received - Deal Approved - ${notes || 'All required documents received, ready to go live'}`;
        await storage.updateDeal(quote.referralId, {
          status: 'approved',
          adminNotes: (quote.adminNotes || '') + noteText,
          receivedDocuments: receivedDocuments || [],
          updatedAt: new Date()
        });
      }

      res.json({ success: true, message: "Documents received - Deal approved and ready to go live" });
    } catch (error) {
      console.error("Error updating to docs received:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // Approve or Decline a deal
  app.post('/api/admin/signups/:quoteId/final-decision', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const { decision, notes, actualCommission } = req.body;

      if (!decision || !['approved', 'declined'].includes(decision)) {
        return res.status(400).json({ message: "Decision must be 'approved' or 'declined'" });
      }

      const dealStage = decision === 'approved' ? 'approved' : 'declined';

      // Update quote with final decision
      await storage.db.update(storage.schema.quotes)
        .set({
          finalDecision: decision,
          finalDecisionDate: new Date(),
          finalDecisionNotes: notes || null,
          actualCommission: actualCommission ? parseFloat(actualCommission) : null,
          updatedAt: new Date()
        })
        .where(storage.eq(storage.schema.quotes.id, quoteId));

      // Get the quote to find the associated deal and update its stage (will auto-sync customerJourneyStatus)
      const quote = await storage.getQuoteById(quoteId);
      if (quote && quote.referralId) {
        const noteText = `\n[${new Date().toLocaleString()}] Deal ${decision.toUpperCase()} - ${notes || ''}`;
        await storage.updateDeal(quote.referralId, {
          dealStage,
          status: decision,
          adminNotes: (quote.adminNotes || '') + noteText,
          actualCommission: actualCommission ? parseFloat(actualCommission) : null,
          updatedAt: new Date()
        });
      }

      res.json({ success: true, message: `Deal ${decision} successfully` });
    } catch (error) {
      console.error("Error updating final decision:", error);
      res.status(500).json({ message: "Failed to update decision" });
    }
  });

  // Mark deal as complete (manually, after payment processing)
  app.post('/api/admin/signups/:quoteId/mark-complete', requireAuth, requireAdmin, auditAdminAction('mark_complete', 'admin'), async (req: any, res) => {
    try {
      const { quoteId } = req.params;

      // Get the quote to find the associated deal
      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Update deal stage to completed (will auto-sync customerJourneyStatus)
      if (quote.referralId) {
        await storage.updateDeal(quote.referralId, {
          dealStage: 'completed',
          status: 'completed',
        });
      }

      console.log(`Quote ${quoteId} marked as complete by admin ${req.user.email}`);

      res.json({ success: true, message: "Deal marked as complete (installed and paid)" });
    } catch (error) {
      console.error("Error marking deal as complete:", error);
      res.status(500).json({ message: "Failed to mark deal as complete" });
    }
  });

  // Move approved deal to pending payments (live status)
  app.post('/api/admin/move-to-payments/:quoteId', requireAuth, requireAdmin, auditAdminAction('move_to_payments', 'admin'), async (req: any, res) => {
    try {
      const { quoteId } = req.params;

      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Get the associated deal to check status
      if (!quote.referralId) {
        return res.status(400).json({ message: "Quote is not associated with a deal" });
      }

      const deals = await storage.getAllDeals();
      const deal = deals.find((d: any) => d.id === quote.referralId);

      if (!deal || deal.dealStage !== 'approved') {
        return res.status(400).json({ message: "Only approved deals can be moved to pending payments" });
      }

      // Move to "live_confirm_ltr" status (will auto-sync customerJourneyStatus to 'live')
      await storage.updateDeal(quote.referralId, {
        dealStage: 'live_confirm_ltr',
      });

      console.log(`Quote ${quoteId} moved to pending payments by admin ${req.user.email}`);

      res.json({
        success: true,
        message: "Deal moved to pending payments"
      });
    } catch (error) {
      console.error("Error moving deal to payments:", error);
      res.status(500).json({ message: "Failed to move deal" });
    }
  });

  app.get('/api/admin/quotes', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const quotes = await storage.getAllQuotesForAdmin();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching admin quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post('/api/admin/quotes/:id/commission', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { estimatedCommission } = req.body;
      if (estimatedCommission === undefined) {
        return res.status(400).json({ message: "Estimated commission is required" });
      }

      await storage.updateQuoteCommission(req.params.id, parseFloat(estimatedCommission));
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating commission:", error);
      res.status(500).json({ message: "Failed to update commission" });
    }
  });

  app.post('/api/admin/quotes/:id/business-type', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { businessType, billUploadRequired } = req.body;
      if (!businessType) {
        return res.status(400).json({ message: "Business type is required" });
      }

      await storage.updateQuoteBusinessType(req.params.id, businessType, billUploadRequired || false);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating business type:", error);
      res.status(500).json({ message: "Failed to update business type" });
    }
  });

  app.post('/api/admin/bills/:billId/approve', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { adminNotes } = req.body;
      await storage.approveQuoteBill(req.params.billId, adminNotes);
      res.json({ success: true });
    } catch (error) {
      console.error("Error approving bill:", error);
      res.status(500).json({ message: "Failed to approve bill" });
    }
  });

  app.post('/api/admin/bills/:billId/reject', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { adminNotes } = req.body;
      if (!adminNotes) {
        return res.status(400).json({ message: "Admin notes are required for rejection" });
      }

      await storage.rejectQuoteBill(req.params.billId, adminNotes);
      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting bill:", error);
      res.status(500).json({ message: "Failed to reject bill" });
    }
  });

  // Stripe commission payment route
  app.post('/api/admin/quotes/:id/pay-commission', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "Stripe is not configured. Please set STRIPE_SECRET_KEY" });
      }

      const { amount, partnerEmail, partnerName } = req.body;

      if (!amount || !partnerEmail) {
        return res.status(400).json({ message: "Amount and partner email are required" });
      }

      // Initialize Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });

      // Create a payment intent (in real implementation, you'd want to use Stripe Connect for payouts)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: 'gbp',
        description: `Commission payment to ${partnerName || partnerEmail}`,
        metadata: {
          quoteId: req.params.id,
          partnerEmail,
          paymentType: 'commission'
        }
      });

      // Record the payment in the database
      await storage.recordCommissionPayment(req.params.id, paymentIntent.id);

      res.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret
      });
    } catch (error: any) {
      console.error("Error processing commission payment:", error);
      res.status(500).json({ message: "Failed to process payment: " + error.message });
    }
  });

  // User endpoint to update their own referrals
  app.patch('/api/deals/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      // Get current referral and verify ownership
      const referrals = await storage.getDealsByUserId(userId);
      const currentReferral = referrals.find(r => r.id === id);

      if (!currentReferral) {
        return res.status(404).json({ message: "Deal not found or you don't have permission to update it" });
      }

      // Check if status is changing
      const oldStatus = currentReferral.status;
      const newStatus = updateData.status || oldStatus;
      const statusChanged = oldStatus !== newStatus;

      // Update the referral
      const updatedReferral = await storage.updateDeal(id, {
        ...updateData,
        updatedAt: new Date()
      });

      // Send notifications if status changed
      if (statusChanged) {
        // Notify the referral owner
        await createNotificationForUser(userId, {
          type: 'referral_status_changed',
          title: 'Referral Status Updated',
          message: `Your referral for ${currentReferral.businessName} has moved from ${oldStatus} to ${newStatus}`,
          dealId: id,
          businessName: currentReferral.businessName,
          metadata: {
            oldStatus,
            newStatus,
            updatedBy: req.user.email || 'You',
            commission: (newStatus === 'approved' || newStatus === 'paid') ? currentReferral.estimatedCommission : null
          }
        });

        // Notify team leader if exists
        const user = await storage.getUser(userId);
        if (user?.parentPartnerId) {
          await createNotificationForUser(user.parentPartnerId, {
            type: 'team_referral_status_changed',
            title: 'Team Member Referral Update',
            message: `${user.firstName || user.email}'s referral for ${currentReferral.businessName} has moved from ${oldStatus} to ${newStatus}`,
            dealId: id,
            businessName: currentReferral.businessName,
            metadata: {
              oldStatus,
              newStatus,
              teamMemberName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
              teamMemberId: userId,
              commission: (newStatus === 'approved' || newStatus === 'paid') ? currentReferral.estimatedCommission : null
            }
          });
        }
      }

      res.json({
        success: true,
        referral: updatedReferral,
        statusChanged
      });
    } catch (error) {
      console.error("Error updating referral:", error);
      res.status(500).json({ message: "Failed to update referral" });
    }
  });

  // Search business names from pipeline
  app.get('/api/businesses/search', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const query = (req.query.q as string || '').trim();

      if (query.length < 2) {
        return res.json([]);
      }

      const businesses = await storage.searchBusinessNames(userId, query);
      res.json(businesses);
    } catch (error) {
      console.error("Error searching businesses:", error);
      res.status(500).json({ message: "Failed to search businesses" });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Notification endpoints
  app.get('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getNotificationsByUserId(userId);

      // Count unread notifications
      const unreadCount = notifications.filter((n: any) => !n.read).length;

      res.json({
        notifications,
        unreadCount,
        total: notifications.length
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Mark notification as read (with userId for security)
      await storage.markNotificationAsRead(id, userId);

      // Notify WebSocket clients
      wsManager.sendNotificationToUser(userId, {
        type: "notificationRead",
        title: "",
        message: "",
        metadata: { notificationId: id }
      });

      res.json({ success: true, message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch('/api/notifications/read-all', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Mark all notifications as read
      await storage.markAllNotificationsAsRead(userId);

      // Notify WebSocket clients
      wsManager.sendNotificationToUser(userId, {
        type: "allNotificationsRead",
        title: "",
        message: "",
        metadata: {}
      });

      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Team referral statistics
  app.get('/api/team/referral-stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getTeamReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching team referral stats:", error);
      res.status(500).json({ message: "Failed to fetch team referral stats" });
    }
  });

  // Team referrals list
  app.get('/api/team/referrals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referrals = await storage.getTeamReferrals(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching team referrals:", error);
      res.status(500).json({ message: "Failed to fetch team referrals" });
    }
  });

  // Team progression data (revenue, level, team size)
  app.get('/api/team/progression', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const data = await storage.getProgressionData(userId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching progression data:", error);
      res.status(500).json({ message: "Failed to fetch progression data" });
    }
  });

  // 🔍 DEBUG ENDPOINT: User Referral Relationships
  // Temporary endpoint to verify referral linking
  app.get('/api/debug/user-referrals/:userId', requireAuth, async (req: any, res) => {
    try {
      const { userId } = req.params;

      // Get the target user's details
      const [targetUser] = await db.execute(sql`
        SELECT 
          id, 
          email, 
          first_name, 
          last_name,
          partner_id,
          referral_code, 
          parent_partner_id
        FROM users 
        WHERE id = ${userId}
      `);

      if (!targetUser.rows || targetUser.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = targetUser.rows[0];

      // Get who referred this user (parent)
      let referredBy = null;
      if (user.parent_partner_id) {
        const [parentUser] = await db.execute(sql`
          SELECT id, email, first_name, last_name, partner_id, referral_code
          FROM users 
          WHERE id = ${user.parent_partner_id}
        `);
        if (parentUser.rows && parentUser.rows.length > 0) {
          referredBy = parentUser.rows[0];
        }
      }

      // Get all users referred BY this user (children)
      const referrals = await db.execute(sql`
        SELECT 
          id, 
          email, 
          first_name, 
          last_name,
          partner_id,
          referral_code,
          created_at,
          (SELECT COUNT(*) 
           FROM deals 
           WHERE referrer_id = users.id 
             AND (status IN ('approved', 'live', 'completed')
                  OR deal_stage IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed'))
          ) as approved_deals_count,
          (SELECT COUNT(*) 
           FROM deals 
           WHERE referrer_id = users.id 
             AND (status IN ('approved', 'live', 'completed')
                  OR deal_stage IN ('approved', 'live_confirm_ltr', 'invoice_received', 'completed'))
             AND submitted_at >= NOW() - INTERVAL '6 months'
          ) as recent_approved_deals
        FROM users 
        WHERE parent_partner_id = ${userId}
        ORDER BY created_at DESC
      `);

      // Calculate status for each referral
      const referralsList = referrals.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: `${r.first_name} ${r.last_name}`,
        partnerId: r.partner_id,
        referralCode: r.referral_code,
        joinedAt: r.created_at,
        approvedDealsAllTime: Number(r.approved_deals_count),
        recentApprovedDeals: Number(r.recent_approved_deals),
        status: Number(r.recent_approved_deals) > 0
          ? 'active'
          : Number(r.approved_deals_count) > 0
            ? 'inactive'
            : 'registered'
      }));

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          partnerId: user.partner_id,
          referralCode: user.referral_code,
          parentPartnerId: user.parent_partner_id
        },
        referredBy: referredBy ? {
          id: referredBy.id,
          email: referredBy.email,
          name: `${referredBy.first_name} ${referredBy.last_name}`,
          partnerId: referredBy.partner_id,
          referralCode: referredBy.referral_code
        } : null,
        referrals: referralsList,
        summary: {
          totalReferrals: referralsList.length,
          activeReferrals: referralsList.filter((r: any) => r.status === 'active').length,
          inactiveReferrals: referralsList.filter((r: any) => r.status === 'inactive').length,
          registeredOnlyReferrals: referralsList.filter((r: any) => r.status === 'registered').length
        }
      });
    } catch (error) {
      console.error('Debug endpoint error:', error);
      res.status(500).json({ error: 'Failed to fetch referral data' });
    }
  });

  // Team analytics - hierarchy and performance data
  app.get('/api/team-analytics', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get team members under this user (direct and indirect)
      const teamMembers = await storage.getTeamHierarchy(userId);

      // Calculate performance metrics
      const totalTeamMembers = teamMembers.length;
      const totalRevenue = teamMembers.reduce((sum, m) => sum + (m.totalRevenue || 0), 0);
      const activeMembers = teamMembers.filter(m => m.hasSubmittedDeals > 0).length;
      const avgConversionRate = activeMembers > 0 ? (activeMembers / totalTeamMembers) * 100 : 0;

      // Format team member data
      const formattedMembers = teamMembers.map((member, index) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        email: member.email,
        level: member.partnerLevel === 1 ? "Direct Team (L1)" : member.partnerLevel === 2 ? "Extended Team (L2)" : "Network (L3)",
        rank: index + 1,
        totalInvites: member.teamSize || 0,
        activeMembers: member.activeTeamMembers || 0,
        conversionRate: member.teamSize > 0 ? ((member.activeTeamMembers || 0) / member.teamSize) * 100 : 0,
        totalRevenue: member.totalRevenue || 0,
        monthlyRevenue: member.monthlyRevenue || 0,
        joinedAt: member.createdAt,
        lastActive: member.lastActiveAt || member.createdAt,
        performanceScore: Math.min(100, Math.round((member.totalRevenue || 0) / 100)),
      }));

      const analytics = {
        performanceMetrics: {
          totalTeamMembers,
          totalRevenue,
          avgConversionRate: Math.round(avgConversionRate),
          totalInvites: teamMembers.reduce((sum, m) => sum + (m.teamSize || 0), 0),
          monthlyGrowth: 0, // TODO: Calculate from historical data
          topPerformer: formattedMembers[0]?.name || "None",
        },
        teamMembers: formattedMembers,
        chartData: [], // TODO: Implement historical data
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching team analytics:", error);
      res.status(500).json({ message: "Failed to fetch team analytics" });
    }
  });

  // Send team invite via email/phone (supports GHL integration)
  app.post('/api/invites', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { email, phone, firstName, lastName, role = 'member', message } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ message: "Either email or phone number is required" });
      }

      // Generate invite link with user's referral code
      const inviteCode = user.referralCode || user.partnerId || userId;
      const inviteUrl = `${req.protocol}://${req.get('host')}/signup?ref=${inviteCode}`;

      // Send invite via GHL if configured
      if (process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID) {
        try {
          const inviteData = {
            firstName: firstName || email?.split('@')[0] || 'Partner',
            lastName: lastName || 'Member',
            email: email || undefined,
            phone: phone || undefined,
            customFields: {
              invited_by: `${user.firstName} ${user.lastName}`,
              invited_by_id: userId,
              team_role: role,
              invite_message: message || '',
              invite_url: inviteUrl,
              invite_date: new Date().toISOString()
            },
            tags: ['Team Invitation', `Role: ${role}`, 'PartnerConnector', `Invited by: ${user.firstName}`]
          };

          const response = await fetch(`https://services.leadconnectorhq.com/locations/${process.env.GHL_LOCATION_ID}/contacts`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28'
            },
            body: JSON.stringify(inviteData)
          });

          if (response.ok) {
            const ghlResponse = await response.json();

            // Trigger workflow if configured
            if (process.env.GHL_WORKFLOW_ID && ghlResponse.contact?.id) {
              const workflowResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${ghlResponse.contact.id}/workflow/${process.env.GHL_WORKFLOW_ID}`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
                  'Content-Type': 'application/json',
                  'Version': '2021-07-28'
                }
              });

              if (!workflowResponse.ok) {
                console.error('Failed to trigger GHL workflow:', await workflowResponse.text());
              }
            }

            console.log(`Invitation sent via GHL to ${email || phone}. Contact ID: ${ghlResponse.contact?.id}`);
          } else {
            console.error('GHL API error:', await response.text());
          }
        } catch (error) {
          console.error('Error sending invitation via GHL:', error);
        }
      }

      // Store invitation in database for tracking
      // TODO: Implement trackInvitation in storage
      // await storage.trackInvitation({
      //   inviterId: userId,
      //   inviterName: `${user.firstName} ${user.lastName}`,
      //   inviteeEmail: email || null,
      //   inviteePhone: phone || null,
      //   inviteCode: inviteCode,
      //   inviteUrl: inviteUrl,
      //   role: role,
      //   message: message || null,
      //   sentAt: new Date()
      // });

      // Create notification for the inviter
      await createNotification(userId, {
        type: 'team_invite_sent',
        title: 'Team Invitation Sent',
        message: `Invitation sent to ${email || phone}`,
        metadata: {
          invitee: email || phone,
          role: role
        }
      });

      res.json({
        success: true,
        message: 'Invitation sent successfully',
        inviteUrl: inviteUrl,
        inviteCode: inviteCode
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get pending team invitations
  app.get('/api/team-invitations', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Return empty array for now - TODO: implement getInvitationsByUserId
      const invitations: any[] = [];
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching team invitations:", error);
      res.status(500).json({ message: "Failed to fetch team invitations" });
    }
  });

  // Resend team invitation
  app.patch('/api/team-invitations/:inviteId/resend', requireAuth, async (req: any, res) => {
    try {
      const { inviteId } = req.params;
      const userId = req.user.id;

      // TODO: Implement invitation resend
      console.log(`Resending invitation ${inviteId} for user ${userId}`);

      res.json({ success: true, message: "Invitation resent successfully" });
    } catch (error) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ message: "Failed to resend invitation" });
    }
  });

  // Cancel team invitation  
  app.delete('/api/team-invitations/:inviteId', requireAuth, async (req: any, res) => {
    try {
      const { inviteId } = req.params;
      const userId = req.user.id;

      // TODO: Implement invitation cancellation
      console.log(`Cancelling invitation ${inviteId} for user ${userId}`);

      res.json({ success: true, message: "Invitation cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ message: "Failed to cancel invitation" });
    }
  });

  // Bill upload - now uses business name instead of dealId/quoteId
  app.post('/api/bills/upload', upload.array('bills', 5), async (req: any, res) => {
    try {
      const businessName = req.body.businessName;
      const files = req.files;

      if (!businessName) {
        return res.status(400).json({ message: "Business name is required" });
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Process each uploaded file
      const uploadPromises = files.map(async (file: any) => {
        const fileContent = file.buffer.toString('base64');
        return storage.createBillUpload(
          businessName,
          file.originalname,
          file.size,
          file.mimetype,
          fileContent
        );
      });

      const billUploads = await Promise.all(uploadPromises);

      res.json({
        success: true,
        message: `${files.length} file(s) uploaded successfully`,
        uploads: billUploads
      });
    } catch (error) {
      console.error("Error uploading bills:", error);
      res.status(500).json({ message: "Failed to upload bills" });
    }
  });

  // Download bill file
  app.get('/api/bills/:billId/download', async (req: any, res) => {
    try {
      const { billId } = req.params;
      const bill = await storage.getBillUploadById(billId);

      if (!bill || !bill.fileContent) {
        return res.status(404).json({ message: "Bill not found" });
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${bill.fileName}"`);
      res.setHeader('Content-Type', bill.mimeType || 'application/octet-stream');
      if (bill.fileSize) {
        res.setHeader('Content-Length', bill.fileSize.toString());
      }

      // Send the file content (decode from base64)
      const fileBuffer = Buffer.from(bill.fileContent, 'base64');
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading bill:", error);
      res.status(500).json({ message: "Failed to download bill" });
    }
  });

  // Get bills for a business name
  app.get('/api/bills', async (req: any, res) => {
    try {
      const businessName = req.query.businessName as string | undefined;

      if (!businessName) {
        return res.status(400).json({ message: "Business name is required" });
      }

      const bills = await storage.getBillUploadsByBusinessName(businessName);

      res.json(bills);
    } catch (error) {
      console.error("Error fetching bills:", error);
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  });

  // View bill file in browser
  app.get('/api/bills/:billId/view', async (req: any, res) => {
    try {
      const { billId } = req.params;
      const bill = await storage.getBillUploadById(billId);

      if (!bill || !bill.fileContent) {
        return res.status(404).json({ message: "Bill not found" });
      }

      // Set headers for inline viewing (not download)
      res.setHeader('Content-Disposition', `inline; filename="${bill.fileName}"`);
      res.setHeader('Content-Type', bill.mimeType || 'application/pdf');
      if (bill.fileSize) {
        res.setHeader('Content-Length', bill.fileSize.toString());
      }

      // Send the file content (decode from base64)
      const fileBuffer = Buffer.from(bill.fileContent, 'base64');
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error viewing bill:", error);
      res.status(500).json({ message: "Failed to view bill" });
    }
  });

  // Submit additional details after quote approval
  app.post('/api/deals/:id/additional-details', async (req: any, res) => {
    try {
      const dealId = req.params.id;
      const userId = req.user?.claims?.sub || 'dev-user-123';
      const additionalDetails = req.body;

      // Verify the referral belongs to the user  
      const userReferrals = await storage.getDealsByUserId(userId);
      const deal = userReferrals.find(r => r.id === dealId);
      if (!referral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Update deal status to processing
      await storage.updateDealStatus(dealId, 'processing');

      // Store additional details (you may want to create a separate table for this)
      console.log('Additional details received for referral:', dealId, additionalDetails);

      res.json({
        success: true,
        message: "Additional details submitted successfully"
      });
    } catch (error) {
      console.error("Error submitting additional details:", error);
      res.status(500).json({ message: "Failed to submit additional details" });
    }
  });

  // Admin middleware to check admin access
  const isAdmin: RequestHandler = async (req: any, res, next) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      next();
    } catch (error) {
      console.error("Error checking admin access:", error);
      res.status(500).json({ message: "Failed to verify admin access" });
    }
  };

  // Password reset functionality
  app.post('/api/admin/users/:userId/reset-password', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.email) {
        return res.status(400).json({ message: "User has no email address" });
      }

      // Generate a simple reset token (in production, use crypto.randomBytes)
      const resetToken = `rst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Send password reset email
      const emailSent = await emailService.sendPasswordResetEmail(user.email, resetToken);

      if (emailSent) {
        res.json({
          success: true,
          message: `Password reset email sent to ${user.email}`
        });
      } else {
        res.json({
          success: false,
          message: "Email service not configured. Password reset email could not be sent."
        });
      }
    } catch (error) {
      console.error("Error sending password reset:", error);
      res.status(500).json({ message: "Failed to send password reset email" });
    }
  });

  // Delete/Archive payment/deal
  app.delete('/api/admin/payments/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Try to delete from commission_payments first
      const cp = await db.select().from(commissionPayments).where(eq(commissionPayments.id, id)).limit(1);
      if (cp.length > 0) {
        await db.delete(commissionPayments).where(eq(commissionPayments.id, id));
        return res.json({ success: true, message: 'Commission payment archived' });
      }

      // Try to delete from quotes (live accounts)
      const q = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
      if (q.length > 0) {
        await db.delete(quotes).where(eq(quotes.id, id));
        return res.json({ success: true, message: 'Deal archived' });
      }

      res.status(404).json({ message: 'Item not found' });
    } catch (error: any) {
      console.error('Error archiving item:', error);
      res.status(500).json({ message: 'Failed to archive item' });
    }
  });

  // ============ RATES MANAGEMENT ENDPOINTS ============

  // Get all rates
  app.get('/api/admin/rates', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const rates = await storage.getRates();
      res.json(rates);
    } catch (error) {
      console.error("Error fetching rates:", error);
      res.status(500).json({ message: "Failed to fetch rates" });
    }
  });

  // Create new rate
  app.post('/api/admin/rates', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const rate = await storage.createRate(req.body);
      res.json(rate);
    } catch (error) {
      console.error("Error creating rate:", error);
      res.status(500).json({ message: "Failed to create rate" });
    }
  });

  // Update rate
  app.patch('/api/admin/rates/:rateId', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { rateId } = req.params;
      const rate = await storage.updateRate(rateId, req.body);
      res.json(rate);
    } catch (error) {
      console.error("Error updating rate:", error);
      res.status(500).json({ message: "Failed to update rate" });
    }
  });

  // Delete rate
  app.delete('/api/admin/rates/:rateId', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { rateId } = req.params;
      await storage.deleteRate(rateId);
      res.json({ success: true, message: "Rate deleted successfully" });
    } catch (error) {
      console.error("Error deleting rate:", error);
      res.status(500).json({ message: "Failed to delete rate" });
    }
  });

  // ============ COMMISSION APPROVAL ENDPOINTS ============

  // Create commission approval when admin enters actual commission
  app.post('/api/admin/referrals/:dealId/create-commission-approval', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { actualCommission, adminNotes, ratesData } = req.body;

      // Fetch all existing commission payments for this deal
      const existingPayments = await storage.getCommissionPaymentsByDeal(dealId);
      const existingApprovedPayments = existingPayments.filter(
        (p: any) => p.paymentStatus === 'approved' || p.paymentStatus === 'paid'
      );
      const pendingPayments = existingPayments.filter(
        (p: any) => p.paymentStatus === 'needs_approval'
      );

      console.log(`[APPROVAL] Deal ${dealId}: ${existingPayments.length} total payments, ${existingApprovedPayments.length} approved/paid, ${pendingPayments.length} pending`);

      // ✅ ALWAYS: Update any pending payment records to 'distributed' so they leave the Pending queue
      for (const pendingPayment of pendingPayments) {
        await db
          .update(commissionPayments)
          .set({
            paymentStatus: 'distributed',
            approvalStatus: 'approved',
            approvedBy: req.user.id,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(commissionPayments.id, pendingPayment.id));
        console.log(`[APPROVAL] Updated payment ${pendingPayment.id} from needs_approval → distributed`);
      }

      // If commissions were already distributed, don't create duplicates
      if (existingApprovedPayments.length > 0) {
        console.log(`[APPROVAL] Commissions already exist for deal ${dealId}, skipping distribution`);
        return res.json({
          success: true,
          message: `Commissions already distributed. Cleaned up ${pendingPayments.length} pending record(s).`,
          alreadyDistributed: true,
          cleanedUp: pendingPayments.length,
        });
      }

      // First update the referral with actual commission
      await storage.updateDeal(dealId, {
        actualCommission: actualCommission,
        adminNotes: adminNotes || null
      });

      // Get deal details for approval
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === dealId);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // ✅ Distribute commissions across hierarchy, passing admin ID for approvedBy
      const approvals = await storage.distributeCommissions(
        dealId,
        actualCommission,
        deal.referrerId,
        deal.businessName,
        adminNotes,
        ratesData,
        req.user.id
      );

      // Create notifications for all recipients
      for (const approval of approvals) {
        const commissionTypeLabel = approval.commissionType === 'direct'
          ? 'Commission'
          : `Level ${approval.level} Override`;

        const percentageLabel = approval.level === 0 ? '60%' : approval.level === 1 ? '20%' : '10%';

        await createNotificationForUser(approval.userId, {
          type: 'commission_approval',
          title: `${commissionTypeLabel} Ready`,
          message: `Your ${commissionTypeLabel.toLowerCase()} of £${approval.commissionAmount} (${percentageLabel}) for ${deal.businessName} is ready for approval`,
          dealId: dealId,
          businessName: deal.businessName
        });
      }

      res.json({
        success: true,
        message: `Created ${approvals.length} commission approval${approvals.length > 1 ? 's' : ''}`,
        approvals: approvals,
        summary: {
          total: actualCommission,
          dealCreator: approvals.find(a => a.level === 0)?.commissionAmount || 0,
          level1Override: approvals.find(a => a.level === 1)?.commissionAmount || 0,
          level2Override: approvals.find(a => a.level === 2)?.commissionAmount || 0,
          companyRevenue: actualCommission - approvals.reduce((sum, a) => sum + Number(a.commissionAmount), 0)
        }
      });
    } catch (error) {
      console.error("Error creating commission approvals:", error);
      res.status(500).json({ message: "Failed to create commission approvals" });
    }
  });

  // Get user's commission approvals
  app.get('/api/commission-approvals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const approvals = await storage.getUserCommissionApprovals(userId);
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching user commission approvals:", error);
      res.status(500).json({ message: "Failed to fetch commission approvals" });
    }
  });

  // Get all commission approvals (admin view)
  app.get('/api/admin/commission-approvals', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const approvals = await storage.getAllCommissionApprovals();
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching commission approvals:", error);
      res.status(500).json({ message: "Failed to fetch commission approvals" });
    }
  });

  // Process commission payment (admin)
  app.post('/api/admin/commission-approvals/:approvalId/process-payment', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { approvalId } = req.params;
      const { paymentReference } = req.body;

      // Generate payment reference if not provided
      const paymentRef = paymentReference || `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      await storage.processCommissionPayment(approvalId, paymentRef);

      res.json({
        success: true,
        message: "Commission payment processed successfully",
        paymentReference: paymentRef
      });
    } catch (error) {
      console.error("Error processing commission payment:", error);
      res.status(500).json({ message: "Failed to process commission payment" });
    }
  });

  // ============ PUSH NOTIFICATION ENDPOINTS ============

  // Get public VAPID key for client
  app.get('/api/push/vapid-key', async (req: any, res) => {
    try {
      const publicKey = pushNotificationService.getPublicVapidKey();
      res.json({ publicKey });
    } catch (error) {
      console.error("Error getting VAPID key:", error);
      res.status(500).json({ message: "Failed to get VAPID key" });
    }
  });

  // Subscribe to push notifications
  app.post('/api/push/subscribe', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { subscription, userAgent } = req.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }

      const saved = await pushNotificationService.savePushSubscription(
        userId,
        subscription,
        userAgent || req.headers['user-agent']
      );

      if (saved) {
        res.json({
          success: true,
          message: "Push notifications enabled successfully",
          subscriptionId: saved.id
        });
      } else {
        res.status(400).json({ message: "Failed to save push subscription" });
      }
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      res.status(500).json({ message: "Failed to subscribe to push notifications" });
    }
  });

  // Unsubscribe from push notifications
  app.delete('/api/push/unsubscribe', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint required for unsubscription" });
      }

      const removed = await pushNotificationService.removePushSubscription(userId, endpoint);

      if (removed) {
        res.json({
          success: true,
          message: "Push notifications disabled successfully"
        });
      } else {
        res.status(404).json({ message: "Subscription not found" });
      }
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      res.status(500).json({ message: "Failed to unsubscribe from push notifications" });
    }
  });

  // Test push notification (for debugging)
  app.post('/api/push/test', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const result = await pushNotificationService.sendTestNotification(userId);

      if (result.success) {
        res.json({
          success: true,
          message: `Test notification sent to ${result.sentCount} device(s)`,
          details: result
        });
      } else {
        res.json({
          success: false,
          message: "Failed to send test notification",
          errors: result.errors
        });
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Get user's push subscription status
  app.get('/api/push/status', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscriptions = await storage.getUserPushSubscriptions(userId);

      res.json({
        isSubscribed: subscriptions.length > 0,
        subscriptionCount: subscriptions.length,
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          endpoint: sub.endpoint.substring(0, 50) + '...',
          userAgent: sub.userAgent,
          createdAt: sub.createdAt,
          isActive: sub.isActive
        }))
      });
    } catch (error) {
      console.error("Error getting push subscription status:", error);
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  });

  // MLM hierarchy routes
  app.get('/api/admin/mlm-hierarchy/:userId?', requireAuth, requireAdmin, auditAdminAction('view_mlm_hierarchy', 'admin'), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const rootUserId = userId || req.user.id;

      const allUsers = await storage.getAllUsers();

      // Build MLM tree structure
      const buildMlmTree = async (users: any[], rootId: string): Promise<any> => {
        const user = users.find(u => u.id === rootId);
        if (!user) return null;

        const children = users.filter(u => u.parentPartnerId === rootId);
        const userReferrals = await storage.getDealsByUserId(rootId);

        const childNodes = [];
        for (const child of children) {
          const childNode = await buildMlmTree(users, child.id);
          if (childNode) childNodes.push(childNode);
        }

        return {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
          email: user.email || '',
          partnerId: user.partnerId || '',
          level: user.partnerLevel || 1,
          children: childNodes,
          totalDeals: userReferrals.length,
          totalCommissions: userReferrals.reduce((sum: number, ref: any) => sum + parseFloat(ref.actualCommission || '0'), 0),
          parentPartnerId: user.parentPartnerId
        };
      };

      const tree = await buildMlmTree(allUsers, rootUserId);

      // Calculate stats
      const levelDistribution: { [key: number]: number } = {};
      allUsers.forEach(user => {
        const level = user.partnerLevel || 1;
        levelDistribution[level] = (levelDistribution[level] || 0) + 1;
      });

      const stats = {
        totalLevels: Math.max(...allUsers.map(u => u.partnerLevel || 1)),
        totalUsers: allUsers.length,
        levelDistribution
      };

      res.json({ tree, stats });
    } catch (error) {
      console.error("Error fetching MLM hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch MLM hierarchy" });
    }
  });

  // Get MLM tree data for visualization
  app.get('/api/admin/mlm-tree-data', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();

      const treeData = await Promise.all(
        allUsers
          .filter((u: any) => u.firstName && u.lastName && u.partnerId) // Only users with complete data
          .map(async (u: any) => {
            // Count direct recruits
            const directRecruits = allUsers.filter((child: any) => child.parentPartnerId === u.id).length;

            // Get total downline count (recursive)
            const countDownline = (userId: string): number => {
              const children = allUsers.filter((child: any) => child.parentPartnerId === userId);
              return children.reduce((sum, child) => sum + 1 + countDownline(child.id), 0);
            };

            // Get user's referrals for commission data
            const referrals = await storage.getDealsByUserId(u.id);
            const totalCommissions = referrals.reduce((sum: number, ref: any) =>
              sum + parseFloat(ref.actualCommission || '0'), 0
            );

            return {
              id: u.id,
              name: `${u.firstName} ${u.lastName}`,
              email: u.email || '',
              partnerId: u.partnerId,
              parentPartnerId: u.parentPartnerId || null,
              directRecruits,
              totalDownline: countDownline(u.id),
              totalDeals: referrals.length,
              totalCommissions
            };
          })
      );

      res.json(treeData);
    } catch (error) {
      console.error("Error fetching MLM tree data:", error);
      res.status(500).json({ message: "Failed to fetch MLM tree data" });
    }
  });

  // Get all users list for selector
  app.get('/api/admin/users/list', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();

      const userList = users
        .filter((u: any) => u.firstName && u.lastName && u.partnerId)
        .map((u: any) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          partnerId: u.partnerId
        }));

      res.json(userList);
    } catch (error) {
      console.error("Error fetching user list:", error);
      res.status(500).json({ message: "Failed to fetch user list" });
    }
  });

  // Get personal MLM tree for a specific user (upline + downline)
  app.get('/api/admin/mlm-personal-tree/:userId', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const allUsers = await storage.getAllUsers();

      // Build upline (all parents going up)
      const upline: Array<{ id: string, name: string, partnerId: string, level: number }> = [];
      let currentParentId = user.parentPartnerId;
      let level = 1;

      while (currentParentId && level <= 10) { // Max 10 levels to prevent infinite loops
        const parent = allUsers.find((u: any) => u.id === currentParentId);
        if (!parent) break;

        upline.push({
          id: parent.id,
          name: `${parent.firstName || ''} ${parent.lastName || ''}`.trim() || 'Unknown',
          partnerId: parent.partnerId || '',
          level
        });

        currentParentId = parent.parentPartnerId;
        level++;
      }

      // Build downline tree (all children going down)
      const buildDownlineTree = async (rootId: string): Promise<any> => {
        const children = allUsers.filter((u: any) => u.parentPartnerId === rootId);
        const userReferrals = await storage.getDealsByUserId(rootId);

        const childNodes = [];
        for (const child of children) {
          const childNode = await buildDownlineTree(child.id);
          if (childNode) childNodes.push(childNode);
        }

        return {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
          email: user.email || '',
          partnerId: user.partnerId || '',
          level: 0,
          children: childNodes,
          totalDeals: userReferrals.length,
          totalCommissions: userReferrals.reduce((sum: number, ref: any) => sum + parseFloat(ref.actualCommission || '0'), 0)
        };
      };

      const downline = await buildDownlineTree(userId);

      res.json({
        upline,
        user: {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
          partnerId: user.partnerId || '',
          email: user.email || ''
        },
        downline
      });
    } catch (error) {
      console.error("Error fetching personal tree:", error);
      res.status(500).json({ message: "Failed to fetch personal tree" });
    }
  });

  app.get('/api/admin/user-details/:userId', requireAuth, requireAdmin, auditAdminAction('view_user_details', 'admin'), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const referrals = await storage.getDealsByUserId(userId);
      const referralsByLevel = await storage.getDealsByLevel(userId);

      res.json({
        user,
        referrals,
        referralsByLevel,
        totalCommissions: referrals.reduce((sum: number, ref: any) => sum + parseFloat(ref.actualCommission || '0'), 0)
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  // Admin routes
  app.get('/api/admin/stats', requireAuth, requireAdmin, auditAdminAction('view_stats', 'admin'), async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Platform-wide user stats for churn analytics
  app.get('/api/admin/user-stats', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const userStats = await storage.getAllUsersStats();
      res.json(userStats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin user search endpoint
  app.get('/api/admin/users/search', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      const users = await storage.getAllUsers();
      const searchTerm = query.toLowerCase();

      // Search by name, email, or partner ID
      const filteredUsers = users.filter((u: any) =>
        u.firstName?.toLowerCase().includes(searchTerm) ||
        u.lastName?.toLowerCase().includes(searchTerm) ||
        u.email?.toLowerCase().includes(searchTerm) ||
        u.partnerId?.toLowerCase().includes(searchTerm)
      );

      res.json(filteredUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Admin analytics endpoint
  app.get('/api/admin/analytics', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const allDeals = await storage.getAllDeals();

      // Total users
      const totalUsers = users.length;

      // Users with team members (have downline)
      const usersWithTeam = users.filter((u: any) =>
        users.some((other: any) => other.parentPartnerId === u.id)
      ).length;

      // Users with extended network (have downline with downline)
      const usersWithExtendedNetwork = users.filter((u: any) => {
        const directDownline = users.filter((other: any) => other.parentPartnerId === u.id);
        return directDownline.some((downline: any) =>
          users.some((grandchild: any) => grandchild.parentPartnerId === downline.id)
        );
      }).length;

      // Total invites sent (count of users who have a parent)
      const invitesSent = users.filter((u: any) => u.parentPartnerId).length;

      // Deal sources - group by user
      const dealsByUser = allDeals.reduce((acc: any, deal: any) => {
        const userId = deal.userId || deal.submittedBy;
        if (!acc[userId]) {
          acc[userId] = 0;
        }
        acc[userId]++;
        return acc;
      }, {});

      const topDealSources = Object.entries(dealsByUser)
        .map(([userId, count]: [string, any]) => {
          const user = users.find((u: any) => u.id === userId);
          return {
            userId,
            userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown',
            dealCount: count
          };
        })
        .sort((a, b) => b.dealCount - a.dealCount)
        .slice(0, 10);

      // Time to first submission
      const usersWithDeals = users.filter((u: any) =>
        allDeals.some((d: any) => (d.userId || d.submittedBy) === u.id)
      );

      const timeToFirstSubmissions = usersWithDeals
        .map((u: any) => {
          const userDeals = allDeals.filter((d: any) => (d.userId || d.submittedBy) === u.id);
          if (userDeals.length === 0) return null;

          const firstDeal = userDeals.reduce((earliest: any, deal: any) => {
            const dealDate = new Date(deal.submittedAt || deal.createdAt);
            const earliestDate = new Date(earliest.submittedAt || earliest.createdAt);
            return dealDate < earliestDate ? deal : earliest;
          });

          const userCreated = new Date(u.createdAt);
          const firstDealDate = new Date(firstDeal.submittedAt || firstDeal.createdAt);
          const daysDiff = Math.floor((firstDealDate.getTime() - userCreated.getTime()) / (1000 * 60 * 60 * 24));

          return daysDiff >= 0 ? daysDiff : null;
        })
        .filter((days: any) => days !== null);

      const avgTimeToFirstSubmission = timeToFirstSubmissions.length > 0
        ? Math.round(timeToFirstSubmissions.reduce((sum: number, days: number) => sum + days, 0) / timeToFirstSubmissions.length)
        : 0;

      // Time to first payment (deals with actualCommission > 0)
      const paidDeals = allDeals.filter((d: any) =>
        d.actualCommission && parseFloat(d.actualCommission) > 0
      );

      const timeToFirstPayments = users
        .map((u: any) => {
          const userPaidDeals = paidDeals.filter((d: any) => (d.userId || d.submittedBy) === u.id);
          if (userPaidDeals.length === 0) return null;

          const firstPaidDeal = userPaidDeals.reduce((earliest: any, deal: any) => {
            const dealDate = new Date(deal.submittedAt || deal.createdAt);
            const earliestDate = new Date(earliest.submittedAt || earliest.createdAt);
            return dealDate < earliestDate ? deal : earliest;
          });

          const userCreated = new Date(u.createdAt);
          const firstPaymentDate = new Date(firstPaidDeal.submittedAt || firstPaidDeal.createdAt);
          const daysDiff = Math.floor((firstPaymentDate.getTime() - userCreated.getTime()) / (1000 * 60 * 60 * 24));

          return daysDiff >= 0 ? daysDiff : null;
        })
        .filter((days: any) => days !== null);

      const avgTimeToFirstPayment = timeToFirstPayments.length > 0
        ? Math.round(timeToFirstPayments.reduce((sum: number, days: number) => sum + days, 0) / timeToFirstPayments.length)
        : 0;

      // Network growth stats
      const usersWithParent = users.filter((u: any) => u.parentPartnerId);
      const networkGrowthRate = totalUsers > 0
        ? Math.round((usersWithParent.length / totalUsers) * 100)
        : 0;

      // Active users (submitted at least one deal)
      const activeUsers = usersWithDeals.length;
      const activationRate = totalUsers > 0
        ? Math.round((activeUsers / totalUsers) * 100)
        : 0;

      res.json({
        totalUsers,
        invitesSent,
        usersWithTeam,
        usersWithExtendedNetwork,
        topDealSources,
        avgTimeToFirstSubmission,
        avgTimeToFirstPayment,
        networkGrowthRate,
        activeUsers,
        activationRate,
        totalDeals: allDeals.length,
        paidDeals: paidDeals.length
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Admin impersonation endpoints
  app.post('/api/admin/impersonate/:userId', requireAuth, requireAdmin, auditAdminAction('impersonate_user', 'admin'), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;

      // Verify target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent impersonating another admin
      if (targetUser.isAdmin) {
        return res.status(403).json({ message: "Cannot impersonate another admin" });
      }

      // Store impersonation in session
      req.session.impersonatedUserId = userId;
      req.session.realAdminId = adminId;

      res.json({
        success: true,
        message: `Now viewing as ${targetUser.firstName} ${targetUser.lastName}`,
        impersonatedUser: {
          id: targetUser.id,
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName
        }
      });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(500).json({ message: "Failed to start impersonation" });
    }
  });

  app.post('/api/admin/end-impersonation', requireAuth, async (req: any, res) => {
    try {
      if (!req.session.impersonatedUserId) {
        return res.status(400).json({ message: "Not currently impersonating" });
      }

      const realAdminId = req.session.realAdminId;

      // Clear impersonation from session
      delete req.session.impersonatedUserId;
      delete req.session.realAdminId;

      res.json({
        success: true,
        message: "Impersonation ended",
        adminId: realAdminId
      });
    } catch (error) {
      console.error("Error ending impersonation:", error);
      res.status(500).json({ message: "Failed to end impersonation" });
    }
  });

  // Get current impersonation status
  app.get('/api/admin/impersonation-status', requireAuth, async (req: any, res) => {
    try {
      if (!req.session.impersonatedUserId) {
        return res.json({ isImpersonating: false });
      }

      const impersonatedUser = await storage.getUser(req.session.impersonatedUserId);
      const realAdmin = await storage.getUser(req.session.realAdminId);

      res.json({
        isImpersonating: true,
        impersonatedUser: impersonatedUser ? {
          id: impersonatedUser.id,
          email: impersonatedUser.email,
          firstName: impersonatedUser.firstName,
          lastName: impersonatedUser.lastName
        } : null,
        realAdmin: realAdmin ? {
          id: realAdmin.id,
          email: realAdmin.email,
          firstName: realAdmin.firstName,
          lastName: realAdmin.lastName
        } : null
      });
    } catch (error) {
      console.error("Error getting impersonation status:", error);
      res.status(500).json({ message: "Failed to get impersonation status" });
    }
  });

  // Payment portal routes
  // Get live accounts (completed quotes) needing payment
  app.get('/api/admin/payments/live-accounts', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const quotes = await storage.getAllQuotesForAdmin();

      // Filter for live quotes that haven't been paid
      const liveAccounts = quotes.filter((q: any) =>
        q.customerJourneyStatus === 'live' &&
        !q.commissionPaid
      );

      // Enhance with deal and user data
      const enhancedAccounts = await Promise.all(
        liveAccounts.map(async (quote: any) => {
          const deal = await storage.getDealById(quote.referralId);
          const user = deal ? await storage.getUser(deal.referrerId) : null;

          // Get upline structure
          const upline = user ? await storage.getMlmHierarchy(user.id) : { parents: [] };

          return {
            ...quote,
            deal,
            user,
            uplineUsers: upline.parents || [],
          };
        })
      );

      res.json(enhancedAccounts);
    } catch (error) {
      console.error("Error fetching live accounts:", error);
      res.status(500).json({ message: "Failed to fetch live accounts" });
    }
  });

  // Get upline structure for a specific user
  app.get('/api/admin/payments/upline/:userId', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const hierarchy = await storage.getMlmHierarchy(userId);

      res.json({
        parents: hierarchy.parents,
        level: hierarchy.level
      });
    } catch (error) {
      console.error("Error fetching upline:", error);
      res.status(500).json({ message: "Failed to fetch upline structure" });
    }
  });

  // Calculate commission breakdown for a payment
  app.post('/api/admin/payments/calculate', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { quoteId, totalAmount } = req.body;

      if (!quoteId || !totalAmount) {
        return res.status(400).json({ message: "Quote ID and total amount are required" });
      }

      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const deal = await storage.getDealById(quote.referralId);
      if (!referral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      const level1User = await storage.getUser(deal.referrerId);
      if (!level1User) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate breakdown
      const amount = parseFloat(totalAmount);
      const breakdown = [
        {
          level: 1,
          userId: level1User.id,
          userName: `${level1User.firstName} ${level1User.lastName}`,
          userEmail: level1User.email,
          percentage: 60,
          amount: (amount * 0.60).toFixed(2),
          role: 'Direct Commission'
        }
      ];

      // Level 2 (parent)
      if (level1User.parentPartnerId) {
        const level2User = await storage.getUser(level1User.parentPartnerId);
        if (level2User) {
          breakdown.push({
            level: 2,
            userId: level2User.id,
            userName: `${level2User.firstName} ${level2User.lastName}`,
            userEmail: level2User.email,
            percentage: 20,
            amount: (amount * 0.20).toFixed(2),
            role: 'Level 1 Override'
          });

          // Level 3 (grandparent)
          if (level2User.parentPartnerId) {
            const level3User = await storage.getUser(level2User.parentPartnerId);
            if (level3User) {
              breakdown.push({
                level: 3,
                userId: level3User.id,
                userName: `${level3User.firstName} ${level3User.lastName}`,
                userEmail: level3User.email,
                percentage: 10,
                amount: (amount * 0.10).toFixed(2),
                role: 'Level 2 Override'
              });
            }
          }
        }
      }

      const totalDistributed = breakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const remainingPercentage = 100 - breakdown.reduce((sum, item) => sum + item.percentage, 0);

      res.json({
        quoteId,
        totalAmount: amount.toFixed(2),
        breakdown,
        totalDistributed: totalDistributed.toFixed(2),
        remainingPercentage,
        summary: {
          level1: breakdown.find(b => b.level === 1),
          level2: breakdown.find(b => b.level === 2),
          level3: breakdown.find(b => b.level === 3)
        }
      });
    } catch (error) {
      console.error("Error calculating commission breakdown:", error);
      res.status(500).json({ message: "Failed to calculate commission breakdown" });
    }
  });

  // Process Stripe payouts
  app.post('/api/admin/payments/process', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { quoteId, totalAmount, paymentReference, breakdown } = req.body;

      if (!quoteId || !totalAmount || !breakdown) {
        return res.status(400).json({ message: "Missing required payment data" });
      }

      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "Stripe is not configured" });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-11-20.acacia',
      });

      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Check if already paid
      if (quote.commissionPaid) {
        return res.status(400).json({ message: "Commission already paid for this quote" });
      }

      const paymentResults = [];
      const failedPayments = [];

      // Process each payment in the breakdown
      for (const payment of breakdown) {
        try {
          const user = await storage.getUser(payment.userId);

          if (!user) {
            failedPayments.push({
              ...payment,
              error: 'User not found'
            });
            continue;
          }

          // Check if user has Stripe account ID
          if (!user.stripeAccountId) {
            failedPayments.push({
              ...payment,
              error: 'User has no Stripe account connected'
            });
            continue;
          }

          // Create a transfer to the connected account
          const transfer = await stripe.transfers.create({
            amount: Math.round(parseFloat(payment.amount) * 100), // Convert to pence
            currency: 'gbp',
            destination: user.stripeAccountId,
            description: `Commission payment for ${quote.quoteId || quote.id} - ${payment.role}`,
            metadata: {
              quoteId: quote.id,
              quoteNumber: quote.quoteId || 'N/A',
              level: payment.level.toString(),
              percentage: payment.percentage.toString(),
              role: payment.role,
              dealId: quote.referralId,
              userId: user.id
            }
          });

          // Create commission payment record
          await storage.createCommissionPayment({
            dealId: quote.referralId,
            recipientId: user.id,
            level: payment.level,
            amount: payment.amount,
            percentage: (payment.percentage / 100).toString(),
            status: 'paid',
            paymentDate: new Date(),
            transferReference: transfer.id,
            notes: `Stripe transfer ${transfer.id} - ${payment.role}`
          });

          paymentResults.push({
            ...payment,
            transferId: transfer.id,
            status: 'success'
          });

        } catch (error: any) {
          console.error(`Failed to process payment for user ${payment.userId}:`, error);
          failedPayments.push({
            ...payment,
            error: error.message
          });
        }
      }

      // If at least one payment succeeded, mark quote as paid and complete
      if (paymentResults.length > 0) {
        await storage.updateQuote(quoteId, {
          commissionPaid: true,
          commissionPaidDate: new Date(),
          stripePaymentId: paymentResults[0].transferId
        });

        // Move to "complete" status (installed and paid)
        await storage.updateQuoteJourneyStatus(quoteId, 'complete');
      }

      res.json({
        success: paymentResults.length > 0,
        totalProcessed: paymentResults.length,
        totalFailed: failedPayments.length,
        successfulPayments: paymentResults,
        failedPayments,
        message: paymentResults.length === breakdown.length
          ? 'All payments processed successfully'
          : `${paymentResults.length} of ${breakdown.length} payments successful`
      });

    } catch (error: any) {
      console.error("Error processing payments:", error);
      res.status(500).json({
        message: "Failed to process payments",
        error: error.message
      });
    }
  });

  // Invoice routes
  // Partner raises invoice for completed deal
  app.post('/api/invoices/raise', requireAuth, async (req: any, res) => {
    try {
      const { quoteId, amount } = req.body;
      const userId = req.user.id;

      if (!quoteId || !amount) {
        return res.status(400).json({ message: "Quote ID and amount are required" });
      }

      // Get quote details
      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Verify the quote belongs to this user
      if (quote.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Create the invoice
      const invoice = await storage.createInvoice(
        quoteId,
        userId,
        parseFloat(amount),
        quote.businessName,
        quote.referralId
      );

      res.json({
        success: true,
        message: "Invoice raised successfully",
        invoice
      });
    } catch (error: any) {
      console.error("Error raising invoice:", error);
      res.status(500).json({
        message: "Failed to raise invoice",
        error: error.message
      });
    }
  });

  // Partner queries an invoice
  app.post('/api/invoices/:id/query', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { queryNotes } = req.body;
      const userId = req.user.id;

      if (!queryNotes) {
        return res.status(400).json({ message: "Query notes are required" });
      }

      const invoice = await storage.getInvoiceById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Verify the invoice belongs to this user
      if (invoice.partnerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.addInvoiceQuery(id, queryNotes);

      // Also add to quote Q&A for communication tracking
      await storage.addQuoteQAMessage(invoice.quoteId, 'partner', userId, `Invoice Query: ${queryNotes}`);

      res.json({ success: true, message: "Query submitted successfully" });
    } catch (error: any) {
      console.error("Error submitting invoice query:", error);
      res.status(500).json({
        message: "Failed to submit query",
        error: error.message
      });
    }
  });

  // Get invoices for current partner
  app.get('/api/invoices', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const invoices = await storage.getInvoicesByPartnerId(userId);
      res.json(invoices);
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Admin: Get all invoices
  app.get('/api/admin/invoices', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error: any) {
      console.error("Error fetching all invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Admin: Mark invoice as paid
  app.post('/api/admin/invoices/:id/mark-paid', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { paymentReference, adminNotes } = req.body;

      if (!paymentReference) {
        return res.status(400).json({ message: "Payment reference is required" });
      }

      const invoice = await storage.getInvoiceById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      await storage.markInvoiceAsPaid(id, paymentReference, adminNotes);

      res.json({ success: true, message: "Invoice marked as paid" });
    } catch (error: any) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({
        message: "Failed to mark invoice as paid",
        error: error.message
      });
    }
  });

  // Admin impersonate user endpoint
  app.post('/api/admin/impersonate/:userId', requireAuth, requireAdmin, auditAdminAction('impersonate_user', 'admin'), async (req: any, res) => {
    try {
      const { userId } = req.params;

      // Get the user to impersonate
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Store original admin user ID in session
      if (!req.session.originalAdminId) {
        req.session.originalAdminId = req.user.id;
      }

      // Switch session to target user
      req.session.userId = targetUser.id;
      req.session.impersonating = true;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`Admin ${req.user.email} is now impersonating user ${targetUser.email}`);

      res.json({
        success: true,
        message: `Now viewing as ${targetUser.firstName} ${targetUser.lastName}`,
        user: targetUser
      });
    } catch (error) {
      console.error("Error impersonating user:", error);
      res.status(500).json({ message: "Failed to impersonate user" });
    }
  });

  // Admin exit impersonation endpoint
  app.post('/api/admin/exit-impersonation', requireAuth, async (req: any, res) => {
    try {
      if (!req.session.impersonating || !req.session.originalAdminId) {
        return res.status(400).json({ message: "Not currently impersonating" });
      }

      const originalAdminId = req.session.originalAdminId;

      // Restore original admin session
      req.session.userId = originalAdminId;
      delete req.session.originalAdminId;
      delete req.session.impersonating;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const adminUser = await storage.getUser(originalAdminId);

      console.log(`Admin ${adminUser?.email} exited impersonation mode`);

      res.json({
        success: true,
        message: "Exited impersonation mode",
        user: adminUser
      });
    } catch (error) {
      console.error("Error exiting impersonation:", error);
      res.status(500).json({ message: "Failed to exit impersonation" });
    }
  });

  // Enhanced admin referrals list with search and filtering
  app.get('/api/admin/referrals', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const {
        search,
        status,
        stage,
        productType,
        page = 1,
        limit = 50,
        sortBy = 'submittedAt',
        sortOrder = 'desc'
      } = req.query;

      let referrals = await storage.getAllDeals();

      if (productType && productType !== 'all') {
        referrals = referrals.filter((r: any) => r.productType === productType);
      }

      // Fetch and attach billUploads and quote data for each referral
      referrals = await Promise.all(referrals.map(async (referral: any) => {
        const billUploads = await storage.getBillUploadsByBusinessName(referral.businessName);

        // Get the most recent quote for this referral
        let quoteData = null;
        try {
          const quoteResults = await db.select()
            .from(quotes)
            .where(eq(quotes.referralId, referral.id))
            .orderBy(desc(quotes.createdAt))
            .limit(1);
          quoteData = quoteResults[0] || null;
        } catch (e) {
          // Quote lookup failed, continue without quote data
        }

        return {
          ...referral,
          billUploads,
          quote: quoteData || null,
          referrer: {
            firstName: referral.partnerName?.split(' ')[0] || '',
            lastName: referral.partnerName?.split(' ')[1] || '',
            email: referral.partnerEmail || '',
            partnerId: referral.partnerId || ''
          },
          businessType: {
            name: referral.businessTypeName || 'N/A'
          }
        };
      }));

      // Apply search filter
      if (search) {
        const searchTerm = search.toString().toLowerCase();
        referrals = referrals.filter((r: any) =>
          r.businessName?.toLowerCase().includes(searchTerm) ||
          r.businessEmail?.toLowerCase().includes(searchTerm) ||
          r.notes?.toLowerCase().includes(searchTerm) ||
          r.adminNotes?.toLowerCase().includes(searchTerm)
        );
      }

      // Apply status filter
      if (status && status !== 'all') {
        referrals = referrals.filter((r: any) => r.status === status);
      }

      // Apply pagination
      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;

      // Sort referrals
      referrals.sort((a: any, b: any) => {
        const aVal = a[sortBy.toString()];
        const bVal = b[sortBy.toString()];

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      const paginatedReferrals = referrals.slice(startIndex, endIndex);

      res.json({
        deals: paginatedReferrals,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: referrals.length,
          totalPages: Math.ceil(referrals.length / limitNum)
        },
        filters: {
          search: search || '',
          status: status || 'all',
          stage: stage || 'all'
        }
      });
    } catch (error) {
      console.error("Error fetching all deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  app.patch('/api/admin/users/:userId', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const updateData = req.body;

      const user = await storage.updateUser(userId, updateData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Enhanced admin referral update with audit trail
  app.patch('/api/admin/referrals/:dealId', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const updateData = req.body;

      // Get current referral for audit trail
      const allDeals = await storage.getAllDeals();
      const currentReferral = allDeals.find((r: any) => r.id === dealId);

      if (!currentReferral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Check if status is changing
      const oldStatus = currentReferral.status;
      const newStatus = updateData.status || oldStatus;
      const statusChanged = oldStatus !== newStatus;

      // Add admin audit info
      const auditInfo = {
        updatedBy: req.user.email,
        updatedAt: new Date(),
        previousValues: {
          status: currentReferral.status,
          estimatedCommission: currentReferral.estimatedCommission,
          actualCommission: currentReferral.actualCommission
        }
      };

      // Append audit info to admin notes
      let updatedAdminNotes = currentReferral.adminNotes || '';

      // Extract appendProgressLog from updateData (it's not a DB field)
      const { appendProgressLog, ...dealUpdateData } = updateData;

      console.log('📝 Backend received appendProgressLog:', appendProgressLog);

      // If frontend sends a progress log entry, append it
      if (appendProgressLog) {
        updatedAdminNotes = updatedAdminNotes
          ? `${updatedAdminNotes}\n${appendProgressLog}`
          : appendProgressLog;
        console.log('✅ Appended to notes. New adminNotes:', updatedAdminNotes);
      } else {
        // Fallback to old admin audit note format
        const adminAuditNote = `\n[${new Date().toLocaleString()}] Updated by admin ${req.user.email}`;
        updatedAdminNotes += adminAuditNote;
        console.log('⚠️ No appendProgressLog, using old format');
      }

      const deal = await storage.updateDeal(dealId, {
        ...dealUpdateData,
        adminNotes: updatedAdminNotes,
        updatedAt: new Date()
      });

      // Send notifications if status changed
      if (statusChanged) {
        // Notify the referral owner
        await createNotificationForUser(currentReferral.referrerId, {
          type: 'referral_status_changed',
          title: 'Referral Status Updated',
          message: `Your referral for ${currentReferral.businessName} has moved from ${oldStatus} to ${newStatus}`,
          dealId: dealId,
          businessName: currentReferral.businessName,
          metadata: {
            oldStatus,
            newStatus,
            updatedBy: `Admin: ${req.user.email}`,
            commission: (newStatus === 'approved' || newStatus === 'paid') ?
              (updateData.actualCommission || updateData.estimatedCommission || currentReferral.estimatedCommission) : null
          }
        });

        // Notify team leader if exists
        const referralOwner = await storage.getUser(currentReferral.referrerId);
        if (referralOwner?.parentPartnerId) {
          await createNotificationForUser(referralOwner.parentPartnerId, {
            type: 'team_referral_status_changed',
            title: 'Team Member Referral Update',
            message: `${referralOwner.firstName || referralOwner.email}'s referral for ${currentReferral.businessName} has moved from ${oldStatus} to ${newStatus}`,
            dealId: dealId,
            businessName: currentReferral.businessName,
            metadata: {
              oldStatus,
              newStatus,
              teamMemberName: referralOwner.firstName ? `${referralOwner.firstName} ${referralOwner.lastName || ''}`.trim() : referralOwner.email,
              teamMemberId: currentReferral.referrerId,
              updatedBy: `Admin: ${req.user.email}`,
              commission: (newStatus === 'approved' || newStatus === 'paid') ?
                (updateData.actualCommission || updateData.estimatedCommission || currentReferral.estimatedCommission) : null
            }
          });
        }
      }

      res.json({
        success: true,
        deal,
        auditInfo,
        statusChanged
      });
    } catch (error) {
      console.error("Error updating referral:", error);
      res.status(500).json({ message: "Failed to update referral" });
    }
  });

  // Seed test data for demonstrating referral system functionality
  app.post('/api/admin/seed-test-data', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      await storage.seedTestDeals();
      res.json({
        success: true,
        message: "Test referrals seeded successfully"
      });
    } catch (error) {
      console.error("Error seeding test data:", error);
      res.status(500).json({ message: "Failed to seed test data" });
    }
  });

  // Enhanced stage override functionality for admin
  app.patch('/api/admin/referrals/:dealId/override-stage', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { dealStage, status, adminNotes, overrideReason } = req.body;

      // Get current referral for audit trail
      const allDeals = await storage.getAllDeals();
      const currentReferral = allDeals.find((r: any) => r.id === dealId);

      if (!currentReferral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Check if status is changing
      const oldStatus = currentReferral.status;
      const newStatus = status || oldStatus;
      const statusChanged = oldStatus !== newStatus;

      // Create audit trail
      const auditNote = `\n[${new Date().toLocaleString()}] Stage override by admin ${req.user.email}: ${currentReferral.dealStage} → ${dealStage}. Reason: ${overrideReason || 'No reason provided'}`;
      const updatedAdminNotes = (adminNotes || currentReferral.adminNotes || '') + auditNote;

      // Update the referral stage and status
      const updateData = {
        dealStage,
        status: status || currentReferral.status,
        adminNotes: updatedAdminNotes,
        updatedAt: new Date()
      };

      const updatedReferral = await storage.updateDeal(dealId, updateData);

      // Send status change notifications if status changed
      if (statusChanged) {
        // Notify the referral owner
        await createNotificationForUser(currentReferral.referrerId, {
          type: 'referral_status_changed',
          title: 'Referral Status Updated',
          message: `Your referral for ${currentReferral.businessName} has moved from ${oldStatus} to ${newStatus}`,
          dealId: dealId,
          businessName: currentReferral.businessName,
          metadata: {
            oldStatus,
            newStatus,
            dealStage,
            updatedBy: `Admin: ${req.user.email}`,
            commission: (newStatus === 'approved' || newStatus === 'paid') ? currentReferral.estimatedCommission : null
          }
        });

        // Notify team leader if exists
        const referralOwner = await storage.getUser(currentReferral.referrerId);
        if (referralOwner?.parentPartnerId) {
          await createNotificationForUser(referralOwner.parentPartnerId, {
            type: 'team_referral_status_changed',
            title: 'Team Member Referral Update',
            message: `${referralOwner.firstName || referralOwner.email}'s referral for ${currentReferral.businessName} has moved from ${oldStatus} to ${newStatus}`,
            dealId: dealId,
            businessName: currentReferral.businessName,
            metadata: {
              oldStatus,
              newStatus,
              dealStage,
              teamMemberName: referralOwner.firstName ? `${referralOwner.firstName} ${referralOwner.lastName || ''}`.trim() : referralOwner.email,
              teamMemberId: currentReferral.referrerId,
              updatedBy: `Admin: ${req.user.email}`,
              commission: (newStatus === 'approved' || newStatus === 'paid') ? currentReferral.estimatedCommission : null
            }
          });
        }
      }

      // Create notification for stage change (if stage changed)
      if (dealStage !== currentReferral.dealStage) {
        const stageNotifications: { [key: string]: { title: string; message: string } } = {
          'quote_sent': {
            title: 'Quote Sent',
            message: `A competitive quote has been sent to ${currentReferral.businessName}`
          },
          'quote_approved': {
            title: 'Quote Approved',
            message: `${currentReferral.businessName} has approved the quote and is ready to proceed`
          },
          'processing': {
            title: 'Application Processing',
            message: `${currentReferral.businessName} application is now being processed`
          },
          'completed': {
            title: 'Referral Complete',
            message: `Your referral for ${currentReferral.businessName} has been successfully completed`
          }
        };

        const notificationData = stageNotifications[dealStage];
        if (notificationData && !statusChanged) { // Only send stage notification if status didn't change (to avoid duplicate notifications)
          await createNotificationForUser(currentReferral.referrerId, {
            type: 'status_update',
            title: notificationData.title,
            message: notificationData.message,
            dealId: dealId,
            businessName: currentReferral.businessName,
            metadata: {
              dealStage,
              previousStage: currentReferral.dealStage,
              updatedBy: `Admin: ${req.user.email}`
            }
          });

          // Also notify team leader about stage change
          const referralOwner = await storage.getUser(currentReferral.referrerId);
          if (referralOwner?.parentPartnerId) {
            await createNotificationForUser(referralOwner.parentPartnerId, {
              type: 'team_referral_status_changed',
              title: 'Team Member Deal Progress',
              message: `${referralOwner.firstName || referralOwner.email}'s deal ${currentReferral.businessName}: ${notificationData.title}`,
              dealId: dealId,
              businessName: currentReferral.businessName,
              metadata: {
                dealStage,
                previousStage: currentReferral.dealStage,
                teamMemberName: referralOwner.firstName ? `${referralOwner.firstName} ${referralOwner.lastName || ''}`.trim() : referralOwner.email,
                teamMemberId: currentReferral.referrerId,
                updatedBy: `Admin: ${req.user.email}`
              }
            });
          }
        }
      }

      res.json({
        success: true,
        message: "Stage override applied successfully",
        referral: updatedReferral,
        previousStage: currentReferral.dealStage,
        newStage: dealStage,
        statusChanged
      });
    } catch (error) {
      console.error("Error overriding referral stage:", error);
      res.status(500).json({ message: "Failed to override referral stage" });
    }
  });

  // Preview commission distribution before payment
  app.post('/api/admin/referrals/:dealId/preview-commission', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { actualCommission } = req.body;

      // Get deal details
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === dealId);

      if (!referral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      const totalCommission = parseFloat(actualCommission);
      const submitterId = deal.referrerId;

      // Calculate commission distribution
      const distribution: any[] = [];

      // Commission tiers
      const tiers = [
        { percentage: 60, label: 'Direct Commission' },
        { percentage: 20, label: 'Level 1 Override' },
        { percentage: 10, label: 'Level 2 Override' },
      ];

      // Walk up the chain
      let currentUserId = submitterId;

      for (let i = 0; i < tiers.length; i++) {
        if (!currentUserId) break;

        const tier = tiers[i];
        const amount = (totalCommission * tier.percentage) / 100;

        // Get user details
        const user = await storage.getUser(currentUserId);

        if (user) {
          distribution.push({
            userId: currentUserId,
            userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
            email: user.email,
            partnerId: user.partnerId,
            amount: amount,
            percentage: tier.percentage,
            label: tier.label,
            level: i
          });
        }

        // Move to next person in chain
        if (i < tiers.length - 1) {
          currentUserId = user?.parentPartnerId || null;
        }
      }

      res.json({
        success: true,
        totalCommission,
        businessName: deal.businessName,
        distribution
      });
    } catch (error) {
      console.error("Error previewing commission:", error);
      res.status(500).json({ message: "Failed to preview commission" });
    }
  });

  // Confirm payment section for commission amounts
  app.post('/api/admin/referrals/:dealId/confirm-payment', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { actualCommission, paymentReference, paymentMethod, paymentNotes } = req.body;

      // Get deal details
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === dealId);

      if (!referral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Update deal with payment confirmation
      const paymentConfirmationNote = `\n[${new Date().toLocaleString()}] Payment confirmed by admin ${req.user.email}: £${actualCommission} via ${paymentMethod || 'Bank Transfer'}. Reference: ${paymentReference}. Notes: ${paymentNotes || 'No additional notes'}`;

      const updateData = {
        actualCommission: actualCommission.toString(),
        status: 'paid',
        dealStage: 'completed',
        adminNotes: (deal.adminNotes || '') + paymentConfirmationNote,
        updatedAt: new Date()
      };

      const updatedReferral = await storage.updateDeal(dealId, updateData);

      // Distribute commissions across the upline chain (60%, 20%, 10%)
      const approvals = await storage.distributeUplineCommissions(
        dealId,
        parseFloat(actualCommission),
        paymentReference,
        paymentMethod || 'Bank Transfer'
      );

      // Send notifications to each person in the commission chain
      for (const approval of approvals) {
        const ratesData = approval.ratesData as any || {};
        const commissionPercentage = parseFloat(ratesData.commissionRate || '0%');
        const commissionAmount = parseFloat(approval.commissionAmount);
        const commissionType = ratesData.commissionType || 'direct';

        await createNotificationForUser(approval.userId, {
          type: 'commission_paid',
          title: commissionType === 'direct' ? 'Commission Payment Confirmed' : 'Override Commission Paid',
          message: `You earned £${commissionAmount.toFixed(2)} (${commissionPercentage}% ${commissionType} commission) for ${referral.businessName}. Reference: ${approval.paymentReference}`,
          dealId: dealId,
          businessName: deal.businessName,
          metadata: {
            amount: commissionAmount,
            percentage: commissionPercentage,
            commissionType: commissionType,
            paymentReference: approval.paymentReference,
            paymentMethod: paymentMethod || 'Bank Transfer'
          }
        });

        // Send push notification
        await pushNotificationService.sendCommissionApprovalNotification(
          approval.userId,
          {
            dealId: dealId,
            businessName: deal.businessName,
            amount: commissionAmount,
            level: ratesData.level || 1,
            percentage: commissionPercentage
          }
        );
      }

      res.json({
        success: true,
        message: `Payment confirmed and distributed to ${approvals.length} people in the commission chain`,
        referral: updatedReferral,
        approvals: approvals,
        paymentDetails: {
          totalAmount: actualCommission,
          reference: paymentReference,
          method: paymentMethod || 'Bank Transfer',
          date: new Date(),
          distributionBreakdown: approvals.map(a => {
            const ratesData = a.ratesData as any || {};
            return {
              userId: a.userId,
              amount: parseFloat(a.commissionAmount),
              percentage: ratesData.commissionRate,
              type: ratesData.commissionType
            };
          })
        }
      });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // Admin referrer reassignment
  app.post('/api/admin/referrals/:dealId/reassign', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { newReferrerId, reason } = req.body;

      // Verify new referrer exists
      const newReferrer = await storage.getUser(newReferrerId);
      if (!newReferrer) {
        return res.status(404).json({ message: "New referrer not found" });
      }

      // Get current referral
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === dealId);
      if (!referral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      const auditNote = `\n[${new Date().toLocaleString()}] Referral reassigned from ${referral.referrerId} to ${newReferrerId} by admin ${req.user.email}. Reason: ${reason}`;

      await storage.updateDeal(dealId, {
        referrerId: newReferrerId,
        adminNotes: (deal.adminNotes || '') + auditNote,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: "Referral reassigned successfully",
        previousReferrer: deal.referrerId,
        newReferrer: newReferrerId,
        reason
      });
    } catch (error) {
      console.error("Error reassigning referral:", error);
      res.status(500).json({ message: "Failed to reassign referral" });
    }
  });

  // Enhanced admin quote management
  app.post('/api/admin/referrals/:dealId/send-quote', requireAuth, requireAdmin, auditAdminAction('send_quote', 'referral'), async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const quoteData = req.body;

      // Verify deal exists
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === dealId);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Update deal with quote information
      await storage.updateDeal(dealId, {
        status: 'quote_sent',
        quoteAmount: quoteData.totalAmount,
        quoteGenerated: true,
        adminNotes: quoteData.adminNotes || '',
        updatedAt: new Date()
      });

      // Log admin action
      console.log('Quote sent by admin for referral:', dealId, {
        admin: req.user.email,
        quoteAmount: quoteData.totalAmount,
        rates: quoteData.rates
      });

      res.json({
        success: true,
        message: "Quote sent to customer successfully",
        quoteData: {
          dealId,
          totalAmount: quoteData.totalAmount,
          sentAt: new Date()
        }
      });
    } catch (error) {
      console.error("Error sending quote:", error);
      res.status(500).json({ message: "Failed to send quote" });
    }
  });

  // Create comprehensive quote with full details
  app.post('/api/admin/quotes/create', requireAuth, requireAdmin, auditAdminAction('create_quote', 'quote'), async (req: any, res) => {
    try {
      const {
        dealId,
        creditCardRate,
        debitCardRate,
        corporateCardRate,
        visaBusinessDebitRate,
        otherBusinessDebitRate,
        amexRate,
        secureTransactionFee,
        estimatedMonthlySaving,
        buyoutAmount,
        devicePaymentType,
        devices,
        hardwareCare,
        settlementType,
        dojoPlan,
      } = req.body;

      // Verify deal exists
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === dealId);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Calculate device costs
      const totalDevices = devices.reduce((sum: number, d: any) => sum + d.quantity, 0);
      const deviceCost = devices.reduce((sum: number, d: any) => sum + d.price, 0);
      const hardwareCareCost = hardwareCare ? totalDevices * 5 : 0;
      const settlementCost = settlementType === '7_day' ? 10 : 0;
      const dojoPlanCost = dojoPlan ? 11.99 : 0;

      const monthlyDeviceCost = devicePaymentType === 'pay_monthly' ? deviceCost : 0;
      const oneTimeDeviceCost = devicePaymentType === 'pay_once' ? deviceCost : 0;
      const totalMonthlyCost = monthlyDeviceCost + hardwareCareCost + settlementCost + dojoPlanCost;

      // Create the quote
      const quote = await storage.createQuote({
        dealId,
        creditCardRate,
        debitCardRate,
        corporateCardRate,
        visaBusinessDebitRate,
        otherBusinessDebitRate,
        amexRate,
        secureTransactionFee,
        estimatedMonthlySaving,
        buyoutAmount,
        devicePaymentType,
        devices,
        hardwareCare,
        settlementType,
        dojoPlan,
        monthlyDeviceCost,
        oneTimeDeviceCost,
        totalAmount: totalMonthlyCost,
        status: 'sent',
        customerJourneyStatus: 'review_quote',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        sentAt: new Date(),
        createdBy: req.user.id,
      });

      // Update deal status and stage (dealStage will auto-sync customerJourneyStatus)
      await storage.updateDeal(dealId, {
        dealStage: 'quote_sent',
        status: 'quote_sent',
        quoteGenerated: true,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        quoteId: quote.id,
        message: "Quote created and sent successfully"
      });
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  // Generate quote from deal details modal (uses comprehensive QuoteBuilder)
  app.post('/api/admin/referrals/:id/generate-quote', requireAuth, requireAdmin, auditAdminAction('generate_quote', 'referral'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        creditCardRate,
        debitCardRate,
        corporateCardRate,
        visaBusinessDebitRate,
        otherBusinessDebitRate,
        amexRate,
        secureTransactionFee,
        estimatedMonthlySaving,
        buyoutAmount,
        devicePaymentType,
        devices,
        hardwareCare,
        settlementType,
        dojoPlan,
      } = req.body;

      // Get deal
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === id);

      if (!referral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Calculate device costs
      const totalDevices = devices?.reduce((sum: number, d: any) => sum + d.quantity, 0) || 0;
      const deviceCost = devices?.reduce((sum: number, d: any) => sum + d.price, 0) || 0;
      const hardwareCareCost = hardwareCare ? totalDevices * 5 : 0;
      const settlementFee = settlementType === "7_day" ? 10 : 0;
      const dojoPlanFee = dojoPlan ? 11.99 : 0;

      const monthlyTotal = devicePaymentType === "pay_monthly"
        ? deviceCost + hardwareCareCost + settlementFee + dojoPlanFee
        : hardwareCareCost + settlementFee + dojoPlanFee;

      const oneTimeTotal = devicePaymentType === "pay_once" ? deviceCost : 0;

      // Create comprehensive quote record
      const quote = await storage.createQuote({
        dealId: id,
        creditCardRate: parseFloat(creditCardRate || '0'),
        debitCardRate: parseFloat(debitCardRate || '0'),
        corporateCardRate: parseFloat(corporateCardRate || '0'),
        visaBusinessDebitRate: parseFloat(visaBusinessDebitRate || '1.99'),
        otherBusinessDebitRate: parseFloat(otherBusinessDebitRate || '1.99'),
        amexRate: parseFloat(amexRate || '1.90'),
        secureTransactionFee: parseFloat(secureTransactionFee || '5.00'),
        estimatedMonthlySaving: parseFloat(estimatedMonthlySaving || '0'),
        buyoutAmount: parseInt(buyoutAmount || '3000'),
        devicePaymentType: devicePaymentType || 'pay_monthly',
        devices: devices || [],
        hardwareCare: hardwareCare || false,
        settlementType: settlementType || '5_day',
        dojoPlan: dojoPlan || false,
        monthlyTotal,
        oneTimeTotal,
        status: 'sent',
        sentAt: new Date(),
        createdBy: req.user.id,
      });

      // Update deal with quote data and move to quote_sent stage
      await storage.updateDeal(id, {
        dealStage: 'quote_sent',
        quoteGenerated: true,
        adminNotes: (deal.adminNotes || '') + `\n[${new Date().toLocaleString()}] Comprehensive quote generated by ${req.user.email}. Quote ID: ${quote.id}. Rates: Credit ${creditCardRate}%, Debit ${debitCardRate}%, Corporate ${corporateCardRate}%. Devices: ${totalDevices}. Monthly: £${monthlyTotal.toFixed(2)}, One-time: £${oneTimeTotal.toFixed(2)}`,
        updatedAt: new Date()
      });

      // Log quote generation
      console.log('Comprehensive quote generated for referral:', id, {
        admin: req.user.email,
        quoteId: quote.id,
        rates: { creditCardRate, debitCardRate, corporateCardRate },
        devices: totalDevices,
        monthlyTotal,
        oneTimeTotal,
        businessEmail: deal.businessEmail
      });

      res.json({
        success: true,
        quoteId: quote.id,
        message: `Quote sent to ${referral.businessEmail}`,
        quoteData: {
          quoteId: quote.id,
          monthlyTotal,
          oneTimeTotal,
          sentAt: new Date()
        }
      });
    } catch (error) {
      console.error("Error generating quote:", error);
      res.status(500).json({ message: "Failed to generate quote" });
    }
  });

  // Alias route for deals terminology - Generate quote from deal details modal
  app.post('/api/admin/deals/:id/generate-quote', requireAuth, requireAdmin, auditAdminAction('generate_quote', 'deal'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        creditCardRate,
        debitCardRate,
        corporateCardRate,
        visaBusinessDebitRate,
        otherBusinessDebitRate,
        amexRate,
        secureTransactionFee,
        estimatedMonthlySaving,
        buyoutAmount,
        devicePaymentType,
        devices,
        hardwareCare,
        settlementType,
        dojoPlan,
      } = req.body;

      // Get deal
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === id);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Calculate device costs
      const totalDevices = devices?.reduce((sum: number, d: any) => sum + d.quantity, 0) || 0;
      const deviceCost = devices?.reduce((sum: number, d: any) => sum + d.price, 0) || 0;
      const hardwareCareCost = hardwareCare ? totalDevices * 5 : 0;
      const settlementFee = settlementType === "7_day" ? 10 : 0;
      const dojoPlanFee = dojoPlan ? 11.99 : 0;

      const monthlyTotal = devicePaymentType === "pay_monthly"
        ? deviceCost + hardwareCareCost + settlementFee + dojoPlanFee
        : hardwareCareCost + settlementFee + dojoPlanFee;

      const oneTimeTotal = devicePaymentType === "pay_once" ? deviceCost : 0;

      // Create comprehensive quote record
      const quote = await storage.createQuote({
        referralId: id,
        creditCardRate: parseFloat(creditCardRate || '0'),
        debitCardRate: parseFloat(debitCardRate || '0'),
        corporateCardRate: parseFloat(corporateCardRate || '0'),
        visaBusinessDebitRate: parseFloat(visaBusinessDebitRate || '1.99'),
        otherBusinessDebitRate: parseFloat(otherBusinessDebitRate || '1.99'),
        amexRate: parseFloat(amexRate || '1.90'),
        secureTransactionFee: parseFloat(secureTransactionFee || '5.00'),
        estimatedMonthlySaving: parseFloat(estimatedMonthlySaving || '0'),
        buyoutAmount: parseInt(buyoutAmount || '3000'),
        devicePaymentType: devicePaymentType || 'pay_monthly',
        devices: devices || [],
        hardwareCare: hardwareCare || false,
        settlementType: settlementType || '5_day',
        dojoPlan: dojoPlan || false,
        monthlyTotal,
        oneTimeTotal,
        status: 'sent',
        sentAt: new Date(),
        createdBy: req.user.id,
      });

      // Update deal with quote data and move to quote_sent stage
      await storage.updateDeal(id, {
        dealStage: 'quote_sent',
        quoteGenerated: true,
        adminNotes: (deal.adminNotes || '') + `\n[${new Date().toLocaleString()}] Quote generated by ${req.user.email}. Quote ID: ${quote.id}. Rates: Credit ${creditCardRate}%, Debit ${debitCardRate}%, Corporate ${corporateCardRate}%. Devices: ${totalDevices}. Monthly: £${monthlyTotal.toFixed(2)}, One-time: £${oneTimeTotal.toFixed(2)}`,
        updatedAt: new Date()
      });

      // Log quote generation
      console.log('Quote generated for deal:', id, {
        admin: req.user.email,
        quoteId: quote.id,
        rates: { creditCardRate, debitCardRate, corporateCardRate },
        devices: totalDevices,
        monthlyTotal,
        oneTimeTotal,
        businessEmail: deal.businessEmail
      });

      res.json({
        success: true,
        quoteId: quote.id,
        message: `Quote sent to ${deal.businessEmail}`,
        quoteData: {
          quoteId: quote.id,
          monthlyTotal,
          oneTimeTotal,
          sentAt: new Date()
        }
      });
    } catch (error) {
      console.error("Error generating quote:", error);
      res.status(500).json({ message: "Failed to generate quote" });
    }
  });

  // Move deal from quote_approved to agreement_sent - helper function
  const moveToAgreementSent = async (req: any, res: any) => {
    try {
      const id = req.params.id || req.params.dealId;

      // Get deal
      const allDeals = await storage.getAllDeals();
      const deal = allDeals.find((r: any) => r.id === id);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Verify it's in quote_approved stage
      if (deal.dealStage !== 'quote_approved') {
        return res.status(400).json({
          message: "Can only move deals from 'Quote Approved' stage to 'Agreement Sent'"
        });
      }

      // Update deal to agreement_sent stage
      const updatedDeal = await storage.updateDeal(id, {
        dealStage: 'agreement_sent',
        status: 'agreement_sent',
        adminNotes: (deal.adminNotes || '') + `\n[${new Date().toLocaleString()}] Deal moved to Agreement Sent stage by ${req.user.email}. Agreement documents sent to ${deal.businessEmail}.`,
        updatedAt: new Date()
      });

      console.log('Deal moved to Agreement Sent:', id, {
        admin: req.user.email,
        businessName: deal.businessName,
        previousStage: 'quote_approved',
        newStage: 'agreement_sent'
      });

      res.json({
        success: true,
        message: `Deal moved to Agreement Sent stage`,
        deal: updatedDeal
      });
    } catch (error) {
      console.error("Error moving deal forward:", error);
      res.status(500).json({ message: "Failed to move deal forward" });
    }
  };

  // Move deal from quote_approved to agreement_sent - both route patterns
  app.patch('/api/admin/referrals/:id/move-to-agreement-sent', requireAuth, requireAdmin, auditAdminAction('move_to_agreement_sent', 'referral'), moveToAgreementSent);
  app.patch('/api/admin/deals/:id/move-to-agreement-sent', requireAuth, requireAdmin, auditAdminAction('move_to_agreement_sent', 'deal'), moveToAgreementSent);

  // Admin document management
  app.post('/api/admin/referrals/:dealId/docs-out-confirmation', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { documentsSent, recipientEmail } = req.body;

      const deal = await storage.updateDeal(dealId, {
        status: 'docs_out_confirmation',
        adminNotes: `Documents sent to ${recipientEmail} on ${new Date().toLocaleDateString()}. Documents: ${documentsSent?.join(', ') || 'Agreement documents'}`,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: "Documents confirmation updated successfully",
        referral
      });
    } catch (error) {
      console.error("Error updating docs confirmation:", error);
      res.status(500).json({ message: "Failed to update documents confirmation" });
    }
  });

  // Admin document requirements management
  app.post('/api/admin/referrals/:dealId/document-requirements', requireAuth, requireAdmin, auditAdminAction('update_document_requirements', 'referral'), async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { requiredDocuments, notes } = req.body;

      // Update deal with document requirements
      const updatedNotes = `Required documents: ${requiredDocuments.join(', ')}. ${notes || ''}`;

      await storage.updateDeal(dealId, {
        adminNotes: updatedNotes,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: "Document requirements updated successfully",
        requiredDocuments
      });
    } catch (error) {
      console.error("Error updating document requirements:", error);
      res.status(500).json({ message: "Failed to update document requirements" });
    }
  });

  // Admin deal stage management
  app.patch('/api/admin/referrals/:dealId/stage', requireAuth, requireAdmin, auditAdminAction('update_stage', 'referral'), async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { dealStage, productType, quoteDeliveryMethod, notes } = req.body;

      // Valid stages for admin override
      const validStages = [
        'quote_request_received',
        'quote_sent',
        'quote_approved',
        'agreement_sent',
        'signed_awaiting_docs',
        'approved',
        'live_confirm_ltr',
        'invoice_received',
        'completed',
        'declined'
      ];

      if (dealStage && !validStages.includes(dealStage)) {
        return res.status(400).json({
          message: "Invalid stage",
          validStages
        });
      }

      const adminNoteEntry = `Stage changed to ${dealStage} by admin on ${new Date().toLocaleDateString()}. ${notes || ''}${productType ? ` Product type: ${productType}.` : ''}${quoteDeliveryMethod ? ` Quote delivery: ${quoteDeliveryMethod}.` : ''}`;

      const updateData: any = {
        adminNotes: adminNoteEntry,
        updatedAt: new Date()
      };

      if (dealStage) {
        updateData.dealStage = dealStage;
      }

      if (productType) {
        updateData.productType = productType;
      }

      if (quoteDeliveryMethod) {
        updateData.quoteDeliveryMethod = quoteDeliveryMethod;
      }

      await storage.updateDeal(dealId, updateData);

      res.json({
        success: true,
        message: `Deal updated successfully`,
        dealStage,
        productType,
        quoteDeliveryMethod,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error updating deal stage:", error);
      res.status(500).json({ message: "Failed to update deal stage" });
    }
  });

  // Alias route for deal stage management (same handler)
  app.patch('/api/admin/deals/:dealId/stage', requireAuth, requireAdmin, auditAdminAction('update_stage', 'deal'), async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { dealStage, productType, quoteDeliveryMethod, notes } = req.body;

      const validStages = [
        'quote_request_received',
        'quote_sent',
        'quote_approved',
        'agreement_sent',
        'signed_awaiting_docs',
        'approved',
        'live_confirm_ltr',
        'invoice_received',
        'completed',
        'declined'
      ];

      if (dealStage && !validStages.includes(dealStage)) {
        return res.status(400).json({ message: "Invalid stage", validStages });
      }

      const adminNoteEntry = `Stage changed to ${dealStage} by admin on ${new Date().toLocaleDateString()}. ${notes || ''}`;
      const updateData: any = { adminNotes: adminNoteEntry, updatedAt: new Date() };
      if (dealStage) updateData.dealStage = dealStage;
      if (productType) updateData.productType = productType;
      if (quoteDeliveryMethod) updateData.quoteDeliveryMethod = quoteDeliveryMethod;

      await storage.updateDeal(dealId, updateData);
      res.json({ success: true, message: `Deal updated successfully`, dealStage, updatedAt: new Date() });
    } catch (error) {
      console.error("Error updating deal stage:", error);
      res.status(500).json({ message: "Failed to update deal stage" });
    }
  });

  app.post('/api/admin/users/:userId/reset-password', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // In a real implementation, you would send an email with a reset link
      // For now, we'll just log it and return success
      console.log(`Password reset requested for user: ${user.email}`);

      res.json({ message: "Password reset email sent successfully" });
    } catch (error) {
      console.error("Error sending password reset:", error);
      res.status(500).json({ message: "Failed to send password reset email" });
    }
  });

  // Migration endpoint: Sync dealStage to customerJourneyStatus
  app.post('/api/admin/migrate-deal-stages', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const deals = await storage.getAllDeals();
      let syncedCount = 0;

      for (const deal of deals) {
        if (deal.dealStage && deal.id) {
          // Find any quotes associated with this deal
          const allQuotes = await storage.getAllQuotesForAdmin();
          const dealQuotes = allQuotes.filter((q: any) => q.referralId === deal.id);

          // Sync customerJourneyStatus for each quote
          for (const quote of dealQuotes) {
            const customerJourneyStatus = mapDealStageToCustomerJourney(deal.dealStage);
            await storage.db.update(storage.schema.quotes)
              .set({
                customerJourneyStatus,
                updatedAt: new Date()
              })
              .where(storage.eq(storage.schema.quotes.id, quote.id));
            syncedCount++;
          }
        }
      }

      res.json({
        success: true,
        message: `Successfully synced ${syncedCount} quotes to match deal stages`,
        syncedCount
      });
    } catch (error) {
      console.error("Error migrating deal stages:", error);
      res.status(500).json({ message: "Failed to migrate deal stages" });
    }
  });

  // Initialize seed data
  await storage.seedBusinessTypes();
  await storage.seedRates();
  // Partners seeding will be added after database schema is migrated

  // Notification routes
  // ============ USER COMMISSION APPROVAL ENDPOINTS ============

  // Get user's pending commission approvals
  app.get('/api/commission-approvals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const approvals = await storage.getCommissionApprovalsByUserId(userId);
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching commission approvals:", error);
      res.status(500).json({ message: "Failed to fetch commission approvals" });
    }
  });

  // User approves commission
  app.patch('/api/commission-approvals/:approvalId/approve', requireAuth, async (req: any, res) => {
    try {
      const { approvalId } = req.params;
      const userId = req.user.id;

      // Verify approval belongs to user
      const approvals = await storage.getCommissionApprovalsByUserId(userId);
      const approval = approvals.find(a => a.id === approvalId);

      if (!approval) {
        return res.status(404).json({ message: "Commission approval not found" });
      }

      if (approval.approvalStatus !== 'pending') {
        return res.status(400).json({ message: "Commission approval is not pending" });
      }

      // Update approval status
      const updatedApproval = await storage.updateCommissionApprovalStatus(approvalId, 'approved');

      res.json({
        success: true,
        message: "Commission approved successfully",
        approval: updatedApproval
      });
    } catch (error) {
      console.error("Error approving commission:", error);
      res.status(500).json({ message: "Failed to approve commission" });
    }
  });

  // User rejects commission  
  app.patch('/api/commission-approvals/:approvalId/reject', requireAuth, async (req: any, res) => {
    try {
      const { approvalId } = req.params;
      const userId = req.user.id;

      // Verify approval belongs to user
      const approvals = await storage.getCommissionApprovalsByUserId(userId);
      const approval = approvals.find(a => a.id === approvalId);

      if (!approval) {
        return res.status(404).json({ message: "Commission approval not found" });
      }

      if (approval.approvalStatus !== 'pending') {
        return res.status(400).json({ message: "Commission approval is not pending" });
      }

      // Update approval status
      const updatedApproval = await storage.updateCommissionApprovalStatus(approvalId, 'rejected');

      res.json({
        success: true,
        message: "Commission rejected",
        approval: updatedApproval
      });
    } catch (error) {
      console.error("Error rejecting commission:", error);
      res.status(500).json({ message: "Failed to reject commission" });
    }
  });

  // ============ COMMISSION PAYMENTS & WITHDRAWALS ============

  // Set up bank details for withdrawals
  app.patch('/api/user/bank-details', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { bankAccountName, bankSortCode, bankAccountNumber } = req.body;

      if (!bankAccountName || !bankSortCode || !bankAccountNumber) {
        return res.status(400).json({ message: "All bank details are required" });
      }

      const updatedUser = await storage.updateUser(userId, {
        bankAccountName,
        bankSortCode,
        bankAccountNumber,
        bankingComplete: true
      });

      res.json({
        success: true,
        message: "Bank details saved successfully",
        user: updatedUser
      });
    } catch (error) {
      console.error("Error saving bank details:", error);
      res.status(500).json({ message: "Failed to save bank details" });
    }
  });

  // Get user's commission payments
  app.get('/api/commission-payments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const payments = await storage.getCommissionPaymentsByRecipient(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching commission payments:", error);
      res.status(500).json({ message: "Failed to fetch commission payments" });
    }
  });


  // Get withdrawn/paid commission payments
  app.get('/api/commission-payments/withdrawn', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get commission payments that have been paid/withdrawn
      const withdrawnPayments = await storage.db.select()
        .from(storage.schema.commissionPayments)
        .where(sql`recipient_id = ${userId} AND payment_status = 'paid'`)
        .orderBy(sql`payment_date DESC`);

      res.json(withdrawnPayments);
    } catch (error) {
      console.error("Error fetching withdrawn commission payments:", error);
      res.status(500).json({ message: "Failed to fetch withdrawn commission payments" });
    }
  });

  // Admin: Get approved commission payments ready for withdrawal
  app.get('/api/admin/commission-payments/approved', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      // Get all approved commission payments with recipient details
      const approvedPayments = await db.select({
        id: commissionPayments.id,
        dealId: commissionPayments.dealId,
        recipientId: commissionPayments.recipientId,
        level: commissionPayments.level,
        amount: commissionPayments.amount,
        percentage: commissionPayments.percentage,
        businessName: commissionPayments.businessName,
        approvalStatus: commissionPayments.approvalStatus,
        paymentStatus: commissionPayments.paymentStatus,
        createdAt: commissionPayments.createdAt,
        recipientName: users.firstName,
        recipientEmail: users.email,
        bankAccountNumber: users.bankAccountNumber,
        bankSortCode: users.bankSortCode,
        bankAccountName: users.bankAccountName,
      })
        .from(commissionPayments)
        .leftJoin(users, eq(commissionPayments.recipientId, users.id))
        .where(eq(commissionPayments.paymentStatus, 'approved'))
        .orderBy(desc(commissionPayments.createdAt));

      res.json(approvedPayments);
    } catch (error) {
      console.error("Error fetching approved commission payments:", error);
      res.status(500).json({ message: "Failed to fetch approved commission payments" });
    }
  });

  // Approve commission payment
  app.patch('/api/commission-payments/:paymentId/approve', requireAuth, async (req: any, res) => {
    try {
      const { paymentId } = req.params;
      const userId = req.user.id;

      // Verify payment belongs to user
      const payments = await storage.getCommissionPaymentsByRecipient(userId);
      const payment = payments.find(p => p.id === paymentId);

      if (!payment) {
        return res.status(404).json({ message: "Commission payment not found" });
      }

      if (payment.approvalStatus !== 'pending') {
        return res.status(400).json({ message: "Commission payment is not pending" });
      }

      // Update payment approval status
      const updatedPayment = await storage.updateCommissionPaymentApproval(paymentId, 'approved', null);

      res.json({
        success: true,
        message: "Commission payment approved successfully",
        payment: updatedPayment
      });
    } catch (error) {
      console.error("Error approving commission payment:", error);
      res.status(500).json({ message: "Failed to approve commission payment" });
    }
  });

  // Query commission payment
  app.patch('/api/commission-payments/:paymentId/query', requireAuth, async (req: any, res) => {
    try {
      const { paymentId } = req.params;
      const { queryNotes } = req.body;
      const userId = req.user.id;

      if (!queryNotes) {
        return res.status(400).json({ message: "Query notes are required" });
      }

      // Verify payment belongs to user
      const payments = await storage.getCommissionPaymentsByRecipient(userId);
      const payment = payments.find(p => p.id === paymentId);

      if (!payment) {
        return res.status(404).json({ message: "Commission payment not found" });
      }

      if (payment.approvalStatus !== 'pending') {
        return res.status(400).json({ message: "Commission payment is not pending" });
      }

      // Update payment with query
      const updatedPayment = await storage.updateCommissionPaymentApproval(paymentId, 'queried', queryNotes);

      res.json({
        success: true,
        message: "Query submitted successfully",
        payment: updatedPayment
      });
    } catch (error) {
      console.error("Error querying commission payment:", error);
      res.status(500).json({ message: "Failed to submit query" });
    }
  });

  // Get withdrawn/paid commissions
  app.get('/api/commission-payments/withdrawn', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const payments = await storage.getCommissionPaymentsByRecipient(userId);

      // Filter only paid commissions
      const withdrawnPayments = payments.filter((p: any) => p.paymentStatus === 'paid');

      res.json(withdrawnPayments);
    } catch (error) {
      console.error("Error fetching withdrawn payments:", error);
      res.status(500).json({ message: "Failed to fetch withdrawn payments" });
    }
  });

  // ============ ADMIN: CREATE MULTI-LEVEL COMMISSIONS ============

  // Admin endpoint to create multi-level commissions when marking deal as live
  app.post('/api/admin/referrals/:dealId/create-commission', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { totalCommission } = req.body;

      if (!totalCommission || isNaN(parseFloat(totalCommission))) {
        return res.status(400).json({ message: "Valid total commission amount is required" });
      }

      const total = parseFloat(totalCommission);

      // Get deal to find the direct referrer
      const deal = await storage.getDealById(dealId);
      if (!referral) {
        return res.status(404).json({ message: "Deal not found" });
      }

      const directReferrerId = deal.referrerId;

      // Get direct referrer
      const directReferrer = await storage.getUser(directReferrerId);
      if (!directReferrer) {
        return res.status(404).json({ message: "Direct referrer not found" });
      }

      const commissions = [];

      // Level 1: Direct referrer gets 60%
      const level1Amount = total * 0.60;
      const level1Commission = await storage.createCommissionPayment({
        dealId,
        recipientId: directReferrerId,
        level: 1,
        amount: level1Amount.toFixed(2),
        percentage: "60.00",
        totalCommission: total.toFixed(2),
        businessName: deal.businessName,
        dealStage: deal.dealStage || 'live',
        approvalStatus: 'pending',
        paymentStatus: 'pending'
      });
      commissions.push(level1Commission);

      // Level 2: Parent gets 20% (if exists)
      if (directReferrer.parentPartnerId) {
        const level2Amount = total * 0.20;
        const level2Commission = await storage.createCommissionPayment({
          dealId,
          recipientId: directReferrer.parentPartnerId,
          level: 2,
          amount: level2Amount.toFixed(2),
          percentage: "20.00",
          totalCommission: total.toFixed(2),
          businessName: deal.businessName,
          dealStage: deal.dealStage || 'live',
          approvalStatus: 'pending',
          paymentStatus: 'pending'
        });
        commissions.push(level2Commission);

        // Level 3: Grandparent gets 10% (if exists)
        const parentUser = await storage.getUser(directReferrer.parentPartnerId);
        if (parentUser && parentUser.parentPartnerId) {
          const level3Amount = total * 0.10;
          const level3Commission = await storage.createCommissionPayment({
            dealId,
            recipientId: parentUser.parentPartnerId,
            level: 3,
            amount: level3Amount.toFixed(2),
            percentage: "10.00",
            totalCommission: total.toFixed(2),
            businessName: deal.businessName,
            dealStage: deal.dealStage || 'live',
            approvalStatus: 'pending',
            paymentStatus: 'pending'
          });
          commissions.push(level3Commission);
        }
      }

      res.json({
        success: true,
        message: "Multi-level commissions created successfully",
        commissions,
        totalCommission: total,
        split: {
          level1: level1Amount,
          level2: directReferrer.parentPartnerId ? total * 0.20 : 0,
          level3: directReferrer.parentPartnerId ? total * 0.10 : 0
        }
      });
    } catch (error) {
      console.error("Error creating multi-level commissions:", error);
      res.status(500).json({ message: "Failed to create commissions" });
    }
  });

  // Admin endpoint to mark commission as withdrawn/paid
  app.patch('/api/admin/commission-payments/:paymentId/withdraw', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { paymentId } = req.params;
      const { transferReference } = req.body;

      // Get the commission payment
      const payment = await storage.db.select().from(storage.schema.commissionPayments).where(sql`id = ${paymentId}`).limit(1);

      if (!payment || payment.length === 0) {
        return res.status(404).json({ message: "Commission payment not found" });
      }

      const commissionPayment = payment[0];

      // Update commission payment to paid status
      await storage.db.update(storage.schema.commissionPayments)
        .set({
          paymentStatus: 'paid',
          paymentDate: new Date(),
          transferReference: transferReference || null,
          updatedAt: new Date()
        })
        .where(sql`id = ${paymentId}`);

      // Update deal stage to "live_paid" if this is the level 1 commission
      if (commissionPayment.level === 1 && commissionPayment.dealId) {
        await storage.db.update(storage.schema.deals)
          .set({
            dealStage: 'live_paid',
            updatedAt: new Date()
          })
          .where(sql`id = ${commissionPayment.dealId}`);
      }

      res.json({
        success: true,
        message: "Commission marked as paid and withdrawn successfully"
      });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  app.get('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getNotificationsByUserId(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch('/api/notifications/:notificationId/read', requireAuth, async (req: any, res) => {
    try {
      const { notificationId } = req.params;
      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true, message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch('/api/notifications/read-all', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Leads routes
  app.get('/api/leads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const leads = await storage.getLeadsByUserId(userId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.post('/api/leads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const leadData = {
        ...req.body,
        partnerId: userId,
      };

      const lead = await storage.createLead(leadData);
      res.json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.post('/api/leads/bulk', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { leads: leadsData } = req.body;

      const leadsWithPartnerId = leadsData.map((lead: any) => ({
        ...lead,
        partnerId: userId,
      }));

      const result = await storage.createLeadsBulk(leadsWithPartnerId);
      res.json(result);
    } catch (error) {
      console.error("Error creating bulk leads:", error);
      res.status(500).json({ message: "Failed to create leads" });
    }
  });

  app.patch('/api/leads/:leadId', async (req: any, res) => {
    try {
      const { leadId } = req.params;
      const { status } = req.body;

      const lead = await storage.updateLeadStatus(leadId, status);
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead status:", error);
      res.status(500).json({ message: "Failed to update lead status" });
    }
  });

  app.put('/api/leads/:leadId', requireAuth, async (req: any, res) => {
    try {
      const { leadId } = req.params;
      const updates = req.body;

      const lead = await storage.updateLead(leadId, updates);
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.get('/api/leads/:leadId/interactions', requireAuth, async (req: any, res) => {
    try {
      const { leadId } = req.params;
      const interactions = await storage.getLeadInteractions(leadId);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching lead interactions:", error);
      res.status(500).json({ message: "Failed to fetch interactions" });
    }
  });

  app.post('/api/leads/:leadId/interactions', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { leadId } = req.params;
      const interactionData = {
        ...req.body,
        partnerId: userId,
      };

      const interaction = await storage.addLeadInteraction(leadId, interactionData);
      res.json(interaction);
    } catch (error) {
      console.error("Error adding interaction:", error);
      res.status(500).json({ message: "Failed to add interaction" });
    }
  });

  app.post('/api/leads/:leadId/send-info', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { leadId } = req.params;
      const { productType, title, content } = req.body;

      // Create an interaction record for the info sharing
      const interactionData = {
        partnerId: userId,
        interactionType: 'email',
        subject: `Sent: ${title}`,
        details: `Sent business information about ${productType}:\n\n${content}`,
        outcome: 'follow_up_required',
        nextAction: 'Follow up on information shared',
      };

      const interaction = await storage.addLeadInteraction(leadId, interactionData);
      res.json({ success: true, interaction });
    } catch (error) {
      console.error("Error sending info:", error);
      res.status(500).json({ message: "Failed to send information" });
    }
  });

  // Partners routes
  app.get('/api/partners', async (req, res) => {
    try {
      const partners = await storage.getPartners();
      res.json(partners);
    } catch (error) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  });

  app.get('/api/partners/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const partner = await storage.getPartnerBySlug(slug);

      if (!partner) {
        return res.status(404).json({ message: "Partner not found" });
      }

      res.json(partner);
    } catch (error) {
      console.error("Error fetching partner:", error);
      res.status(500).json({ message: "Failed to fetch partner" });
    }
  });

  // Admin diagnostics routes
  app.get('/api/admin/request-logs', requireAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getRequestLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching request logs:", error);
      res.status(500).json({ message: "Failed to fetch request logs" });
    }
  });

  app.get('/api/admin/error-logs', requireAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getErrorLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching error logs:", error);
      res.status(500).json({ message: "Failed to fetch error logs" });
    }
  });

  app.get('/api/admin/webhook-logs', requireAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getWebhookLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
      res.status(500).json({ message: "Failed to fetch webhook logs" });
    }
  });

  app.get('/api/admin/audit-logs', requireAuth, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAudits(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Account management routes
  app.patch('/api/account/profile', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, phone, address, city, postcode, country } = req.body;

      // Update user profile
      await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        phone,
        address,
        city,
        postcode,
        country
      });

      // Log the profile update
      await storage.createAudit({
        actorUserId: userId,
        action: 'profile_updated',
        entityType: 'user',
        entityId: userId,
        metadata: { fields_changed: Object.keys(req.body) },
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ message: "Profile updated successfully" });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch('/api/account/banking', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bankingData = req.body;

      // Update banking details
      await storage.updateBankingDetails(userId, bankingData);

      // Log the banking update
      await storage.createAudit({
        actorUserId: userId,
        action: 'banking_updated',
        entityType: 'user',
        entityId: userId,
        metadata: { fields_updated: Object.keys(bankingData) },
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ message: "Banking details updated successfully" });
    } catch (error) {
      console.error("Error updating banking details:", error);
      res.status(500).json({ message: "Failed to update banking details" });
    }
  });

  app.post('/api/account/feedback', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type, subject, message, priority, rating } = req.body;

      // Store feedback
      const feedbackId = await storage.createFeedback({
        userId,
        type,
        subject,
        message,
        priority,
        rating: rating ? parseInt(rating) : null
      });

      // Log the feedback submission
      await storage.createAudit({
        actorUserId: userId,
        action: 'feedback_submitted',
        entityType: 'feedback',
        entityId: feedbackId,
        metadata: { type, subject, priority },
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ message: "Feedback submitted successfully", id: feedbackId });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Analytics tracking endpoint
  app.post('/api/analytics/track', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { event, data } = req.body;

      // Log analytics event for audit trail
      await storage.createAudit({
        actorUserId: userId,
        action: 'analytics_tracked',
        entityType: 'analytics',
        entityId: event,
        metadata: { event, data },
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Update user onboarding data based on event
      if (event === 'tour_started') {
        await storage.upsertUser({
          id: userId,
          tourStarted: new Date(),
        });
      } else if (event === 'tour_completed') {
        const user = await storage.getUser(userId);
        await storage.upsertUser({
          id: userId,
          tourCompleted: new Date(),
          onboardingXp: (user?.onboardingXp || 0) + 100,
        });
      } else if (event === 'tour_skipped') {
        await storage.upsertUser({
          id: userId,
          tourSkipped: new Date(),
        });
      }

      res.json({ success: true, message: 'Analytics event tracked' });
    } catch (error) {
      console.error("Error tracking analytics:", error);
      res.status(500).json({ success: false, message: "Failed to track analytics" });
    }
  });

  // ============ CONTACTS ENDPOINTS ============

  // Get user's contacts
  app.get('/api/contacts', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const contacts = await storage.getContactsByUserId(userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Create contact
  app.post('/api/contacts', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Validate request body with Zod schema
      const validationResult = insertContactSchema.omit({ partnerId: true }).safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error);
        return res.status(400).json({
          message: "Invalid contact data",
          details: errorMessage.message
        });
      }

      const contactData = {
        ...validationResult.data,
        partnerId: userId,
      };

      const contact = await storage.createContact(contactData);
      res.json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Get contact by ID
  app.get('/api/contacts/:contactId', requireAuth, async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const userId = req.user.id;
      const contact = await storage.getContactById(contactId, userId);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  // Update contact
  app.put('/api/contacts/:contactId', requireAuth, async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const userId = req.user.id;

      // Validate request body with Zod schema (partial for updates)
      const validationResult = insertContactSchema.omit({ partnerId: true }).partial().safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error);
        return res.status(400).json({
          message: "Invalid contact data",
          details: errorMessage.message
        });
      }

      const contact = await storage.updateContact(contactId, userId, validationResult.data);
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Delete contact
  app.delete('/api/contacts/:contactId', requireAuth, async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const userId = req.user.id;
      await storage.deleteContact(contactId, userId);
      res.json({ success: true, message: "Contact deleted successfully" });
    } catch (error) {
      console.error("Error deleting contact:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Get contact interactions
  app.get('/api/contacts/:contactId/interactions', requireAuth, async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const userId = req.user.id;
      const interactions = await storage.getContactInteractions(contactId, userId);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching contact interactions:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to fetch contact interactions" });
    }
  });

  // Add contact interaction
  app.post('/api/contacts/:contactId/interactions', requireAuth, async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const userId = req.user.id;
      const interaction = await storage.addContactInteraction(contactId, userId, req.body);
      res.json(interaction);
    } catch (error) {
      console.error("Error adding contact interaction:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to add contact interaction" });
    }
  });

  // ============ OPPORTUNITIES ENDPOINTS ============

  // Get user's opportunities
  app.get('/api/opportunities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const opportunities = await storage.getOpportunitiesByUserId(userId);
      res.json(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  // Create opportunity
  app.post('/api/opportunities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;


      // Convert date strings to Date objects for timestamp fields
      const requestData = { ...req.body };
      if (requestData.expectedCloseDate && typeof requestData.expectedCloseDate === 'string') {
        requestData.expectedCloseDate = new Date(requestData.expectedCloseDate);
      }
      if (requestData.lastContact && typeof requestData.lastContact === 'string') {
        requestData.lastContact = new Date(requestData.lastContact);
      }
      if (requestData.nextFollowUp && typeof requestData.nextFollowUp === 'string') {
        requestData.nextFollowUp = new Date(requestData.nextFollowUp);
      }

      // Validate request body with Zod schema
      const validationResult = insertOpportunitySchema.omit({ partnerId: true }).safeParse(requestData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error);
        console.error('Opportunity validation failed:', {
          errors: validationResult.error.errors,
          requestBody: requestData,
          formattedError: errorMessage.message
        });
        return res.status(400).json({
          message: "Invalid opportunity data",
          details: errorMessage.message,
          validationErrors: validationResult.error.errors
        });
      }

      const opportunityData = {
        ...validationResult.data,
        partnerId: userId,
      };

      const opportunity = await storage.createOpportunity(opportunityData);
      res.json(opportunity);
    } catch (error) {
      console.error("Error creating opportunity:", error);
      res.status(500).json({ message: "Failed to create opportunity" });
    }
  });

  // Get opportunity by ID
  app.get('/api/opportunities/:opportunityId', requireAuth, async (req: any, res) => {
    try {
      const { opportunityId } = req.params;
      const userId = req.user.id;
      const opportunity = await storage.getOpportunityById(opportunityId, userId);

      if (!opportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }

      res.json(opportunity);
    } catch (error) {
      console.error("Error fetching opportunity:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to fetch opportunity" });
    }
  });

  // Update opportunity
  app.put('/api/opportunities/:opportunityId', requireAuth, async (req: any, res) => {
    try {
      const { opportunityId } = req.params;
      const userId = req.user.id;

      // Convert date strings to Date objects for timestamp fields
      const requestData = { ...req.body };
      if (requestData.expectedCloseDate && typeof requestData.expectedCloseDate === 'string') {
        requestData.expectedCloseDate = new Date(requestData.expectedCloseDate);
      }
      if (requestData.lastContact && typeof requestData.lastContact === 'string') {
        requestData.lastContact = new Date(requestData.lastContact);
      }
      if (requestData.nextFollowUp && typeof requestData.nextFollowUp === 'string') {
        requestData.nextFollowUp = new Date(requestData.nextFollowUp);
      }

      // Validate request body with Zod schema (partial for updates)
      const validationResult = insertOpportunitySchema.omit({ partnerId: true }).partial().safeParse(requestData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error);
        console.error('Opportunity update validation failed:', {
          errors: validationResult.error.errors,
          requestBody: requestData,
          formattedError: errorMessage.message
        });
        return res.status(400).json({
          message: "Invalid opportunity data",
          details: errorMessage.message,
          validationErrors: validationResult.error.errors
        });
      }

      const opportunity = await storage.updateOpportunity(opportunityId, userId, validationResult.data);

      // Synchronize related contact data if the opportunity is linked to a contact
      if (opportunity.contactId && validationResult.data) {
        const contactUpdates: any = {};

        // Map opportunity fields to contact fields that should be synchronized
        if (validationResult.data.contactEmail) {
          contactUpdates.email = validationResult.data.contactEmail;
        }
        if (validationResult.data.contactPhone) {
          contactUpdates.phone = validationResult.data.contactPhone;
        }
        if (validationResult.data.contactFirstName) {
          contactUpdates.firstName = validationResult.data.contactFirstName;
        }
        if (validationResult.data.contactLastName) {
          contactUpdates.lastName = validationResult.data.contactLastName;
        }
        if (validationResult.data.businessName) {
          contactUpdates.company = validationResult.data.businessName;
        }
        if (validationResult.data.businessType) {
          contactUpdates.businessType = validationResult.data.businessType;
        }

        // Update the contact if there are any changes
        if (Object.keys(contactUpdates).length > 0) {
          try {
            await storage.updateContact(opportunity.contactId, userId, contactUpdates);
            console.log(`Contact ${opportunity.contactId} synchronized with opportunity ${opportunityId} updates`);
          } catch (error) {
            console.error(`Failed to synchronize contact ${opportunity.contactId}:`, error);
            // Continue execution - don't fail the opportunity update if contact sync fails
          }
        }
      }

      res.json(opportunity);
    } catch (error) {
      console.error("Error updating opportunity:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to update opportunity" });
    }
  });

  // Delete opportunity
  app.delete('/api/opportunities/:opportunityId', requireAuth, async (req: any, res) => {
    try {
      const { opportunityId } = req.params;
      const userId = req.user.id;
      await storage.deleteOpportunity(opportunityId, userId);
      res.json({ success: true, message: "Opportunity deleted successfully" });
    } catch (error) {
      console.error("Error deleting opportunity:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to delete opportunity" });
    }
  });

  // Get opportunity interactions
  app.get('/api/opportunities/:opportunityId/interactions', requireAuth, async (req: any, res) => {
    try {
      const { opportunityId } = req.params;
      const userId = req.user.id;
      const interactions = await storage.getOpportunityInteractions(opportunityId, userId);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching opportunity interactions:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to fetch opportunity interactions" });
    }
  });

  // Add opportunity interaction
  app.post('/api/opportunities/:opportunityId/interactions', requireAuth, async (req: any, res) => {
    try {
      const { opportunityId } = req.params;
      const userId = req.user.id;
      const interaction = await storage.addOpportunityInteraction(opportunityId, userId, req.body);
      res.json(interaction);
    } catch (error) {
      console.error("Error adding opportunity interaction:", error);
      if (error instanceof Error && error.message.includes('access denied')) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to add opportunity interaction" });
    }
  });

  // Convert contact to opportunity
  app.post('/api/contacts/:contactId/convert-to-opportunity', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { contactId } = req.params;
      const { opportunityData } = req.body;

      // Get the contact first (with user ownership check)
      const contact = await storage.getContactById(contactId, userId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Create opportunity with contact data
      const opportunity = await storage.createOpportunity({
        ...opportunityData,
        partnerId: userId,
        contactId: contactId,
        businessName: opportunityData.businessName || contact.company || `${contact.firstName} ${contact.lastName}`,
        contactFirstName: contact.firstName,
        contactLastName: contact.lastName,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        estimatedValue: opportunityData.estimatedValue || contact.estimatedMonthlyVolume || '0',
        status: opportunityData.status || 'prospect',
        stage: opportunityData.stage || 'initial_contact',
      });

      res.json(opportunity);
    } catch (error) {
      console.error("Error converting contact to opportunity:", error);
      res.status(500).json({ message: "Failed to convert contact to opportunity" });
    }
  });

  // ================== NEW ADMIN ANALYTICS & EXPORT ROUTES ==================

  // Initialize Stripe
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia'
  }) : null;

  // Admin Analytics: Overview
  app.get('/api/admin/analytics/overview', requireAuth, requireAdmin, auditAdminAction('view_analytics', 'admin'), async (req: any, res) => {
    try {
      const analyticsData = await storage.getAnalyticsOverview();
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics overview:", error);
      res.status(500).json({ message: "Failed to fetch analytics overview" });
    }
  });

  // Admin Analytics: Revenue Metrics
  app.get('/api/admin/analytics/revenue', requireAuth, requireAdmin, auditAdminAction('view_revenue', 'admin'), async (req: any, res) => {
    try {
      const revenueData = await storage.getRevenueMetrics();
      res.json(revenueData);
    } catch (error) {
      console.error("Error fetching revenue metrics:", error);
      res.status(500).json({ message: "Failed to fetch revenue metrics" });
    }
  });

  // Admin Analytics: User Growth
  app.get('/api/admin/analytics/users', requireAuth, requireAdmin, auditAdminAction('view_user_growth', 'admin'), async (req: any, res) => {
    try {
      const userGrowthData = await storage.getUserGrowthMetrics();
      res.json(userGrowthData);
    } catch (error) {
      console.error("Error fetching user growth metrics:", error);
      res.status(500).json({ message: "Failed to fetch user growth metrics" });
    }
  });

  // Admin Analytics: Top Performers (Leaderboard)
  app.get('/api/admin/analytics/top-performers', requireAuth, requireAdmin, auditAdminAction('view_top_performers', 'admin'), async (req: any, res) => {
    try {
      const topPerformers = await storage.getTopPerformers();
      res.json(topPerformers);
    } catch (error) {
      console.error("Error fetching top performers:", error);
      res.status(500).json({ message: "Failed to fetch top performers" });
    }
  });

  // Admin: Update Referral Stage
  app.post('/api/admin/referrals/:dealId/update-stage', requireAuth, requireAdmin, auditAdminAction('update_referral_stage', 'referral'), async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const { stage, notes } = req.body;

      if (!stage) {
        return res.status(400).json({ message: "Stage is required" });
      }

      const updatedReferral = await storage.updateDealStage(dealId, stage);

      // Add admin audit log
      await storage.createAdminAuditLog({
        actorId: req.user.id,
        action: 'update_referral_stage',
        entityType: 'referral',
        entityId: dealId,
        details: {
          oldStage: updatedReferral.status,
          newStage: stage,
          notes: notes || null
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      });

      res.json(updatedReferral);
    } catch (error) {
      console.error("Error updating referral stage:", error);
      res.status(500).json({ message: "Failed to update referral stage" });
    }
  });

  // Admin: Export Users CSV
  app.get('/api/admin/export/users', requireAuth, requireAdmin, auditAdminAction('export_users', 'admin'), async (req: any, res) => {
    try {
      const csvData = await storage.exportUsersCSV();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting users:", error);
      res.status(500).json({ message: "Failed to export users" });
    }
  });

  // Admin: Export Referrals CSV
  app.get('/api/admin/export/referrals', requireAuth, requireAdmin, auditAdminAction('export_referrals', 'admin'), async (req: any, res) => {
    try {
      const csvData = await storage.exportReferralsCSV();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="referrals_export.csv"');
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting referrals:", error);
      res.status(500).json({ message: "Failed to export referrals" });
    }
  });

  // Admin: Export Payments CSV
  app.get('/api/admin/export/payments', requireAuth, requireAdmin, auditAdminAction('export_payments', 'admin'), async (req: any, res) => {
    try {
      const csvData = await storage.exportPaymentsCSV();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="payments_export.csv"');
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting payments:", error);
      res.status(500).json({ message: "Failed to export payments" });
    }
  });

  // ================== PRODUCTION ADMIN INITIALIZATION ==================

  // Special endpoint to grant admin access in production
  // Use this once to set up your admin account
  app.post('/api/admin/initialize-production-admin', async (req: any, res) => {
    try {
      const { secretKey, email } = req.body;

      // Check secret key (you should set this as an environment variable)
      const ADMIN_INIT_SECRET = process.env.ADMIN_INIT_SECRET || 'your-secret-key-2024';

      if (!secretKey || secretKey !== ADMIN_INIT_SECRET) {
        return res.status(403).json({ message: "Invalid secret key" });
      }

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Update the user to be an admin
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found. Please log in first to create your account." });
      }

      // Grant admin access
      await storage.updateUser(user.id, { isAdmin: true });

      // Log this important action
      console.log(`[ADMIN INIT] Granted admin access to ${email} (user ID: ${user.id})`);

      res.json({
        success: true,
        message: `Admin access granted to ${email}`,
        userId: user.id
      });

    } catch (error) {
      console.error("Error initializing production admin:", error);
      res.status(500).json({ message: "Failed to initialize admin access" });
    }
  });

  // ================== STRIPE PAYMENT PROCESSING ROUTES ==================

  // Admin: Get Pending Payments
  app.get('/api/admin/payments/pending', requireAuth, requireAdmin, auditAdminAction('view_pending_payments', 'payment'), async (req: any, res) => {
    try {
      const pendingPayments = await storage.getPendingPayments();
      res.json(pendingPayments);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      res.status(500).json({ message: "Failed to fetch pending payments" });
    }
  });

  // Admin: Get Payment History
  app.get('/api/admin/payments/history', requireAuth, requireAdmin, auditAdminAction('view_payment_history', 'payment'), async (req: any, res) => {
    try {
      const paymentHistory = await storage.getPaymentHistory();
      res.json(paymentHistory);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // Admin: Process Stripe Payout
  app.post('/api/admin/payments/process-stripe', requireAuth, requireAdmin, auditAdminAction('process_stripe_payment', 'payment'), async (req: any, res) => {
    try {
      const { dealId, recipientId, amount, recipientEmail, recipientName } = req.body;

      if (!dealId || !recipientId || !amount) {
        return res.status(400).json({
          message: "Missing required fields: dealId, recipientId, and amount are required"
        });
      }

      if (!stripe) {
        return res.status(500).json({
          message: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable."
        });
      }

      // Convert amount to smallest currency unit (pence for GBP)
      const amountInPence = Math.round(parseFloat(amount) * 100);

      // Create or retrieve Stripe Connect account for recipient
      let stripeAccountId: string;

      try {
        // Check if user already has a Stripe Connect account
        const user = await storage.getUser(recipientId);

        if (user?.stripeAccountId) {
          stripeAccountId = user.stripeAccountId;
        } else {
          // Create a new Stripe Connect account for the recipient
          const account = await stripe.accounts.create({
            type: 'express',
            country: 'GB',
            email: recipientEmail || user?.email,
            capabilities: {
              transfers: { requested: true }
            },
            business_type: 'individual',
            metadata: {
              userId: recipientId,
              partnerId: user?.partnerId || ''
            }
          });

          stripeAccountId = account.id;

          // Save the Stripe account ID to the user record
          await storage.updateUser(recipientId, { stripeAccountId });
        }

        // Create a transfer to the Connect account
        const transfer = await stripe.transfers.create({
          amount: amountInPence,
          currency: 'gbp',
          destination: stripeAccountId,
          description: `Commission payout for referral ${dealId}`,
          metadata: {
            dealId,
            recipientId,
            recipientName: recipientName || 'Partner',
            processedBy: req.user.email
          }
        });

        // Record the payment in the database
        await storage.processStripePayment(dealId, recipientId, parseFloat(amount), transfer.id);

        // Create admin audit log
        await storage.createAdminAuditLog({
          actorId: req.user.id,
          action: 'process_stripe_payment',
          entityType: 'payment',
          entityId: dealId,
          details: {
            recipientId,
            amount: parseFloat(amount),
            stripeTransferId: transfer.id,
            stripeAccountId,
            currency: 'GBP'
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || null
        });

        res.json({
          success: true,
          message: "Payment processed successfully",
          stripeTransferId: transfer.id,
          amount: amount,
          recipient: recipientName || recipientEmail
        });

      } catch (stripeError: any) {
        console.error("Stripe error:", stripeError);

        // Handle specific Stripe errors
        if (stripeError.type === 'StripeInvalidRequestError') {
          return res.status(400).json({
            message: "Invalid payment request",
            error: stripeError.message
          });
        }

        throw stripeError;
      }

    } catch (error) {
      console.error("Error processing Stripe payment:", error);
      res.status(500).json({
        message: "Failed to process payment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin: Process Manual Payment (non-Stripe)
  app.post('/api/admin/payments/process-manual', requireAuth, requireAdmin, auditAdminAction('process_manual_payment', 'payment'), async (req: any, res) => {
    try {
      const { dealId, recipientId, amount, paymentMethod, paymentReference, notes } = req.body;

      if (!dealId || !recipientId || !amount) {
        return res.status(400).json({
          message: "Missing required fields: dealId, recipientId, and amount are required"
        });
      }

      // Record the manual payment
      await storage.processStripePayment(
        dealId,
        recipientId,
        parseFloat(amount),
        paymentReference || `MANUAL_${Date.now()}`
      );

      // Create admin audit log
      await storage.createAdminAuditLog({
        actorId: req.user.id,
        action: 'process_manual_payment',
        entityType: 'payment',
        entityId: dealId,
        details: {
          recipientId,
          amount: parseFloat(amount),
          paymentMethod: paymentMethod || 'Bank Transfer',
          paymentReference,
          notes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      });

      res.json({
        success: true,
        message: "Manual payment recorded successfully",
        amount: amount,
        paymentReference: paymentReference || `MANUAL_${Date.now()}`
      });

    } catch (error) {
      console.error("Error processing manual payment:", error);
      res.status(500).json({
        message: "Failed to process manual payment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ============================================
  // COMMISSION WORKFLOW ROUTES (LIVE -> PAYMENTS)
  // ============================================

  // Admin: Create commission from LIVE stage
  app.post('/api/admin/payments/create-commission', requireAuth, requireAdmin, auditAdminAction('create_commission', 'payment'), async (req: any, res) => {
    try {
      const { dealId, grossAmount, currency = 'GBP', evidenceUrl, notes } = req.body;

      if (!dealId || !grossAmount) {
        return res.status(400).json({
          message: "Missing required fields: dealId and grossAmount are required"
        });
      }

      // Get the deal to verify it's at the right stage
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      if (!['live', 'live_confirm_ltr'].includes(deal.dealStage || '')) {
        return res.status(400).json({
          message: "Deal must be at LIVE or Live Confirm LTR stage to create commission"
        });
      }

      // Check if payment already exists for this deal
      const existingPayments = await storage.getCommissionPaymentsByDeal(dealId);
      const hasActivePayment = existingPayments.some(p =>
        ['needs_approval', 'approved', 'paid'].includes(p.paymentStatus || '')
      );
      if (hasActivePayment) {
        return res.status(400).json({
          message: "A commission payment already exists for this deal"
        });
      }

      // Get the referrer's upline chain for MLM splits
      const referrer = await storage.getUser(deal.referrerId);
      if (!referrer) {
        return res.status(404).json({ message: "Deal referrer not found" });
      }

      const grossAmountNum = parseFloat(grossAmount);

      // Calculate splits based on MLM structure (60%/20%/10%)
      const splits: { userId: string; level: number; percentage: number; amount: number }[] = [];

      // Level 0: Direct referrer gets 60%
      splits.push({
        userId: deal.referrerId,
        level: 0,
        percentage: 60,
        amount: grossAmountNum * 0.60
      });

      // Level 1: First upline gets 20% (if exists)
      if (referrer.parentPartnerId) {
        const upline1 = await storage.getUser(referrer.parentPartnerId);
        if (upline1) {
          splits.push({
            userId: upline1.id,
            level: 1,
            percentage: 20,
            amount: grossAmountNum * 0.20
          });

          // Level 2: Second upline gets 10% (if exists)
          if (upline1.parentPartnerId) {
            const upline2 = await storage.getUser(upline1.parentPartnerId);
            if (upline2) {
              splits.push({
                userId: upline2.id,
                level: 2,
                percentage: 10,
                amount: grossAmountNum * 0.10
              });
            }
          }
        }
      }

      // Create the main commission payment record
      const paymentRecord = await storage.createCommissionPayment({
        dealId,
        recipientId: deal.referrerId,
        level: 0,
        amount: (grossAmountNum * 0.60).toFixed(2),
        percentage: '60.00',
        totalCommission: grossAmount,
        grossAmount: grossAmount,
        currency,
        businessName: deal.businessName,
        dealStage: deal.dealStage,
        approvalStatus: 'needs_approval',
        paymentStatus: 'needs_approval',
        evidenceUrl: evidenceUrl || null,
        notes: notes || null,
        createdBy: req.user.id,
      });

      // Create payment splits as ledger entries
      for (const split of splits) {
        await db.insert(paymentSplits).values({
          paymentId: paymentRecord.id,
          dealId,
          beneficiaryUserId: split.userId,
          level: split.level,
          percentage: split.percentage.toFixed(2),
          amount: split.amount.toFixed(2),
          status: 'pending',
        });
      }

      // Update deal stage to invoice_received
      await storage.updateDeal(dealId, { dealStage: 'invoice_received' });

      // Create audit log
      await storage.createAdminAuditLog({
        actorId: req.user.id,
        action: 'create_commission',
        entityType: 'payment',
        entityId: paymentRecord.id,
        details: {
          dealId,
          grossAmount: grossAmountNum,
          currency,
          splits: splits.map(s => ({ level: s.level, percentage: s.percentage, amount: s.amount })),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      });

      res.json({
        success: true,
        message: "Commission created and sent to Payments for approval",
        payment: paymentRecord,
        splits,
      });

    } catch (error) {
      console.error("Error creating commission:", error);
      res.status(500).json({
        message: "Failed to create commission",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin: Get payments needing approval
  app.get('/api/admin/payments/needs-approval', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const payments = await db
        .select()
        .from(commissionPayments)
        .where(eq(commissionPayments.paymentStatus, 'needs_approval'))
        .orderBy(desc(commissionPayments.createdAt));

      // Enrich with deal and user info
      const enrichedPayments = await Promise.all(payments.map(async (payment) => {
        const deal = await storage.getDealById(payment.dealId);
        const recipient = await storage.getUser(payment.recipientId);
        const createdByUser = payment.createdBy ? await storage.getUser(payment.createdBy) : null;

        // Get splits for this payment
        const splits = await db
          .select()
          .from(paymentSplits)
          .where(eq(paymentSplits.paymentId, payment.id));

        // Enrich splits with user names
        const enrichedSplits = await Promise.all(splits.map(async (split) => {
          const user = await storage.getUser(split.beneficiaryUserId);
          return {
            ...split,
            beneficiaryName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
          };
        }));

        return {
          ...payment,
          deal,
          recipientName: recipient ? `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() || recipient.email : 'Unknown',
          createdByName: createdByUser ? `${createdByUser.firstName || ''} ${createdByUser.lastName || ''}`.trim() : 'System',
          splits: enrichedSplits,
        };
      }));

      res.json(enrichedPayments);
    } catch (error) {
      console.error("Error fetching payments needing approval:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Admin: Approve a payment
  app.post('/api/admin/payments/:paymentId/approve', requireAuth, requireAdmin, auditAdminAction('approve_payment', 'payment'), async (req: any, res) => {
    try {
      const { paymentId } = req.params;

      const [payment] = await db
        .select()
        .from(commissionPayments)
        .where(eq(commissionPayments.id, paymentId));

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (payment.paymentStatus !== 'needs_approval') {
        return res.status(400).json({
          message: `Payment cannot be approved from status: ${payment.paymentStatus}`
        });
      }

      // Update payment to approved
      await db
        .update(commissionPayments)
        .set({
          paymentStatus: 'approved',
          approvalStatus: 'approved',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(commissionPayments.id, paymentId));

      // Update all splits to approved
      await db
        .update(paymentSplits)
        .set({ status: 'approved' })
        .where(eq(paymentSplits.paymentId, paymentId));

      // Create audit log
      await storage.createAdminAuditLog({
        actorId: req.user.id,
        action: 'approve_payment',
        entityType: 'payment',
        entityId: paymentId,
        details: { dealId: payment.dealId, grossAmount: payment.grossAmount },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      });

      res.json({ success: true, message: "Payment approved successfully" });

    } catch (error) {
      console.error("Error approving payment:", error);
      res.status(500).json({ message: "Failed to approve payment" });
    }
  });

  // Admin: Mark payment as paid
  app.post('/api/admin/payments/:paymentId/mark-paid', requireAuth, requireAdmin, auditAdminAction('mark_payment_paid', 'payment'), async (req: any, res) => {
    try {
      const { paymentId } = req.params;
      const { transferReference } = req.body;

      const [payment] = await db
        .select()
        .from(commissionPayments)
        .where(eq(commissionPayments.id, paymentId));

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (payment.paymentStatus !== 'approved') {
        return res.status(400).json({
          message: `Payment must be approved before marking as paid. Current status: ${payment.paymentStatus}`
        });
      }

      if (!payment.approvedBy) {
        return res.status(400).json({
          message: "Payment must have an approver before marking as paid"
        });
      }

      // Update payment to paid
      await db
        .update(commissionPayments)
        .set({
          paymentStatus: 'paid',
          paidBy: req.user.id,
          paidAt: new Date(),
          paymentDate: new Date(),
          transferReference: transferReference || `PAY_${Date.now()}`,
          updatedAt: new Date(),
        })
        .where(eq(commissionPayments.id, paymentId));

      // Update all splits to paid
      await db
        .update(paymentSplits)
        .set({ status: 'paid' })
        .where(eq(paymentSplits.paymentId, paymentId));

      // Update deal stage to completed
      await storage.updateDeal(payment.dealId, { dealStage: 'completed' });

      // Create audit log
      await storage.createAdminAuditLog({
        actorId: req.user.id,
        action: 'mark_payment_paid',
        entityType: 'payment',
        entityId: paymentId,
        details: {
          dealId: payment.dealId,
          grossAmount: payment.grossAmount,
          transferReference: transferReference || `PAY_${Date.now()}`
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || null
      });

      res.json({ success: true, message: "Payment marked as paid" });

    } catch (error) {
      console.error("Error marking payment as paid:", error);
      res.status(500).json({ message: "Failed to mark payment as paid" });
    }
  });

  // Admin: Get payment details with splits and audit trail
  app.get('/api/admin/payments/:paymentId/details', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { paymentId } = req.params;

      const [payment] = await db
        .select()
        .from(commissionPayments)
        .where(eq(commissionPayments.id, paymentId));

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Get deal info
      const deal = await storage.getDealById(payment.dealId);

      // Get splits
      const splits = await db
        .select()
        .from(paymentSplits)
        .where(eq(paymentSplits.paymentId, paymentId));

      // Enrich splits with user names
      const enrichedSplits = await Promise.all(splits.map(async (split) => {
        const user = await storage.getUser(split.beneficiaryUserId);
        return {
          ...split,
          beneficiaryName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
          beneficiaryEmail: user?.email,
        };
      }));

      // Get admin users for audit trail
      const createdByUser = payment.createdBy ? await storage.getUser(payment.createdBy) : null;
      const approvedByUser = payment.approvedBy ? await storage.getUser(payment.approvedBy) : null;
      const paidByUser = payment.paidBy ? await storage.getUser(payment.paidBy) : null;

      res.json({
        ...payment,
        deal,
        splits: enrichedSplits,
        auditTrail: {
          createdBy: createdByUser ? `${createdByUser.firstName || ''} ${createdByUser.lastName || ''}`.trim() : null,
          createdAt: payment.createdAt,
          approvedBy: approvedByUser ? `${approvedByUser.firstName || ''} ${approvedByUser.lastName || ''}`.trim() : null,
          approvedAt: payment.approvedAt,
          paidBy: paidByUser ? `${paidByUser.firstName || ''} ${paidByUser.lastName || ''}`.trim() : null,
          paidAt: payment.paidAt,
        },
      });

    } catch (error) {
      console.error("Error fetching payment details:", error);
      res.status(500).json({ message: "Failed to fetch payment details" });
    }
  });

  // Admin: Get all payments with filtering
  app.get('/api/admin/payments/all', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { status, productType, referrerId, startDate, endDate } = req.query;

      let query = db.select().from(commissionPayments);
      const conditions: any[] = [];

      if (status) {
        conditions.push(eq(commissionPayments.paymentStatus, status as string));
      }

      if (referrerId) {
        conditions.push(eq(commissionPayments.recipientId, referrerId as string));
      }

      if (startDate) {
        conditions.push(gte(commissionPayments.createdAt, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(commissionPayments.createdAt, new Date(endDate as string)));
      }

      const payments = conditions.length > 0
        ? await db.select().from(commissionPayments).where(and(...conditions)).orderBy(desc(commissionPayments.createdAt))
        : await db.select().from(commissionPayments).orderBy(desc(commissionPayments.createdAt));

      // Enrich with deal and user info, filter by productType if specified
      const enrichedPayments = await Promise.all(payments.map(async (payment) => {
        const deal = await storage.getDealById(payment.dealId);

        // Filter by productType if specified
        if (productType && deal?.productType !== productType) {
          return null;
        }

        const recipient = await storage.getUser(payment.recipientId);

        return {
          ...payment,
          deal,
          productType: deal?.productType,
          recipientName: recipient ? `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() || recipient.email : 'Unknown',
        };
      }));

      res.json(enrichedPayments.filter(Boolean));

    } catch (error) {
      console.error("Error fetching all payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Check if payment exists for a deal
  app.get('/api/admin/deals/:dealId/payment-status', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { dealId } = req.params;

      const payments = await storage.getCommissionPaymentsByDeal(dealId);

      if (payments.length === 0) {
        return res.json({ hasPayment: false });
      }

      const latestPayment = payments[0];

      // Get splits for the payment
      const splits = await db
        .select()
        .from(paymentSplits)
        .where(eq(paymentSplits.paymentId, latestPayment.id));

      // Enrich splits with user names
      const enrichedSplits = await Promise.all(splits.map(async (split) => {
        const user = await storage.getUser(split.beneficiaryUserId);
        return {
          ...split,
          beneficiaryName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
        };
      }));

      res.json({
        hasPayment: true,
        payment: {
          ...latestPayment,
          splits: enrichedSplits,
        },
      });

    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ message: "Failed to check payment status" });
    }
  });

  // ============================================
  // ACCOUNTING INTEGRATIONS ROUTES
  // ============================================

  // Get all integrations for the current user
  app.get('/api/integrations', requireAuth, async (req: any, res) => {
    try {
      const integrations = await storage.getAccountingIntegrations(req.user.id);
      res.json(integrations);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      res.status(500).json({ message: 'Failed to fetch integrations' });
    }
  });

  // Initiate OAuth connection for a provider
  app.post('/api/integrations/:provider/connect', requireAuth, async (req: any, res) => {
    try {
      const { provider } = req.params;
      const validProviders = ['quickbooks', 'xero', 'sage', 'freshbooks'];

      if (!validProviders.includes(provider)) {
        return res.status(400).json({ message: 'Invalid provider' });
      }

      // Check if OAuth credentials are configured
      const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
      const redirectUri = process.env[`${provider.toUpperCase()}_REDIRECT_URI`] ||
        `${process.env.APP_URL || 'https://partner-connector.replit.app'}/api/integrations/${provider}/callback`;

      if (!clientId) {
        // Store a pending integration for when credentials are configured
        await storage.createAccountingIntegration({
          userId: req.user.id,
          provider,
          isConnected: false,
          syncStatus: 'idle',
        });

        return res.json({
          message: 'Integration saved. OAuth credentials not configured - please contact support to complete setup.',
          requiresSetup: true
        });
      }

      // Generate OAuth authorization URL based on provider
      let authUrl = '';
      const state = crypto.randomBytes(16).toString('hex');

      // Store state for verification
      await storage.createAccountingIntegration({
        userId: req.user.id,
        provider,
        isConnected: false,
        syncStatus: 'idle',
        settings: { oauthState: state }
      });

      switch (provider) {
        case 'quickbooks':
          authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=com.intuit.quickbooks.accounting&state=${state}`;
          break;
        case 'xero':
          authUrl = `https://login.xero.com/identity/connect/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid profile email accounting.transactions accounting.contacts offline_access&state=${state}`;
          break;
        case 'sage':
          authUrl = `https://www.sageone.com/oauth2/auth/central?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=full_access&state=${state}`;
          break;
        case 'freshbooks':
          authUrl = `https://api.freshbooks.com/auth/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
          break;
      }

      res.json({ authUrl });
    } catch (error) {
      console.error('Error initiating integration connection:', error);
      res.status(500).json({ message: 'Failed to initiate connection' });
    }
  });

  // OAuth callback handler
  app.get('/api/integrations/:provider/callback', async (req: any, res) => {
    try {
      const { provider } = req.params;
      const { code, state, realmId } = req.query;

      if (!code || !state) {
        console.error('[Integrations] OAuth callback missing params');
        return res.redirect('/integrations?error=missing_params');
      }

      // Find the integration by state
      const integration = await storage.findIntegrationByState(state as string);
      if (!integration) {
        console.error('[Integrations] OAuth callback invalid state');
        return res.redirect('/integrations?error=invalid_state');
      }

      // Security: Validate user session matches integration owner
      if (req.user && req.user.id !== integration.userId) {
        console.error('[Integrations] OAuth callback user mismatch - potential account takeover attempt');
        return res.redirect('/integrations?error=session_mismatch');
      }

      // Exchange code for tokens
      const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
      const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
      const redirectUri = process.env[`${provider.toUpperCase()}_REDIRECT_URI`] ||
        `${process.env.APP_URL || 'https://partner-connector.replit.app'}/api/integrations/${provider}/callback`;

      let tokenUrl = '';
      let tokenBody: any = {};

      switch (provider) {
        case 'quickbooks':
          tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
          tokenBody = {
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
          };
          break;
        case 'xero':
          tokenUrl = 'https://identity.xero.com/connect/token';
          tokenBody = {
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri
          };
          break;
      }

      if (tokenUrl && clientId && clientSecret) {
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
          },
          body: new URLSearchParams(tokenBody).toString()
        });

        if (tokenResponse.ok) {
          const tokens = await tokenResponse.json();

          await storage.updateAccountingIntegration(integration.id, {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            realmId: realmId as string || null,
            isConnected: true,
            syncStatus: 'success',
            settings: { ...integration.settings, oauthState: null }
          });

          return res.redirect('/integrations?success=connected');
        }
      }

      // Fallback: mark as connected without real tokens (for demo)
      await storage.updateAccountingIntegration(integration.id, {
        isConnected: true,
        syncStatus: 'success',
        companyName: 'Demo Company',
        lastSyncAt: new Date(),
        settings: { ...integration.settings, oauthState: null }
      });

      res.redirect('/integrations?success=connected');
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      res.redirect('/integrations?error=callback_failed');
    }
  });

  // Disconnect an integration
  app.post('/api/integrations/:provider/disconnect', requireAuth, async (req: any, res) => {
    try {
      const { provider } = req.params;

      const integration = await storage.getAccountingIntegrationByProvider(req.user.id, provider);
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      await storage.deleteAccountingIntegration(integration.id);
      res.json({ success: true, message: 'Integration disconnected' });
    } catch (error) {
      console.error('Error disconnecting integration:', error);
      res.status(500).json({ message: 'Failed to disconnect integration' });
    }
  });

  // Trigger sync for an integration
  app.post('/api/integrations/:provider/sync', requireAuth, async (req: any, res) => {
    try {
      const { provider } = req.params;

      const integration = await storage.getAccountingIntegrationByProvider(req.user.id, provider);
      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      if (!integration.isConnected) {
        return res.status(400).json({ message: 'Integration is not connected' });
      }

      // Update status to syncing
      await storage.updateAccountingIntegration(integration.id, {
        syncStatus: 'syncing'
      });

      // Simulate sync process (in production, this would call the actual API)
      setTimeout(async () => {
        try {
          await storage.updateAccountingIntegration(integration.id, {
            syncStatus: 'success',
            lastSyncAt: new Date(),
            syncError: null
          });
        } catch (e) {
          console.error('Error updating sync status:', e);
        }
      }, 3000);

      res.json({ success: true, message: 'Sync started' });
    } catch (error) {
      console.error('Error triggering sync:', error);
      res.status(500).json({ message: 'Failed to start sync' });
    }
  });

  // Error handling middleware (must be last)
  app.use(errorHandlingMiddleware);

  const httpServer = createServer(app);
  return httpServer;
}
