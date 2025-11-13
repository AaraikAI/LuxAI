import { z } from 'zod';

/**
 * User Roles
 */
export enum UserRole {
  CLIENT = 'client',
  ASSISTANT = 'assistant',
  DESIGNER = 'designer',
  AGENCY_MANAGER = 'agency_manager',
  VENDOR = 'vendor',
  ADMIN = 'admin'
}

/**
 * User/Client Types
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  kycStatus: KYCStatus;
  kycVerifiedAt?: Date;
}

export enum KYCStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export interface Client extends User {
  role: UserRole.CLIENT;
  netWorth?: number;
  netWorthVerifiedAt?: Date;
  preferences: ClientPreferences;
  liveUpdatesEnabled: boolean;
}

export interface ClientPreferences {
  dietaryRestrictions?: string[];
  travelPreferences?: string[];
  accommodationPreferences?: string[];
  activityPreferences?: string[];
  sustainabilityFocus: boolean;
  culturalSensitivities?: string[];
  languagePreferences?: string[];
  accessibility?: string[];
}

/**
 * Designer/Agency Types
 */
export interface Designer extends User {
  role: UserRole.DESIGNER;
  agencyId?: string;
  specializations: string[];
  certifications: string[];
  experienceYears: number;
}

export interface Agency {
  id: string;
  name: string;
  legalName: string;
  registrationNumber: string;
  address: Address;
  phone: string;
  email: string;
  website?: string;
  tier: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionTier {
  FREEMIUM = 'freemium',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

/**
 * Vendor Types
 */
export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  legalName: string;
  registrationNumber: string;
  category: VendorCategory;
  capabilities: string[];
  safetyBadges?: string[];
  insuranceCoverage: number;
  insuranceExpiresAt: Date;
  kybStatus: KYBStatus;
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum VendorCategory {
  TRAVEL = 'travel',
  AVIATION = 'aviation',
  ACCOMMODATION = 'accommodation',
  EXPERIENCES = 'experiences',
  DINING = 'dining',
  STAFFING = 'staffing',
  EVENTS = 'events',
  ESTATE = 'estate',
  LIFESTYLE = 'lifestyle'
}

export enum KYBStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

/**
 * Deal/Vault Types
 */
export interface Deal {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  category: VendorCategory;
  subcategory?: string;
  location: Location;
  priceRange: PriceRange;
  isExclusive: boolean;
  isOffMarket: boolean;
  availability: Availability;
  images: string[];
  tags: string[];
  sustainabilityScore?: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

export interface Availability {
  startDate?: Date;
  endDate?: Date;
  blackoutDates?: Date[];
  minimumNotice?: number; // hours
}

/**
 * Quote/Booking Types
 */
export interface Quote {
  id: string;
  itineraryId: string;
  dealId?: string;
  vendorId: string;
  clientId: string;
  designerId: string;
  status: QuoteStatus;
  lineItems: LineItem[];
  subtotal: number;
  taxes: number;
  fees: number;
  total: number;
  currency: string;
  validUntil: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: VendorCategory;
  metadata?: Record<string, any>;
}

/**
 * Itinerary Types
 */
export interface Itinerary {
  id: string;
  clientId: string;
  designerId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  destinations: Destination[];
  activities: Activity[];
  accommodations: Accommodation[];
  transportation: Transportation[];
  status: ItineraryStatus;
  approvalStatus: ApprovalStatus;
  aiGenerated: boolean;
  sustainabilityMetrics?: SustainabilityMetrics;
  totalBudget?: number;
  actualCost?: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ItineraryStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED_BY_ASSISTANT = 'approved_by_assistant',
  APPROVED_BY_FAMILY_OFFICE = 'approved_by_family_office',
  APPROVED_BY_PRINCIPAL = 'approved_by_principal',
  REJECTED = 'rejected'
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  coordinates: Coordinates;
  arrivalDate: Date;
  departureDate: Date;
  notes?: string;
}

export interface Activity {
  id: string;
  destinationId: string;
  name: string;
  description: string;
  category: string;
  startTime: Date;
  endTime: Date;
  location: Location;
  vendorId?: string;
  cost?: number;
  bookingStatus: BookingStatus;
}

export interface Accommodation {
  id: string;
  destinationId: string;
  name: string;
  type: string;
  address: Address;
  checkIn: Date;
  checkOut: Date;
  rooms: number;
  guests: number;
  vendorId?: string;
  cost?: number;
  bookingStatus: BookingStatus;
}

export interface Transportation {
  id: string;
  type: TransportationType;
  fromDestinationId: string;
  toDestinationId: string;
  departureTime: Date;
  arrivalTime: Date;
  provider?: string;
  flightNumber?: string;
  vendorId?: string;
  cost?: number;
  bookingStatus: BookingStatus;
  metadata?: Record<string, any>;
}

export enum TransportationType {
  PRIVATE_JET = 'private_jet',
  COMMERCIAL_FLIGHT = 'commercial_flight',
  HELICOPTER = 'helicopter',
  YACHT = 'yacht',
  LUXURY_CAR = 'luxury_car',
  TRAIN = 'train',
  OTHER = 'other'
}

export enum BookingStatus {
  PENDING = 'pending',
  REQUESTED = 'requested',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled'
}

/**
 * Approval Workflow Types
 */
export interface Approval {
  id: string;
  itineraryId: string;
  lineItemId?: string;
  approverId: string;
  approverRole: UserRole;
  status: ApprovalStatus;
  notes?: string;
  budgetCap?: number;
  createdAt: Date;
  resolvedAt?: Date;
}

/**
 * Payment Types
 */
export interface PaymentIntent {
  id: string;
  quoteId: string;
  clientId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  stripePaymentIntentId?: string;
  escrowRequired: boolean;
  escrowReleaseDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  ESCROWED = 'escrowed'
}

export enum PaymentMethod {
  CARD = 'card',
  WIRE_TRANSFER = 'wire_transfer',
  ACH = 'ach',
  CRYPTO_USDC = 'crypto_usdc',
  CRYPTO_USDT = 'crypto_usdt'
}

/**
 * Live Updates Types
 */
export interface LiveUpdateActivity {
  id: string;
  itineraryId: string;
  clientId: string;
  type: LiveUpdateType;
  title: string;
  message: string;
  priority: LiveUpdatePriority;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
  status: LiveUpdateStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum LiveUpdateType {
  FLIGHT_STATUS = 'flight_status',
  DELAY_ALERT = 'delay_alert',
  REBOOK_SUGGESTION = 'rebook_suggestion',
  ARRIVAL_COUNTDOWN = 'arrival_countdown',
  SERVICE_REMINDER = 'service_reminder',
  DISRUPTION = 'disruption',
  MILESTONE = 'milestone',
  SUSTAINABILITY = 'sustainability'
}

export enum LiveUpdatePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum LiveUpdateStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Aviation-Specific Types (Amalfi Jets)
 */
export interface FlightLeg {
  id: string;
  origin: Airport;
  destination: Airport;
  departureTime: Date;
  arrivalTime: Date;
  duration: number; // minutes
  aircraft?: Aircraft;
  passengers: number;
  pets?: number;
  catering?: CateringOption[];
  carbonEmissions?: number; // kg CO2
}

export interface Airport {
  code: string; // IATA or ICAO
  name: string;
  city: string;
  country: string;
  coordinates: Coordinates;
}

export interface Aircraft {
  id: string;
  type: string;
  manufacturer: string;
  model: string;
  capacity: number;
  range: number; // nautical miles
  speed: number; // knots
  safetyBadges: string[];
}

export interface CateringOption {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface EmptyLeg {
  id: string;
  vendorId: string;
  origin: Airport;
  destination: Airport;
  departureDate: Date;
  aircraft: Aircraft;
  price: number;
  currency: string;
  flexibility: number; // days
  radiusMiles: number;
  availableUntil: Date;
}

/**
 * Sustainability Types
 */
export interface SustainabilityMetrics {
  totalCarbonEmissions: number; // kg CO2
  offsetAmount: number; // kg CO2
  offsetCost: number;
  offsetProvider?: string;
  sustainabilityScore: number; // 0-100
  breakdown: CarbonBreakdown;
}

export interface CarbonBreakdown {
  flights: number;
  accommodation: number;
  groundTransportation: number;
  activities: number;
}

/**
 * Document Types
 */
export interface Document {
  id: string;
  userId: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  type: DocumentType;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  signatureRequired: boolean;
  signedAt?: Date;
  signedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum DocumentType {
  PASSPORT = 'passport',
  ID = 'id',
  PROOF_OF_ADDRESS = 'proof_of_address',
  NET_WORTH_AFFIDAVIT = 'net_worth_affidavit',
  CONTRACT = 'contract',
  NDA = 'nda',
  INVOICE = 'invoice',
  RECEIPT = 'receipt',
  INSURANCE = 'insurance',
  OTHER = 'other'
}

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

/**
 * Forum/Networking Types
 */
export interface ForumPost {
  id: string;
  authorId: string;
  pseudonym?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isAnonymous: boolean;
  replyCount: number;
  viewCount: number;
  upvotes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumReply {
  id: string;
  postId: string;
  authorId: string;
  pseudonym?: string;
  content: string;
  isAnonymous: boolean;
  upvotes: number;
  createdAt: Date;
}

/**
 * Rating/Review Types
 */
export interface Rating {
  id: string;
  vendorId: string;
  clientId: string;
  bookingId: string;
  rating: number; // 1-5
  review?: string;
  categories: RatingCategory[];
  status: RatingStatus;
  createdAt: Date;
  respondedAt?: Date;
  response?: string;
}

export interface RatingCategory {
  name: string;
  score: number;
}

export enum RatingStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  DISPUTED = 'disputed',
  REMOVED = 'removed'
}

/**
 * Audit Log Types
 */
export interface AuditLog {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * Common Types
 */
export interface Address {
  street: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface Location {
  name: string;
  address: Address;
  coordinates: Coordinates;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * API Response Types
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  timestamp: Date;
}

/**
 * Webhook Event Types
 */
export enum WebhookEventType {
  QUOTE_CREATED = 'quote.created',
  QUOTE_UPDATED = 'quote.updated',
  QUOTE_ACCEPTED = 'quote.accepted',
  APPROVAL_REQUESTED = 'approval.requested',
  APPROVAL_UPDATED = 'approval.updated',
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  BOOKING_CONFIRMED = 'booking.confirmed',
  LIVE_UPDATE_TRIGGERED = 'live_update.triggered',
  KYC_COMPLETED = 'kyc.completed',
  ITINERARY_GENERATED = 'itinerary.generated'
}

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: Record<string, any>;
  timestamp: Date;
}
