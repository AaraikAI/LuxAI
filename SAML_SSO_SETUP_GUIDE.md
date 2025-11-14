# SAML/SSO Setup Guide - Step-by-Step Instructions
**Platform:** LuxAI Designer | **Status:** Code Complete ✅ | **Package Installed:** ✅

---

## 📋 OVERVIEW

The SAML/SSO integration is **100% code complete** and the required npm package has been **successfully installed**. This guide provides step-by-step instructions to configure and use SAML Single Sign-On with various identity providers.

### What's Already Done ✅
- ✅ Package installed: `@node-saml/passport-saml ^4.0.4`
- ✅ Service implemented: `saml.service.ts` (439 lines)
- ✅ Routes implemented: `saml.routes.ts` (203 lines, 8 endpoints)
- ✅ Routes registered in `index.ts`
- ✅ Database tables created: `saml_providers`, `saml_mappings`
- ✅ Migration ready: `008_saml_tables.sql`

### What You Need to Do
1. Run database migration
2. Configure your Identity Provider (IdP)
3. Create SAML provider via API
4. Test SSO login flow

---

## 🚀 QUICK START (5 MINUTES)

### Step 1: Verify Installation

```bash
cd /home/user/LuxAI/packages/backend

# Check package is installed
npm list @node-saml/passport-saml
# Should show: @node-saml/passport-saml@4.0.4

# Verify service exists
ls -la src/services/saml.service.ts
ls -la src/routes/saml.routes.ts

# Check routes are registered
grep "saml" src/routes/index.ts
```

**Expected Output:**
```
import samlRoutes from './saml.routes';
router.use('/saml', samlRoutes);
```

---

### Step 2: Run Database Migration

The SAML tables are already defined in migration `008_saml_tables.sql`.

```bash
cd /home/user/LuxAI/packages/backend

# Run migrations
npm run db:migrate

# OR manually run SQL
psql $DATABASE_URL -f src/db/migrations/008_saml_tables.sql
```

**Verify Migration:**
```sql
-- Check tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('saml_providers', 'saml_mappings');
```

**Expected Output:**
```
 tablename
-----------------
 saml_providers
 saml_mappings
```

---

### Step 3: Start the Server

```bash
cd /home/user/LuxAI

# Start backend
npm run dev --workspace=@luxai/backend

# Server should start on http://localhost:3001
```

**Verify SAML Routes:**
```bash
# Test SAML endpoints
curl http://localhost:3001/api/saml/providers

# Expected: [] (empty array, no providers configured yet)
```

---

## 🔧 CONFIGURATION OPTIONS

You can configure **any SAML 2.0 compliant Identity Provider**. Below are guides for the most common ones:

### Supported Identity Providers
1. **Google Workspace** (Google OAuth via SAML)
2. **Microsoft Azure AD** (Entra ID)
3. **Okta**
4. **Auth0**
5. **OneLogin**
6. **Generic SAML 2.0 Provider**

---

## 📘 OPTION 1: GOOGLE WORKSPACE SETUP

### Step 1: Configure Google as SAML IdP

1. **Go to Google Admin Console**
   - Navigate to: https://admin.google.com
   - Go to: Apps → Web and mobile apps → Add app → Add custom SAML app

2. **App Details**
   - App name: `LuxAI Designer`
   - Description: `Luxury travel planning platform`
   - App icon: (optional)
   - Click **Continue**

