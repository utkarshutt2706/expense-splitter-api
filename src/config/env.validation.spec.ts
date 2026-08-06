import { validateEnv } from './env.validation';

describe('validateEnv', () => {
    const validConfig = {
        DATABASE_URL: 'postgresql://user:password@host:5432/database',
        CORS_ALLOWED_ORIGINS: 'https://utkarshutt2706.github.io',
        API_KEY: 'a-sufficiently-long-secret',
        JWT_SECRET: 'a-sufficiently-long-jwt-signing-secret',
        FRONTEND_URL: 'https://utkarshutt2706.github.io',
        RESEND_API_KEY: 're_test_key',
    };

    it('accepts a valid config and applies defaults', () => {
        const result = validateEnv(validConfig);

        expect(result).toEqual({
            ...validConfig,
            NODE_ENV: 'development',
            PORT: 3000,
            MAIL_FROM: 'Expense Splitter <onboarding@resend.dev>',
        });
    });

    it('coerces PORT from a string to a number', () => {
        const result = validateEnv({ ...validConfig, PORT: '4000' });

        expect(result.PORT).toBe(4000);
    });

    it('throws when DATABASE_URL is missing', () => {
        const rest: Partial<typeof validConfig> = { ...validConfig };
        delete rest.DATABASE_URL;

        expect(() => validateEnv(rest)).toThrow('Invalid environment configuration');
    });

    it('throws when DATABASE_URL is not a valid URL', () => {
        expect(() => validateEnv({ ...validConfig, DATABASE_URL: 'not-a-url' })).toThrow(
            'Invalid environment configuration',
        );
    });

    it('throws when API_KEY is too short', () => {
        expect(() => validateEnv({ ...validConfig, API_KEY: 'short' })).toThrow(
            'Invalid environment configuration',
        );
    });

    it('throws when JWT_SECRET is too short', () => {
        expect(() => validateEnv({ ...validConfig, JWT_SECRET: 'short' })).toThrow(
            'Invalid environment configuration',
        );
    });

    it('throws when NODE_ENV is not one of the allowed values', () => {
        expect(() => validateEnv({ ...validConfig, NODE_ENV: 'staging' })).toThrow(
            'Invalid environment configuration',
        );
    });

    it('throws when RESEND_API_KEY is missing', () => {
        const rest: Partial<typeof validConfig> = { ...validConfig };
        delete rest.RESEND_API_KEY;

        expect(() => validateEnv(rest)).toThrow('Invalid environment configuration');
    });

    it('accepts an explicit MAIL_FROM, overriding the default', () => {
        const result = validateEnv({ ...validConfig, MAIL_FROM: 'Custom <hello@example.com>' });

        expect(result.MAIL_FROM).toBe('Custom <hello@example.com>');
    });
});
