import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    referralCode?: string;
    impersonatedUserId?: string;
    realAdminId?: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

// Middleware to require authentication
export const requireAuth: RequestHandler = async (req: any, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Fetch user from storage and attach to request
  try {
    const { storage } = await import('./storage');

    // Check if admin is impersonating another user
    if (req.session.impersonatedUserId && req.session.realAdminId) {
      // Verify the real user is an admin
      const realAdmin = await storage.getUser(req.session.realAdminId);
      if (!realAdmin || !realAdmin.isAdmin) {
        // Invalid impersonation session, clear it
        delete req.session.impersonatedUserId;
        delete req.session.realAdminId;
      } else {
        // Return impersonated user data
        const impersonatedUser = await storage.getUser(req.session.impersonatedUserId);
        if (impersonatedUser) {
          req.user = impersonatedUser;
          req.realAdmin = realAdmin;
          req.isImpersonating = true;
          return next();
        }
      }
    }

    // Normal authentication flow
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    req.isImpersonating = false;
    next();
  } catch (error) {
    console.error('[requireAuth] Error fetching user:', error);
    return res.status(500).json({ message: "Authentication error" });
  }
};

// Helper to get current user ID from session
export function getCurrentUserId(req: any): string | undefined {
  return req.session?.userId;
}
