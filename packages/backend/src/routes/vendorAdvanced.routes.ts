import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { vendorAdvancedService } from '../services/vendorAdvanced.service';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /vendor-advanced/inventory
 * Get vendor inventory
 */
router.get('/inventory', asyncHandler(async (req: AuthRequest, res: Response) => {
  const vendorId = req.query.vendor_id as string || req.user!.id;

  const inventory = await vendorAdvancedService.getInventory(vendorId);

  res.json({
    success: true,
    data: inventory,
  });
}));

/**
 * POST /vendor-advanced/inventory
 * Create inventory item
 */
const createInventorySchema = z.object({
  vendor_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().optional(),
  min_quantity: z.number().optional(),
  unit: z.string().optional(),
  base_price: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

router.post('/inventory', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createInventorySchema.parse(req.body);

  const item = await vendorAdvancedService.createInventoryItem(data);

  res.json({
    success: true,
    data: item,
  });
}));

/**
 * PUT /vendor-advanced/inventory/:id/quantity
 * Update inventory quantity
 */
const updateQuantitySchema = z.object({
  quantity: z.number(),
  vendor_id: z.string(),
});

router.put('/inventory/:id/quantity', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { quantity, vendor_id } = updateQuantitySchema.parse(req.body);

  await vendorAdvancedService.updateInventoryQuantity(id, vendor_id, quantity);

  res.json({
    success: true,
    data: {
      message: 'Quantity updated',
    },
  });
}));

/**
 * GET /vendor-advanced/availability
 * Get availability
 */
router.get('/availability', asyncHandler(async (req: AuthRequest, res: Response) => {
  const vendorId = req.query.vendor_id as string;
  const startDate = new Date(req.query.start_date as string);
  const endDate = new Date(req.query.end_date as string);
  const inventoryId = req.query.inventory_id as string;

  const availability = await vendorAdvancedService.getAvailability(
    vendorId,
    startDate,
    endDate,
    inventoryId
  );

  res.json({
    success: true,
    data: availability,
  });
}));

/**
 * POST /vendor-advanced/availability
 * Set availability
 */
const setAvailabilitySchema = z.object({
  vendor_id: z.string(),
  inventory_id: z.string().optional(),
  date: z.string(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  available_quantity: z.number().optional(),
  is_available: z.boolean(),
  notes: z.string().optional(),
});

router.post('/availability', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = setAvailabilitySchema.parse(req.body);

  const availability = await vendorAdvancedService.setAvailability({
    ...data,
    date: new Date(data.date),
  });

  res.json({
    success: true,
    data: availability,
  });
}));

/**
 * GET /vendor-advanced/pricing-rules
 * Get pricing rules
 */
router.get('/pricing-rules', asyncHandler(async (req: AuthRequest, res: Response) => {
  const vendorId = req.query.vendor_id as string;
  const inventoryId = req.query.inventory_id as string;

  const rules = await vendorAdvancedService.getPricingRules(vendorId, inventoryId);

  res.json({
    success: true,
    data: rules,
  });
}));

/**
 * POST /vendor-advanced/pricing-rules
 * Create pricing rule
 */
const createPricingRuleSchema = z.object({
  vendor_id: z.string(),
  inventory_id: z.string().optional(),
  rule_type: z.string(),
  rule_name: z.string(),
  conditions: z.record(z.any()),
  adjustment_type: z.enum(['percentage', 'fixed']),
  adjustment_value: z.number(),
  priority: z.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

router.post('/pricing-rules', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createPricingRuleSchema.parse(req.body);

  const rule = await vendorAdvancedService.createPricingRule({
    ...data,
    start_date: data.start_date ? new Date(data.start_date) : undefined,
    end_date: data.end_date ? new Date(data.end_date) : undefined,
  });

  res.json({
    success: true,
    data: rule,
  });
}));

/**
 * POST /vendor-advanced/calculate-price
 * Calculate price with rules
 */
const calculatePriceSchema = z.object({
  vendor_id: z.string(),
  inventory_id: z.string(),
  base_price: z.number(),
  context: z.record(z.any()),
});

router.post('/calculate-price', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { vendor_id, inventory_id, base_price, context } = calculatePriceSchema.parse(req.body);

  const result = await vendorAdvancedService.calculatePrice(
    vendor_id,
    inventory_id,
    base_price,
    context
  );

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * GET /vendor-advanced/campaigns
 * Get promotional campaigns
 */
router.get('/campaigns', asyncHandler(async (req: AuthRequest, res: Response) => {
  const vendorId = req.query.vendor_id as string;
  const includeInactive = req.query.include_inactive === 'true';

  const campaigns = await vendorAdvancedService.getCampaigns(vendorId, includeInactive);

  res.json({
    success: true,
    data: campaigns,
  });
}));

/**
 * POST /vendor-advanced/campaigns
 * Create promotional campaign
 */
const createCampaignSchema = z.object({
  vendor_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  campaign_type: z.string(),
  discount_type: z.string().optional(),
  discount_value: z.number().optional(),
  min_purchase_amount: z.number().optional(),
  max_discount_amount: z.number().optional(),
  usage_limit: z.number().optional(),
  promo_code: z.string().optional(),
  applicable_items: z.array(z.string()).optional(),
  start_date: z.string(),
  end_date: z.string(),
  metadata: z.record(z.any()).optional(),
});

router.post('/campaigns', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createCampaignSchema.parse(req.body);

  const campaign = await vendorAdvancedService.createCampaign({
    ...data,
    start_date: new Date(data.start_date),
    end_date: new Date(data.end_date),
  });

  res.json({
    success: true,
    data: campaign,
  });
}));

/**
 * POST /vendor-advanced/apply-promo
 * Apply promo code
 */
const applyPromoSchema = z.object({
  promo_code: z.string(),
  purchase_amount: z.number(),
  vendor_id: z.string().optional(),
});

router.post('/apply-promo', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { promo_code, purchase_amount, vendor_id } = applyPromoSchema.parse(req.body);

  const result = await vendorAdvancedService.applyPromoCode(
    promo_code,
    req.user!.id,
    purchase_amount,
    vendor_id
  );

  res.json({
    success: true,
    data: result,
  });
}));

export default router;
