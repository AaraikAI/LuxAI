import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'support';
  title?: string;
  created_by: string;
  is_active: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  participants?: ConversationParticipant[];
  unread_count?: number;
  last_message?: Message;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: Date;
  last_read_at?: Date;
  is_muted: boolean;
  user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'file' | 'image' | 'system';
  attachments: any[];
  metadata: any;
  reply_to_id?: string;
  is_edited: boolean;
  edited_at?: Date;
  is_deleted: boolean;
  deleted_at?: Date;
  created_at: Date;
  sender?: {
    id: string;
    email: string;
    full_name?: string;
  };
  read_receipts?: number;
  reactions?: any[];
}

export class MessagingService {
  /**
   * Get user's conversations
   */
  async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const result = await query(
        `SELECT c.*,
                COUNT(m.id) FILTER (WHERE m.created_at > COALESCE(cp.last_read_at, '1970-01-01')) as unread_count,
                (
                  SELECT row_to_json(last_msg.*)
                  FROM (
                    SELECT id, sender_id, content, message_type, created_at
                    FROM messages
                    WHERE conversation_id = c.id AND is_deleted = false
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) last_msg
                ) as last_message
         FROM conversations c
         INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
         LEFT JOIN messages m ON c.id = m.conversation_id AND m.is_deleted = false
         WHERE cp.user_id = $1 AND c.is_active = true
         GROUP BY c.id, cp.last_read_at
         ORDER BY COALESCE((
           SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id
         ), c.created_at) DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        ...row,
        metadata: row.metadata,
        unread_count: parseInt(row.unread_count),
        last_message: row.last_message,
      }));
    } catch (error) {
      logger.error('Failed to get user conversations', { error, userId });
      throw error;
    }
  }

  /**
   * Create conversation
   */
  async createConversation(data: {
    type: 'direct' | 'group' | 'support';
    title?: string;
    created_by: string;
    participant_ids: string[];
    metadata?: any;
  }): Promise<Conversation> {
    try {
      // For direct conversations, check if one already exists
      if (data.type === 'direct' && data.participant_ids.length === 1) {
        const existingConv = await this.findDirectConversation(
          data.created_by,
          data.participant_ids[0]
        );
        if (existingConv) {
          return existingConv;
        }
      }

      // Create conversation
      const result = await query(
        `INSERT INTO conversations (type, title, created_by, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.type, data.title, data.created_by, JSON.stringify(data.metadata || {})]
      );

      const conversation = result.rows[0];

