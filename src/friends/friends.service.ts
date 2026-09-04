import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    buildFriendSummaries,
    friendBalanceGroupSelect,
    FriendSummary,
} from './friend-summary-builder';

export type Friend = FriendSummary;

@Injectable()
export class FriendsService {
    constructor(private readonly prisma: PrismaService) {}

    async findFriends(userId: string): Promise<Friend[]> {
        const memberships = await this.prisma.groupMember.findMany({
            where: { userId, leftAt: null },
            select: { groupId: true },
        });
        const groupIds = memberships.map(({ groupId }) => groupId);
        if (groupIds.length === 0) return [];

        const [friendMemberships, groups] = await Promise.all([
            this.prisma.groupMember.findMany({
                where: { groupId: { in: groupIds }, userId: { not: userId }, leftAt: null },
                select: { userId: true, groupId: true },
            }),
            this.prisma.group.findMany({
                where: { id: { in: groupIds } },
                select: friendBalanceGroupSelect,
            }),
        ]);
        const users = await this.prisma.user.findMany({
            where: { id: { in: [...new Set(friendMemberships.map(({ userId: id }) => id))] } },
            omit: { passwordHash: true },
        });
        return buildFriendSummaries(userId, users, friendMemberships, groups);
    }
}
