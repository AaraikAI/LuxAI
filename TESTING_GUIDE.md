# LuxAI Designer - Complete Testing Guide
**Platform:** LuxAI Designer | **Version:** 5.0.0 | **Status:** 100% Complete

---

## 📋 TABLE OF CONTENTS

1. [Environment Setup](#1-environment-setup)
2. [Database Setup & Migrations](#2-database-setup--migrations)
3. [Backend Server Testing](#3-backend-server-testing)
4. [Frontend Testing](#4-frontend-testing)
5. [API Endpoint Testing](#5-api-endpoint-testing)
6. [Feature-Specific Testing](#6-feature-specific-testing)
7. [Integration Testing](#7-integration-testing)
8. [Performance Testing](#8-performance-testing)
9. [Security Testing](#9-security-testing)
10. [Production Deployment Testing](#10-production-deployment-testing)

---

## 1. ENVIRONMENT SETUP

### Step 1.1: Clone and Install Dependencies

```bash
# Navigate to project
cd /home/user/LuxAI

# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

**Expected Output:**
- Should show all packages installed without errors
- No missing dependencies
- No vulnerability warnings (or acceptable low severity)

---

### Step 1.2: Configure Environment Variables

```bash
# Copy example environment file
cd packages/backend
cp .env.example .env

# Edit .env file
nano .env
```

**Minimum Required Configuration:**
```env
# Server
NODE_ENV=development
PORT=3001
BASE_URL=http://localhost:3001

# Database (Supabase or local PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/luxai_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-refresh-token-secret-min-32-chars
REFRESH_TOKEN_EXPIRES_IN=7d

# Redis (Optional - for queues and caching)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:5173
```

**Optional API Keys (for full functionality):**
```env
# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Payment
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# KYC/AML
PERSONA_API_KEY=persona_...
ONFIDO_API_TOKEN=api_token...

# Aviation
AMALFI_API_KEY=amalfi_...

# GDS
SABRE_CLIENT_ID=...
SABRE_CLIENT_SECRET=...
SABRE_PCC=...

# DocuSign
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_ACCOUNT_ID=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Calendar OAuth (Optional)
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
OUTLOOK_CALENDAR_CLIENT_ID=...
OUTLOOK_CALENDAR_CLIENT_SECRET=...
```

---

### Step 1.3: Verify Node and npm Versions

```bash
# Check Node version (should be 18+)
node --version

# Check npm version (should be 9+)
npm --version

# Check TypeScript
npx tsc --version
```

**Expected:**
- Node: v18.x or higher
- npm: v9.x or higher
- TypeScript: v5.x

---

## 2. DATABASE SETUP & MIGRATIONS

### Step 2.1: Create Database

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL (if not installed)
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL
sudo service postgresql start

# Create database
sudo -u postgres psql
```

```sql
-- In PostgreSQL shell
CREATE DATABASE luxai_db;
CREATE USER luxai_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE luxai_db TO luxai_user;
\q
```

**Option B: Supabase (Recommended)**
1. Go to https://supabase.com
2. Create new project
3. Copy connection string
4. Update DATABASE_URL in .env

---

### Step 2.2: Run All Migrations

```bash
cd /home/user/LuxAI/packages/backend

# Method 1: Run all migrations at once
npm run db:migrate

# Method 2: Manual migration (if script doesn't exist)
psql $DATABASE_URL -f src/db/schema.sql
psql $DATABASE_URL -f src/db/migrations/008_saml_tables.sql
psql $DATABASE_URL -f src/db/migrations/009_notifications_tables.sql
psql $DATABASE_URL -f src/db/migrations/010_admin_tables.sql
psql $DATABASE_URL -f src/db/migrations/011_search_tables.sql
psql $DATABASE_URL -f src/db/migrations/012_reporting_tables.sql
psql $DATABASE_URL -f src/db/migrations/013_calendar_tables.sql
psql $DATABASE_URL -f src/db/migrations/014_messaging_tables.sql
psql $DATABASE_URL -f src/db/migrations/015_i18n_tables.sql
psql $DATABASE_URL -f src/db/migrations/016_vendor_advanced_tables.sql
psql $DATABASE_URL -f src/db/migrations/017_social_tables.sql
psql $DATABASE_URL -f src/db/migrations/018_cms_tables.sql
psql $DATABASE_URL -f src/db/migrations/019_gdpr_export_files.sql
```

---

### Step 2.3: Verify Database Tables

```bash
# Connect to database
psql $DATABASE_URL

# List all tables
\dt

# Expected: Should show 78+ tables
```

**Verify Core Tables:**
```sql
-- Check user table
SELECT COUNT(*) FROM users;

-- Check migrations
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected tables include:
-- users, clients, vendors, itineraries, deals, etc.
```

---

### Step 2.4: Seed Test Data (Optional)

```bash
# Create seed script if it doesn't exist
cd packages/backend

# Run seed
npm run db:seed

# OR manually seed
psql $DATABASE_URL -f src/db/seed.ts
```

**Manual Seed (Quick Test Data):**
```sql
-- Create test admin user
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'admin@luxai.com',
  '$2b$10$X9qvM7HKX7YvCXh3xKGkR.oY3h7u/k.KYW8x5Kp6L.vY9T4Q7X8Ha', -- Demo123!
  'Admin User',
  'admin',
  true
);

-- Create test client
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'client@luxai.com',
  '$2b$10$X9qvM7HKX7YvCXh3xKGkR.oY3h7u/k.KYW8x5Kp6L.vY9T4Q7X8Ha', -- Demo123!
  'Test Client',
  'client',
  true
);

-- Create test vendor
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'vendor@luxai.com',
  '$2b$10$X9qvM7HKX7YvCXh3xKGkR.oY3h7u/k.KYW8x5Kp6L.vY9T4Q7X8Ha', -- Demo123!
  'Test Vendor',
  'vendor',
  true
);

-- Verify
SELECT id, email, role FROM users;
```

---

## 3. BACKEND SERVER TESTING

### Step 3.1: Start Backend Server

```bash
cd /home/user/LuxAI

# Start backend in development mode
npm run dev --workspace=@luxai/backend

# OR
cd packages/backend
npm run dev
```

**Expected Output:**
```
> @luxai/backend@1.0.0 dev
> tsx watch src/index.ts

[INFO] Server starting...
[INFO] Database connected
[INFO] Redis connected (or skipped if not configured)
[INFO] Server listening on http://localhost:3001
```

---

### Step 3.2: Test Health Endpoint

```bash
# Test health check
curl http://localhost:3001/api/health

# Expected response:
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-11-14T...",
    "version": "1.0.0"
  }
}
```

---

### Step 3.3: Test Database Connection

```bash
# Create a test endpoint file (if not exists)
curl http://localhost:3001/api/health

# Check server logs for database connection
# Should see: "Database connected" or similar
```

---

### Step 3.4: Verify All Routes Loaded

```bash
# Check server startup logs
# Should see all 31 routes registered:
# - /api/auth
# - /api/two-factor
# - /api/itineraries
# - /api/kyc
# - /api/aviation
# ... (all 31 routes)
```

---

## 4. FRONTEND TESTING

### Step 4.1: Start Frontend Development Server

```bash
# Open new terminal
cd /home/user/LuxAI

# Start frontend
npm run dev --workspace=@luxai/web

# OR
cd packages/web
npm run dev
```

**Expected Output:**
```
VITE v5.x.x ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

### Step 4.2: Access Frontend

```bash
# Open browser to:
http://localhost:5173

# Should see:
# - LuxAI Designer landing page
# - Navigation menu
# - Login/Register buttons
```

---

### Step 4.3: Test Frontend Compilation

```bash
cd packages/web

# Build frontend
npm run build

# Expected: No TypeScript errors
# Output: dist/ folder with compiled assets
```

---

### Step 4.4: Verify Frontend Routes

**Test these URLs in browser:**
- `http://localhost:5173/` - Home page
- `http://localhost:5173/login` - Login page
- `http://localhost:5173/register` - Register page
- `http://localhost:5173/dashboard` - Dashboard (requires auth)

---

## 5. API ENDPOINT TESTING

### Step 5.1: Test Authentication Endpoints

**Register New User:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "full_name": "Test User",
    "role": "client"
  }'

# Expected:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "test@example.com",
      "role": "client"
    },
    "token": "jwt-token-here"
  }
}
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@luxai.com",
    "password": "Demo123!"
  }'

# Save the token from response
export JWT_TOKEN="your-jwt-token-here"
```

**Get Current User:**
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $JWT_TOKEN"

# Expected: User details
```

---

### Step 5.2: Test Protected Endpoints

**Create Itinerary:**
```bash
curl -X POST http://localhost:3001/api/itineraries \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Paris Vacation",
    "description": "A week in Paris",
    "startDate": "2025-12-01",
    "endDate": "2025-12-08",
    "destination": "Paris, France",
    "budget": 10000
  }'
```

**List Itineraries:**
```bash
curl http://localhost:3001/api/itineraries \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Step 5.3: Test All Major Endpoints

**Use this script to test all endpoints:**

```bash
#!/bin/bash
# save as test-endpoints.sh

BASE_URL="http://localhost:3001/api"
TOKEN="your-jwt-token"

echo "Testing LuxAI API Endpoints..."

# Health check
echo "1. Health Check"
curl -s $BASE_URL/health | jq

# Auth endpoints
echo "2. Get Current User"
curl -s $BASE_URL/auth/me -H "Authorization: Bearer $TOKEN" | jq

# Itineraries
echo "3. List Itineraries"
curl -s $BASE_URL/itineraries -H "Authorization: Bearer $TOKEN" | jq

# Vendors
echo "4. List Deals"
curl -s $BASE_URL/vendors/deals -H "Authorization: Bearer $TOKEN" | jq

# Forum
echo "5. List Forum Posts"
curl -s $BASE_URL/forum/posts | jq

# Notifications
echo "6. Get Notifications"
curl -s $BASE_URL/notifications -H "Authorization: Bearer $TOKEN" | jq

# Analytics
echo "7. Get Platform Analytics"
curl -s $BASE_URL/analytics/platform -H "Authorization: Bearer $TOKEN" | jq

# SAML Providers
echo "8. List SAML Providers"
curl -s $BASE_URL/saml/providers | jq

# i18n Languages
echo "9. List Languages"
curl -s $BASE_URL/i18n/languages | jq

# CMS Blog Posts
echo "10. List Blog Posts"
curl -s $BASE_URL/cms/blog | jq

echo "All tests completed!"
```

**Run the script:**
```bash
chmod +x test-endpoints.sh
./test-endpoints.sh
```

---

### Step 5.4: Test with Postman/Insomnia

**Import Collection:**

1. **Create Postman Collection** for all 240 endpoints
2. **Set Environment Variables:**
   - `base_url`: http://localhost:3001/api
   - `token`: {{jwt_token}}

3. **Test Categories:**
   - Authentication (5 endpoints)
   - Two-Factor (7 endpoints)
   - Itineraries (7 endpoints)
   - KYC (5 endpoints)
   - Aviation (7 endpoints)
   - Vendors (8 endpoints)
   - Payments (6 endpoints)
   - Vault (4 endpoints)
   - Forum (8 endpoints)
   - Analytics (4 endpoints)
   - Reports (7 endpoints)
   - GDPR (15 endpoints)
   - Security (7 endpoints)
   - Notifications (11 endpoints)
   - Admin (14 endpoints)
   - Search (7 endpoints)
   - Reporting (9 endpoints)
   - Calendar (7 endpoints)
   - Messaging (12 endpoints)
   - i18n (12 endpoints)
   - Vendor Advanced (11 endpoints)
   - Social (14 endpoints)
   - CMS (15 endpoints)
   - SAML (8 endpoints)
   - Queue (7 endpoints)

---

## 6. FEATURE-SPECIFIC TESTING

### Test 6.1: Two-Factor Authentication

**Setup 2FA:**
```bash
# 1. Get 2FA status
curl http://localhost:3001/api/two-factor/status \
  -H "Authorization: Bearer $JWT_TOKEN"

# 2. Setup 2FA
curl -X POST http://localhost:3001/api/two-factor/setup \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response includes:
# - secret (for manual entry)
# - qrCode (data URL for scanning)
# - backupCodes (8 codes)

# 3. Enable 2FA with TOTP code
curl -X POST http://localhost:3001/api/two-factor/enable \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'

# 4. Test login with 2FA
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "twoFactorToken": "123456"
  }'
```

---

### Test 6.2: GDPR Compliance

**Request Data Export:**
```bash
curl -X POST http://localhost:3001/api/gdpr/data-export \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Testing data export"
  }'

# Save requestId from response
export REQUEST_ID="uuid-here"

# Check status
curl http://localhost:3001/api/gdpr/data-export/$REQUEST_ID \
  -H "Authorization: Bearer $JWT_TOKEN"

# When status is 'completed', download export
curl http://localhost:3001/api/gdpr/download/$REQUEST_ID \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -o my-data-export.json
```

---

### Test 6.3: PDF Report Generation

```bash
# Create itinerary first
curl -X POST http://localhost:3001/api/itineraries \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Trip",
    "startDate": "2025-12-01",
    "endDate": "2025-12-08"
  }'

# Get itinerary ID from response
export ITINERARY_ID="uuid-here"

# Generate PDF
curl http://localhost:3001/api/reports/itinerary/$ITINERARY_ID/pdf \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -o itinerary-report.pdf

# Open PDF to verify
xdg-open itinerary-report.pdf  # Linux
# or
open itinerary-report.pdf       # macOS
```

---

### Test 6.4: Notifications System

**Send Test Notification:**
```bash
curl -X POST http://localhost:3001/api/notifications/test \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "info",
    "title": "Test Notification",
    "message": "This is a test notification"
  }'

# List notifications
curl http://localhost:3001/api/notifications \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get unread count
curl http://localhost:3001/api/notifications/unread-count \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Test 6.5: Real-time Messaging

**Create Conversation:**
```bash
# Create direct conversation
curl -X POST http://localhost:3001/api/messaging/conversations \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "direct",
    "participantIds": ["other-user-id"]
  }'

# Save conversation ID
export CONV_ID="uuid-here"

# Send message
curl -X POST http://localhost:3001/api/messaging/conversations/$CONV_ID/messages \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello! This is a test message."
  }'

# Get messages
curl http://localhost:3001/api/messaging/conversations/$CONV_ID/messages \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Test 6.6: Multi-language (i18n)

```bash
# List available languages
curl http://localhost:3001/api/i18n/languages

# Get English translations
curl http://localhost:3001/api/i18n/translations/en

# Get Spanish translations
curl http://localhost:3001/api/i18n/translations/es

# Set user language preference
curl -X PUT http://localhost:3001/api/i18n/user/language \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "languageCode": "es",
    "timezone": "Europe/Madrid"
  }'
