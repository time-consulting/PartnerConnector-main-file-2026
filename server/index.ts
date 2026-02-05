import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initSentry, getSentryHandlers } from "./sentry";
import { wsManager } from "./websocket";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/schema";

// Initialize Sentry before everything else
initSentry();

const app = express();

// Sentry request handler must be first
const sentryHandlers = getSentryHandlers();
app.use(sentryHandlers.requestHandler);
app.use(sentryHandlers.tracingHandler);

// Enable compression for all responses
app.use(compression({
  // Compression level (0-9): 6 provides good balance of speed vs compression ratio
  level: 6,
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Filter function to exclude already compressed formats and small responses
  filter: (req: Request, res: Response) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Only compress if content type indicates text-based content
    const contentType = res.getHeader('content-type') as string;
    if (contentType) {
      // Skip already compressed formats
      if (contentType.includes('image/') || 
          contentType.includes('video/') ||
          contentType.includes('audio/') ||
          contentType.includes('application/pdf') ||
          contentType.includes('application/zip')) {
        return false;
      }
    }
    
    // Use compression for text-based content
    return compression.filter(req, res);
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- ADD THIS BLOCK HERE ---
import session from "express-session";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,          // behind Railway HTTPS
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);
// --- END OF BLOCK ---

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Sentry error handler must be before your other error handlers and after all controllers
  app.use(sentryHandlers.errorHandler);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    
    // Log the error but don't throw it again to prevent headers conflict
    console.error('Application error:', err);
  });

  // Add caching middleware for static assets before serving them
  app.use((req, res, next) => {
    const url = req.url;
    const ext = url.split('.').pop()?.toLowerCase();
    const filename = url.split('/').pop() || '';
    
    // Only apply to static assets (not API routes)
    if (!url.startsWith('/api')) {
      // Check if file has hash in name (typical Vite pattern: filename-hash.ext)
      const hasHash = /\.[a-f0-9]{8,}\./i.test(filename) || /\-[a-f0-9]{8,}\./i.test(filename);
      
      if (hasHash) {
        // Hashed assets - can be cached for 1 year since content changes = new hash
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (ext === 'html' || url === '/' || !ext) {
        // HTML files and routes - short cache to ensure updates are seen quickly
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      } else if (['js', 'css', 'json'].includes(ext || '')) {
        // Non-hashed JS/CSS - moderate cache with revalidation
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
      } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'avif'].includes(ext || '')) {
        // Images - can be cached longer as they change less frequently
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
      } else if (['woff', 'woff2', 'ttf', 'eot'].includes(ext || '')) {
        // Fonts - can be cached for long periods
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
      } else if (ext) {
        // Default caching for other static assets
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
      }
    }
    
    next();
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Initialize WebSocket server with the HTTP server
  wsManager.initialize(server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
