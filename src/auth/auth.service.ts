import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password-hasher';

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) {}

    async register(dto: RegisterDto): Promise<AuthUserResponseDto> {
        const passwordHash = await hashPassword(dto.password);

        try {
            return await this.prisma.user.create({
                data: {
                    name: dto.name,
                    email: dto.email,
                    phone: dto.phone,
                    passwordHash,
                },
                omit: { passwordHash: true },
            });
        } catch (error) {
            throw this.mapPrismaError(error);
        }
    }

    async login(dto: LoginDto): Promise<AuthUserResponseDto> {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

        if (!user?.passwordHash || !(await verifyPassword(dto.password, user.passwordHash))) {
            throw new UnauthorizedException('Invalid email or password');
        }

        return this.toPublicUser(user);
    }

    private toPublicUser(user: User): AuthUserResponseDto {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
        };
    }

    private mapPrismaError(error: unknown): Error {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = Array.isArray(error.meta?.target)
                ? (error.meta.target as string[]).join(', ')
                : 'field';
            return new ConflictException(`A user with this ${target} already exists`);
        }
        return error instanceof Error ? error : new Error('Unexpected error');
    }
}
