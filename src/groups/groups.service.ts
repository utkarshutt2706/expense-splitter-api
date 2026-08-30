import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Group, GroupMember, Prisma } from '@prisma/client';
import { BalancesService } from '../balances/balances.service';
import { mapBalanceInputs } from '../balances/balance-input-mapper';
import { calculateNetBalances } from '../balances/balance-calculator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { GroupSummaryResponseDto } from './dto/group-summary-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

type GroupWithMembers = Group & { members: GroupMember[] };

const ACTIVE_MEMBER = { leftAt: null };
const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class GroupsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly balancesService: BalancesService,
    ) {}

    async create(creatorUserId: string, dto: CreateGroupDto): Promise<GroupResponseDto> {
        const memberIds = Array.from(new Set([creatorUserId, ...dto.memberIds]));

        try {
            const group = await this.prisma.group.create({
                data: {
                    name: dto.name,
                    members: {
                        create: memberIds.map((userId) => ({ userId })),
                    },
                },
                include: { members: { where: ACTIVE_MEMBER } },
            });
            return this.toResponse(group);
        } catch (error) {
            throw this.mapPrismaError(error);
        }
    }

    async findAll(userId: string): Promise<GroupResponseDto[]> {
        const groups = await this.prisma.group.findMany({
            where: { members: { some: { userId, ...ACTIVE_MEMBER } } },
            include: { members: { where: ACTIVE_MEMBER } },
        });
        return groups.map((group) => this.toResponse(group));
    }

    async findAllSummaries(userId: string): Promise<GroupSummaryResponseDto[]> {
        const groups = await this.prisma.group.findMany({
            where: { members: { some: { userId, ...ACTIVE_MEMBER } } },
            include: {
                members: { where: ACTIVE_MEMBER },
                expenses: {
                    select: {
                        paidByUserId: true,
                        createdAt: true,
                        splits: { select: { userId: true, amount: true } },
                    },
                },
                payments: {
                    select: {
                        fromUserId: true,
                        toUserId: true,
                        amount: true,
                        createdAt: true,
                    },
                },
            },
        });

        return groups.map((group) => {
            const memberIds = group.members.map((member) => member.userId);
            const balanceInputs = mapBalanceInputs(group.expenses, group.payments);
            const balances = calculateNetBalances(
                memberIds,
                balanceInputs.expenses,
                balanceInputs.payments,
            );
            const activityDates = [
                ...group.expenses.map((expense) => expense.createdAt),
                ...group.payments.map((payment) => payment.createdAt),
            ];
            const lastActivityAt = activityDates.reduce<Date | null>(
                (latest, date) => (!latest || date > latest ? date : latest),
                null,
            );

            return {
                id: group.id,
                name: group.name,
                memberIds,
                memberCount: memberIds.length,
                currentUserBalance: balances.find((entry) => entry.userId === userId)?.balance ?? 0,
                hasFinancialActivity: activityDates.length > 0,
                lastActivityAt: lastActivityAt?.toISOString() ?? null,
                createdAt: group.createdAt.toISOString(),
            };
        });
    }

    async findOne(id: string): Promise<GroupResponseDto> {
        const group = await this.prisma.group.findUnique({
            where: { id },
            include: { members: { where: ACTIVE_MEMBER } },
        });
        if (!group) {
            throw new NotFoundException(`Group ${id} not found`);
        }
        return this.toResponse(group);
    }

    async remove(id: string): Promise<void> {
        try {
            await this.runSerializableTransaction(async (tx) => {
                const { balances } = await this.balancesService.getGroupBalances(id, tx);
                const unsettled = balances.filter((entry) => entry.balance !== 0);
                if (unsettled.length > 0) {
                    throw new ConflictException(
                        'Cannot delete a group with unsettled balances -- everyone must be settled up first',
                    );
                }

                await tx.group.delete({ where: { id } });
            });
        } catch (error) {
            throw this.mapPrismaError(error, id);
        }
    }

    async update(id: string, dto: UpdateGroupDto): Promise<GroupResponseDto> {
        try {
            return await this.runSerializableTransaction(async (tx) => {
                const existing = await tx.group.findUnique({
                    where: { id },
                    include: { members: { where: ACTIVE_MEMBER } },
                });
                if (!existing) {
                    throw new NotFoundException(`Group ${id} not found`);
                }

                if (dto.memberIds) {
                    const currentUserIds = new Set(existing.members.map((member) => member.userId));
                    const nextUserIds = new Set(dto.memberIds);
                    const toRemove = [...currentUserIds].filter(
                        (userId) => !nextUserIds.has(userId),
                    );
                    const toAdd = [...nextUserIds].filter((userId) => !currentUserIds.has(userId));

                    if (toRemove.length > 0) {
                        const { balances } = await this.balancesService.getGroupBalances(id, tx);
                        const unsettled = balances.filter(
                            (entry) => toRemove.includes(entry.userId) && entry.balance !== 0,
                        );
                        if (unsettled.length > 0) {
                            throw new ConflictException(
                                `Cannot remove member(s) with an unsettled balance: ${unsettled
                                    .map((entry) => entry.userId)
                                    .join(', ')}`,
                            );
                        }
                    }

                    await tx.groupMember.updateMany({
                        where: { groupId: id, userId: { in: toRemove } },
                        data: { leftAt: new Date() },
                    });
                    await Promise.all(
                        toAdd.map((userId) =>
                            tx.groupMember.upsert({
                                where: { groupId_userId: { groupId: id, userId } },
                                create: { groupId: id, userId },
                                update: { leftAt: null },
                            }),
                        ),
                    );
                }

                if (dto.name !== undefined) {
                    await tx.group.update({ where: { id }, data: { name: dto.name } });
                }

                const updated = await tx.group.findUnique({
                    where: { id },
                    include: { members: { where: ACTIVE_MEMBER } },
                });
                if (!updated) {
                    throw new NotFoundException(`Group ${id} not found`);
                }
                return this.toResponse(updated);
            });
        } catch (error) {
            throw this.mapPrismaError(error, id);
        }
    }

    private toResponse(group: GroupWithMembers): GroupResponseDto {
        return {
            id: group.id,
            name: group.name,
            memberIds: group.members.map((member) => member.userId),
            createdAt: group.createdAt.toISOString(),
        };
    }

    private async runSerializableTransaction<T>(
        operation: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
        for (let attempt = 1; attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt++) {
            try {
                return await this.prisma.$transaction(operation, {
                    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                });
            } catch (error) {
                const isRetryableConflict =
                    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
                if (!isRetryableConflict || attempt === SERIALIZABLE_TRANSACTION_ATTEMPTS) {
                    throw error;
                }
            }
        }

        throw new Error('Serializable transaction retry limit exceeded');
    }

    private mapPrismaError(error: unknown, id?: string): Error {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                return new NotFoundException(id ? `Group ${id} not found` : 'Group not found');
            }
            if (error.code === 'P2003') {
                return new BadRequestException(
                    'One or more memberIds do not reference an existing user',
                );
            }
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }
}
