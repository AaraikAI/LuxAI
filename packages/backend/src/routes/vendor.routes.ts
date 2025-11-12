import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { vendorService } from '../services/vendor.service';
import { UserRole } from '@luxai/shared';

const router = Router();

router.use(authenticate);

const onboardingSchema = z.object({
  businessName: z.string().min(1),
  legalName: z.string().min(1),
  registrationNumber: z.string(),
  category: z.string(),
  capabilities: z.array(z.string()),
  safetyBadges: z.array(z.string()).optional(),
  insuranceCoverage: z.number().min(1000000),
  insuranceExpiresAt: z.string().datetime(),
  businessAddress: z.any(),
  businessEmail: z.string().email(),
  businessPhone: z.string(),
  taxId: z.string(),
  bankAccount: z.object({
    accountHolderName: z.string(),
    accountNumber: z.string(),
    routingNumber: z.string(),
    accountType: z.enum(['checking', 'savings']),
    bankName: z.string(),
  }),
});

const createDealSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string(),
  subcategory: z.string().optional(),
  location: z.any(),
  priceRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
  }),
  isExclusive: z.boolean(),
  isOffMarket: z.boolean(),
  availability: z.any().optional(),
  images: z.array(z.string()),
  tags: z.array(z.string()),
  sustainabilityScore: z.number().optional(),
});

router.post('/onboard', asyncHandler(async (req: AuthRequest, res) => {
  const data = onboardingSchema.parse(req.body);
  const result = await vendorService.submitOnboarding({
    userId: req.user!.id,
    ...data,
    insuranceExpiresAt: new Date(data.insuranceExpiresAt),
  });

  res.status(201).json({ success: true, data: result });
}));

router.get('/profile', authorize(UserRole.VENDOR), asyncHandler(async (req: AuthRequest, res) => {
  const { query: dbQuery } = await import('../db');
  const vendorResult = await dbQuery('SELECT id FROM vendors WHERE user_id = $1', [req.user!.id]);

  if (vendorResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
  }

  const profile = await vendorService.getVendorProfile(vendorResult.rows[0].id);
  res.json({ success: true, data: profile });
}));

router.post('/deals', authorize(UserRole.VENDOR), asyncHandler(async (req: AuthRequest, res) => {
  const data = createDealSchema.parse(req.body);
  const { query: dbQuery } = await import('../db');
  const vendorResult = await dbQuery('SELECT id FROM vendors WHERE user_id = $1', [req.user!.id]);

  if (vendorResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
  }

  const result = await vendorService.createDeal({
    vendorId: vendorResult.rows[0].id,
    ...data,
  });

  res.status(201).json({ success: true, data: result });
}));

router.get('/deals', authorize(UserRole.VENDOR), asyncHandler(async (req: AuthRequest, res) => {
  const { query: dbQuery } = await import('../db');
  const vendorResult = await dbQuery('SELECT id FROM vendors WHERE user_id = $1', [req.user!.id]);

  if (vendorResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
  }

  const deals = await vendorService.getVendorDeals(vendorResult.rows[0].id);
  res.json({ success: true, data: deals });
}));

router.get('/analytics', authorize(UserRole.VENDOR), asyncHandler(async (req: AuthRequest, res) => {
  const { query: dbQuery } = await import('../db');
  const vendorResult = await dbQuery('SELECT id FROM vendors WHERE user_id = $1', [req.user!.id]);

  if (vendorResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
  }

  const analytics = await vendorService.getVendorAnalytics(vendorResult.rows[0].id);
  res.json({ success: true, data: analytics });
}));

router.get('/vault/search', asyncHandler(async (req: AuthRequest, res) => {
  const filters = {
    category: req.query.category as string,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
    location: req.query.location as string,
    isOffMarket: req.query.isOffMarket === 'true',
    tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const result = await vendorService.searchDeals(filters);
  res.json({ success: true, data: result.deals, meta: { total: result.total } });
}));

export default router;
