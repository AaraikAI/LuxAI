import { getPool } from '../db';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface CreatePostRequest {
  authorId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isAnonymous: boolean;
}

export interface CreateReplyRequest {
  postId: string;
  authorId: string;
  content: string;
  isAnonymous: boolean;
}

export interface ForumPost {
  id: string;
  authorId: string;
  authorName: string;
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
  authorName: string;
  pseudonym?: string;
  content: string;
  isAnonymous: boolean;
  upvotes: number;
  createdAt: Date;
}

export class ForumService {
  /**
   * Generate a pseudonym for anonymous posts
   */
  private generatePseudonym(userId: string): string {
    // Generate consistent pseudonym based on user ID
    const adjectives = ['Elegant', 'Sophisticated', 'Distinguished', 'Refined', 'Cultured', 'Discerning'];
    const nouns = ['Traveler', 'Explorer', 'Voyager', 'Wanderer', 'Connoisseur', 'Enthusiast'];

    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const adj = adjectives[hash % adjectives.length];
    const noun = nouns[(hash * 17) % nouns.length];
    const num = (hash % 9000) + 1000;

    return `${adj}${noun}${num}`;
  }

  /**
   * Create a new forum post
   */
  async createPost(request: CreatePostRequest): Promise<string> {
    const pool = getPool();

    try {
      const postId = uuidv4();
      const pseudonym = request.isAnonymous ? this.generatePseudonym(request.authorId) : null;

      await pool.query(
        `
        INSERT INTO forum_posts (
          id,
          author_id,
          pseudonym,
          title,
          content,
          category,
          tags,
          is_anonymous,
          reply_count,
          view_count,
          upvotes,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, NOW(), NOW())
        `,
        [
          postId,
          request.authorId,
          pseudonym,
          request.title,
          request.content,
          request.category,
          request.tags,
          request.isAnonymous,
        ]
      );

      return postId;
    } catch (error) {
      logger.error('Failed to create forum post', error);
      throw new Error('Failed to create post');
    }
  }

  /**
   * Get all posts with optional filtering
   */
  async getPosts(category?: string, tags?: string[], limit: number = 50): Promise<ForumPost[]> {
    const pool = getPool();

    try {
      let query = `
        SELECT
          fp.id,
          fp.author_id,
          CASE
            WHEN fp.is_anonymous THEN fp.pseudonym
            ELSE u.first_name || ' ' || u.last_name
          END as author_name,
          fp.pseudonym,
          fp.title,
          fp.content,
          fp.category,
          fp.tags,
          fp.is_anonymous,
          fp.reply_count,
          fp.view_count,
          fp.upvotes,
          fp.created_at,
          fp.updated_at
        FROM forum_posts fp
        LEFT JOIN users u ON fp.author_id = u.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        query += ` AND fp.category = $${paramIndex++}`;
        params.push(category);
      }

      if (tags && tags.length > 0) {
        query += ` AND fp.tags && $${paramIndex++}::text[]`;
        params.push(tags);
      }

      query += ` ORDER BY fp.created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await pool.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: row.author_name,
        pseudonym: row.pseudonym,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isAnonymous: row.is_anonymous,
        replyCount: row.reply_count,
        viewCount: row.view_count,
        upvotes: row.upvotes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get forum posts', error);
      throw new Error('Failed to get posts');
    }
  }

