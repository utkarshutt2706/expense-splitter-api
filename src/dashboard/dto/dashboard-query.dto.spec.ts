import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DashboardQueryDto } from './dashboard-query.dto';

describe('DashboardQueryDto', () => {
    const valid = {};
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (value: Record<string, unknown>) =>
        pipe.transform(value, { type: 'body', metatype: DashboardQueryDto });
    it('accepts a valid request without changing fields', async () => {
        await expect(check(valid)).resolves.toEqual(valid);
    });
    it.each([
        { field: 'from', value: '' },
        { field: 'from', value: '2025-02-29' },
        { field: 'from', value: '2026-02-30' },
        { field: 'from', value: 'invalid' },
        { field: 'from', value: 1 },
        { field: 'to', value: '' },
        { field: 'to', value: '2025-02-29' },
        { field: 'to', value: 'invalid' },
        { field: 'to', value: 1 },
    ])('rejects invalid $field: $value', async ({ field, value }) => {
        await expect(check({ ...valid, [field]: value })).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });
    it('rejects unknown properties', async () => {
        await expect(check({ ...valid, passwordHash: 'injected' })).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });
    it('accepts boundary request 1', async () => {
        const request = { from: '2024-02-29', to: '2024-03-01T00:00:00Z' };
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
});
