import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Group, GroupMember, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

type GroupWithMembers = Group & { members: GroupMember[] };

const ACTIVE_MEMBER = { leftAt: null };

@Injectable()
export class GroupsService {
    constructor(private readonly prisma: PrismaService) {}

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
            await this.prisma.group.delete({ where: { id } });
        } catch (error) {
            throw this.mapPrismaError(error, id);
        }
    }

    async update(id: string, dto: UpdateGroupDto): Promise<GroupResponseDto> {
        const existing = await this.prisma.group.findUnique({
            where: { id },
            include: { members: { where: ACTIVE_MEMBER } },
        });
        if (!existing) {
            throw new NotFoundException(`Group ${id} not found`);
        }

        try {
            if (dto.memberIds) {
                const currentUserIds = new Set(existing.members.map((member) => member.userId));
                const nextUserIds = new Set(dto.memberIds);
                const toRemove = [...currentUserIds].filter((userId) => !nextUserIds.has(userId));
                const toAdd = [...nextUserIds].filter((userId) => !currentUserIds.has(userId));

                await this.prisma.$transaction([
                    this.prisma.groupMember.updateMany({
                        where: { groupId: id, userId: { in: toRemove } },
                        data: { leftAt: new Date() },
                    }),
                    ...toAdd.map((userId) =>
                        this.prisma.groupMember.upsert({
                            where: { groupId_userId: { groupId: id, userId } },
                            create: { groupId: id, userId },
                            update: { leftAt: null },
                        }),
                    ),
                ]);
            }
            if (dto.name !== undefined) {
                await this.prisma.group.update({ where: { id }, data: { name: dto.name } });
            }
        } catch (error) {
            throw this.mapPrismaError(error, id);
        }

        return this.findOne(id);
    }

    private toResponse(group: GroupWithMembers): GroupResponseDto {
        return {
            id: group.id,
            name: group.name,
            memberIds: group.members.map((member) => member.userId),
            createdAt: group.createdAt.toISOString(),
        };
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
