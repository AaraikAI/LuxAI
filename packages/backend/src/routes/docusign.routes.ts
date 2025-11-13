import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { docuSignService } from '../services/docusign.service';

const router = Router();

router.use(authenticate);

const createEnvelopeSchema = z.object({
  documentId: z.string().uuid(),
  signers: z.array(z.object({
    name: z.string(),
    email: z.string().email(),
    recipientId: z.string(),
    routingOrder: z.number(),
  })),
  emailSubject: z.string(),
  emailBody: z.string(),
  templateId: z.string().optional(),
});

router.post('/envelope', asyncHandler(async (req: AuthRequest, res) => {
  const data = createEnvelopeSchema.parse(req.body);
  await docuSignService.initialize();
  const result = await docuSignService.createEnvelope(data);
  res.status(201).json({ success: true, data: result });
}));

router.get('/envelope/:id/status', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const status = await docuSignService.getEnvelopeStatus(id);
  res.json({ success: true, data: status });
}));

router.get('/envelope/:id/download', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const document = await docuSignService.downloadSignedDocument(id);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(document);
}));

router.post('/envelope/:id/void', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  await docuSignService.voidEnvelope(id, reason);
  res.json({ success: true, message: 'Envelope voided' });
}));

router.post('/webhook', asyncHandler(async (req, res) => {
  await docuSignService.handleWebhook(req.body);
  res.json({ received: true });
}));

export default router;
