export function validateEnv() {
  const required = ['NEXT_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_WS_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
  return missing.length === 0;
}

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4010/api';
}

export function getWsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4010';
}

export function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}
