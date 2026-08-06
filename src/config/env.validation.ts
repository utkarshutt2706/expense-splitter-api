import { z } from 'zod';

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    CORS_ALLOWED_ORIGINS: z.string().min(1),
    API_KEY: z.string().min(16),
    JWT_SECRET: z.string().min(32),
    FRONTEND_URL: z.url(),
    GMAIL_USER: z.email(),
    GMAIL_APP_PASSWORD: z.string().min(1),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
    const result = envSchema.safeParse(config);
    if (!result.success) {
        throw new Error(`Invalid environment configuration: ${result.error.message}`);
    }
    return result.data;
}