3. **Google IdP Details**
   - **Copy these values** (you'll need them):
     - SSO URL: `https://accounts.google.com/o/saml2/idp?idpid=XXXXX`
     - Entity ID: `https://accounts.google.com/o/saml2`
     - Certificate: Download the X.509 certificate
   - Click **Continue**

4. **Service Provider Details**
   - ACS URL: `http://localhost:3001/api/saml/acs` (or your production URL)
   - Entity ID: `luxai-designer` (or your custom entity ID)
   - Start URL: `http://localhost:3001/api/saml/login/google`
   - Signed response: ✅ Checked
   - Name ID format: `EMAIL`
   - Name ID: `Basic Information > Primary email`
   - Click **Continue**

5. **Attribute Mapping**
   - Add these mappings:
     ```
     Google attribute        → App attribute
     Primary email          → email
     First name             → firstName
     Last name              → lastName
     ```
   - Click **Finish**

6. **Enable the App**
   - Turn ON for everyone or specific organizational units
   - Click **Save**

---

### Step 2: Create SAML Provider in LuxAI

**Extract Certificate:**
```bash
# Open the downloaded certificate
cat ~/Downloads/GoogleIDPCertificate*.crt

# Copy the entire content including BEGIN/END lines
```

**Create Provider via API:**
```bash
# Replace with your actual values
curl -X POST http://localhost:3001/api/saml/providers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Google Workspace",
    "entity_id": "https://accounts.google.com/o/saml2",
    "sso_url": "https://accounts.google.com/o/saml2/idp?idpid=XXXXX",
    "sso_logout_url": "https://accounts.google.com/o/saml2/logout",
    "certificate": "-----BEGIN CERTIFICATE-----\nMIIDdDCCAlygAwIBAgIGAXxxx...\n-----END CERTIFICATE-----",
    "is_active": true,
    "auto_provision": true,
    "default_role": "client",
    "attribute_mapping": {
      "email": "email",
      "firstName": "firstName",
      "lastName": "lastName"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Google Workspace",
    "entity_id": "https://accounts.google.com/o/saml2",
    "is_active": true,
    "created_at": "2025-11-14T..."
  }
}
```

---

### Step 3: Test Google SSO Login

1. **Get Provider ID**
```bash
# List providers
curl http://localhost:3001/api/saml/providers

# Copy the "id" field (UUID)
```

2. **Access Login URL**
```bash
# Replace {providerId} with actual UUID
http://localhost:3001/api/saml/login/{providerId}
```

3. **Login Flow**
   - Browser redirects to Google login
   - User logs in with Google credentials
   - Google sends SAML assertion to `/api/saml/acs`
   - LuxAI creates/updates user (if auto_provision=true)
   - Returns JWT token and redirects to frontend

4. **Verify User Created**
```sql
-- Check users table
SELECT id, email, full_name, role, created_at
FROM users
WHERE email = 'user@yourdomain.com';
```

---

## 📘 OPTION 2: MICROSOFT AZURE AD SETUP

### Step 1: Configure Azure AD as SAML IdP

1. **Go to Azure Portal**
   - Navigate to: https://portal.azure.com
   - Go to: Azure Active Directory → Enterprise Applications → New application

2. **Create Application**
   - Click **Create your own application**
   - Name: `LuxAI Designer`
   - Select: **Integrate any other application you don't find in the gallery (Non-gallery)**
   - Click **Create**

3. **Set up Single Sign-On**
   - Go to: Single sign-on → SAML
   - Click **Edit** on Basic SAML Configuration

4. **Basic SAML Configuration**
   - Identifier (Entity ID): `luxai-designer`
   - Reply URL (ACS): `http://localhost:3001/api/saml/acs`
   - Sign on URL: `http://localhost:3001/api/saml/login/azure`
   - Logout URL: `http://localhost:3001/api/saml/logout`
   - Click **Save**

5. **User Attributes & Claims**
   - Add these claims:
     ```
     Claim name       → Source attribute
     email           → user.mail
     firstName       → user.givenname
     lastName        → user.surname
     ```

6. **Download Certificate**
   - Scroll to: SAML Signing Certificate
   - Download: **Certificate (Base64)**

7. **Copy Setup URLs**
   - Login URL: `https://login.microsoftonline.com/.../saml2`
   - Azure AD Identifier: `https://sts.windows.net/.../`
   - Logout URL: `https://login.microsoftonline.com/.../saml2`

8. **Assign Users**
   - Go to: Users and groups → Add user/group
   - Assign users who should have access

---

### Step 2: Create Azure Provider in LuxAI

```bash
# Extract certificate
cat ~/Downloads/certificate.cer

# Create provider
curl -X POST http://localhost:3001/api/saml/providers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Microsoft Azure AD",
    "entity_id": "https://sts.windows.net/YOUR_TENANT_ID/",
    "sso_url": "https://login.microsoftonline.com/YOUR_TENANT_ID/saml2",
    "sso_logout_url": "https://login.microsoftonline.com/YOUR_TENANT_ID/saml2",
    "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "is_active": true,
    "auto_provision": true,
    "default_role": "client",
    "attribute_mapping": {
      "email": "email",
      "firstName": "firstName",
      "lastName": "lastName"
    }
  }'
```

---

### Step 3: Test Azure SSO Login

Same process as Google (Steps 1-4 above).

---

## 📘 OPTION 3: OKTA SETUP

### Step 1: Configure Okta as SAML IdP

1. **Go to Okta Admin Console**
   - Navigate to: https://YOUR_DOMAIN-admin.okta.com
   - Go to: Applications → Applications → Create App Integration

2. **Create SAML Integration**
   - Sign-in method: **SAML 2.0**
   - Click **Next**

3. **General Settings**
   - App name: `LuxAI Designer`
   - App logo: (optional)
   - App visibility: ✅ Do not display application icon to users
   - Click **Next**

4. **Configure SAML**
   - Single sign-on URL: `http://localhost:3001/api/saml/acs`
   - ✅ Use this for Recipient URL and Destination URL
   - Audience URI (SP Entity ID): `luxai-designer`
   - Default RelayState: (leave empty)
   - Name ID format: `EmailAddress`
   - Application username: `Email`
   - Update application username on: `Create and update`

5. **Attribute Statements**
   ```
   Name         → Value
   email       → user.email
   firstName   → user.firstName
   lastName    → user.lastName
   ```

6. **Click Next → Finish**

7. **View Setup Instructions**
   - Go to: Sign On tab → View Setup Instructions
   - Copy:
     * Identity Provider Single Sign-On URL
     * Identity Provider Issuer
     * X.509 Certificate

8. **Assign Users**
   - Go to: Assignments tab
   - Click **Assign** → Assign to People/Groups

---

### Step 2: Create Okta Provider in LuxAI

```bash
curl -X POST http://localhost:3001/api/saml/providers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "name": "Okta",
    "entity_id": "http://www.okta.com/YOUR_ISSUER_ID",
    "sso_url": "https://YOUR_DOMAIN.okta.com/app/YOUR_APP_ID/sso/saml",
    "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "is_active": true,
    "auto_provision": true,
    "default_role": "client",
    "attribute_mapping": {
      "email": "email",
      "firstName": "firstName",
      "lastName": "lastName"
    }
  }'
```

---

## 🔍 TESTING SAML SSO

### Method 1: Browser Test

1. **Get Login URL**
```bash
# List providers to get ID
curl http://localhost:3001/api/saml/providers

# Provider ID: abc123...
```

2. **Open in Browser**
```
http://localhost:3001/api/saml/login/abc123
```

3. **Expected Flow**
   - ✅ Redirects to IdP login page
   - ✅ User logs in with IdP credentials
   - ✅ IdP sends SAML assertion
   - ✅ LuxAI validates assertion
   - ✅ User created/updated (if auto_provision enabled)
   - ✅ JWT token generated
   - ✅ Redirects to frontend with token

---

### Method 2: Test with SAML Tracer

**Install Browser Extension:**
- Chrome: [SAML-tracer](https://chrome.google.com/webstore/detail/saml-tracer)
- Firefox: [SAML-tracer](https://addons.mozilla.org/en-US/firefox/addon/saml-tracer/)

**Trace SAML Flow:**
1. Open SAML-tracer extension
2. Click **Start**
3. Navigate to login URL
4. Complete SSO login
5. View SAML request/response in tracer
6. Verify assertion attributes

---

### Method 3: Command Line Test

**Test Metadata Endpoint:**
```bash
# Get Service Provider metadata
curl http://localhost:3001/api/saml/metadata/{providerId}

# Should return XML metadata
```

**Test ACS Endpoint:**
```bash
# This is called by IdP, not directly
# But you can verify it exists
curl -X POST http://localhost:3001/api/saml/acs

# Should return 400 (missing SAML response)
```

---

## 📊 SAML PROVIDER MANAGEMENT

### List All Providers

```bash
GET /api/saml/providers

# Response:
[
  {
    "id": "uuid-1",
    "name": "Google Workspace",
    "entity_id": "https://accounts.google.com/o/saml2",
    "is_active": true,
    "auto_provision": true,
    "created_at": "..."
  },
  {
    "id": "uuid-2",
    "name": "Microsoft Azure AD",
    "entity_id": "https://sts.windows.net/.../",
    "is_active": true,
    "auto_provision": true,
    "created_at": "..."
  }
]
```

---

### Update Provider

```bash
PUT /api/saml/providers/{id}
Authorization: Bearer ADMIN_TOKEN

{
  "name": "Google Workspace (Updated)",
  "is_active": true,
  "auto_provision": false,
  "default_role": "vendor"
}
```

---

### Delete Provider

```bash
DELETE /api/saml/providers/{id}
Authorization: Bearer ADMIN_TOKEN

# Soft deletes provider (is_active = false)
```

---

### Get Service Provider Metadata

```bash
GET /api/saml/metadata/{providerId}

# Returns XML:
<?xml version="1.0"?>
<EntityDescriptor ...>
  <SPSSODescriptor ...>
    <AssertionConsumerService ... />
  </SPSSODescriptor>
</EntityDescriptor>
```

---

## 🔐 SECURITY CONSIDERATIONS

### Certificate Management

**Certificate Format:**
```
-----BEGIN CERTIFICATE-----
MIIDdDCCAlygAwIBAgIGAXxxx...
(multiple lines)
...xxxxx==
-----END CERTIFICATE-----
```

**Important:**
- ✅ Include BEGIN/END lines
- ✅ Keep newlines in JSON (use `\n`)
- ✅ No spaces or extra characters
- ✅ Base64 encoded
- ⚠️ Store securely in database
- 🔄 Rotate certificates before expiration

---

### Attribute Mapping

**Default Mapping:**
```json
{
  "email": "email",
  "firstName": "firstName",
  "lastName": "lastName"
}
```

**Custom Mapping Example:**
```json
{
  "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
  "role": "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
}
```

---

### Auto-Provisioning

**Enabled (auto_provision = true):**
- New users created automatically on first login
- User data populated from SAML attributes
- Default role assigned from provider config
- Email is primary identifier

**Disabled (auto_provision = false):**
- Only existing users can login via SSO
- User must be created manually first
- Email must match exactly
- More secure for controlled access

---

## 🐛 TROUBLESHOOTING

### Issue: "Certificate validation failed"

**Cause:** Invalid or malformed certificate

**Solution:**
```bash
# Verify certificate format
openssl x509 -in certificate.cer -text -noout

# Should show certificate details
# If error, certificate is invalid

# Convert from CER to PEM if needed
openssl x509 -in certificate.cer -out certificate.pem
```

---

### Issue: "Assertion expired"

**Cause:** Clock skew between IdP and SP

**Solution:**
```bash
# Check server time
date

# Sync with NTP
sudo ntpdate -s time.nist.gov

# Or set clock skew tolerance in SAML config
# (Not currently exposed in API)
```

---

### Issue: "Attribute not found in assertion"

**Cause:** Attribute mapping mismatch

**Solution:**
1. Use SAML-tracer to view actual assertion
2. Find exact attribute names in assertion
3. Update attribute_mapping in provider config
4. Example:
```bash
PUT /api/saml/providers/{id}
{
  "attribute_mapping": {
    "email": "http://schemas.xmlsoap.org/...",
    "firstName": "givenName",
    "lastName": "surname"
  }
}
```

---

### Issue: "User not created" (auto_provision = true)

**Check:**
1. Verify auto_provision is true
2. Check email in SAML assertion
3. Verify attribute mapping
4. Check database logs
5. Check server logs for errors

**Debug:**
```bash
# Enable debug logging
DEBUG=saml* npm run dev

# Check user table
SELECT * FROM users WHERE email = 'user@domain.com';

# Check SAML sessions
SELECT * FROM saml_sessions ORDER BY created_at DESC LIMIT 5;
```

---

### Issue: "Redirect loop"

**Cause:** Frontend not handling JWT token

**Solution:**
1. Check ACS endpoint returns correct redirect
2. Verify frontend can receive token
3. Check browser console for errors
4. Ensure RelayState preserved

---

## 📚 API REFERENCE

### All SAML Endpoints

```
GET    /api/saml/providers              List all providers (public)
POST   /api/saml/providers              Create provider (admin)
PUT    /api/saml/providers/:id          Update provider (admin)
DELETE /api/saml/providers/:id          Delete provider (admin)
GET    /api/saml/metadata/:providerId   Get SP metadata XML
GET    /api/saml/login/:providerId      Initiate SSO login
POST   /api/saml/acs                    Assertion Consumer Service
GET    /api/saml/logout                 SAML logout
```

---

## 🎯 PRODUCTION DEPLOYMENT

### Environment Variables

```bash
# Add to .env
BASE_URL=https://yourdomain.com
SAML_CALLBACK_URL=https://yourdomain.com/api/saml/acs
SAML_ENTITY_ID=luxai-designer-production
```

---

### Update Provider URLs

```bash
# Update all providers with production URLs
PUT /api/saml/providers/{id}
{
  "sso_url": "https://login.provider.com/...",
  "callback_url": "https://yourdomain.com/api/saml/acs"
}
```

---

### SSL/TLS Required

⚠️ **IMPORTANT:** SAML requires HTTPS in production
- All URLs must use https://
- Valid SSL certificate required
- Self-signed certificates NOT recommended

---

### Update IdP Configuration

For each Identity Provider, update:
1. **ACS URL:** `https://yourdomain.com/api/saml/acs`
2. **Entity ID:** `luxai-designer-production`
3. **Login URL:** `https://yourdomain.com/api/saml/login/{providerId}`
4. **Logout URL:** `https://yourdomain.com/api/saml/logout`

---

## ✅ VERIFICATION CHECKLIST

- [ ] Package installed: `@node-saml/passport-saml@4.0.4`
- [ ] Migration 008 executed successfully
- [ ] Tables `saml_providers` and `saml_mappings` exist
- [ ] Routes registered in index.ts
- [ ] Server starts without errors
- [ ] Can access `/api/saml/providers` endpoint
- [ ] Identity Provider configured (Google/Azure/Okta)
- [ ] SAML provider created via API
- [ ] Can access login URL
- [ ] SSO login flow works end-to-end
- [ ] User created/updated in database
- [ ] JWT token returned successfully
- [ ] Frontend receives and stores token

---

## 🎓 ADDITIONAL RESOURCES

### SAML 2.0 Specification
- https://docs.oasis-open.org/security/saml/v2.0/

### Identity Provider Documentation
- **Google Workspace:** https://support.google.com/a/answer/6087519
- **Azure AD:** https://docs.microsoft.com/en-us/azure/active-directory/saas-apps/
- **Okta:** https://developer.okta.com/docs/guides/build-sso-integration/saml2/

### SAML Tools
- **SAML-tracer:** https://github.com/UNINETT/SAML-tracer
- **SAML Decoder:** https://www.samltool.com/decode.php
- **Certificate Decoder:** https://www.sslshopper.com/certificate-decoder.html

---

## 📞 SUPPORT

If you encounter issues:

1. **Check server logs:**
```bash
tail -f logs/server.log | grep -i saml
```

2. **Enable debug mode:**
```bash
DEBUG=saml* npm run dev
```

3. **Verify database:**
```sql
SELECT * FROM saml_providers;
SELECT * FROM saml_sessions ORDER BY created_at DESC LIMIT 10;
```

4. **Test manually:**
- Use SAML-tracer browser extension
- Check SAML assertion attributes
- Verify certificate is valid
- Confirm URLs match exactly

---

**Status:** ✅ **CODE COMPLETE - READY FOR CONFIGURATION**
**Last Updated:** November 14, 2025
**Version:** 5.0.0
