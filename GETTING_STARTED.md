# Getting Started with LuxAI Designer

Your LuxAI Designer application is now fully configured with Supabase! Follow these steps to start developing.

## ✅ What's Already Done

- ✅ Monorepo structure with npm workspaces
- ✅ Backend API with Express.js and TypeScript
- ✅ Frontend React application with Vite
- ✅ Supabase PostgreSQL database configured
- ✅ All 24 database tables created
- ✅ Sprint 1, 2, and 3 features implemented
- ✅ Authentication system with JWT
- ✅ SSL configuration for Supabase

## 🚀 Quick Start

### 1. Run Health Check

First, verify your database connection:

```bash
npm run db:health --workspace=@luxai/backend
```

**Expected output:**
```
📋 Health Check Results:

1. Database Connection...
   ✅ Connected to PostgreSQL
   ✅ Server time: 2025-11-13...
   ✅ PostgreSQL version: PostgreSQL 15.x

2. Database Schema...
   ✅ All 24 tables present

3. PostgreSQL Extensions...
   ✅ uuid-ossp extension enabled
   ✅ pgcrypto extension enabled

4. Sample Queries...
   ✅ Users table: 0 records
   ✅ Itineraries table: 0 records
   ✅ Vendors table: 0 records

5. Connection Pool...
   ✅ Max connections: 20
   ✅ Idle timeout: 30000ms
   ✅ Connection timeout: 2000ms

✅ All health checks passed!
🚀 Your LuxAI Designer backend is ready to use.
```

### 2. Start the Application

Start both backend and frontend servers:

```bash
npm run dev
```

This will start:
- **Backend**: http://localhost:3000
- **Frontend**: http://localhost:5173

### 3. Verify Services

Open your browser and navigate to:

- **Frontend**: http://localhost:5173
- **Backend Health**: http://localhost:3000/api/health

**Expected backend response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-11-13T...",
    "version": "1.0.0"
  }
}
```

## 📋 Database Tables

Your Supabase database now contains:

### Core Tables (7)
1. **users** - User accounts with role-based access
2. **clients** - Client profiles with preferences
3. **agencies** - Travel agencies
4. **designers** - Travel designers
5. **vendors** - Service vendors
6. **itineraries** - Travel itineraries
7. **line_items** - Itinerary line items

### Travel Components (5)
8. **destinations** - Destination information
9. **accommodations** - Hotels, villas, etc.
10. **transportation** - Ground transportation
11. **activities** - Experiences and activities
12. **aircraft** - Private jets

### Aviation & Services (3)
13. **empty_legs** - Empty leg flights
14. **quotes** - Service quotes
15. **deals** - Marketplace deals

### Workflow & Compliance (3)
16. **approvals** - Approval workflows
17. **documents** - Document management
18. **ratings** - Reviews and ratings

### Payments & Analytics (3)
19. **payment_intents** - Payment processing
20. **live_update_activities** - Real-time updates
21. **webhook_events** - Webhook logs

### Community & Admin (3)
22. **forum_posts** - Community posts
23. **forum_replies** - Post replies
24. **audit_logs** - System audit trail

## 🔧 Development Commands

### Database Commands
```bash
# Run migrations
npm run db:migrate --workspace=@luxai/backend

# Verify tables
npm run db:verify --workspace=@luxai/backend

# Health check
npm run db:health --workspace=@luxai/backend

# Seed data (coming soon)
npm run db:seed --workspace=@luxai/backend
```

### Application Commands
```bash
# Start development servers
npm run dev

# Start backend only
npm run dev --workspace=@luxai/backend

# Start frontend only
npm run dev --workspace=@luxai/web

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## 🌟 Implemented Features

### Sprint 1: Foundation & Compliance
- ✅ KYC/AML verification (Persona/Onfido integration)
- ✅ Private aviation booking (Amalfi Jets integration)
- ✅ Multi-level approval workflows
- ✅ Role-based access control

