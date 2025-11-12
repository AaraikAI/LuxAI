import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { approvalService, ApprovalStatus } from '../services/approval.service';
import { UserRole } from '@luxai/shared';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

const createApprovalSchema = z.object({
  itineraryId: z.string().uuid(),
  lineItemId: z.string().uuid().optional(),
  approverId: z.string().uuid(),
  approverRole: z.string(),
  budgetCap: z.number().optional(),
  notes: z.string().optional(),
});

const processDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

const initiateWorkflowSchema = z.object({
  itineraryId: z.string().uuid(),
  requiresAssistantApproval: z.boolean().default(true),
  requiresFamilyOfficeApproval: z.boolean().default(true),
  requiresPrincipalApproval: z.boolean().default(true),
  budgetThreshold: z.number().optional(),
});

/**
 * Create approval request
 * POST /api/approvals
 */
router.post(
  '/',
  authorize(UserRole.CLIENT, UserRole.DESIGNER, UserRole.AGENCY_MANAGER),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = createApprovalSchema.parse(req.body);

    const approval = await approvalService.createApproval(data);

    res.status(201).json({
      success: true,
      data: approval,
    });
  })
);

/**
 * Get pending approvals for current user
 * GET /api/approvals/pending
 */
router.get(
  '/pending',
  asyncHandler(async (req: AuthRequest, res) => {
    const approvals = await approvalService.getPendingApprovals(
      req.user!.id,
      req.user!.role
    );

    res.json({
      success: true,
      data: approvals,
      meta: {
        count: approvals.length,
      },
    });
  })
);

/**
 * Get approval history for an itinerary
 * GET /api/approvals/itinerary/:itineraryId
 */
router.get(
  '/itinerary/:itineraryId',
  asyncHandler(async (req: AuthRequest, res) => {
    const { itineraryId } = req.params;

    // Verify user has access to this itinerary
    const { query } = await import('../db');
    const itinResult = await query(
      'SELECT client_id, designer_id FROM itineraries WHERE id = $1',
      [itineraryId]
    );

    if (itinResult.rows.length === 0) {
      throw new AppError(404, 'ITINERARY_NOT_FOUND', 'Itinerary not found');
    }

    const itinerary = itinResult.rows[0];
    const isAuthorized =
      req.user!.id === itinerary.client_id ||
      req.user!.id === itinerary.designer_id ||
      req.user!.role === UserRole.ADMIN;

    if (!isAuthorized) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    const history = await approvalService.getApprovalHistory(itineraryId);

    res.json({
      success: true,
      data: history,
    });
  })
);

/**
 * Process approval decision
 * POST /api/approvals/:approvalId/decision
 */
router.post(
  '/:approvalId/decision',
  asyncHandler(async (req: AuthRequest, res) => {
    const { approvalId } = req.params;
    const data = processDecisionSchema.parse(req.body);

    // Verify user is the approver
    const { query } = await import('../db');
    const approvalResult = await query(
      'SELECT approver_id FROM approvals WHERE id = $1',
      [approvalId]
    );

    if (approvalResult.rows.length === 0) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval not found');
    }

    if (approvalResult.rows[0].approver_id !== req.user!.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the assigned approver can process this approval');
    }

    const result = await approvalService.processApprovalDecision({
      approvalId,
      decision: data.decision,
      notes: data.notes,
    });

    res.json({
      success: true,
      data: result,
      message: data.decision === 'approve'
        ? result.completed
          ? 'Itinerary fully approved and ready to book'
          : `Approval processed. Waiting for ${result.nextApprover} approval.`
        : 'Itinerary rejected',
    });
  })
);

/**
 * Check if budget exceeds cap
 * GET /api/approvals/budget-check/:itineraryId
 */
router.get(
  '/budget-check/:itineraryId',
  asyncHandler(async (req: AuthRequest, res) => {
    const { itineraryId } = req.params;
    const budgetCap = req.query.budgetCap
      ? parseFloat(req.query.budgetCap as string)
      : undefined;

    const result = await approvalService.checkBudgetExceeded(itineraryId, budgetCap);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * Initiate approval workflow
 * POST /api/approvals/workflow/initiate
 */
router.post(
  '/workflow/initiate',
  authorize(UserRole.CLIENT, UserRole.DESIGNER),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = initiateWorkflowSchema.parse(req.body);

    // Verify user has access to this itinerary
    const { query } = await import('../db');
    const itinResult = await query(
      'SELECT client_id, designer_id FROM itineraries WHERE id = $1',
      [data.itineraryId]
    );

    if (itinResult.rows.length === 0) {
      throw new AppError(404, 'ITINERARY_NOT_FOUND', 'Itinerary not found');
    }

    const itinerary = itinResult.rows[0];
    const isAuthorized =
      req.user!.id === itinerary.client_id ||
      req.user!.id === itinerary.designer_id;

    if (!isAuthorized) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    const result = await approvalService.initiateApprovalWorkflow(
      data.itineraryId,
      {
        itineraryId: data.itineraryId,
        currentStatus: ApprovalStatus.PENDING,
        requiresAssistantApproval: data.requiresAssistantApproval,
        requiresFamilyOfficeApproval: data.requiresFamilyOfficeApproval,
        requiresPrincipalApproval: data.requiresPrincipalApproval,
        budgetThreshold: data.budgetThreshold || 0,
      }
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Approval workflow initiated successfully',
    });
  })
);

export default router;
