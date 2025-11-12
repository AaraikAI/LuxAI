# LuxAI Designer

> **Your World, Anticipated: AI-Powered Luxury for the Ultra-Elite**

LuxAI Designer is an AI-enabled web and mobile application that empowers luxury travel designers to craft ultra-bespoke experiences for ultra-high-net-worth (UHNW) and high-net-worth (HNW) clients. The platform integrates AI expertise with a private off-market marketplace, team collaboration tools, and direct client portals.

## 🌟 Features

### Core Capabilities
- **AI-Powered Itinerary Generation**: Generate luxury travel plans in under 60 seconds using Claude/GPT-4
- **Off-Market Vault**: Exclusive access to vetted luxury deals and experiences
- **Multi-Stakeholder Approval Flows**: Support for assistants, family offices, and principals
- **Private Aviation Integration**: Amalfi Jets and other charter providers
- **Real-Time Live Updates**: iOS Live Activities and Android Live Updates for trip tracking
- **Sustainability Tracking**: ICAO-based carbon calculations and offset options
- **Secure Document Management**: E-signatures, NDAs, and encrypted storage
- **UHNW Networking Forum**: Anonymous networking with verified users

### User Roles
- **Clients (UHNW/HNW)**: Book and manage luxury travel experiences
- **Designers**: Create bespoke itineraries with AI assistance
- **Vendors**: Offer exclusive services and accommodations
- **Agency Managers**: Oversee teams and sales metrics

## 🏗️ Architecture

### Tech Stack

#### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15 with pgcrypto
- **Cache**: Redis 7
- **AI Services**: OpenAI GPT-4, Anthropic Claude
- **Authentication**: JWT with bcrypt
- **Payments**: Stripe Connect with escrow
- **File Storage**: AWS S3

#### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios

#### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Orchestration**: Kubernetes (Production)
- **CI/CD**: GitHub Actions
- **Monitoring**: Datadog, Sentry
- **Observability**: Pino logging

### Project Structure

```
LuxAI/
├── packages/
│   ├── backend/          # Node.js/Express API
│   │   ├── src/
│   │   │   ├── config/       # Configuration
│   │   │   ├── db/           # Database & migrations
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic
│   │   │   └── utils/        # Utilities
│   │   └── Dockerfile
│   ├── web/              # React web application
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── pages/        # Page components
│   │   │   ├── stores/       # Zustand stores
│   │   │   └── lib/          # API client
│   │   └── Dockerfile
│   └── shared/           # Shared types and utilities
│       └── src/
│           └── types/        # TypeScript definitions
├── docker-compose.yml
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **Docker**: 24.x or higher (recommended)
- **Docker Compose**: 2.x or higher (recommended)

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/LuxAI.git
   cd LuxAI
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start all services**
   ```bash
   docker-compose up
   ```

   This will start:
   - PostgreSQL on `localhost:5432`
   - Redis on `localhost:6379`
   - Backend API on `http://localhost:3000`
   - Web frontend on `http://localhost:5173`

4. **Initialize the database**
   ```bash
   # The schema will be automatically applied on first run
   # Or manually run:
   docker-compose exec postgres psql -U luxai -d luxai_dev -f /docker-entrypoint-initdb.d/schema.sql
   ```

### Option 2: Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up PostgreSQL**
   ```bash
   # Install PostgreSQL 15
   # Create database
   createdb luxai_dev

   # Apply schema
   psql -U postgres -d luxai_dev -f packages/backend/src/db/schema.sql
   ```

3. **Set up Redis**
   ```bash
   # Install and start Redis
   redis-server
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Backend
   npm run dev:backend

   # Terminal 2: Web
   npm run dev:web
   ```

## 📝 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://luxai:password@localhost:5432/luxai_dev

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# AI Services (at least one required)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

### Optional Variables

```bash
# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# KYC/AML
PERSONA_API_KEY=your-persona-api-key
ONFIDO_API_KEY=your-onfido-api-key

# Amalfi Jets
AMALFI_API_KEY=your-amalfi-api-key
AMALFI_API_URL=https://api.amalfi.example.com

# AWS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=luxai-documents

# Email
SENDGRID_API_KEY=your-sendgrid-key
```

