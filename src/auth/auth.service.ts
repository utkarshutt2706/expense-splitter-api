import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { JwtPayload } from '../common/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password-hasher';
import { createRefreshToken, hashRefreshToken, REFRESH_SESSION_TTL_MS } from './refresh-session';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    async register(dto: RegisterDto): Promise<AuthTokenResponseDto> {
        const phone = dto.phone.trim();

        const passwordHash = await hashPassword(dto.password);

        let user: Omit<User, 'passwordHash'>;
        try {
            user = await this.prisma.user.create({
                data: { name: dto.name, email: dto.email, phone, passwordHash },
                omit: { passwordHash: true },
            });
        } catch (error) {
            throw this.mapPrismaError(error);
        }

        return this.toTokenResponse(user);
    }

    async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

        if (!user?.passwordHash || !(await verifyPassword(dto.password, user.passwordHash))) {
            throw new UnauthorizedException('Invalid email or password');
        }

        return this.toTokenResponse(user);
    }

    async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        // Still requires the current password even though the caller is already
        // authenticated via JWT -- a leaked/stolen token alone shouldn't be
        // enough to lock the real account owner out.
        if (
            !user?.passwordHash ||
            !(await verifyPassword(dto.currentPassword, user.passwordHash))
        ) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        const passwordHash = await hashPassword(dto.newPassword);
        await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    }

    async createRefreshSession(userId: string): Promise<string> {
        const token = createRefreshToken();
        await this.prisma.authSession.create({
            data: {
                userId,
                tokenHash: hashRefreshToken(token),
                expiresAt: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
            },
        });
        return token;
    }

    async refresh(refreshToken: string): Promise<AuthTokenResponseDto | null> {
        const session = await this.prisma.authSession.findUnique({
            where: { tokenHash: hashRefreshToken(refreshToken) },
            include: { user: true },
        });

        if (!session || session.expiresAt <= new Date()) {
            if (session) {
                await this.prisma.authSession.delete({ where: { id: session.id } });
            }
            return null;
        }

        return this.toTokenResponse(session.user);
    }

    async revokeRefreshSession(refreshToken: string): Promise<void> {
        await this.prisma.authSession.deleteMany({
            where: { tokenHash: hashRefreshToken(refreshToken) },
        });
    }

    private async toTokenResponse(user: Omit<User, 'passwordHash'>): Promise<AuthTokenResponseDto> {
        const payload: JwtPayload = { sub: user.id, email: user.email };
        const accessToken = await this.jwtService.signAsync(payload);

        return { user: this.toPublicUser(user), accessToken };
    }

    private toPublicUser(user: Omit<User, 'passwordHash'>): AuthUserResponseDto {
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
