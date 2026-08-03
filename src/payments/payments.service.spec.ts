import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        payment: { create: jest.Mock; findMany: jest.Mock };
    };

    const group = { id: 'group-1', name: 'Daaru Party', createdAt: new Date() };
    const createdAt = new Date('2026-07-24T10:00:00.000Z');

    const payment = {
        id: 'payment-1',
        groupId: 'group-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: dec(500),
        createdAt,
    };

    beforeEach(() => {
        prisma = {
            group: { findUnique: jest.fn() },
            payment: { create: jest.fn(), findMany: jest.fn() },
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

        it('throws BadRequestException when fromUserId equals toUserId', async () => {
            const dto = { fromUserId: 'user-1', toUserId: 'user-1', amount: 500 };

            await expect(service.create('group-1', dto)).rejects.toThrow(BadRequestException);
            expect(prisma.payment.create).not.toHaveBeenCalled();
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
                createdAt: createdAt.toISOString(),
            });
        });

        it('maps a foreign key violation to BadRequestException', async () => {
            prisma.payment.create.mockRejectedValue(knownRequestError('P2003'));

            await expect(
                service.create('group-1', {
                    fromUserId: 'missing-user',
                    toUserId: 'user-2',
                    amount: 500,
                }),
            ).rejects.toThrow(BadRequestException);
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
                    createdAt: createdAt.toISOString(),
                },
            ]);
        });
    });
});
