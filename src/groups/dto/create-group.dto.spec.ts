import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateGroupDto } from './create-group.dto';

describe('CreateGroupDto', () => {
    const valid = { name: 'Trip', memberIds: ['a'] };
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (value: Record<string, unknown>) =>
        pipe.transform(value, { type: 'body', metatype: CreateGroupDto });
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
        { field: 'memberIds', value: null },
        { field: 'memberIds', value: [] },
        { field: 'memberIds', value: {} },
        { field: 'memberIds', value: 'a' },
        { field: 'memberIds', value: ['a', 'a'] },
        { field: 'memberIds', value: [1] },
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
            name: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        };
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
});
