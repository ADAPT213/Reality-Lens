import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4010),
  DATABASE_URL: Joi.string().optional(),
  REDIS_URL: Joi.string().optional(),
  JWT_SECRET: Joi.string().min(32).default('dev-secret-0123456789-0123456789-0123456789-012345'),
  OPENAI_API_KEY: Joi.string().optional(),
  OPENAI_KEYS: Joi.string().optional(), // comma separated list
  OPENROUTER_API_KEY: Joi.string().optional(),
  OPENROUTER_KEYS: Joi.string().optional(), // comma separated list
  CHAT_PROVIDER: Joi.string().valid('openai', 'openrouter', 'ollama', 'local').default('local'),
  OLLAMA_HOST: Joi.string().default('http://localhost:11434'),
  MODEL_NAME: Joi.string().default('mistral:latest'),
  S3_ENDPOINT: Joi.string().optional(),
  S3_ACCESS_KEY: Joi.string().optional(),
  S3_SECRET_KEY: Joi.string().optional(),
  S3_BUCKET: Joi.string().optional(),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
});
