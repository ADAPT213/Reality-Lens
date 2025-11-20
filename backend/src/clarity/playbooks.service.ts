import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PlaybooksService {
  constructor(private readonly prisma: PrismaService) {}

  async getByCode(code: string) {
    try {
      return await this.prisma.clarityPlaybook.findUnique({ where: { code } });
    } catch {
      return null;
    }
  }
}
