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
