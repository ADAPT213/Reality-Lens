const express = require('express');
const OpenAI = require('openai').default;

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  process.exit(1);
});

const app = express();
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('[Error] OPENAI_API_KEY environment variable required');
  process.exit(1);
}
console.log('[Init] OpenAI key length:', apiKey.length);

const openai = new OpenAI({ apiKey });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/v1/copilot/ask', async (req, res) => {
  try {
    const { question } = req.body;
    console.log('[Copilot] Question:', question);

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are SmartPick Copilot. Provide warehouse ergonomic guidance.',
          },
          { role: 'user', content: question || 'Provide ergonomic risk overview.' },
        ],
        max_tokens: 450,
        temperature: 0.4,
      });

      const answer = completion.choices[0]?.message?.content?.trim() || 'No response generated.';
      console.log('[Copilot] OpenAI response generated');
      res.json({ answer });
    } catch (apiError) {
      console.warn('[Copilot] OpenAI API unavailable, using fallback:', apiError.message);
      const fallback = `Based on warehouse ergonomics best practices:

1. **High-reach zones** (above 6 feet): Prioritize reducing these - they cause shoulder strain and fall risks
2. **Heavy items at ground level**: Move to waist-height zones to prevent back injuries  
3. **High-frequency picks**: Place at optimal height (waist to shoulder) to minimize repetitive strain
4. **Congested aisles**: Widen to reduce collision risks and improve flow

Immediate actions: Audit zones A-C for high-reach items, relocate heaviest SKUs to mid-height, and review pick frequency data to optimize slotting.`;

      res.json({ answer: fallback, source: 'fallback' });
    }
  } catch (error) {
    console.error('[Copilot] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4010;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SmartPick Copilot running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Copilot: POST http://localhost:${PORT}/api/v1/copilot/ask`);
  console.log('[Server] Listening and ready for requests');
});

server.on('error', (err) => {
  console.error('[Server] Error:', err);
  process.exit(1);
});

server.on('close', () => {
  console.log('[Server] Closed');
});

// Keep process alive
setInterval(() => {
  // ping keepalive
}, 30000);
