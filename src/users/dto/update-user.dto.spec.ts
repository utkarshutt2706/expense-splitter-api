import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
    const valid = {
        name: 'User',
        email: 'user@example.com',
        phone: '9876543210',
        avatarUrl: 'https://example.com/avatar.png',
    };
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (value: Record<string, unknown>) =>
        pipe.transform(value, { type: 'body', metatype: UpdateUserDto });
    it('accepts a valid request without changing fields', async () => {
        await expect(check(valid)).resolves.toEqual(valid);
    });
    it.each([
        { field: 'name', value: '' },
        { field: 'name', value: 1 },
        {
            field: 'name',
            value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        { field: 'email', value: 'bad' },
        { field: 'email', value: 1 },
        { field: 'phone', value: 1 },
        { field: 'phone', value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
        { field: 'avatarUrl', value: 'bad' },
        { field: 'avatarUrl', value: 1 },
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
        const request = {};
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
    it('accepts boundary request 2', async () => {
        const request = {
            name: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            phone: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        };
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
});
