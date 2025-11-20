import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import logger from './common/logger';

async function bootstrap() {
  console.log('[Bootstrap] Starting application creation...');
  const app = await NestFactory.create(AppModule, {
    // Temporarily enable Nest logger for startup diagnostics; replace with custom logger after stabilization
    logger: ['error', 'warn', 'log'],
  });
  console.log('[Bootstrap] Application created successfully');

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  // Global prefix and versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SmartPick AI API')
      .setDescription('Warehouse ergonomics and picking optimization platform')
      .setVersion('1.0')
      .addTag('health', 'Health check endpoints')
      .addTag('copilot', 'AI-powered operational assistant')
      .addTag('optimization', 'SKU placement optimization')
      .addTag('slotting', 'Product Positioning Engine (move plans, simulate, heatmap)')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 4010;
  console.log(`[Bootstrap] Attempting to listen on port ${port}...`);
  await app.listen(port);
  console.log(`[Bootstrap] Server is now listening on port ${port}`);

  logger.info(`🚀 Backend running on http://localhost:${port}/api`, {
    context: 'Bootstrap',
    port,
    env: process.env.NODE_ENV || 'development',
    docs: process.env.NODE_ENV !== 'production' ? `http://localhost:${port}/api/docs` : 'disabled',
  });
}

bootstrap().catch((error) => {
  // Extra console output for early-failing diagnostics when custom logger may not yet be fully initialized
  // Do not remove: assists in CI/local crash visibility.
  // eslint-disable-next-line no-console
  console.error('[Bootstrap] Fatal startup error:', error?.message || error);
  logger.error('Failed to start application', {
    context: 'Bootstrap',
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
