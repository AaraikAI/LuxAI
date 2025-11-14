import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { socialService } from '../services/social.service';
import { z } from 'zod';

const router = Router();

// Public routes
router.get('/profiles/:userId', asyncHandler(async (req, res: Response) => {
  const { userId } = req.params;
  const profile = await socialService.getProfile(userId);
  res.json({ success: true, data: profile });
}));

// Authenticated routes
router.use(authenticate);

router.get('/profile', asyncHandler(async (req: AuthRequest, res: Response) => {
  const profile = await socialService.getProfile(req.user!.id);
  res.json({ success: true, data: profile });
}));

const updateProfileSchema = z.object({
  display_name: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  social_links: z.record(z.string()).optional(),
  is_public: z.boolean().optional(),
});

router.put('/profile', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = updateProfileSchema.parse(req.body);
  const profile = await socialService.updateProfile(req.user!.id, data);
  res.json({ success: true, data: profile });
}));

router.post('/follow/:userId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  await socialService.followUser(req.user!.id, userId);
  res.json({ success: true, data: { message: 'User followed' } });
}));

router.delete('/follow/:userId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  await socialService.unfollowUser(req.user!.id, userId);
  res.json({ success: true, data: { message: 'User unfollowed' } });
}));

router.get('/followers', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const followers = await socialService.getFollowers(req.user!.id, limit, offset);
  res.json({ success: true, data: followers });
}));

router.get('/following', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const following = await socialService.getFollowing(req.user!.id, limit, offset);
  res.json({ success: true, data: following });
}));

const createPostSchema = z.object({
  post_type: z.string(),
  content: z.string().optional(),
  media_urls: z.array(z.string()).optional(),
  linked_entity_type: z.string().optional(),
  linked_entity_id: z.string().optional(),
  visibility: z.enum(['public', 'followers', 'private']).optional(),
});

router.post('/posts', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createPostSchema.parse(req.body);
  const post = await socialService.createPost({ ...data, user_id: req.user!.id });
  res.json({ success: true, data: post });
}));

router.get('/feed', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const feed = await socialService.getFeed(req.user!.id, limit, offset);
  res.json({ success: true, data: feed });
}));

router.post('/posts/:postId/like', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { postId } = req.params;
  await socialService.likePost(postId, req.user!.id);
  res.json({ success: true, data: { message: 'Post liked' } });
}));

router.delete('/posts/:postId/like', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { postId } = req.params;
  await socialService.unlikePost(postId, req.user!.id);
  res.json({ success: true, data: { message: 'Post unliked' } });
}));

const addCommentSchema = z.object({
  content: z.string(),
  parent_id: z.string().optional(),
});

router.post('/posts/:postId/comments', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { postId } = req.params;
  const { content, parent_id } = addCommentSchema.parse(req.body);
  const comment = await socialService.addComment(postId, req.user!.id, content, parent_id);
  res.json({ success: true, data: comment });
}));

const trackShareSchema = z.object({
  entity_type: z.string(),
  entity_id: z.string(),
  platform: z.string(),
});

router.post('/share', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entity_type, entity_id, platform } = trackShareSchema.parse(req.body);
  await socialService.trackShare(req.user!.id, entity_type, entity_id, platform);
  res.json({ success: true, data: { message: 'Share tracked' } });
}));

router.get('/activity', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const activity = await socialService.getActivity(req.user!.id, limit, offset);
  res.json({ success: true, data: activity });
}));

export default router;
