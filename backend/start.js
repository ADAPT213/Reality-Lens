#!/usr/bin/env node
const path = require('path');

process.env.PORT = process.env.PORT || '4010';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/smartpick';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'dev-secret-0123456789-0123456789-0123456789-012345';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

console.log('[start] Loading main.js with env:', {
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'),
  JWT_SECRET: process.env.JWT_SECRET?.substring(0, 10) + '...',
  NODE_ENV: process.env.NODE_ENV,
});

try {
  require('./dist/main');
} catch (e) {
  console.error('[start] Failed to load:', e.message);
  console.error(e.stack);
  process.exit(1);
}
