import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateGroupDto } from './update-group.dto';

describe('UpdateGroupDto', () => {
    const valid = { name: 'Trip', memberIds: ['a'] };
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (value: Record<string, unknown>) =>
        pipe.transform(value, { type: 'body', metatype: UpdateGroupDto });
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
        const request = {};
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
    it('accepts boundary request 2', async () => {
        const request = {
            name: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        };
        await expect(check({ ...valid, ...request })).resolves.toEqual({ ...valid, ...request });
    });
});