## 🔌 API Documentation

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "client",
  "phone": "+1234567890"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "client",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "jwt-token"
  }
}
```

### Itineraries

#### Generate Itinerary (AI-Powered)
```http
POST /api/itineraries/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "startDate": "2024-06-01T00:00:00Z",
  "endDate": "2024-06-10T00:00:00Z",
  "destinations": ["Paris", "French Riviera"],
  "budget": 100000,
  "specialRequests": "Michelin-starred dining, private yacht"
}
```

#### List Itineraries
```http
GET /api/itineraries
Authorization: Bearer <token>
```

#### Get Itinerary Details
```http
GET /api/itineraries/:id
Authorization: Bearer <token>
```

#### Update Itinerary Status
```http
PATCH /api/itineraries/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "approved"
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run backend tests
npm test --workspace=@luxai/backend

# Run with coverage
npm test -- --coverage
```

## 🏭 Production Deployment

### Build for Production

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@luxai/backend
npm run build --workspace=@luxai/web
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure production database with SSL
4. Set up CDN for static assets
5. Enable monitoring (Sentry, Datadog)
6. Configure rate limiting
7. Set up SSL/TLS certificates

### Docker Production Build

```dockerfile
# Backend
docker build -f packages/backend/Dockerfile -t luxai-backend:latest .

# Web
docker build -f packages/web/Dockerfile -t luxai-web:latest .
```

## 🔒 Security Considerations

### Implemented Security Measures

- ✅ JWT-based authentication with bcrypt password hashing
- ✅ HTTPS enforcement via Helmet middleware
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ SQL injection prevention via parameterized queries
- ✅ XSS protection via Content Security Policy
- ✅ CORS configuration for trusted origins
- ✅ Input validation with Zod schemas
- ✅ Secure session management
- ✅ Audit logging for sensitive operations

### To Be Implemented (Production)

- [ ] KYC/AML verification (Persona/Onfido)
- [ ] PCI-DSS compliance for payments
- [ ] SOC 2 Type II certification
- [ ] Penetration testing
- [ ] GDPR/CCPA compliance tools
- [ ] DDoS protection (Cloudflare)
- [ ] Web Application Firewall (WAF)

## 📊 Database Schema

### Core Tables

- **users**: User accounts and authentication
- **clients**: UHNW client profiles and preferences
- **designers**: Travel designer profiles
- **vendors**: Service provider information
- **itineraries**: Travel plans and bookings
- **destinations**: Destination details within itineraries
- **activities**: Activities and experiences
- **accommodations**: Lodging arrangements
- **transportation**: Travel segments (flights, cars, yachts)
- **quotes**: Pricing from vendors
- **payments**: Payment transactions and escrow
- **live_update_activities**: Real-time notifications
- **documents**: Secure document storage
- **audit_logs**: System audit trail

See `packages/backend/src/db/schema.sql` for complete schema.

## 🎯 Roadmap

### MVP (Q2 2026)
- [x] Core authentication and authorization
- [x] AI-powered itinerary generation
- [x] Basic client and designer portals
- [x] Database schema and migrations
- [ ] KYC/AML integration
- [ ] Stripe payment processing
- [ ] Amalfi Jets integration
- [ ] Live Updates (iOS/Android)

### Full Production (Q4 2026)
- [ ] Off-Market Vault with 500+ exclusives
- [ ] Multi-stakeholder approval workflows
- [ ] Vendor Studio and onboarding
- [ ] UHNW networking forum
- [ ] Advanced analytics dashboards
- [ ] Mobile native apps (iOS/Android)
- [ ] GDS integration (Sabre)
- [ ] Sustainability calculator
- [ ] E-signature workflows (DocuSign)
- [ ] 24/7 concierge support

### Future Enhancements
- [ ] Voice mode for itinerary planning
- [ ] Blockchain-based deal provenance
- [ ] AR/VR destination previews
- [ ] Predictive AI for proactive suggestions
- [ ] Integration with luxury lifestyle services
- [ ] White-label platform for agencies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for type safety
- Follow ESLint configuration
- Write tests for new features
- Document API endpoints
- Use meaningful commit messages

## 📄 License

This project is proprietary and confidential.

## 👥 Team

- **Product**: Based on comprehensive PRD
- **Engineering**: Full-stack TypeScript development
- **AI/ML**: OpenAI GPT-4 & Anthropic Claude integration
- **Design**: Luxury-focused UI/UX with Tailwind CSS

## 📞 Support

For support and inquiries:
- Email: support@luxai.example.com
- Documentation: [docs.luxai.example.com](https://docs.luxai.example.com)
- Status: [status.luxai.example.com](https://status.luxai.example.com)

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Anthropic for Claude API
- Amalfi Jets for aviation partnership
- All luxury service providers in our network

---

**LuxAI Designer** - Redefining luxury travel for the ultra-elite through AI-powered personalization and exclusive access.
