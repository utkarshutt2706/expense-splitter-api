import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
    const valid = {
        name: 'User',
        email: 'user@example.com',
        phone: '9876543210',
        password: 'password123',
    };
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (value: Record<string, unknown>) =>
        pipe.transform(value, { type: 'body', metatype: RegisterDto });
    it('accepts a valid request without changing fields', async () => {
        await expect(check(valid)).resolves.toEqual(valid);
    });
    it.each([
        { field: 'name', value: null },
        { field: 'name', value: '' },
        { field: 'name', value: 1 },
        {
            field: 'name',
            value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        { field: 'email', value: null },
        { field: 'email', value: '' },
        { field: 'email', value: 'invalid' },
        { field: 'email', value: 1 },
        { field: 'phone', value: null },
        { field: 'phone', value: '' },
        { field: 'phone', value: '1234567890' },
        { field: 'phone', value: '987654321' },
        { field: 'phone', value: '98765432101' },
        { field: 'phone', value: 123 },
        { field: 'password', value: null },
        { field: 'password', value: '' },
        { field: 'password', value: '1234567' },
        {
            field: 'password',
            value: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        { field: 'password', value: 1 },
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
        const request = { name: 'x', password: '12345678', phone: '6000000000' };
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
    it('accepts boundary request 2', async () => {
        const request = {
            name: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            password:
                'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            phone: '9999999999',
        };
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
});
