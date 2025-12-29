const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { globalErrorHandler, notFound } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const organizationRoutes = require("./routes/organizations");
const templateRoutes = require("./routes/templates");
const campaignRoutes = require("./routes/campaigns");
const audienceRoutes = require("./routes/audience");
const assetGenerateFilesRoutes = require("./routes/assetGenerateFiles");
const adminRoutes = require("./routes/admin");
const dashboardRoutes = require("./routes/dashboard");
const conversationRoutes = require("./routes/conversations");

// Create Express app
const app = express();

// Trust proxy (important for rate limiting and IP detection)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/audience", audienceRoutes);
app.use("/api/asset-files", assetGenerateFilesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/conversations", conversationRoutes);

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp Business API Server",
    version: "1.0.0",
    endpoints: {
      auth: {
        "POST /api/auth/login": "User login",
        "POST /api/auth/refresh": "Refresh access token",
        "POST /api/auth/logout": "User logout",
        "POST /api/auth/logout-all": "Logout from all devices",
        "GET /api/auth/profile": "Get user profile",
        "POST /api/auth/change-password": "Change password",
        "POST /api/auth/validate": "Validate token",
      },
      users: {
        "GET /api/users": "Get all users",
        "GET /api/users/:id": "Get user by ID",
        "POST /api/users": "Create new user",
        "PUT /api/users/:id": "Update user",
        "DELETE /api/users/:id": "Delete user",
      },
      organizations: {
        "GET /api/organizations": "Get all organizations",
        "GET /api/organizations/:id": "Get organization by ID",
        "POST /api/organizations": "Create new organization",
        "PUT /api/organizations/:id": "Update organization",
        "DELETE /api/organizations/:id": "Delete organization",
        "GET /api/organizations/:id/users": "Get organization users",
        "PUT /api/organizations/:id/whatsapp-config": "Update WhatsApp config",
        "GET /api/organizations/:id/whatsapp-config": "Get WhatsApp config",
      },
      templates: {
        "GET /api/templates/pending-approval": "Get pending approval templates",
        "GET /api/templates/pending-admin-approval":
          "Get pending admin approval templates",
        "GET /api/templates/organization/:id": "Get organization templates",
        "GET /api/templates/organization/:id/auto-reply":
          "Get auto reply templates",
        "POST /api/templates/organization/:id": "Create new template",
        "GET /api/templates/:id": "Get template by ID",
        "PUT /api/templates/:id": "Update template",
        "DELETE /api/templates/:id": "Delete template",
        "POST /api/templates/:id/submit-approval": "Submit for approval",
        "POST /api/templates/:id/approve": "Approve template",
        "POST /api/templates/:id/reject": "Reject template",
        "POST /api/templates/:id/admin-approve":
          "Admin approve with auto reply flag",
        "POST /api/templates/:id/admin-reject": "Admin reject template",
        "PUT /api/templates/:id/parameters": "Update template parameters",
        "PUT /api/templates/:id/auto-reply-status": "Update auto reply status",
        "POST /api/templates/organization/:id/sync-whatsapp":
          "Sync from WhatsApp API",
      },
      campaigns: {
        "GET /api/campaigns/pending-approval": "Get pending approval campaigns",
        "GET /api/campaigns/organization/:id": "Get organization campaigns",
        "POST /api/campaigns/organization/:id": "Create campaign",
        "GET /api/campaigns/organization/:id/stats": "Get campaign statistics",
        "GET /api/campaigns/:id": "Get campaign by ID",
        "PUT /api/campaigns/:id": "Update campaign",
        "DELETE /api/campaigns/:id": "Delete campaign",
        "POST /api/campaigns/:id/submit-approval": "Submit for approval",
        "POST /api/campaigns/:id/approve": "Approve campaign",
        "POST /api/campaigns/:id/reject": "Reject campaign",
        "POST /api/campaigns/:id/start": "Start campaign",
        "POST /api/campaigns/:id/pause": "Pause campaign",
        "POST /api/campaigns/:id/cancel": "Cancel campaign",
        "GET /api/campaigns/:id/audience?include_replies=true":
          "Get campaign audience with reply messages",
        "POST /api/campaigns/:id/audience": "Add audience to campaign",
        "DELETE /api/campaigns/:id/audience": "Remove audience from campaign",
        "PUT /api/campaigns/audience/:id/status": "Update message status",
      },
      audience: {
        "GET /api/audience/organization/:id": "Get master audience",
        "POST /api/audience/organization/:id": "Create audience record",
        "POST /api/audience/organization/:id/bulk": "Bulk create audience",
      },
      "asset-files": {
        "GET /api/asset-files/organization/:id": "Get organization asset files",
        "GET /api/asset-files/template/:id": "Get template asset files",
        "POST /api/asset-files/template/:id": "Create asset file",
        "POST /api/asset-files/template/:id/version":
          "Create asset file version",
        "GET /api/asset-files/template/:id/versions/:fileName":
          "Get file versions",
        "PUT /api/asset-files/:id": "Update asset file",
        "DELETE /api/asset-files/:id": "Deactivate asset file",
      },
      admin: {
        "GET /api/admin/pending-approvals":
          "Get all pending approvals (templates and campaigns)",
      },
      dashboard: {
        "GET /api/dashboard/overview": "Get dashboard overview (role-based)",
        "GET /api/dashboard/stats": "Get dashboard statistics (role-based)",
        "GET /api/dashboard/activities": "Get recent activities (role-based)",
      },
    },
  });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`, {
    environment: process.env.NODE_ENV,
    port: PORT,
  });

  // Start background job processor
  const backgroundJobProcessor = require("./services/backgroundJobProcessor");
  backgroundJobProcessor.start();

  console.log(`
🚀 WhatsApp Business API Server is running!
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV}
📚 API Documentation: http://localhost:${PORT}/api
❤️  Health Check: http://localhost:${PORT}/health
🔄 Background Jobs: Campaign processing enabled

🔐 Default Super Admin Credentials:
📧 Email: ${process.env.DEFAULT_SUPER_ADMIN_EMAIL || "superadmin@example.com"}
🔑 Password: ${process.env.DEFAULT_SUPER_ADMIN_PASSWORD || "SuperAdmin123!"}

⚠️  Remember to:
1. Initialize the database: npm run db:init
2. Change default admin password after first login
3. Configure your PostgreSQL database settings in .env
4. Configure AWS SQS settings for message processing
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection:", {
    error: err.message,
    stack: err.stack,
  });
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
