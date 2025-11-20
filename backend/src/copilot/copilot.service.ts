import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class CopilotService {
  private openai: OpenAI | null = null;
  private provider: 'openai' | 'openrouter' | 'ollama' | 'local' = 'local';
  private modelName: string;
  private openRouterKey: string | undefined;
  private ollamaHost: string;
  private openAIKeys: string[] = [];
  private openRouterKeys: string[] = [];
  private openAIIndex = 0;
  private openRouterIndex = 0;
  private openAISuccess: number[] = [];
  private openAIFail: number[] = [];
  private openRouterSuccess: number[] = [];
  private openRouterFail: number[] = [];
  private static bootTime = Date.now();

  constructor(private prisma: PrismaService) {
    const key = process.env.OPENAI_API_KEY || '';
    const multiKeys = process.env.OPENAI_KEYS || '';
    const multiRouterKeys = process.env.OPENROUTER_KEYS || '';
    this.openRouterKey = process.env.OPENROUTER_API_KEY;
    this.provider = (process.env.CHAT_PROVIDER as any) || 'local';
    this.modelName = process.env.MODEL_NAME || 'mistral:latest';
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

    // Parse key lists
    if (multiKeys.trim().length) {
      this.openAIKeys = multiKeys
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 10);
    } else if (key && key.length > 10) {
      this.openAIKeys = [key];
    }
    this.openAISuccess = new Array(this.openAIKeys.length).fill(0);
    this.openAIFail = new Array(this.openAIKeys.length).fill(0);
    if (multiRouterKeys.trim().length) {
      this.openRouterKeys = multiRouterKeys
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 10);
    } else if (this.openRouterKey && this.openRouterKey.length > 10) {
      this.openRouterKeys = [this.openRouterKey];
    }
    this.openRouterSuccess = new Array(this.openRouterKeys.length).fill(0);
    this.openRouterFail = new Array(this.openRouterKeys.length).fill(0);

    if (this.provider === 'openai' && this.openAIKeys.length) {
      this.openai = new OpenAI({ apiKey: this.openAIKeys[0] });
    }
  }

  async askCopilot(question: string, warehouseId?: string, shiftCode?: string): Promise<string> {
    const q = (question || '').trim() || 'Provide current ergonomic risk overview.';
    const contextLines: string[] = [];
    contextLines.push('SmartPick Context');

    // Safe context gathering
    if (warehouseId) {
      const warehouse = await this.safeGetWarehouse(warehouseId);
      if (warehouse) contextLines.push(`Warehouse: ${warehouse.name} (${warehouse.code})`);
      const snapshot = await this.safeGetLatestSnapshot(warehouseId, shiftCode);
      if (snapshot) {
        contextLines.push('Latest Shift Metrics:');
        contextLines.push(`- Picks/hour: ${snapshot.avgPicksPerHour}`);
        contextLines.push(`- Red locations: ${snapshot.redLocations}`);
        contextLines.push(`- Status: ${snapshot.status}`);
        if (snapshot.bucketStart)
          contextLines.push(
            `- Snapshot: ${snapshot.bucketStart instanceof Date ? snapshot.bucketStart.toISOString() : snapshot.bucketStart}`,
          );
      }
      const alerts = await this.safeGetActiveAlerts(warehouseId);
      if (alerts.length) {
        contextLines.push('Active Alerts (top 5):');
        alerts.forEach((a: { severity: string; title: string; message: string }) =>
          contextLines.push(`- [${a.severity}] ${a.title}: ${a.message}`),
        );
      }
    } else {
      contextLines.push('No warehouse specified.');
    }

    const context = contextLines.join('\n');

    // Provider dispatch
    // Allow per-request model override
    if ((question || '').includes('model:')) {
      const override = /model:([\w\-.:/]+)/.exec(question)?.[1];
      if (override) this.modelName = override.trim();
    }

    switch (this.provider) {
      case 'openai':
        return this.runOpenAI(q, context);
      case 'openrouter':
        return this.runOpenRouter(q, context);
      case 'ollama':
        return this.runOllama(q, context);
      default:
        return this.localFallback(q, context);
    }
  }

  private async runOpenAI(q: string, context: string): Promise<string> {
    if (!this.openai) return this.localFallback(q, context, 'OpenAI not configured');
    const key = this.nextOpenAIKey();
    if (key && (!this.openai || (this.openai as any).apiKey !== key)) {
      this.openai = new OpenAI({ apiKey: key });
    }
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are SmartPick Copilot. Use provided warehouse context to give ergonomic improvement and risk mitigation guidance. If data missing, state the gap plainly.',
          },
          { role: 'system', content: context },
          { role: 'user', content: q },
        ],
        max_tokens: 450,
        temperature: 0.4,
      });
      const answer = completion.choices[0]?.message?.content?.trim();
      if (answer) {
        this.recordOpenAI(true);
        return answer;
      }
      throw new Error('Empty completion');
    } catch (e: any) {
      // Rotate to next key on error
      this.rotateOpenAIKey();
      this.recordOpenAI(false);
      return this.localFallback(q, context, 'OpenAI error: ' + e.message);
    }
  }

  private async runOpenRouter(q: string, context: string): Promise<string> {
    const key = this.nextOpenRouterKey();
    if (!key) return this.localFallback(q, context, 'OpenRouter key missing');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'https://smartpick.local',
          'X-Title': 'SmartPick AI',
        },
        body: JSON.stringify({
          model: this.modelName || 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            { role: 'system', content: 'You are SmartPick Copilot.' },
            { role: 'system', content: context },
            { role: 'user', content: q },
          ],
          temperature: 0.4,
          max_tokens: 450,
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
      const data: any = await res.json();
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (answer) {
        this.recordOpenRouter(true);
        return answer;
      }
      this.recordOpenRouter(false);
      return this.localFallback(q, context, 'OpenRouter empty response');
    } catch (e: any) {
      this.rotateOpenRouterKey();
      this.recordOpenRouter(false);
      return this.localFallback(q, context, 'OpenRouter error: ' + e.message);
    }
  }

  private async runOllama(q: string, context: string): Promise<string> {
    try {
      const res = await fetch(`${this.ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: 'You are SmartPick Copilot.' },
            { role: 'system', content: context },
            { role: 'user', content: q },
          ],
          options: { temperature: 0.4 },
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data: any = await res.json();
      // Ollama streaming aggregated: if response includes 'message'
      const answer = data.message?.content?.trim() || data?.choices?.[0]?.message?.content?.trim();
      return answer || this.localFallback(q, context, 'Ollama empty response');
    } catch (e: any) {
      return this.localFallback(q, context, 'Ollama error: ' + e.message);
    }
  }

  // Key rotation helpers
  private nextOpenAIKey(): string | undefined {
    if (!this.openAIKeys.length) return undefined;
    return this.openAIKeys[this.openAIIndex % this.openAIKeys.length];
  }
  private rotateOpenAIKey() {
    if (this.openAIKeys.length > 1)
      this.openAIIndex = (this.openAIIndex + 1) % this.openAIKeys.length;
  }
  private nextOpenRouterKey(): string | undefined {
    if (!this.openRouterKeys.length) return undefined;
    return this.openRouterKeys[this.openRouterIndex % this.openRouterKeys.length];
  }
  private rotateOpenRouterKey() {
    if (this.openRouterKeys.length > 1)
      this.openRouterIndex = (this.openRouterIndex + 1) % this.openRouterKeys.length;
  }

  private recordOpenAI(success: boolean) {
    if (!this.openAIKeys.length) return;
    const idx = this.openAIIndex % this.openAISuccess.length;
    if (success) this.openAISuccess[idx]++;
    else this.openAIFail[idx]++;
  }
  private recordOpenRouter(success: boolean) {
    if (!this.openRouterKeys.length) return;
    const idx = this.openRouterIndex % this.openRouterSuccess.length;
    if (success) this.openRouterSuccess[idx]++;
    else this.openRouterFail[idx]++;
  }

  getKeyStats() {
    return {
      openai: this.openAIKeys.map((k, i) => ({
        index: i,
        successes: this.openAISuccess[i],
        failures: this.openAIFail[i],
      })),
      openrouter: this.openRouterKeys.map((k, i) => ({
        index: i,
        successes: this.openRouterSuccess[i],
        failures: this.openRouterFail[i],
      })),
      uptimeSeconds: Math.floor((Date.now() - CopilotService.bootTime) / 1000),
      provider: this.provider,
      model: this.modelName,
    };
  }

  private localFallback(question: string, context: string, note?: string): string {
    const lines: string[] = [];
    lines.push('SmartPick Copilot (local mode)');
    if (note) lines.push(note);
    const picks = /Picks\/hour:\s*(\d+(?:\.\d+)?)/.exec(context)?.[1] || '-';
    const reds = /Red locations:\s*(\d+)/.exec(context)?.[1] || '-';
    const status = /Status:\s*([\w-]+)/.exec(context)?.[1] || 'unknown';
    lines.push('Key Signals:');
    lines.push(`- Picks/hour: ${picks}`);
    lines.push(`- Red locations: ${reds}`);
    lines.push(`- Status: ${status}`);
    lines.push('Guidance:');
    lines.push('- Investigate zones driving red location counts.');
    lines.push('- Re-slot top velocity SKUs into neutral reach band.');
    lines.push('- Address any high-severity alerts lingering > 15 min.');
    lines.push('- Schedule micro-breaks if sustained high picks/hour.');
    lines.push('Answer:');
    lines.push(question);
    return lines.join('\n');
  }

  private async safeGetWarehouse(id: string) {
    try {
      return await this.prisma.warehouse.findUnique({ where: { id } });
    } catch {
      return null;
    }
  }

  private async safeGetLatestSnapshot(warehouseId: string, shiftCode?: string) {
    try {
      return await this.prisma.shiftSnapshot.findFirst({
        where: { warehouseId, shiftCode: shiftCode || undefined },
        orderBy: { bucketStart: 'desc' },
      });
    } catch {
      return null;
    }
  }

  private async safeGetActiveAlerts(warehouseId: string) {
    try {
      return await this.prisma.alert.findMany({
        where: { warehouseId, resolvedAt: null },
        orderBy: { triggeredAt: 'desc' },
        take: 5,
      });
    } catch {
      return [];
    }
  }
}
