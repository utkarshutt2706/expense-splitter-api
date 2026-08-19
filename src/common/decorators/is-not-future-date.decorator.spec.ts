import { validate } from 'class-validator';

import { IsNotFutureDate } from './is-not-future-date.decorator';

class TestDto {
    @IsNotFutureDate()
    paidOn!: string;
}

function dateInputValue(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

describe('IsNotFutureDate', () => {
    it.each([
        ['a past date', '2026-08-18'],
        ['today', dateInputValue(new Date())],
    ])('accepts %s', async (_label, value) => {
        const dto = new TestDto();
        dto.paidOn = value;

        await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects a future date with the default message', async () => {
        const dto = new TestDto();
        dto.paidOn = '2099-12-31';

        const errors = await validate(dto);

        expect(errors[0]?.constraints).toEqual({
            isNotFutureDate: 'paidOn must not be a future date',
        });
    });

    it.each([['not-a-date'], [12345]])('rejects invalid values: %s', async (value) => {
        const dto = new TestDto();
        dto.paidOn = value as unknown as string;

        await expect(validate(dto)).resolves.toHaveLength(1);
    });
});
