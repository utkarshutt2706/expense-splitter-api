import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BatchLookupUsersDto } from './dto/batch-lookup-users.dto';
import { LookupUserDto, MIN_USER_LOOKUP_LENGTH } from './dto/lookup-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type PublicUser = Omit<User, 'passwordHash'>;
export type UserLookupResult = Pick<User, 'id' | 'name' | 'avatarUrl'> &
    Partial<Pick<User, 'email' | 'phone'>>;

const USER_LOOKUP_LIMIT = 10;
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

    async lookup(dto: LookupUserDto): Promise<UserLookupResult[]> {
        const search = dto.query?.trim();

        if (!search || search.length < MIN_USER_LOOKUP_LENGTH) {
            throw new BadRequestException(
                `query must be at least ${MIN_USER_LOOKUP_LENGTH} characters long`,
            );
        }

        const isEmailLookup = search.includes('@');
        const isPhoneLookup = /^\+?\d+$/.test(search);

        let where: Prisma.UserWhereInput;
        if (isEmailLookup) {
            where = { email: { equals: search, mode: 'insensitive' } };
        } else if (isPhoneLookup) {
            where = { phone: { equals: search } };
        } else {
            where = { name: { contains: search, mode: 'insensitive' } };
        }

        return this.prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                avatarUrl: true,
                email: isEmailLookup,
                phone: isPhoneLookup,
            },
            orderBy: { name: 'asc' },
            take: USER_LOOKUP_LIMIT,
        });
    }

    findManyByIds(dto: BatchLookupUsersDto): Promise<PublicUser[]> {
        return this.prisma.user.findMany({
            where: { id: { in: dto.ids } },
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
