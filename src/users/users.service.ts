import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LookupUserDto } from './dto/lookup-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type PublicUser = Omit<User, 'passwordHash'>;

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

    async lookup(dto: LookupUserDto): Promise<PublicUser> {
        if (dto.email && dto.phone) {
            throw new BadRequestException('Provide only one of email or phone, not both');
        }
        if (!dto.email && !dto.phone) {
            throw new BadRequestException('email or phone is required');
        }

        const user = await this.prisma.user.findUnique({
            where: dto.email ? { email: dto.email } : { phone: dto.phone as string },
            omit: { passwordHash: true },
        });
        if (!user) {
            throw new NotFoundException('No registered user matches that email or phone');
        }
        return user;
    }

    async findFriends(userId: string): Promise<PublicUser[]> {
        const myGroups = await this.prisma.groupMember.findMany({
            where: { userId },
            select: { groupId: true },
        });
        const groupIds = myGroups.map((membership) => membership.groupId);

        const friendMemberships = await this.prisma.groupMember.findMany({
            where: { groupId: { in: groupIds }, userId: { not: userId } },
            select: { userId: true },
            distinct: ['userId'],
        });

        return this.prisma.user.findMany({
            where: { id: { in: friendMemberships.map((membership) => membership.userId) } },
            omit: { passwordHash: true },
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
