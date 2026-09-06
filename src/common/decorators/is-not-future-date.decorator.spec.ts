import { validate } from 'class-validator';

import { IsNotFutureDate } from './is-not-future-date.decorator';

class TestDto {
    timeZone?: string = 'Asia/Kolkata';

    @IsNotFutureDate()
    paidOn!: string;
}

describe('IsNotFutureDate', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-09-05T21:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it.each([
        ['a past date', '2026-08-18'],
        ['today in UTC', '2026-09-05'],
        ['today at 2:30 AM in India', '2026-09-06'],
        ['an ISO date for today in India', '2026-09-06T00:00:00.000Z'],
    ])('accepts %s', async (_label, value) => {
        const dto = new TestDto();
        dto.paidOn = value;

        await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects a future date with the default message', async () => {
        const dto = new TestDto();
        dto.paidOn = '2026-09-07';

        const errors = await validate(dto);

        expect(errors[0]?.constraints).toEqual({
            isNotFutureDate: 'paidOn must not be a future date',
        });
    });

    it.each([
        ['2026-09-05T18:29:59.999Z', 'Asia/Kolkata', '2026-09-06', false],
        ['2026-09-05T18:30:00.000Z', 'Asia/Kolkata', '2026-09-06', true],
        ['2026-09-05T21:00:00.000Z', 'Asia/Kolkata', '2026-09-07', false],
        ['2026-09-05T21:00:00.000Z', 'UTC', '2026-09-06', false],
        ['2026-09-05T21:00:00.000Z', undefined, '2026-09-06', false],
        ['2026-09-05T21:00:00.000Z', undefined, '2026-09-05', true],
        ['2026-09-06T01:00:00.000Z', 'America/Los_Angeles', '2026-09-05', true],
        ['2026-09-06T01:00:00.000Z', 'America/Los_Angeles', '2026-09-06', false],
        ['2026-09-05T10:00:00.000Z', 'Pacific/Kiritimati', '2026-09-06', true],
        ['2026-12-31T21:00:00.000Z', 'Asia/Kolkata', '2027-01-01', true],
        ['2026-12-31T21:00:00.000Z', 'Asia/Kolkata', '2027-01-02', false],
        ['2026-01-15T04:30:00.000Z', 'America/New_York', '2026-01-15', false],
        ['2026-07-15T04:30:00.000Z', 'America/New_York', '2026-07-15', true],
    ])('validates %s in %s against %s', async (now, timeZone, value, accepted) => {
        jest.setSystemTime(new Date(now));
        const dto = new TestDto();
        dto.timeZone = timeZone;
        dto.paidOn = value;

        await expect(validate(dto)).resolves.toHaveLength(accepted ? 0 : 1);
    });

    it.each(['Invalid/Zone', '', null, 330])(
        'rejects an invalid timezone: %s',
        async (timeZone) => {
            const dto = Object.assign(new TestDto(), { paidOn: '2026-09-05', timeZone });

            await expect(validate(dto)).resolves.toHaveLength(1);
        },
    );

    it.each([['not-a-date'], [12345]])('rejects invalid values: %s', async (value) => {
        const dto = new TestDto();
        dto.paidOn = value as unknown as string;

        await expect(validate(dto)).resolves.toHaveLength(1);
    });
});
