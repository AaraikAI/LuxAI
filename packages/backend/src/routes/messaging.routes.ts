import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { messagingService } from '../services/messaging.service';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /messaging/conversations
 * Get user's conversations
 */
router.get('/conversations', asyncHandler(async (req: AuthRequest, res: Response) => {
  const conversations = await messagingService.getUserConversations(req.user!.id);

  res.json({
    success: true,
    data: conversations,
  });
}));

/**
 * POST /messaging/conversations
 * Create conversation
 */
const createConversationSchema = z.object({
  type: z.enum(['direct', 'group', 'support']),
  title: z.string().optional(),
  participant_ids: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
});

router.post('/conversations', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createConversationSchema.parse(req.body);

  const conversation = await messagingService.createConversation({
    ...data,
    created_by: req.user!.id,
  });

  res.json({
    success: true,
    data: conversation,
  });
}));

/**
 * GET /messaging/conversations/:id
 * Get conversation details
 */
router.get('/conversations/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const conversation = await messagingService.getConversation(id, req.user!.id);

  res.json({
    success: true,
    data: conversation,
  });
}));

/**
 * GET /messaging/conversations/:id/messages
 * Get conversation messages
 */
router.get('/conversations/:id/messages', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const messages = await messagingService.getMessages(id, req.user!.id, limit, offset);

  res.json({
    success: true,
    data: messages,
  });
}));

/**
 * POST /messaging/conversations/:id/messages
 * Send message
 */
const sendMessageSchema = z.object({
  content: z.string(),
  message_type: z.enum(['text', 'file', 'image', 'system']).optional(),
  attachments: z.array(z.any()).optional(),
  reply_to_id: z.string().optional(),
});

router.post('/conversations/:id/messages', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = sendMessageSchema.parse(req.body);

  const message = await messagingService.sendMessage({
    ...data,
    conversation_id: id,
    sender_id: req.user!.id,
  });

  res.json({
    success: true,
    data: message,
  });
}));

/**
 * PUT /messaging/conversations/:id/read
 * Mark conversation as read
 */
router.put('/conversations/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await messagingService.markAsRead(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Conversation marked as read',
    },
  });
}));

/**
 * PUT /messaging/messages/:id
 * Update message
 */
const updateMessageSchema = z.object({
  content: z.string(),
});

router.put('/messages/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content } = updateMessageSchema.parse(req.body);

  const message = await messagingService.updateMessage(id, req.user!.id, content);

  res.json({
    success: true,
    data: message,
  });
}));

/**
 * DELETE /messaging/messages/:id
 * Delete message
 */
router.delete('/messages/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await messagingService.deleteMessage(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Message deleted',
    },
  });
}));

/**
 * POST /messaging/messages/:id/reactions
 * Add reaction to message
 */
const addReactionSchema = z.object({
  emoji: z.string(),
});

router.post('/messages/:id/reactions', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { emoji } = addReactionSchema.parse(req.body);

  await messagingService.addReaction(id, req.user!.id, emoji);

  res.json({
    success: true,
    data: {
      message: 'Reaction added',
    },
  });
}));

/**
 * DELETE /messaging/messages/:id/reactions/:emoji
 * Remove reaction from message
 */
router.delete('/messages/:id/reactions/:emoji', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, emoji } = req.params;

  await messagingService.removeReaction(id, req.user!.id, emoji);

  res.json({
    success: true,
    data: {
      message: 'Reaction removed',
    },
  });
}));

/**
 * POST /messaging/conversations/:id/typing
 * Set typing indicator
 */
router.post('/conversations/:id/typing', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await messagingService.setTypingIndicator(id, req.user!.id);

  res.json({
    success: true,
    data: {
      message: 'Typing indicator set',
    },
  });
}));

/**
 * GET /messaging/conversations/:id/typing
 * Get typing users
 */
router.get('/conversations/:id/typing', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const typingUsers = await messagingService.getTypingUsers(id);

  res.json({
    success: true,
    data: {
      typing_users: typingUsers,
    },
  });
}));

export default router;
