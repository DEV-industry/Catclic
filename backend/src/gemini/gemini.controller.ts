import { Body, Controller, Post } from '@nestjs/common';
import { GeminiService } from './gemini.service';

class PredictDto {
    teamA: string;
    teamB: string;
    oddsA: string;
    oddsB: string;
}

@Controller('predict')
export class GeminiController {
    constructor(private readonly geminiService: GeminiService) { }

    @Post()
    async getPrediction(@Body() body: PredictDto) {
        return this.geminiService.predictWinner(body.teamA, body.teamB, body.oddsA, body.oddsB);
    }
}