  /**
   * Get a single post by ID
   */
  async getPostById(postId: string): Promise<ForumPost | null> {
    const pool = getPool();

    try {
      const result = await pool.query(
        `
        SELECT
          fp.id,
          fp.author_id,
          CASE
            WHEN fp.is_anonymous THEN fp.pseudonym
            ELSE u.first_name || ' ' || u.last_name
          END as author_name,
          fp.pseudonym,
          fp.title,
          fp.content,
          fp.category,
          fp.tags,
          fp.is_anonymous,
          fp.reply_count,
          fp.view_count,
          fp.upvotes,
          fp.created_at,
          fp.updated_at
        FROM forum_posts fp
        LEFT JOIN users u ON fp.author_id = u.id
        WHERE fp.id = $1
        `,
        [postId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        authorId: row.author_id,
        authorName: row.author_name,
        pseudonym: row.pseudonym,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isAnonymous: row.is_anonymous,
        replyCount: row.reply_count,
        viewCount: row.view_count,
        upvotes: row.upvotes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get post by ID', error);
      throw new Error('Failed to get post');
    }
  }

  /**
   * Increment view count for a post
   */
  async recordPostView(postId: string): Promise<void> {
    const pool = getPool();

    try {
      await pool.query(
        `UPDATE forum_posts SET view_count = view_count + 1 WHERE id = $1`,
        [postId]
      );
    } catch (error) {
      logger.error('Failed to record post view', error);
      // Don't throw - non-critical operation
    }
  }

  /**
   * Create a reply to a post
   */
  async createReply(request: CreateReplyRequest): Promise<string> {
    const pool = getPool();

    try {
      const replyId = uuidv4();
      const pseudonym = request.isAnonymous ? this.generatePseudonym(request.authorId) : null;

      await pool.query(
        `
        INSERT INTO forum_replies (
          id,
          post_id,
          author_id,
          pseudonym,
          content,
          is_anonymous,
          upvotes,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
        `,
        [replyId, request.postId, request.authorId, pseudonym, request.content, request.isAnonymous]
      );

      // Increment reply count on the post
      await pool.query(
        `UPDATE forum_posts SET reply_count = reply_count + 1 WHERE id = $1`,
        [request.postId]
      );

      return replyId;
    } catch (error) {
      logger.error('Failed to create reply', error);
      throw new Error('Failed to create reply');
    }
  }

  /**
   * Get replies for a post
   */
  async getReplies(postId: string): Promise<ForumReply[]> {
    const pool = getPool();

    try {
      const result = await pool.query(
        `
        SELECT
          fr.id,
          fr.post_id,
          fr.author_id,
          CASE
            WHEN fr.is_anonymous THEN fr.pseudonym
            ELSE u.first_name || ' ' || u.last_name
          END as author_name,
          fr.pseudonym,
          fr.content,
          fr.is_anonymous,
          fr.upvotes,
          fr.created_at
        FROM forum_replies fr
        LEFT JOIN users u ON fr.author_id = u.id
        WHERE fr.post_id = $1
        ORDER BY fr.created_at ASC
        `,
        [postId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        postId: row.post_id,
        authorId: row.author_id,
        authorName: row.author_name,
        pseudonym: row.pseudonym,
        content: row.content,
        isAnonymous: row.is_anonymous,
        upvotes: row.upvotes,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get replies', error);
      throw new Error('Failed to get replies');
    }
  }

  /**
   * Upvote a post
   */
  async upvotePost(postId: string, userId: string): Promise<void> {
    const pool = getPool();

    try {
      // Check if user already upvoted
      const existingVote = await pool.query(
        `SELECT id FROM forum_votes WHERE post_id = $1 AND user_id = $2 AND vote_type = 'post'`,
        [postId, userId]
      );

      if (existingVote.rows.length > 0) {
        throw new Error('Already upvoted');
      }

      // Record vote
      await pool.query(
        `INSERT INTO forum_votes (id, post_id, user_id, vote_type, created_at) VALUES ($1, $2, $3, 'post', NOW())`,
        [uuidv4(), postId, userId]
      );

      // Increment upvote count
      await pool.query(
        `UPDATE forum_posts SET upvotes = upvotes + 1 WHERE id = $1`,
        [postId]
      );
    } catch (error) {
      logger.error('Failed to upvote post', error);
      throw error;
    }
  }

  /**
   * Upvote a reply
   */
  async upvoteReply(replyId: string, userId: string): Promise<void> {
    const pool = getPool();

    try {
      // Check if user already upvoted
      const existingVote = await pool.query(
        `SELECT id FROM forum_votes WHERE reply_id = $1 AND user_id = $2 AND vote_type = 'reply'`,
        [replyId, userId]
      );

      if (existingVote.rows.length > 0) {
        throw new Error('Already upvoted');
      }

      // Record vote
      await pool.query(
        `INSERT INTO forum_votes (id, reply_id, user_id, vote_type, created_at) VALUES ($1, $2, $3, 'reply', NOW())`,
        [uuidv4(), replyId, userId]
      );

      // Increment upvote count
      await pool.query(
        `UPDATE forum_replies SET upvotes = upvotes + 1 WHERE id = $1`,
        [replyId]
      );
    } catch (error) {
      logger.error('Failed to upvote reply', error);
      throw error;
    }
  }

  /**
   * Get trending posts (most active in last 7 days)
   */
  async getTrendingPosts(limit: number = 10): Promise<ForumPost[]> {
    const pool = getPool();

    try {
      const result = await pool.query(
        `
        SELECT
          fp.id,
          fp.author_id,
          CASE
            WHEN fp.is_anonymous THEN fp.pseudonym
            ELSE u.first_name || ' ' || u.last_name
          END as author_name,
          fp.pseudonym,
          fp.title,
          fp.content,
          fp.category,
          fp.tags,
          fp.is_anonymous,
          fp.reply_count,
          fp.view_count,
          fp.upvotes,
          fp.created_at,
          fp.updated_at
        FROM forum_posts fp
        LEFT JOIN users u ON fp.author_id = u.id
        WHERE fp.created_at > NOW() - INTERVAL '7 days'
        ORDER BY (fp.reply_count + fp.upvotes + fp.view_count / 10) DESC
        LIMIT $1
        `,
        [limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: row.author_name,
        pseudonym: row.pseudonym,
        title: row.title,
        content: row.content,
        category: row.category,
        tags: row.tags,
        isAnonymous: row.is_anonymous,
        replyCount: row.reply_count,
        viewCount: row.view_count,
        upvotes: row.upvotes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to get trending posts', error);
      throw new Error('Failed to get trending posts');
    }
  }
}

export const forumService = new ForumService();
