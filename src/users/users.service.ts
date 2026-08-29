import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { calculateNetBalances, simplifyDebts } from '../balances/balance-calculator';
import { fromCents, toCents } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { BatchLookupUsersDto } from './dto/batch-lookup-users.dto';
import { LookupUserDto } from './dto/lookup-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type PublicUser = Omit<User, 'passwordHash'>;
export type Friend = PublicUser & {
    sharedGroupCount: number;
    netBalance: number;
    groupBalances: { groupId: string; groupName: string; balance: number }[];
};

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async findOne(id: string): Promise<PublicUser> {
        const user = await this.prisma.user.findUnique({
            where: { id },
            omit: { passwordHash: true },
        });
        if (!user) {
            throw new NotFoundException(`User ${id} not found`);
        }
        return user;
    }

    async lookup(dto: LookupUserDto): Promise<PublicUser[]> {
        const search = dto.query?.trim();

        if (!search) {
            throw new BadRequestException('query is required');
        }

        return this.prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                ],
            },
            omit: { passwordHash: true },
            orderBy: { name: 'asc' },
        });
    }

    findManyByIds(dto: BatchLookupUsersDto): Promise<PublicUser[]> {
        return this.prisma.user.findMany({
            where: { id: { in: dto.ids } },
            omit: { passwordHash: true },
        });
    }

    async findFriends(userId: string): Promise<Friend[]> {
        const myGroups = await this.prisma.groupMember.findMany({
            where: { userId, leftAt: null },
            select: { groupId: true },
        });
        const groupIds = myGroups.map((membership) => membership.groupId);
        if (groupIds.length === 0) return [];

        const [friendMemberships, groups] = await Promise.all([
            this.prisma.groupMember.findMany({
                where: {
                    groupId: { in: groupIds },
                    userId: { not: userId },
                    leftAt: null,
                },
                select: { userId: true, groupId: true },
            }),
            this.prisma.group.findMany({
                where: { id: { in: groupIds } },
                select: {
                    id: true,
                    name: true,
                    members: { where: { leftAt: null }, select: { userId: true } },
                    expenses: {
                        select: {
                            paidByUserId: true,
                            splits: { select: { userId: true, amount: true } },
                        },
                    },
                    payments: {
                        select: { fromUserId: true, toUserId: true, amount: true },
                    },
                },
            }),
        ]);

        const sharedGroupCountByUserId = friendMemberships.reduce<Map<string, number>>(
            (counts, membership) => {
                counts.set(membership.userId, (counts.get(membership.userId) ?? 0) + 1);
                return counts;
            },
            new Map(),
        );
        const users = await this.prisma.user.findMany({
            where: { id: { in: [...sharedGroupCountByUserId.keys()] } },
            omit: { passwordHash: true },
        });

        const groupBalancesByUserId = new Map<
            string,
            { groupId: string; groupName: string; balanceCents: number }[]
        >();
        for (const group of groups) {
            const balances = calculateNetBalances(
                group.members.map((member) => member.userId),
                group.expenses.map((expense) => ({
                    paidByUserId: expense.paidByUserId,
                    splits: expense.splits.map((split) => ({
                        userId: split.userId,
                        amount: split.amount.toNumber(),
                    })),
                })),
                group.payments.map((payment) => ({
                    fromUserId: payment.fromUserId,
                    toUserId: payment.toUserId,
                    amount: payment.amount.toNumber(),
                })),
            );
            for (const settlement of simplifyDebts(balances)) {
                if (settlement.toUserId === userId) {
                    const groupBalances = groupBalancesByUserId.get(settlement.fromUserId) ?? [];
                    groupBalances.push({
                        groupId: group.id,
                        groupName: group.name,
                        balanceCents: toCents(settlement.amount),
                    });
                    groupBalancesByUserId.set(settlement.fromUserId, groupBalances);
                } else if (settlement.fromUserId === userId) {
                    const groupBalances = groupBalancesByUserId.get(settlement.toUserId) ?? [];
                    groupBalances.push({
                        groupId: group.id,
                        groupName: group.name,
                        balanceCents: -toCents(settlement.amount),
                    });
                    groupBalancesByUserId.set(settlement.toUserId, groupBalances);
                }
            }
        }

        return users.map((user) => {
            const groupBalances = groupBalancesByUserId.get(user.id) ?? [];
            return {
                ...user,
                sharedGroupCount: sharedGroupCountByUserId.get(user.id) ?? 0,
                netBalance: fromCents(
                    groupBalances.reduce((total, entry) => total + entry.balanceCents, 0),
                ),
                groupBalances: groupBalances.map((entry) => ({
                    groupId: entry.groupId,
                    groupName: entry.groupName,
                    balance: fromCents(entry.balanceCents),
                })),
            };
        });
    }

    update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
        return this.prisma.user
            .update({ where: { id }, data: dto, omit: { passwordHash: true } })
            .catch((error: unknown) => {
                throw this.mapPrismaError(error, id);
            });
    }

    remove(id: string): Promise<User> {
        return this.prisma.user.delete({ where: { id } }).catch((error: unknown) => {
            throw this.mapPrismaError(error, id);
        });
    }

    private mapPrismaError(error: unknown, id?: string): Error {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                const target = Array.isArray(error.meta?.target)
                    ? (error.meta.target as string[]).join(', ')
                    : 'field';
                return new ConflictException(`A user with this ${target} already exists`);
            }
            if (error.code === 'P2025') {
                return new NotFoundException(id ? `User ${id} not found` : 'User not found');
            }
            if (error.code === 'P2003') {
                return new ConflictException(
                    'Cannot delete a user referenced by an existing group or expense',
                );
            }
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }
}
