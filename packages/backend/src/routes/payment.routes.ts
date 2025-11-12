import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { stripeService } from '../services/stripe.service';

const router = Router();

router.use(authenticate);

const createPaymentIntentSchema = z.object({
  quoteId: z.string().uuid(),
  amount: z.number().min(1),
  currency: z.string().default('usd'),
});

router.post('/intent', asyncHandler(async (req: AuthRequest, res) => {
  const data = createPaymentIntentSchema.parse(req.body);
  const result = await stripeService.createPaymentIntent(
    data.quoteId,
    data.amount,
    data.currency,
    req.user!.id
  );

  res.status(201).json({ success: true, data: result });
}));

router.post('/intent/:id/confirm', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const result = await stripeService.confirmPayment(id);
  res.json({ success: true, data: result });
}));

router.post('/escrow/:id/release', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  await stripeService.releaseEscrow(id);
  res.json({ success: true, message: 'Escrow funds released' });
}));

router.post('/refund/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;
  const result = await stripeService.refundPayment(id, amount, reason);
  res.json({ success: true, data: result });
}));

router.get('/history', asyncHandler(async (req: AuthRequest, res) => {
  const history = await stripeService.getPaymentHistory(req.user!.id);
  res.json({ success: true, data: history });
}));

router.post('/webhook', asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  await stripeService.handleWebhook(signature, req.body);
  res.json({ received: true });
}));

export default router;
