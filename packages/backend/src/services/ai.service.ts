import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface GenerateItineraryRequest {
  clientId: string;
  preferences?: any;
  startDate: Date;
  endDate: Date;
  destinations?: string[];
  budget?: number;
  specialRequests?: string;
}

export interface ItineraryResponse {
  title: string;
  description: string;
  destinations: any[];
  activities: any[];
  accommodations: any[];
  transportation: any[];
  estimatedCost: number;
  sustainabilityScore: number;
}

export class AIService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    if (config.ai.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.ai.anthropicApiKey,
      });
    }

    if (config.ai.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.ai.openaiApiKey,
      });
    }
  }

  async generateItinerary(
    request: GenerateItineraryRequest
  ): Promise<ItineraryResponse> {
    try {
      logger.info('Generating itinerary with AI', { clientId: request.clientId });

      // Build the prompt
      const prompt = this.buildItineraryPrompt(request);

      // Use Claude for generation (preferred for luxury content)
      let response: string;

      if (this.anthropic) {
        response = await this.generateWithClaude(prompt);
      } else if (this.openai) {
        response = await this.generateWithOpenAI(prompt);
      } else {
        throw new AppError(500, 'AI_NOT_CONFIGURED', 'AI services not configured');
      }

      // Parse and structure the response
      const itinerary = this.parseItineraryResponse(response);

      logger.info('Itinerary generated successfully', {
        clientId: request.clientId,
      });

      return itinerary;
    } catch (error) {
      logger.error('Error generating itinerary', error);
      throw new AppError(
        500,
        'AI_GENERATION_FAILED',
        'Failed to generate itinerary'
      );
    }
  }

  private buildItineraryPrompt(request: GenerateItineraryRequest): string {
    const days = Math.ceil(
      (request.endDate.getTime() - request.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return `You are an expert luxury travel designer with 7+ years of experience planning ultra-bespoke experiences for ultra-high-net-worth (UHNW) clients.

Create a detailed, luxurious itinerary with the following requirements:

**Trip Details:**
- Duration: ${days} days (${request.startDate.toISOString().split('T')[0]} to ${request.endDate.toISOString().split('T')[0]})
- Destinations: ${request.destinations?.join(', ') || 'Flexible'}
- Budget: ${request.budget ? `$${request.budget.toLocaleString()}` : 'Ultra-luxury'}
${request.specialRequests ? `- Special Requests: ${request.specialRequests}` : ''}

**Client Preferences:**
${JSON.stringify(request.preferences || {}, null, 2)}

**Guidelines:**
1. Focus on exclusive, off-market experiences
2. Prioritize private aviation and luxury transportation
3. Include sustainability considerations
4. Suggest Michelin-starred dining and unique culinary experiences
5. Recommend ultra-luxury accommodations (5-star hotels, private villas, etc.)
6. Include cultural experiences with high attention to sensitivity
7. Provide specific vendor recommendations when possible

**Output Format:**
Return a JSON object with the following structure:
{
  "title": "Catchy itinerary title",
  "description": "Overview of the experience",
  "destinations": [
    {
      "name": "Destination name",
      "country": "Country",
      "arrivalDate": "ISO date",
      "departureDate": "ISO date",
      "highlights": ["highlight1", "highlight2"]
    }
  ],
  "activities": [
    {
      "name": "Activity name",
      "description": "Detailed description",
      "category": "Category (e.g., dining, entertainment, cultural)",
      "startTime": "ISO datetime",
      "duration": "Duration in minutes",
      "estimatedCost": "Cost in USD"
    }
  ],
  "accommodations": [
    {
      "name": "Hotel/Villa name",
      "type": "Type (e.g., 5-star hotel, private villa)",
      "checkIn": "ISO date",
      "checkOut": "ISO date",
      "rooms": 1,
      "estimatedCost": "Cost per night in USD"
    }
  ],
  "transportation": [
    {
      "type": "Type (e.g., private_jet, luxury_car)",
      "from": "Origin",
      "to": "Destination",
      "departureTime": "ISO datetime",
      "estimatedCost": "Cost in USD"
    }
  ],
  "estimatedCost": "Total estimated cost in USD",
  "sustainabilityScore": "Score from 0-100"
}`;
  }

  private async generateWithClaude(prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    throw new Error('Unexpected response format from Claude');
  }

  private async generateWithOpenAI(prompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert luxury travel designer with 7+ years of experience.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    return completion.choices[0].message.content || '';
  }

  private parseItineraryResponse(response: string): ItineraryResponse {
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (error) {
      logger.error('Failed to parse AI response', { response, error });
      throw new AppError(
        500,
        'AI_PARSE_ERROR',
        'Failed to parse AI-generated itinerary'
      );
    }
  }

  async chat(messages: Array<{ role: string; content: string }>) {
    try {
      if (this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: messages as any,
        });

        const content = response.content[0];
        if (content.type === 'text') {
          return { message: content.text };
        }
      } else if (this.openai) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: messages as any,
        });

        return { message: response.choices[0].message.content };
      }

      throw new AppError(500, 'AI_NOT_CONFIGURED', 'AI services not configured');
    } catch (error) {
      logger.error('Chat error', error);
      throw new AppError(500, 'CHAT_FAILED', 'Failed to process chat request');
    }
  }
}

export const aiService = new AIService();
