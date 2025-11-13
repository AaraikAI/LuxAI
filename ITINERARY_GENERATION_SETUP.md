# Itinerary Generation Setup

The "Generate Itinerary" feature uses AI (OpenAI or Anthropic) to create personalized travel plans. To enable this feature, you need to configure your AI API keys.

## Error: "Failed to generate itinerary"

This error appears when:
1. AI API keys are not configured
2. AI API keys are invalid
3. AI service is unavailable

## Configuration Steps

### Option 1: OpenAI (Recommended)

1. **Get an API key**:
   - Go to https://platform.openai.com/api-keys
   - Sign in or create an account
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

2. **Add to `.env`**:
   ```bash
   OPENAI_API_KEY=sk-your-actual-openai-key-here
   ```

3. **Restart the backend**:
   ```bash
   npm run dev --workspace=@luxai/backend
   ```

### Option 2: Anthropic Claude

1. **Get an API key**:
   - Go to https://console.anthropic.com/
   - Sign in or create an account
   - Go to API Keys section
   - Create a new key
   - Copy the key (starts with `sk-ant-`)

2. **Add to `.env`**:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key-here
   ```

3. **Restart the backend**:
   ```bash
   npm run dev --workspace=@luxai/backend
   ```

## Testing

After configuring your API key:

1. Go to http://localhost:5173/itineraries/new
2. Fill in the form:
   - **Start Date**: Any future date
   - **End Date**: A few days after start date
   - **Destinations**: e.g., "Paris, Rome, Barcelona"
   - **Budget** (optional): e.g., "50000"
   - **Special Requests** (optional): e.g., "Michelin star restaurants, private tours"
3. Click "Generate Itinerary"
4. AI will create a personalized itinerary (takes 10-30 seconds)

## API Costs

### OpenAI Pricing
- **GPT-4**: ~$0.03-0.06 per itinerary
- **GPT-3.5-Turbo**: ~$0.002-0.005 per itinerary

### Anthropic Pricing
- **Claude 3 Opus**: ~$0.05-0.10 per itinerary
- **Claude 3 Sonnet**: ~$0.01-0.03 per itinerary

## Troubleshooting

### "API key invalid"
- Verify the key is copied correctly (no spaces)
- Check if the key has been revoked
- Ensure billing is set up on the AI platform

### "Rate limit exceeded"
- You've hit the API rate limit
- Wait a few minutes and try again
- Upgrade your AI platform tier

### "Insufficient quota"
- Add credits/billing to your AI platform account
- Check your usage limits

### Still not working?

1. **Check backend logs**:
   ```bash
   # Look for errors in the terminal running the backend
   ```

2. **Check .env file**:
   ```bash
   cat .env | grep API_KEY
   # Should show your configured keys
   ```

3. **Restart everything**:
   ```bash
   # Stop servers (Ctrl+C)
   npm run dev
   ```

## Backend Implementation

The itinerary generation service:
- Located in: `packages/backend/src/services/itinerary.service.ts`
- Uses OpenAI GPT-4 or Anthropic Claude
- Generates destinations, activities, accommodations, and transportation
- Estimates costs and creates a detailed day-by-day plan

## Without AI Keys

If you don't want to configure AI keys yet, you can still:
- View existing itineraries (when database has data)
- Use all other features (aviation, vault, forum, analytics, etc.)
- Manually create itineraries through the API (not via the UI)

The AI itinerary generation is optional - all other features work without AI keys!

## Production Recommendations

For production deployment:
1. Use environment-specific API keys (dev vs prod)
2. Set up usage monitoring and alerts
3. Implement rate limiting on the endpoint
4. Add caching for similar requests
5. Consider using multiple AI providers for redundancy
6. Monitor API costs closely

## Next Steps

Once configured, you can:
- Generate unlimited AI-powered itineraries
- Customize the AI prompts in `itinerary.service.ts`
- Add more AI features (chat assistant, smart recommendations, etc.)
- Implement fine-tuned models for better results
