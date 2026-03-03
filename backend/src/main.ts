import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      /^chrome-extension:\/\//,
      'https://catclic.tech',
    ],
    methods: ['GET', 'POST'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
