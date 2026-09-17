import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { resolve } from 'node:path';

import { EnvironmentVariables } from './config/env.validation';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const uploadDir = resolve(config.get('UPLOAD_DIR', { infer: true }) ?? 'uploads');
  (app as NestExpressApplication).useStaticAssets(uploadDir, {
    prefix: '/uploads/',
    index: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

    if (
      config.get('SWAGGER_ENABLED', { infer: true }) &&
      process.env.VERCEL !== '1'
    ) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('DeSeven API')
        .setDescription('HTTP API for the DeSeven job operations platform')
        .setVersion('0.0.1')
        .addBearerAuth()
        .addApiKey(
          {
            type: 'apiKey',
            name: 'X-Talyn-Api-Key',
            in: 'header',
            description:
              "BidderPlatform internal ingestion key. Not Talyn's native authentication.",
          },
          'talyn-ingest',
        )
        .build(),
    );

    SwaggerModule.setup('docs', app, document);
  }
}
