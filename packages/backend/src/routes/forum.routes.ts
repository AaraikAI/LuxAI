import { Router } from 'express';
import { forumService } from '../services/forum.service';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /forum/posts
 * Create a new forum post
 */
router.post('/posts', authenticate, async (req, res) => {
  try {
    const authorId = (req as any).user.id;
    const postData = { ...req.body, authorId };

    const postId = await forumService.createPost(postData);

    res.json({
      success: true,
      data: { postId },
    });
  } catch (error: any) {
    logger.error('Failed to create post', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_POST_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /forum/posts
 * Get all posts with optional filtering
 */
router.get('/posts', authenticate, async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const posts = await forumService.getPosts(category, tags, limit);

    res.json({
      success: true,
      data: posts,
    });
  } catch (error: any) {
    logger.error('Failed to get posts', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_POSTS_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /forum/posts/trending
 * Get trending posts
 */
router.get('/posts/trending', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const posts = await forumService.getTrendingPosts(limit);

    res.json({
      success: true,
      data: posts,
    });
  } catch (error: any) {
    logger.error('Failed to get trending posts', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_TRENDING_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /forum/posts/:id
 * Get a single post by ID
 */
router.get('/posts/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await forumService.getPostById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    // Record view
    await forumService.recordPostView(id);

    res.json({
      success: true,
      data: post,
    });
  } catch (error: any) {
    logger.error('Failed to get post', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_POST_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /forum/posts/:id/replies
 * Create a reply to a post
 */
router.post('/posts/:id/replies', authenticate, async (req, res) => {
  try {
    const { id: postId } = req.params;
    const authorId = (req as any).user.id;
    const replyData = { ...req.body, postId, authorId };

    const replyId = await forumService.createReply(replyData);

    res.json({
      success: true,
      data: { replyId },
    });
  } catch (error: any) {
    logger.error('Failed to create reply', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_REPLY_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * GET /forum/posts/:id/replies
 * Get replies for a post
 */
router.get('/posts/:id/replies', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const replies = await forumService.getReplies(id);

    res.json({
      success: true,
      data: replies,
    });
  } catch (error: any) {
    logger.error('Failed to get replies', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_REPLIES_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /forum/posts/:id/upvote
 * Upvote a post
 */
router.post('/posts/:id/upvote', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    await forumService.upvotePost(id, userId);

    res.json({
      success: true,
      data: { message: 'Post upvoted' },
    });
  } catch (error: any) {
    logger.error('Failed to upvote post', error);
    res.status(error.message === 'Already upvoted' ? 400 : 500).json({
      success: false,
      error: {
        code: error.message === 'Already upvoted' ? 'ALREADY_UPVOTED' : 'UPVOTE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * POST /forum/replies/:id/upvote
 * Upvote a reply
 */
router.post('/replies/:id/upvote', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    await forumService.upvoteReply(id, userId);

    res.json({
      success: true,
      data: { message: 'Reply upvoted' },
    });
  } catch (error: any) {
    logger.error('Failed to upvote reply', error);
    res.status(error.message === 'Already upvoted' ? 400 : 500).json({
      success: false,
      error: {
        code: error.message === 'Already upvoted' ? 'ALREADY_UPVOTED' : 'UPVOTE_FAILED',
        message: error.message,
      },
    });
  }
});

export default router;
