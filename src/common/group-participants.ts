import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function assertActiveGroupParticipants(
    prisma: PrismaService,
    groupId: string,
    participantUserIds: string[],
): Promise<void> {
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { members: { where: { leftAt: null }, select: { userId: true } } },
    });

    if (!group) {
        throw new NotFoundException(`Group ${groupId} not found`);
    }

    const activeMemberIds = new Set(group.members.map((member) => member.userId));
    const nonMemberIds = [...new Set(participantUserIds)].filter(
        (userId) => !activeMemberIds.has(userId),
    );

    if (nonMemberIds.length > 0) {
        throw new BadRequestException(
            `All participants must be active group members; invalid userId(s): ${nonMemberIds.join(', ')}`,
        );
    }
}
