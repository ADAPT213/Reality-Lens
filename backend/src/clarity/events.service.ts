import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ClarityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(
    arg1:
      | string
      | {
          context?: string;
          source?: string;
          type: string;
          userId?: string;
          actor?: string;
          payload?: any;
        },
    payload?: any,
    userId?: string,
    actor?: string,
  ) {
    try {
      let data: any;
      if (typeof arg1 === 'string') {
        data = { type: arg1, payload, userId: userId ?? null, actor: actor ?? null };
      } else {
        const { context, source, type, userId: uid, actor: act, payload: p } = arg1;
        data = {
          context: context ?? null,
          source: source ?? null,
          type,
          userId: uid ?? null,
          actor: act ?? null,
          payload: p ?? null,
        };
      }
      return await this.prisma.clarityEvent.create({ data });
    } catch (e) {
      return null as any;
    }
  }
}