```

---

### Test 6.7: Advanced Search

```bash
# Global search
curl -X POST http://localhost:3001/api/search/global \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "paris",
    "filters": {
      "entityTypes": ["itineraries", "deals"],
      "dateFrom": "2025-01-01",
      "dateTo": "2025-12-31"
    }
  }'

# Save search
curl -X POST http://localhost:3001/api/search/save \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paris Trips",
    "filters": {
      "query": "paris",
      "entityTypes": ["itineraries"]
    }
  }'

# View saved searches
curl http://localhost:3001/api/search/saved \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Test 6.8: Analytics Dashboard

```bash
# Get platform analytics (admin only)
curl http://localhost:3001/api/analytics/platform \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected metrics:
# - Total users
# - Active users
# - Total revenue
# - User growth %
# - Revenue growth %
# - Average itinerary value
# - Conversion rate
# - Top destinations
# - Top vendors

# Get user analytics
curl http://localhost:3001/api/analytics/user/$USER_ID \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get time series data
curl "http://localhost:3001/api/analytics/timeseries?metric=revenue&startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Test 6.9: Social Features

```bash
# Update profile
curl -X PUT http://localhost:3001/api/social/profile \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "John Traveler",
    "bio": "Luxury travel enthusiast",
    "visibility": "public"
  }'

