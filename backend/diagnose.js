const path = require('path');

process.env.PORT = process.env.PORT || '4010';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/smartpick';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'dev-secret-0123456789-0123456789-0123456789-012345';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

console.log('[DIAG] Starting backend...');
console.log('[DIAG] ENV:', {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
    ? 'SET (length=' + process.env.OPENAI_API_KEY.length + ')'
    : 'NOT SET',
  CHAT_PROVIDER: process.env.CHAT_PROVIDER || 'NOT SET',
  MODEL_NAME: process.env.MODEL_NAME || 'NOT SET',
  JWT_SECRET: process.env.JWT_SECRET?.substring(0, 10) + '...',
});

process.on('uncaughtException', (error) => {
  console.error('[DIAG] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[DIAG] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('[DIAG] Loading main.js...');
try {
  require('./dist/main');
  console.log('[DIAG] main.js loaded successfully');
} catch (e) {
  console.error('[DIAG] Failed to load main.js:', e);
  process.exit(1);
}
