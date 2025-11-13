import { Router } from 'express';
import { vaultService } from '../services/vault.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /vault/search
 * Search the Vault for deals
 */
router.post('/search', authenticate, async (req, res) => {
  try {
    const filters = req.body;
    const deals = await vaultService.searchDeals(filters);

    res.json({
      success: true,
      data: deals,
    });
  } catch (error: any) {
    logger.error('Vault search failed', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VAULT_SEARCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /vault/featured
 * Get featured/curated deals
 */
router.get('/featured', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const deals = await vaultService.getFeaturedDeals(limit);

    res.json({
      success: true,
      data: deals,
    });
  } catch (error: any) {
    logger.error('Failed to get featured deals', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FEATURED_DEALS_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /vault/deals/:id
 * Get deal details by ID
 */
router.get('/deals/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deal = await vaultService.getDealById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEAL_NOT_FOUND',
          message: 'Deal not found',
        },
      });
    }

    // Record view
    await vaultService.recordDealView(id);

    res.json({
      success: true,
      data: deal,
    });
  } catch (error: any) {
    logger.error('Failed to get deal', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_DEAL_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /vault/deals/:id/quote
 * Request a quote for a deal
 */
router.post('/deals/:id/quote', authenticate, async (req, res) => {
  try {
    const { id: dealId } = req.params;
    const clientId = (req as any).user.id;
    const details = req.body;

    const quoteId = await vaultService.requestQuote(dealId, clientId, details);

    res.json({
      success: true,
      data: { quoteId },
    });
  } catch (error: any) {
    logger.error('Failed to request quote', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'QUOTE_REQUEST_FAILED',
        message: error.message,
      },
    });
  }
});

export default router;
