import { query } from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class SocialService {
  // Profile Management
  async getProfile(userId: string): Promise<any> {
    const result = await query(
      `SELECT up.*, u.email FROM user_profiles up
       INNER JOIN users u ON up.user_id = u.id
       WHERE up.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default profile
      return this.createProfile(userId);
    }

    return { ...result.rows[0], social_links: result.rows[0].social_links };
  }

  async createProfile(userId: string): Promise<any> {
    const result = await query(
      `INSERT INTO user_profiles (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING RETURNING *`,
      [userId]
    );
    return result.rows[0];
  }

  async updateProfile(userId: string, data: any): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (['display_name', 'bio', 'avatar_url', 'location', 'website', 'is_public'].includes(key)) {
        fields.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    });

    if (data.social_links) {
      fields.push(`social_links = $${paramIndex++}`);
      params.push(JSON.stringify(data.social_links));
    }

    params.push(userId);

    const result = await query(
      `UPDATE user_profiles SET ${fields.join(', ')}, updated_at = NOW()
       WHERE user_id = $${paramIndex} RETURNING *`,
      params
    );

    return { ...result.rows[0], social_links: result.rows[0].social_links };
  }

  // Follow System
  async followUser(followerId: string, followingId: string): Promise<void> {
    await query(
      `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );

    // Update counts
    await query(`UPDATE user_profiles SET following_count = following_count + 1 WHERE user_id = $1`, [followerId]);
    await query(`UPDATE user_profiles SET follower_count = follower_count + 1 WHERE user_id = $1`, [followingId]);

    // Create activity
    await this.createActivity({
      user_id: followingId,
      activity_type: 'follow',
      actor_id: followerId,
      target_type: 'user',
      target_id: followingId,
    });

    logger.info('User followed', { followerId, followingId });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const result = await query(
      `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    if (result.rowCount > 0) {
      await query(`UPDATE user_profiles SET following_count = GREATEST(0, following_count - 1) WHERE user_id = $1`, [followerId]);
      await query(`UPDATE user_profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE user_id = $1`, [followingId]);
    }

    logger.info('User unfollowed', { followerId, followingId });
  }

  async getFollowers(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const result = await query(
      `SELECT u.id, u.email, up.display_name, up.avatar_url, uf.created_at
       FROM user_follows uf
       INNER JOIN users u ON uf.follower_id = u.id
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE uf.following_id = $1
       ORDER BY uf.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getFollowing(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const result = await query(
      `SELECT u.id, u.email, up.display_name, up.avatar_url, uf.created_at
       FROM user_follows uf
       INNER JOIN users u ON uf.following_id = u.id
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE uf.follower_id = $1
       ORDER BY uf.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  // Activity Posts
  async createPost(data: any): Promise<any> {
    const result = await query(
      `INSERT INTO activity_posts
       (user_id, post_type, content, media_urls, linked_entity_type, linked_entity_id, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.user_id, data.post_type, data.content, JSON.stringify(data.media_urls || []),
       data.linked_entity_type, data.linked_entity_id, data.visibility || 'public']
    );

    await query(`UPDATE user_profiles SET post_count = post_count + 1 WHERE user_id = $1`, [data.user_id]);

    return { ...result.rows[0], media_urls: result.rows[0].media_urls };
  }

  async getFeed(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const result = await query(
      `SELECT ap.*, u.email, up.display_name, up.avatar_url,
              EXISTS(SELECT 1 FROM post_likes WHERE post_id = ap.id AND user_id = $1) as is_liked
       FROM activity_posts ap
       INNER JOIN users u ON ap.user_id = u.id
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE ap.visibility = 'public' OR ap.user_id = $1
          OR ap.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $1)
       ORDER BY ap.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => ({ ...row, media_urls: row.media_urls }));
  }

  async likePost(postId: string, userId: string): Promise<void> {
    await query(
      `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, userId]
    );

    await query(`UPDATE activity_posts SET like_count = like_count + 1 WHERE id = $1`, [postId]);
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    const result = await query(
      `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );

    if (result.rowCount > 0) {
      await query(`UPDATE activity_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = $1`, [postId]);
    }
  }

  async addComment(postId: string, userId: string, content: string, parentId?: string): Promise<any> {
    const result = await query(
      `INSERT INTO post_comments (post_id, user_id, content, parent_comment_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [postId, userId, content, parentId]
    );

    await query(`UPDATE activity_posts SET comment_count = comment_count + 1 WHERE id = $1`, [postId]);

    return result.rows[0];
  }

  async trackShare(userId: string, entityType: string, entityId: string, platform: string): Promise<void> {
    await query(
      `INSERT INTO social_shares (user_id, entity_type, entity_id, platform) VALUES ($1, $2, $3, $4)`,
      [userId, entityType, entityId, platform]
    );

    // Update share count if it's a post
    if (entityType === 'post') {
      await query(`UPDATE activity_posts SET share_count = share_count + 1 WHERE id = $1`, [entityId]);
    }
  }

  // Activity Feed
  async createActivity(data: any): Promise<void> {
    await query(
      `INSERT INTO activity_feed (user_id, activity_type, actor_id, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.user_id, data.activity_type, data.actor_id, data.target_type, data.target_id,
       JSON.stringify(data.metadata || {})]
    );
  }

  async getActivity(userId: string, limit = 50, offset = 0): Promise<any[]> {
    const result = await query(
      `SELECT af.*, u.email, up.display_name, up.avatar_url
       FROM activity_feed af
       INNER JOIN users u ON af.actor_id = u.id
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE af.user_id = $1
       ORDER BY af.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => ({ ...row, metadata: row.metadata }));
  }
}

export const socialService = new SocialService();
