import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { LoggerMiddleware } from './common/logger.middleware';
import { envValidationSchema } from './common/env.validation';
import { WebsocketModule } from './websocket/websocket.module';
import { SlottingModule } from './slotting/slotting.module';
import { IngestModule } from './ingest/ingest.module';
import { CopilotModule } from './copilot/copilot.module';
import { HealthModule } from './health/health.module';
import { ClarityModule } from './clarity/clarity.module';
import { VisionModule } from './vision/vision.module';
import { AutomationModule } from './automation/automation.module';
// Trim optional modules to stabilize build; re-enable as they mature

@Module({
  imports: [
    // Configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '..', '.env'),
        path.resolve(__dirname, '..', '.env.local'),
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    CommonModule,
    WebsocketModule,
    CopilotModule,
    SlottingModule,
    IngestModule,
    HealthModule,
    ClarityModule,
    VisionModule,
    AutomationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
