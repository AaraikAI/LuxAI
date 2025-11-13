import Stripe from 'stripe';
import { config } from '../config';
import { query } from '../db';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Stripe Payment Service
 * Handles payment processing, escrow, and Connect integration
 */
export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!config.stripe.secretKey) {
      logger.warn('Stripe not configured');
    }

    this.stripe = new Stripe(config.stripe.secretKey || 'sk_test_dummy', {
      apiVersion: '2024-11-20.acacia' as any, // Latest Stripe API version
    });
  }

  /**
   * Create Stripe Connect account for vendor
   */
  async createConnectAccount(vendorId: string, email: string): Promise<{
    accountId: string;
    onboardingUrl: string;
  }> {
    try {
      // Create Stripe Connect account
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      // Create account link for onboarding
      const accountLink = await this.stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${config.webUrl}/vendor/dashboard`,
        return_url: `${config.webUrl}/vendor/dashboard?setup=complete`,
        type: 'account_onboarding',
      });

      // Store account ID in database
      await query(
        `UPDATE vendors
         SET stripe_account_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [account.id, vendorId]
      );

      logger.info('Stripe Connect account created', { vendorId, accountId: account.id });

      return {
        accountId: account.id,
        onboardingUrl: accountLink.url,
      };
    } catch (error: any) {
      logger.error('Failed to create Stripe Connect account', { error, vendorId });
      throw new AppError(500, 'STRIPE_CONNECT_FAILED', 'Failed to create payment account');
    }
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(
    quoteId: string,
    amount: number,
    currency: string = 'usd',
    clientId: string
  ): Promise<{
    paymentIntentId: string;
    clientSecret: string;
    requiresEscrow: boolean;
  }> {
    try {
      const requiresEscrow = amount > 50000; // >$50k requires escrow

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          quoteId,
          clientId,
          requiresEscrow: requiresEscrow.toString(),
        },
        capture_method: requiresEscrow ? 'manual' : 'automatic',
      });

      // Store in database
      await query(
        `INSERT INTO payment_intents (
          id, quote_id, client_id, amount, currency, status,
          payment_method, stripe_payment_intent_id, escrow_required
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          paymentIntent.id,
          quoteId,
          clientId,
          amount,
          currency,
          'pending',
          'card',
          paymentIntent.id,
          requiresEscrow,
        ]
      );

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount,
        requiresEscrow,
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        requiresEscrow,
      };
    } catch (error: any) {
      logger.error('Failed to create payment intent', { error, quoteId });
      throw new AppError(500, 'PAYMENT_INTENT_FAILED', 'Failed to create payment intent');
    }
  }

  /**
   * Confirm payment
   */
  async confirmPayment(paymentIntentId: string): Promise<{ status: string }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.capture_method === 'manual') {
        // Escrow payment - hold funds
        logger.info('Payment held in escrow', { paymentIntentId });

        await query(
          `UPDATE payment_intents
           SET status = $1, updated_at = CURRENT_TIMESTAMP
           WHERE stripe_payment_intent_id = $2`,
          ['escrowed', paymentIntentId]
        );

        return { status: 'escrowed' };
      } else {
        // Automatic capture
        await query(
          `UPDATE payment_intents
           SET status = $1, updated_at = CURRENT_TIMESTAMP
           WHERE stripe_payment_intent_id = $2`,
          ['succeeded', paymentIntentId]
        );

        return { status: 'succeeded' };
      }
    } catch (error: any) {
      logger.error('Failed to confirm payment', { error, paymentIntentId });
      throw new AppError(500, 'PAYMENT_CONFIRM_FAILED', 'Failed to confirm payment');
    }
  }

  /**
   * Release escrow funds
   */
  async releaseEscrow(paymentIntentId: string): Promise<void> {
    try {
      // Capture the held payment
      await this.stripe.paymentIntents.capture(paymentIntentId);

      await query(
        `UPDATE payment_intents
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE stripe_payment_intent_id = $2`,
        ['succeeded', paymentIntentId]
      );

      logger.info('Escrow funds released', { paymentIntentId });
    } catch (error: any) {
      logger.error('Failed to release escrow', { error, paymentIntentId });
      throw new AppError(500, 'ESCROW_RELEASE_FAILED', 'Failed to release escrow funds');
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<{ refundId: string }> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason as any,
      });

      await query(
        `UPDATE payment_intents
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE stripe_payment_intent_id = $2`,
        ['refunded', paymentIntentId]
      );

      logger.info('Payment refunded', { paymentIntentId, refundId: refund.id });

      return { refundId: refund.id };
    } catch (error: any) {
      logger.error('Failed to refund payment', { error, paymentIntentId });
      throw new AppError(500, 'REFUND_FAILED', 'Failed to refund payment');
    }
  }

  /**
   * Transfer funds to vendor
   */
  async transferToVendor(
    vendorId: string,
    amount: number,
    currency: string = 'usd',
    description: string
  ): Promise<{ transferId: string }> {
    try {
      // Get vendor's Stripe account ID
      const vendorResult = await query(
        'SELECT stripe_account_id FROM vendors WHERE id = $1',
        [vendorId]
      );

      if (vendorResult.rows.length === 0) {
        throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
      }

      const stripeAccountId = vendorResult.rows[0].stripe_account_id;

      if (!stripeAccountId) {
        throw new AppError(
          400,
          'NO_STRIPE_ACCOUNT',
          'Vendor has not set up payment account'
        );
      }

      // Calculate platform fee (5% commission)
      const platformFee = Math.round(amount * 0.05);
      const vendorAmount = amount - platformFee;

      // Create transfer
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(vendorAmount * 100),
        currency,
        destination: stripeAccountId,
        description,
      });

      logger.info('Funds transferred to vendor', {
        vendorId,
        transferId: transfer.id,
        amount: vendorAmount,
        platformFee,
      });

      return { transferId: transfer.id };
    } catch (error: any) {
      logger.error('Failed to transfer funds to vendor', { error, vendorId });
      throw new AppError(500, 'TRANSFER_FAILED', 'Failed to transfer funds to vendor');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(
    signature: string,
    payload: string | Buffer
  ): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      logger.info('Stripe webhook received', { type: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'account.updated':
          await this.handleAccountUpdated(event.data.object as Stripe.Account);
          break;
        default:
          logger.info('Unhandled webhook event', { type: event.type });
      }
    } catch (error: any) {
      logger.error('Failed to handle webhook', { error });
      throw error;
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await query(
      `UPDATE payment_intents
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE stripe_payment_intent_id = $2`,
      ['succeeded', paymentIntent.id]
    );

    logger.info('Payment succeeded webhook processed', { paymentIntentId: paymentIntent.id });
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await query(
      `UPDATE payment_intents
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE stripe_payment_intent_id = $2`,
      ['failed', paymentIntent.id]
    );

    logger.info('Payment failed webhook processed', { paymentIntentId: paymentIntent.id });
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    // Update vendor account status
    logger.info('Stripe account updated', { accountId: account.id });
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(clientId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT
          pi.*,
          q.total as quote_total,
          i.title as itinerary_title
         FROM payment_intents pi
         JOIN quotes q ON q.id = pi.quote_id
         LEFT JOIN itineraries i ON i.id = q.itinerary_id
         WHERE pi.client_id = $1
         ORDER BY pi.created_at DESC`,
        [clientId]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get payment history', { error, clientId });
      throw new AppError(500, 'PAYMENT_HISTORY_FAILED', 'Failed to fetch payment history');
    }
  }
}

export const stripeService = new StripeService();
