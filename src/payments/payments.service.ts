import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

@Injectable()
export class PaymentsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(groupId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
        await this.ensureGroupExists(groupId);

        if (dto.fromUserId === dto.toUserId) {
            throw new BadRequestException('fromUserId and toUserId must be different');
        }

        try {
            const payment = await this.prisma.payment.create({
                data: {
                    groupId,
                    fromUserId: dto.fromUserId,
                    toUserId: dto.toUserId,
                    amount: dto.amount,
                },
            });
            return this.toResponse(payment);
        } catch (error) {
            throw this.mapPrismaError(error);
        }
    }

    async findAllByGroup(groupId: string): Promise<PaymentResponseDto[]> {
        await this.ensureGroupExists(groupId);

        const payments = await this.prisma.payment.findMany({
            where: { groupId },
            orderBy: { createdAt: 'asc' },
        });
        return payments.map((payment) => this.toResponse(payment));
    }

    private async ensureGroupExists(groupId: string): Promise<void> {
        const group = await this.prisma.group.findUnique({ where: { id: groupId } });
        if (!group) {
            throw new NotFoundException(`Group ${groupId} not found`);
        }
    }

    private toResponse(payment: Payment): PaymentResponseDto {
        return {
            id: payment.id,
            groupId: payment.groupId,
            fromUserId: payment.fromUserId,
            toUserId: payment.toUserId,
            amount: payment.amount.toNumber(),
            createdAt: payment.createdAt.toISOString(),
        };
    }

    private mapPrismaError(error: unknown): Error {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            return new BadRequestException(
                'fromUserId or toUserId does not reference an existing user',
            );
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }
}
