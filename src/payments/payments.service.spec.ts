import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('mock prisma error', {
        code,
        clientVersion: '7.9.1',
    });
}

function dec(value: number): Prisma.Decimal {
    return new Prisma.Decimal(value);
}

describe('PaymentsService', () => {
    let service: PaymentsService;
    let prisma: {
        group: { findUnique: jest.Mock };
        payment: {
            create: jest.Mock;
            findMany: jest.Mock;
            findFirst: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
    };

    const group = {
        id: 'group-1',
        name: 'Daaru Party',
        createdAt: new Date(),
        members: [{ userId: 'user-1' }, { userId: 'user-2' }],
    };
    const createdAt = new Date('2026-07-24T10:00:00.000Z');

    const payment: Payment = {
        id: 'payment-1',
        groupId: 'group-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: dec(500),
        paidOn: createdAt,
        createdAt,
    };

    beforeEach(() => {
        prisma = {
            group: { findUnique: jest.fn() },
            payment: {
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
        };
        service = new PaymentsService(prisma as unknown as PrismaService);
        prisma.group.findUnique.mockResolvedValue(group);
    });

    describe('create', () => {
        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.findUnique.mockResolvedValue(null);
            const dto = { fromUserId: 'user-1', toUserId: 'user-2', amount: 500 };

            await expect(service.create('missing', dto)).rejects.toThrow(NotFoundException);
        });

        it('rejects participants who are not active group members', async () => {
            const dto = { fromUserId: 'user-1', toUserId: 'outside-user', amount: 500 };

            await expect(service.create('group-1', dto)).rejects.toThrow(
                'invalid userId(s): outside-user',
            );
            expect(prisma.payment.create).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when fromUserId equals toUserId', async () => {
            const dto = { fromUserId: 'user-1', toUserId: 'user-1', amount: 500 };

            await expect(service.create('group-1', dto)).rejects.toThrow(BadRequestException);
            expect(prisma.payment.create).not.toHaveBeenCalled();
        });

        it('defaults paidOn to today when omitted', async () => {
            const createMock = prisma.payment.create as jest.MockedFunction<
                (args: { data: { paidOn: Date } }) => Promise<unknown>
            >;
            createMock.mockImplementation((args) => {
                expect(args.data.paidOn).toBeInstanceOf(Date);
                return Promise.resolve({ ...payment, paidOn: new Date() });
            });

            await service.create('group-1', {
                fromUserId: 'user-1',
                toUserId: 'user-2',
                amount: 500,
            });
        });

        it('creates a payment and maps it to the response shape', async () => {
            prisma.payment.create.mockResolvedValue(payment);

            const result = await service.create('group-1', {
                fromUserId: 'user-1',
                toUserId: 'user-2',
                amount: 500,
            });

            expect(result).toEqual({
                id: 'payment-1',
                groupId: 'group-1',
                fromUserId: 'user-1',
                toUserId: 'user-2',
                amount: 500,
                paidOn: createdAt.toISOString(),
                createdAt: createdAt.toISOString(),
            });
        });

        it('maps a foreign key violation to BadRequestException', async () => {
            prisma.payment.create.mockRejectedValue(knownRequestError('P2003'));

            await expect(
                service.create('group-1', {
                    fromUserId: 'user-1',
                    toUserId: 'user-2',
                    amount: 500,
                }),
            ).rejects.toThrow('fromUserId or toUserId does not reference an existing user');
            expect(prisma.payment.create).toHaveBeenCalledTimes(1);
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.payment.create.mockRejectedValue(new Error('boom'));
            const dto = { fromUserId: 'user-1', toUserId: 'user-2', amount: 500 };

            await expect(service.create('group-1', dto)).rejects.toThrow('boom');
        });
    });

    describe('findAllByGroup', () => {
        it('throws NotFoundException when the group does not exist', async () => {
            prisma.group.findUnique.mockResolvedValue(null);

            await expect(service.findAllByGroup('missing')).rejects.toThrow(NotFoundException);
        });

        it('returns all payments for the group mapped to the response shape', async () => {
            prisma.payment.findMany.mockResolvedValue([payment]);

            const result = await service.findAllByGroup('group-1');

            expect(result).toEqual([
                {
                    id: 'payment-1',
                    groupId: 'group-1',
                    fromUserId: 'user-1',
                    toUserId: 'user-2',
                    amount: 500,
                    paidOn: createdAt.toISOString(),
                    createdAt: createdAt.toISOString(),
                },
            ]);
        });
    });

    describe('update', () => {
        const dto = { fromUserId: 'user-2', toUserId: 'user-1', amount: 750 };

        beforeEach(() => {
            prisma.payment.findFirst.mockResolvedValue(payment);
        });

        it('throws NotFoundException when the payment is outside the group', async () => {
            prisma.payment.findFirst.mockResolvedValue(null);

            await expect(service.update('group-1', 'payment-1', dto)).rejects.toThrow(
                NotFoundException,
            );
            expect(prisma.payment.findFirst).toHaveBeenCalledWith({
                where: { id: 'payment-1', groupId: 'group-1' },
            });
            expect(prisma.payment.update).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when payer and recipient are identical', async () => {
            const invalid = { ...dto, toUserId: dto.fromUserId };

            await expect(service.update('group-1', 'payment-1', invalid)).rejects.toThrow(
                BadRequestException,
            );
            expect(prisma.payment.update).not.toHaveBeenCalled();
        });

        it('rejects an updated participant who is not an active group member', async () => {
            const invalid = { ...dto, toUserId: 'outside-user' };

            await expect(service.update('group-1', 'payment-1', invalid)).rejects.toThrow(
                'invalid userId(s): outside-user',
            );
            expect(prisma.payment.update).not.toHaveBeenCalled();
        });

        it('replaces the payment and maps it to the response shape', async () => {
            const updated: Payment = {
                id: 'payment-1',
                groupId: 'group-1',
                fromUserId: dto.fromUserId,
                toUserId: dto.toUserId,
                amount: dec(dto.amount),
                paidOn: createdAt,
                createdAt,
            };
            const updateMock = prisma.payment.update as jest.MockedFunction<
                (args: { where: { id: string }; data: { paidOn: Date } }) => Promise<unknown>
            >;
            updateMock.mockImplementation((args) => {
                expect(args.where.id).toBe('payment-1');
                expect(args.data.paidOn).toBeInstanceOf(Date);
                return Promise.resolve(updated);
            });

            await expect(service.update('group-1', 'payment-1', dto)).resolves.toEqual({
                id: 'payment-1',
                groupId: 'group-1',
                fromUserId: 'user-2',
                toUserId: 'user-1',
                amount: 750,
                paidOn: createdAt.toISOString(),
                createdAt: createdAt.toISOString(),
            });
        });

        it('maps a foreign key violation to BadRequestException', async () => {
            prisma.payment.update.mockRejectedValue(knownRequestError('P2003'));

            await expect(service.update('group-1', 'payment-1', dto)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('maps a concurrent deletion to NotFoundException', async () => {
            prisma.payment.update.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.update('group-1', 'payment-1', dto)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('remove', () => {
        beforeEach(() => {
            prisma.payment.findFirst.mockResolvedValue(payment);
            prisma.payment.delete.mockResolvedValue(payment);
        });

        it('throws NotFoundException when the payment is outside the group', async () => {
            prisma.payment.findFirst.mockResolvedValue(null);

            await expect(service.remove('group-1', 'payment-1')).rejects.toThrow(NotFoundException);
            expect(prisma.payment.delete).not.toHaveBeenCalled();
        });

        it('deletes the payment after verifying its group scope', async () => {
            await expect(service.remove('group-1', 'payment-1')).resolves.toBeUndefined();

            expect(prisma.payment.findFirst).toHaveBeenCalledWith({
                where: { id: 'payment-1', groupId: 'group-1' },
            });
            expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'payment-1' } });
        });

        it('maps a concurrent deletion to NotFoundException', async () => {
            prisma.payment.delete.mockRejectedValue(knownRequestError('P2025'));

            await expect(service.remove('group-1', 'payment-1')).rejects.toThrow(NotFoundException);
        });

        it('rethrows unrecognized errors unchanged', async () => {
            prisma.payment.delete.mockRejectedValue(new Error('boom'));

            await expect(service.remove('group-1', 'payment-1')).rejects.toThrow('boom');
        });
    });

    describe('persistence and failure contracts', () => {
        const dto = { fromUserId: 'user-1', toUserId: 'user-2', amount: 10.25 };
        afterEach(() => jest.useRealTimers());
        it.each([undefined, '2026-08-01T10:30:00+05:30'])(
            'writes the exact provided/default date %p',
            async (paidOn) => {
                jest.useFakeTimers().setSystemTime(new Date('2026-09-01T12:00:00Z'));
                const expectedDate = new Date(paidOn ?? '2026-09-01T12:00:00Z');
                prisma.payment.create.mockResolvedValue({
                    ...payment,
                    amount: dec(10.25),
                    paidOn: expectedDate,
                });
                await expect(service.create('group-1', { ...dto, paidOn })).resolves.toMatchObject({
                    amount: 10.25,
                    paidOn: expectedDate.toISOString(),
                });
                expect(prisma.payment.create).toHaveBeenCalledWith({
                    data: { groupId: 'group-1', ...dto, paidOn: expectedDate },
                });
                prisma.payment.findFirst.mockResolvedValue(payment);
                prisma.payment.update.mockResolvedValue({
                    ...payment,
                    ...dto,
                    amount: dec(10.25),
                    paidOn: expectedDate,
                });
                await expect(
                    service.update('group-1', 'payment-1', { ...dto, paidOn }),
                ).resolves.toMatchObject({ amount: 10.25, paidOn: expectedDate.toISOString() });
                expect(prisma.payment.update).toHaveBeenCalledWith({
                    where: { id: 'payment-1' },
                    data: { ...dto, paidOn: expectedDate },
                });
            },
        );
        it('returns an empty, group-scoped ordered list', async () => {
            prisma.payment.findMany.mockResolvedValue([]);
            await expect(service.findAllByGroup('group-1')).resolves.toEqual([]);
            expect(prisma.payment.findMany).toHaveBeenCalledWith({
                where: { groupId: 'group-1' },
                orderBy: { createdAt: 'asc' },
            });
        });
        it('does not write after participant lookup failure', async () => {
            const error = new Error('DB down');
            prisma.group.findUnique.mockRejectedValue(error);
            await expect(service.create('group-1', dto)).rejects.toBe(error);
            expect(prisma.payment.create).not.toHaveBeenCalled();
        });
        it('preserves legacy date fallback', async () => {
            prisma.payment.findMany.mockResolvedValue([{ ...payment, paidOn: null }]);
            await expect(service.findAllByGroup('group-1')).resolves.toEqual([
                {
                    id: payment.id,
                    groupId: payment.groupId,
                    fromUserId: payment.fromUserId,
                    toUserId: payment.toUserId,
                    amount: 500,
                    paidOn: createdAt.toISOString(),
                    createdAt: createdAt.toISOString(),
                },
            ]);
        });
        it('maps creation P2025 without an id', async () => {
            prisma.payment.create.mockRejectedValue(knownRequestError('P2025'));
            await expect(service.create('group-1', dto)).rejects.toThrow('Payment not found');
        });
        it('preserves unknown Prisma failures and normalizes non-Error rejections', async () => {
            const error = knownRequestError('P2024');
            prisma.payment.create.mockRejectedValueOnce(error).mockRejectedValueOnce(null);
            await expect(service.create('group-1', dto)).rejects.toBe(error);
            await expect(service.create('group-1', dto)).rejects.toThrow('Unexpected error');
        });
    });
});
