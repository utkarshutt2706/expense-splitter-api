import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
    const valid = { currentPassword: 'p', newPassword: '12345678' };
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (value: Record<string, unknown>) =>
        pipe.transform(value, { type: 'body', metatype: ChangePasswordDto });
    it('accepts a valid request without changing fields', async () => {
        await expect(check(valid)).resolves.toEqual(valid);
    });
    it.each([
        { field: 'currentPassword', value: null },
        { field: 'currentPassword', value: '' },
        { field: 'currentPassword', value: 1 },
        { field: 'newPassword', value: null },
        { field: 'newPassword', value: '' },
        { field: 'newPassword', value: '1234567' },
        {
            field: 'newPassword',
            value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        { field: 'newPassword', value: 1 },
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
        const request = {
            newPassword:
                'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        };
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
});
