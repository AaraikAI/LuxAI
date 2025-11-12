import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://luxai:password@localhost:5432/luxai_dev',
    maxConnections: 20,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // OIDC
  oidc: {
    issuer: process.env.OIDC_ISSUER || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  },

  // AI Services
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  // Payment
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  // KYC/AML
  kyc: {
    personaApiKey: process.env.PERSONA_API_KEY || '',
    onfidoApiKey: process.env.ONFIDO_API_KEY || '',
  },

  // Amalfi Jets
  amalfi: {
    apiKey: process.env.AMALFI_API_KEY || '',
    apiUrl: process.env.AMALFI_API_URL || 'https://api.amalfi.example.com',
  },

  // Sabre GDS
  sabre: {
    apiKey: process.env.SABRE_API_KEY || '',
    apiSecret: process.env.SABRE_API_SECRET || '',
  },

  // AWS
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'luxai-documents',
  },

  // Observability
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },

  datadog: {
    apiKey: process.env.DATADOG_API_KEY || '',
  },

  // Email
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@luxai.example.com',
  },

  // Push Notifications
  push: {
    oneSignalApiKey: process.env.ONESIGNAL_API_KEY || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  // URLs
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  webUrl: process.env.WEB_URL || 'http://localhost:5173',

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
};
