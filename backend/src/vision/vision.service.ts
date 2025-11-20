import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class VisionService {
  constructor(private prisma: PrismaService) {}

  createSession(args: { imagePath: string; warehouseId: string; userId?: string }) {
    return this.prisma.visionSession.create({
      data: {
        imagePath: args.imagePath,
        warehouseId: args.warehouseId,
        createdBy: args.userId ?? null,
      },
    });
  }

  async savePickfaces(sessionId: string, pickfaces: any[]) {
    await this.prisma.visionPickface.deleteMany({ where: { sessionId } });
    return this.prisma.$transaction(
      pickfaces.map((pf) =>
        this.prisma.visionPickface.create({
          data: {
            sessionId,
            locationCode: pf.locationCode,
            sku: pf.sku,
            x: pf.x,
            y: pf.y,
            width: pf.width,
            height: pf.height,
          },
        }),
      ),
    );
  }

  getSession(sessionId: string) {
    return this.prisma.visionSession.findUnique({
      where: { id: sessionId },
      include: { pickfaces: true },
    });
  }
}