### Sprint 2: Vendor & Operations
- ✅ Vendor onboarding & management
- ✅ Stripe Connect payment processing
- ✅ Carbon footprint tracking & offset purchasing
- ✅ iOS/Android live activity updates
- ✅ DocuSign e-signature integration

### Sprint 3: Marketplace & Analytics
- ✅ Vault off-market marketplace
- ✅ Sabre GDS flight/hotel booking
- ✅ UHNW community forum
- ✅ Advanced analytics dashboard
- ✅ Multi-format reporting & exports

## 🎯 Next Steps

### 1. Create Your First User

```bash
# Use the registration page at http://localhost:5173/register
# Or use the API directly:

curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@luxai.com",
    "password": "YourSecurePassword123!",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }'
```

### 2. Configure API Keys

Update your `.env` file with real API keys for:

```bash
# AI Services
OPENAI_API_KEY=sk-your-actual-openai-key
ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key

# Payment Processing
STRIPE_SECRET_KEY=sk_live_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# KYC/AML
PERSONA_API_KEY=your-persona-key
ONFIDO_API_KEY=your-onfido-key

# Aviation
AMALFI_API_KEY=your-amalfi-key

# GDS
SABRE_API_KEY=your-sabre-key
SABRE_API_SECRET=your-sabre-secret
```

### 3. Set Up Redis (Optional)

Redis is used for caching. If you want to enable it:

```bash
# Install Redis locally (Mac)
brew install redis
brew services start redis

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or use a cloud provider (Upstash, Redis Cloud, etc.)
```

### 4. Configure Environment Variables

Review and update all environment variables in `.env`:
- JWT secret (change from default)
- API URLs for production
- Third-party API credentials

### 5. Explore the Application

- **Dashboard**: View overview and stats
- **Itineraries**: Create AI-generated travel plans
- **Private Aviation**: Book private jets
- **Vault**: Browse exclusive off-market deals
- **Forum**: Connect with UHNW community
- **Analytics**: Track performance metrics
- **Reports**: Export and share itineraries

## 🛠 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is already in use
lsof -i :3000

# Check database connection
npm run db:health --workspace=@luxai/backend

# View logs
npm run dev --workspace=@luxai/backend
```

### Frontend won't start
```bash
# Check if port 5173 is already in use
lsof -i :5173

# Clear cache and reinstall
rm -rf node_modules
npm install
```

### Database connection issues
```bash
# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection with psql
psql "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Check Supabase dashboard for database status
```

### Build errors
```bash
# Rebuild shared package
npm run build --workspace=@luxai/shared

# Clear build artifacts
rm -rf packages/*/dist
npm run build
```

## 📚 Documentation

- [Supabase Setup Guide](./SUPABASE_SETUP.md)
- [API Documentation](./API_DOCS.md) (coming soon)
- [Architecture Overview](./ARCHITECTURE.md) (coming soon)
- [Deployment Guide](./DEPLOYMENT.md) (coming soon)

## 🔐 Security Notes

### Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong random value
- [ ] Enable SSL/HTTPS for all endpoints
- [ ] Set up proper CORS policies
- [ ] Configure rate limiting
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Set up monitoring and alerting
- [ ] Configure proper backup strategy
- [ ] Review and update API key permissions
- [ ] Enable audit logging
- [ ] Set up WAF (Web Application Firewall)

### Environment Variables

**NEVER commit `.env` files to git!** They contain sensitive credentials.

To share configuration:
1. Update `.env.example` with variable names (no values)
2. Share actual values through secure channels (1Password, etc.)
3. Use separate credentials for dev/staging/production

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase dashboard logs
3. Check application logs in terminal
4. Verify all dependencies are installed

## 🎉 You're Ready!

Your LuxAI Designer application is fully configured and ready for development. Start building amazing luxury travel experiences!

```bash
npm run dev
```

Then open http://localhost:5173 and start exploring! 🚀
