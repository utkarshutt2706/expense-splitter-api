import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(groupId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
        await this.ensureGroupExists(groupId);

        this.validateParticipants(dto);

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

    async update(groupId: string, id: string, dto: UpdatePaymentDto): Promise<PaymentResponseDto> {
        await this.ensurePaymentExists(groupId, id);
        this.validateParticipants(dto);

        try {
            const payment = await this.prisma.payment.update({
                where: { id },
                data: {
                    fromUserId: dto.fromUserId,
                    toUserId: dto.toUserId,
                    amount: dto.amount,
                },
            });
            return this.toResponse(payment);
        } catch (error) {
            throw this.mapPrismaError(error, groupId, id);
        }
    }

    private async ensureGroupExists(groupId: string): Promise<void> {
        const group = await this.prisma.group.findUnique({ where: { id: groupId } });
        if (!group) {
            throw new NotFoundException(`Group ${groupId} not found`);
        }
    }

    private async ensurePaymentExists(groupId: string, id: string): Promise<void> {
        const payment = await this.prisma.payment.findFirst({ where: { id, groupId } });
        if (!payment) {
            throw new NotFoundException(`Payment ${id} not found in group ${groupId}`);
        }
    }

    private validateParticipants(dto: CreatePaymentDto): void {
        if (dto.fromUserId === dto.toUserId) {
            throw new BadRequestException('fromUserId and toUserId must be different');
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

    private mapPrismaError(error: unknown, groupId?: string, id?: string): Error {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2003') {
                return new BadRequestException(
                    'fromUserId or toUserId does not reference an existing user',
                );
            }
            if (error.code === 'P2025') {
                return new NotFoundException(
                    id && groupId
                        ? `Payment ${id} not found in group ${groupId}`
                        : 'Payment not found',
                );
            }
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }
}