# Follow user
curl -X POST http://localhost:3001/api/social/follow/$OTHER_USER_ID \
  -H "Authorization: Bearer $JWT_TOKEN"

# Create post
curl -X POST http://localhost:3001/api/social/posts \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Just booked an amazing trip to Bali!",
    "post_type": "text",
    "visibility": "public"
  }'

# Get activity feed
curl http://localhost:3001/api/social/feed \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Test 6.10: CMS Features

```bash
# List blog posts
curl http://localhost:3001/api/cms/blog

# Get specific blog post
curl http://localhost:3001/api/cms/blog/welcome-to-luxai

# Search help articles
curl "http://localhost:3001/api/cms/help/search?q=booking"

# List FAQs
curl http://localhost:3001/api/cms/faq

# Search FAQs
curl "http://localhost:3001/api/cms/faq/search?q=payment"
```

---

## 7. INTEGRATION TESTING

### Test 7.1: End-to-End User Journey

**Complete User Flow:**
```bash
#!/bin/bash
# E2E Test: User Registration → Login → Create Itinerary → Get Report

echo "=== E2E Test: Complete User Journey ==="

# 1. Register
echo "1. Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "e2e-test@example.com",
    "password": "Test123!",
    "full_name": "E2E Test User",
    "role": "client"
  }')

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
USER_ID=$(echo $REGISTER_RESPONSE | jq -r '.data.user.id')
echo "✓ User registered. ID: $USER_ID"

# 2. Create Itinerary
echo "2. Creating itinerary..."
ITINERARY_RESPONSE=$(curl -s -X POST http://localhost:3001/api/itineraries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "E2E Test Trip to Tokyo",
    "description": "Testing itinerary creation",
    "startDate": "2025-12-01",
    "endDate": "2025-12-08",
    "destination": "Tokyo, Japan",
    "budget": 15000
  }')

ITINERARY_ID=$(echo $ITINERARY_RESPONSE | jq -r '.data.id')
echo "✓ Itinerary created. ID: $ITINERARY_ID"

# 3. Submit for Approval
echo "3. Submitting for approval..."
curl -s -X POST http://localhost:3001/api/itineraries/$ITINERARY_ID/submit-for-approval \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "✓ Submitted for approval"

# 4. Generate PDF Report
echo "4. Generating PDF report..."
curl -s http://localhost:3001/api/reports/itinerary/$ITINERARY_ID/pdf \
  -H "Authorization: Bearer $TOKEN" \
  -o e2e-test-report.pdf
echo "✓ PDF report generated: e2e-test-report.pdf"

# 5. Create Notification
echo "5. Sending test notification..."
curl -s -X POST http://localhost:3001/api/notifications/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "success",
    "title": "E2E Test Complete",
    "message": "All steps completed successfully!"
  }' > /dev/null
echo "✓ Notification sent"

# 6. Get User Analytics
echo "6. Getting user analytics..."
curl -s http://localhost:3001/api/analytics/user/$USER_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
echo "✓ Analytics retrieved"

echo ""
echo "=== E2E Test Complete! ==="
echo "Summary:"
echo "- User ID: $USER_ID"
echo "- Itinerary ID: $ITINERARY_ID"
echo "- PDF Report: e2e-test-report.pdf"
```

