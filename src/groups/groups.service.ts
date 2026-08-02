import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Group, GroupMember, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';

type GroupWithMembers = Group & { members: GroupMember[] };

@Injectable()
export class GroupsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateGroupDto): Promise<GroupResponseDto> {
        try {
            const group = await this.prisma.group.create({
                data: {
                    name: dto.name,
                    members: {
                        create: dto.memberIds.map((userId) => ({ userId })),
                    },
                },
                include: { members: true },
            });
            return this.toResponse(group);
        } catch (error) {
            throw this.mapPrismaError(error);
        }
    }

    async findAll(): Promise<GroupResponseDto[]> {
        const groups = await this.prisma.group.findMany({ include: { members: true } });
        return groups.map((group) => this.toResponse(group));
    }

    async findOne(id: string): Promise<GroupResponseDto> {
        const group = await this.prisma.group.findUnique({
            where: { id },
            include: { members: true },
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

    async rename(id: string, name: string): Promise<GroupResponseDto> {
        try {
            const group = await this.prisma.group.update({
                where: { id },
                data: { name },
                include: { members: true },
            });
            return this.toResponse(group);
        } catch (error) {
            throw this.mapPrismaError(error, id);
        }
    }

    async addMember(id: string, dto: AddMemberDto): Promise<GroupResponseDto> {
        await this.findOne(id);
        try {
            await this.prisma.groupMember.create({
                data: { groupId: id, userId: dto.userId },
            });
        } catch (error) {
            throw this.mapMembershipError(error);
        }
        return this.findOne(id);
    }

    async removeMember(id: string, userId: string): Promise<GroupResponseDto> {
        await this.findOne(id);
        try {
            await this.prisma.groupMember.delete({
                where: { groupId_userId: { groupId: id, userId } },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                throw new NotFoundException('User is not a member of this group');
            }
            throw error;
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
                return new ConflictException(
                    'One or more memberIds do not reference an existing user',
                );
            }
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }

    private mapMembershipError(error: unknown): Error {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return new ConflictException('User is already a member of this group');
            }
            if (error.code === 'P2003') {
                return new NotFoundException('User not found');
            }
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }
}
