import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: any;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }

    private readonly cache = new Map<string, any>();
    private requestQueue: Promise<void> = Promise.resolve();

    async predictWinner(teamA: string, teamB: string, oddsA: string, oddsB: string): Promise<any> {
        // v8 suffix - Reverted to pure AI (No external API)
        const cacheKey = `${teamA.toLowerCase()}-${teamB.toLowerCase()}-v8`;

        if (this.cache.has(cacheKey)) {
            this.logger.log(`[CACHE HIT] ${teamA} vs ${teamB}`);
            return this.cache.get(cacheKey)!;
        }

        const result = this.requestQueue.then(async () => {
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

            this.logger.log(`[AI PROCESSING] ${teamA} vs ${teamB}...`);

            // Rate limit delay (4s)
            await new Promise(r => setTimeout(r, 4000));

            return this.callGemini(teamA, teamB, oddsA, oddsB, cacheKey);
        });

        this.requestQueue = result.then(() => { }).catch(() => { });
        return result;
    }

    private async callGemini(teamA: string, teamB: string, oddsA: string, oddsB: string, cacheKey: string) {

        const prompt = `
          Analyze this match: ${teamA} (${oddsA}) vs ${teamB} (${oddsB}).
          Context: Home team is ${teamA}, Away team is ${teamB}.
          Response Language: Polish (Polski).
          
          Instructions:
          1. Act as a sports betting expert.
          2. Estimate win probabilities based on the odds provided and general team knowledge.
          3. Provide a clear, textual analysis.
          4. Do NOT hallucinate specific match stats like xG or exact recent results if you don't know them. Focus on team strengths/weaknesses.

          Return strictly JSON: 
          {
            "prediction": "1", 
            "summary": "One sentence summary in Polish.",
            "full_analysis": "Detailed analysis in Polish. Use <b>bold</b> tags for key insights.",
            "stats": {
                "probs": { "home": 60, "draw": 25, "away": 15 }
            }
          }
          ("1"=Home, "2"=Away, "X"=Draw).
          Ensure percentages sum to 100.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const cleanText = text.replace(/```json|```/g, '').trim();
            const json = JSON.parse(cleanText);

            this.cache.set(cacheKey, json);
            return json;
        } catch (error) {
            this.logger.error(`Gemini SDK Error: ${error.message}`);
            return {
                prediction: 'X',
                summary: 'Błąd AI.',
                full_analysis: 'Problem z generowaniem analizy.',
                stats: { probs: { home: 33, draw: 33, away: 33 } }
            };
        }
    }
}