---

### Test 7.2: Queue Processing

**Test Email Queue:**
```bash
# Check queue stats
curl http://localhost:3001/api/queue/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# View active jobs
curl http://localhost:3001/api/queue/active \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Trigger email (register new user)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "queue-test@example.com",
    "password": "Test123!",
    "full_name": "Queue Test",
    "role": "client"
  }'

# Check queue stats again
curl http://localhost:3001/api/queue/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### Test 7.3: Redis Caching

```bash
# Test caching (if Redis configured)
# First request (cache miss)
time curl http://localhost:3001/api/analytics/platform \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Second request (cache hit - should be faster)
time curl http://localhost:3001/api/analytics/platform \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 8. PERFORMANCE TESTING

### Test 8.1: Load Testing with Apache Bench

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test health endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:3001/api/health

# Test authenticated endpoint
ab -n 100 -c 10 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3001/api/itineraries
```

---

### Test 8.2: Load Testing with k6

```bash
# Install k6
sudo snap install k6

# Create load test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10, // 10 virtual users
  duration: '30s',
};

export default function() {
  let response = http.get('http://localhost:3001/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
EOF

# Run load test
k6 run load-test.js
```

---

### Test 8.3: Database Query Performance

```sql
-- Connect to database
psql $DATABASE_URL

-- Enable query timing
\timing

-- Test queries
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM itineraries;
SELECT COUNT(*) FROM notifications;

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

---

## 9. SECURITY TESTING

### Test 9.1: Authentication Security

```bash
# Test invalid credentials
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@luxai.com",
    "password": "WrongPassword"
  }'

# Expected: 401 Unauthorized

# Test missing token
curl http://localhost:3001/api/itineraries

# Expected: 401 Unauthorized

# Test invalid token
curl http://localhost:3001/api/itineraries \
  -H "Authorization: Bearer invalid-token"

# Expected: 401 Unauthorized

# Test expired token
curl http://localhost:3001/api/itineraries \
  -H "Authorization: Bearer expired-token-here"

# Expected: 401 Unauthorized
```

---

### Test 9.2: Authorization (Role-Based Access)

```bash
# Try to access admin endpoint with client token
curl http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# Expected: 403 Forbidden

# Try to access with admin token
curl http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK with user list
```

---

### Test 9.3: SQL Injection Protection

```bash
# Try SQL injection in search
curl -X POST http://localhost:3001/api/search/global \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "paris OR 1=1 --"
  }'

# Expected: Should be sanitized, no error

# Try SQL injection in login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@luxai.com'\'' OR '\''1'\''='\''1",
    "password": "anything"
  }'

# Expected: 401 Unauthorized (not SQL error)
```

---

### Test 9.4: CORS Policy

```bash
# Test CORS from different origin
curl -H "Origin: http://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS http://localhost:3001/api/auth/login

# Should reject if origin not in CORS_ORIGIN
```

---

## 10. PRODUCTION DEPLOYMENT TESTING

### Test 10.1: Build for Production

```bash
# Build backend
cd packages/backend
npm run build

# Verify build output
ls -la dist/

# Build frontend
cd ../web
npm run build

# Verify build output
ls -la dist/
```

---

### Test 10.2: Production Environment Variables

```bash
# Create production .env
cat > .env.production << EOF
NODE_ENV=production
PORT=3001
BASE_URL=https://api.yourdomain.com
DATABASE_URL=postgresql://user:pass@prod-db:5432/luxai
REDIS_URL=redis://prod-redis:6379
JWT_SECRET=$(openssl rand -base64 32)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)
# ... other production values
EOF
```

---

### Test 10.3: Docker Testing (if applicable)

```bash
# Build Docker image
docker build -t luxai-backend -f packages/backend/Dockerfile .

# Run container
docker run -p 3001:3001 \
  --env-file packages/backend/.env.production \
  luxai-backend

# Test health endpoint
curl http://localhost:3001/api/health
```

---

### Test 10.4: SSL/TLS Testing

```bash
# Test HTTPS (if deployed)
curl https://api.yourdomain.com/api/health

# Check SSL certificate
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com

# Test SSL Labs
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.yourdomain.com
```

---

## 🎯 TESTING CHECKLIST

### Pre-Deployment Checklist
- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] Database created and migrated
- [ ] Backend server starts without errors
- [ ] Frontend compiles without errors
- [ ] Health endpoint returns 200
- [ ] Can register new user
- [ ] Can login with credentials
- [ ] JWT tokens work correctly
- [ ] Protected routes require authentication
- [ ] Role-based access control works
- [ ] All 240 endpoints tested
- [ ] PDF generation works
- [ ] Email queue processes jobs
- [ ] GDPR export/deletion works
- [ ] Notifications send correctly
- [ ] Search returns results
- [ ] Analytics calculate correctly
- [ ] Social features work
- [ ] CMS content displays
- [ ] i18n translations load
- [ ] No console errors in browser
- [ ] No server errors in logs
- [ ] Database queries performant
- [ ] Redis caching works (if enabled)
- [ ] Load testing passed
- [ ] Security tests passed
- [ ] Production build succeeds

---

## 📊 EXPECTED RESULTS SUMMARY

### Backend
- **Server Start:** < 5 seconds
- **Health Check:** < 50ms
- **Database Query:** < 100ms average
- **API Response:** < 200ms average
- **PDF Generation:** < 2 seconds

### Frontend
- **Build Time:** < 30 seconds
- **Page Load:** < 2 seconds
- **Time to Interactive:** < 3 seconds

### Performance
- **Concurrent Users:** 100+ without degradation
- **Requests/Second:** 500+
- **Database Connections:** Pooled correctly
- **Memory Usage:** < 512MB idle, < 1GB under load

---

## 🐛 TROUBLESHOOTING

### Server Won't Start
```bash
# Check port not in use
lsof -i :3001

# Kill process if needed
kill -9 <PID>

# Check logs
tail -f logs/error.log
```

### Database Connection Failed
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check database exists
psql $DATABASE_URL -c "\l"

# Verify migrations
psql $DATABASE_URL -c "\dt"
```

### API Returns 500 Error
```bash
# Check server logs
tail -f logs/error.log

# Check database logs
# Check for specific error message

# Enable debug mode
DEBUG=* npm run dev
```

---

**Testing Complete!** 🎉

This guide covers all aspects of testing the LuxAI Designer application. Follow the steps in order for comprehensive testing, or jump to specific sections as needed.

**Last Updated:** November 14, 2025
**Version:** 5.0.0
