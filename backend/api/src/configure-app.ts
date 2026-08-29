import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { parseCorsOrigin } from './config/cors';
import { EnvironmentVariables } from './config/env.validation';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.enableCors({
    origin: parseCorsOrigin(config.get('CORS_ORIGIN', { infer: true })),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('BidderPlatform API')
        .setDescription('HTTP API for the bidder management platform')
        .setVersion('0.0.1')
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup('api/docs', app, document);
  }
}