      // Add creator as admin participant
      await query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [conversation.id, data.created_by]
      );

      // Add other participants
      for (const participantId of data.participant_ids) {
        if (participantId !== data.created_by) {
          await query(
            `INSERT INTO conversation_participants (conversation_id, user_id, role)
             VALUES ($1, $2, 'member')`,
            [conversation.id, participantId]
          );
        }
      }

      logger.info('Conversation created', { conversationId: conversation.id, type: data.type });

      return {
        ...conversation,
        metadata: conversation.metadata,
      };
    } catch (error) {
      logger.error('Failed to create conversation', { error, data });
      throw error;
    }
  }

  /**
   * Find existing direct conversation between two users
   */
  private async findDirectConversation(userId1: string, userId2: string): Promise<Conversation | null> {
    try {
      const result = await query(
        `SELECT c.*
         FROM conversations c
         INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
         INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
         WHERE c.type = 'direct'
           AND c.is_active = true
           AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
         LIMIT 1`,
        [userId1, userId2]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        ...result.rows[0],
        metadata: result.rows[0].metadata,
      };
    } catch (error) {
      logger.error('Failed to find direct conversation', { error, userId1, userId2 });
      return null;
    }
  }

  /**
   * Get conversation details
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation> {
    try {
      // Verify user is participant
      const participantCheck = await query(
        'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      if (participantCheck.rows.length === 0) {
        throw new AppError(403, 'FORBIDDEN', 'Not a participant of this conversation');
      }

      const result = await query(
        'SELECT * FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
      }

      // Get participants
      const participants = await this.getConversationParticipants(conversationId);

      return {
        ...result.rows[0],
        metadata: result.rows[0].metadata,
        participants,
      };
    } catch (error) {
      logger.error('Failed to get conversation', { error, conversationId, userId });
      throw error;
    }
  }

  /**
   * Get conversation participants
   */
  async getConversationParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    try {
      const result = await query(
        `SELECT cp.*, u.email, u.full_name
         FROM conversation_participants cp
         INNER JOIN users u ON cp.user_id = u.id
         WHERE cp.conversation_id = $1
         ORDER BY cp.joined_at ASC`,
        [conversationId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        conversation_id: row.conversation_id,
        user_id: row.user_id,
        role: row.role,
        joined_at: row.joined_at,
        last_read_at: row.last_read_at,
        is_muted: row.is_muted,
        user: {
          id: row.user_id,
          email: row.email,
          full_name: row.full_name,
        },
      }));
    } catch (error) {
      logger.error('Failed to get conversation participants', { error, conversationId });
      throw error;
    }
  }

  /**
   * Send message
   */
  async sendMessage(data: {
    conversation_id: string;
    sender_id: string;
    content: string;
    message_type?: 'text' | 'file' | 'image' | 'system';
    attachments?: any[];
    reply_to_id?: string;
  }): Promise<Message> {
    try {
      // Verify sender is participant
      const participantCheck = await query(
        'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [data.conversation_id, data.sender_id]
      );

      if (participantCheck.rows.length === 0) {
        throw new AppError(403, 'FORBIDDEN', 'Not a participant of this conversation');
      }

      // Create message
      const result = await query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, attachments, reply_to_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.conversation_id,
          data.sender_id,
          data.content,
          data.message_type || 'text',
          JSON.stringify(data.attachments || []),
          data.reply_to_id,
        ]
      );

      // Update conversation updated_at
      await query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [data.conversation_id]
      );

      logger.info('Message sent', { messageId: result.rows[0].id, conversationId: data.conversation_id });

      return {
        ...result.rows[0],
        attachments: result.rows[0].attachments,
        metadata: result.rows[0].metadata,
      };
    } catch (error) {
      logger.error('Failed to send message', { error, data });
      throw error;
    }
  }

  /**
   * Get conversation messages
   */
  async getMessages(
    conversationId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    try {
      // Verify user is participant
      const participantCheck = await query(
        'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      if (participantCheck.rows.length === 0) {
        throw new AppError(403, 'FORBIDDEN', 'Not a participant of this conversation');
      }

      const result = await query(
        `SELECT m.*, u.email, u.full_name,
                (SELECT COUNT(*) FROM message_read_receipts WHERE message_id = m.id) as read_receipts,
                (SELECT json_agg(json_build_object('emoji', emoji, 'user_id', user_id, 'created_at', created_at))
                 FROM message_reactions WHERE message_id = m.id) as reactions
         FROM messages m
         INNER JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = $1 AND m.is_deleted = false
         ORDER BY m.created_at DESC
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return result.rows.map((row) => ({
        id: row.id,
        conversation_id: row.conversation_id,
        sender_id: row.sender_id,
        content: row.content,
        message_type: row.message_type,
        attachments: row.attachments,
        metadata: row.metadata,
        reply_to_id: row.reply_to_id,
        is_edited: row.is_edited,
        edited_at: row.edited_at,
        is_deleted: row.is_deleted,
        deleted_at: row.deleted_at,
        created_at: row.created_at,
        sender: {
          id: row.sender_id,
          email: row.email,
          full_name: row.full_name,
        },
        read_receipts: parseInt(row.read_receipts),
        reactions: row.reactions || [],
      }));
    } catch (error) {
      logger.error('Failed to get messages', { error, conversationId, userId });
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      // Update last_read_at
      await query(
        `UPDATE conversation_participants
         SET last_read_at = NOW()
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );

      // Create read receipts for unread messages
      await query(
        `INSERT INTO message_read_receipts (message_id, user_id)
         SELECT m.id, $2
         FROM messages m
         LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_id = $2
         WHERE m.conversation_id = $1
           AND m.sender_id != $2
           AND mrr.id IS NULL
         ON CONFLICT DO NOTHING`,
        [conversationId, userId]
      );

      logger.info('Messages marked as read', { conversationId, userId });
    } catch (error) {
      logger.error('Failed to mark messages as read', { error, conversationId, userId });
      throw error;
    }
  }

  /**
   * Update message
   */
  async updateMessage(
    messageId: string,
    userId: string,
    content: string
  ): Promise<Message> {
    try {
      const result = await query(
        `UPDATE messages
         SET content = $1, is_edited = true, edited_at = NOW()
         WHERE id = $2 AND sender_id = $3
         RETURNING *`,
        [content, messageId, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Message not found or unauthorized');
      }

      logger.info('Message updated', { messageId, userId });

      return {
        ...result.rows[0],
        attachments: result.rows[0].attachments,
        metadata: result.rows[0].metadata,
      };
    } catch (error) {
      logger.error('Failed to update message', { error, messageId, userId });
      throw error;
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    try {
      const result = await query(
        `UPDATE messages
         SET is_deleted = true, deleted_at = NOW(), content = '[deleted]'
         WHERE id = $1 AND sender_id = $2`,
        [messageId, userId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'NOT_FOUND', 'Message not found or unauthorized');
      }

      logger.info('Message deleted', { messageId, userId });
    } catch (error) {
      logger.error('Failed to delete message', { error, messageId, userId });
      throw error;
    }
  }

  /**
   * Add reaction to message
   */
  async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      await query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [messageId, userId, emoji]
      );

      logger.info('Reaction added', { messageId, userId, emoji });
    } catch (error) {
      logger.error('Failed to add reaction', { error, messageId, userId, emoji });
      throw error;
    }
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      await query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [messageId, userId, emoji]
      );

      logger.info('Reaction removed', { messageId, userId, emoji });
    } catch (error) {
      logger.error('Failed to remove reaction', { error, messageId, userId, emoji });
      throw error;
    }
  }

  /**
   * Set typing indicator
   */
  async setTypingIndicator(conversationId: string, userId: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 5000); // 5 seconds

      await query(
        `INSERT INTO typing_indicators (conversation_id, user_id, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET started_at = NOW(), expires_at = $3`,
        [conversationId, userId, expiresAt]
      );
    } catch (error) {
      logger.error('Failed to set typing indicator', { error, conversationId, userId });
    }
  }

  /**
   * Get typing users
   */
  async getTypingUsers(conversationId: string): Promise<string[]> {
    try {
      // Clean up expired indicators
      await query('DELETE FROM typing_indicators WHERE expires_at < NOW()');

      const result = await query(
        'SELECT user_id FROM typing_indicators WHERE conversation_id = $1',
        [conversationId]
      );

      return result.rows.map((row) => row.user_id);
    } catch (error) {
      logger.error('Failed to get typing users', { error, conversationId });
      return [];
    }
  }
}

export const messagingService = new MessagingService();
