import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VisionService } from './vision.service';
import { ClarityEventsService } from '../clarity/events.service';
import { SlottingService } from '../slotting/slotting.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/v1/vision')
export class VisionController {
  constructor(
    private vision: VisionService,
    private clarityEvents: ClarityEventsService,
    private slotting: SlottingService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: any, @Query('warehouseId') warehouseId = 'WH-001') {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${file.originalname}`;
    const imagePath = path.join(uploadsDir, filename);
    fs.writeFileSync(imagePath, file.buffer);

    const session = await this.vision.createSession({
      imagePath: `/uploads/${filename}`,
      warehouseId,
    });

    await this.clarityEvents.logEvent({
      context: 'vision',
      source: 'user',
      type: 'vision_image_uploaded',
      payload: { sessionId: session.id, imagePath: session.imagePath, warehouseId },
    });

    return session;
  }

  @Post(':id/pickfaces')
  async savePickfaces(@Param('id') id: string, @Body() body: { pickfaces: any[] }) {
    await this.vision.savePickfaces(id, body.pickfaces || []);
    await this.clarityEvents.logEvent({
      context: 'vision',
      source: 'user',
      type: 'vision_pickfaces_saved',
      payload: { sessionId: id, count: (body.pickfaces || []).length },
    });
    return { ok: true };
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    const s = await this.vision.getSession(id);
    if (!s) throw new NotFoundException();
    return s;
  }

  @Post(':id/generate-plan')
  async generatePlan(@Param('id') id: string) {
    const session = await this.vision.getSession(id);
    if (!session) throw new NotFoundException();
    const input = ((session.pickfaces as any[]) || []).map((pf: any) => ({
      warehouseId: session.warehouseId,
      locationCode: pf.locationCode,
      sku: pf.sku,
    }));
    const plan = await this.slotting.generatePlanFromVision(input);
    await this.clarityEvents.logEvent({
      context: 'vision',
      source: 'system',
      type: 'vision_plan_generated',
      payload: { sessionId: id, moves: (plan as any).items?.length || 0 },
    });
    return { sessionId: id, plan };
  }
}
