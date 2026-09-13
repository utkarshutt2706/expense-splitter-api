import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateExpenseDto } from '../../expenses/dto/create-expense.dto';
import { UpdateExpenseDto } from '../../expenses/dto/update-expense.dto';
import { CreatePaymentDto } from '../../payments/dto/create-payment.dto';
import { UpdatePaymentDto } from '../../payments/dto/update-payment.dto';

const expense = {
    description: 'Dinner',
    amount: 100,
    paidByUserId: 'user-1',
    splitType: 'equal',
    splits: [{ userId: 'user-1', amount: 100 }],
};
const payment = { fromUserId: 'user-1', toUserId: 'user-2', amount: 100 };

describe.each([
    [CreateExpenseDto, expense],
    [UpdateExpenseDto, expense],
    [CreatePaymentDto, payment],
    [UpdatePaymentDto, payment],
])('paidOn request validation for %s', (metatype, input) => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const validate = (fields: Record<string, unknown>) =>
        pipe.transform({ ...input, ...fields }, { type: 'body', metatype });

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-09-05T21:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('accepts local today at 2:30 AM in India and retains the calendar date', async () => {
        await expect(
            validate({ paidOn: '2026-09-06', timeZone: 'Asia/Kolkata' }),
        ).resolves.toMatchObject({
            paidOn: '2026-09-06',
            timeZone: 'Asia/Kolkata',
        });
    });

    it.each([
        { paidOn: '2026-09-07', timeZone: 'Asia/Kolkata' },
        { paidOn: '2026-09-06', timeZone: 'America/Los_Angeles' },
        { paidOn: '2026-09-06' },
        { paidOn: 'invalid', timeZone: 'Asia/Kolkata' },
        { timeZone: 'Invalid/Zone' },
        { timeZone: null },
        { timeZone: 330 },
    ])('rejects invalid request fields: %j', async (fields) => {
        await expect(validate(fields)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('supports existing requests using the UTC default', async () => {
        await expect(validate({ paidOn: '2026-09-05' })).resolves.toMatchObject({
            paidOn: '2026-09-05',
        });
        await expect(validate({})).resolves.toMatchObject(input);
    });
});

describe.each([CreateExpenseDto, UpdateExpenseDto])('%s expense request boundaries', (metatype) => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (fields: Record<string, unknown>) =>
        pipe.transform({ ...expense, ...fields }, { type: 'body', metatype });

    it.each([undefined, null, '', 0, 'x'.repeat(501)])(
        'rejects invalid description %p',
        async (description) => {
            await expect(check({ description })).rejects.toBeInstanceOf(BadRequestException);
        },
    );
    it.each(['x', 'x'.repeat(500)])('accepts description boundary', async (description) => {
        await expect(check({ description })).resolves.toMatchObject({ description });
    });
    it.each([
        undefined,
        null,
        [],
        {},
        'invalid',
        [null],
        [{ userId: '', amount: 100 }],
        [{ userId: 'a', amount: '100' }],
        [{ userId: 'a', amount: 100, admin: true }],
    ])('rejects malformed splits %p', async (splits) => {
        await expect(check({ splits })).rejects.toBeInstanceOf(BadRequestException);
    });
    it.each(['percentage', 'shares'])('validates nested %s inputs', async (splitType) => {
        const field = splitType === 'percentage' ? 'percentages' : 'shares';
        const weight = splitType === 'percentage' ? 'percentage' : 'shares';
        const entries = [{ userId: 'user-1', [weight]: 100 }];
        const result: unknown = await check({ splitType, [field]: entries });
        expect(result).toMatchObject({ splitType, [field]: entries });
        for (const bad of [
            undefined,
            null,
            [],
            '100',
            [{ userId: '', [weight]: 100 }],
            [{ userId: 'user-1', [weight]: 0 }],
            [{ userId: 'user-1', [weight]: -1 }],
            [{ userId: 'user-1', [weight]: '100' }],
            [{ userId: 'user-1', [weight]: Infinity }],
        ]) {
            await expect(check({ splitType, [field]: bad })).rejects.toBeInstanceOf(
                BadRequestException,
            );
        }
    });
    it.each(['unknown', null, undefined, 1])(
        'rejects unsupported split type %p',
        async (splitType) => {
            await expect(check({ splitType })).rejects.toBeInstanceOf(BadRequestException);
        },
    );
});

describe.each([
    [CreateExpenseDto, expense],
    [UpdateExpenseDto, expense],
    [CreatePaymentDto, payment],
    [UpdatePaymentDto, payment],
])('%s financial request boundaries', (metatype, input) => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    });
    const check = (fields: Record<string, unknown>) =>
        pipe.transform({ ...input, ...fields }, { type: 'body', metatype });
    it.each([undefined, null, 0, -1, NaN, Infinity, -Infinity, '100', {}, []])(
        'rejects invalid amount %p',
        async (amount) => {
            await expect(check({ amount })).rejects.toBeInstanceOf(BadRequestException);
        },
    );
    it.each([0.01, 9999999999.99])(
        'accepts representable positive amount %p without coercion',
        async (amount) => {
            await expect(check({ amount })).resolves.toMatchObject({ amount });
        },
    );
    it('rejects unknown top-level fields', async () => {
        await expect(check({ createdByUserId: 'attacker' })).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });
    it.each(['', 123, {}, 'not-a-date'])('rejects malformed paidOn %p', async (paidOn) => {
        await expect(check({ paidOn })).rejects.toBeInstanceOf(BadRequestException);
    });
    it('requires all mandatory fields even for replacement PATCH DTOs', async () => {
        await expect(pipe.transform({}, { type: 'body', metatype })).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });
    it('retains leap-day calendar and explicit offset inputs', async () => {
        await expect(check({ paidOn: '2024-02-29' })).resolves.toMatchObject({
            paidOn: '2024-02-29',
        });
        await expect(check({ paidOn: '2024-02-29T23:30:00-08:00' })).resolves.toMatchObject({
            paidOn: '2024-02-29T23:30:00-08:00',
        });
    });
});
