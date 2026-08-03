import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { JwtPayload } from '../common/jwt-payload';
import { hashInvitationToken } from '../invitations/invitation-token';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password-hasher';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    async register(dto: RegisterDto): Promise<AuthTokenResponseDto> {
        const passwordHash = await hashPassword(dto.password);

        const user = await this.prisma.$transaction(async (tx) => {
            const invitation = dto.inviteToken
                ? await this.validateInvitationForRegistration(tx, dto.inviteToken, dto.email)
                : null;

            let created: Omit<User, 'passwordHash'>;
            try {
                created = await tx.user.create({
                    data: { name: dto.name, email: dto.email, phone: dto.phone, passwordHash },
                    omit: { passwordHash: true },
                });
            } catch (error) {
                throw this.mapPrismaError(error);
            }

            if (invitation) {
                await tx.groupMember.upsert({
                    where: { groupId_userId: { groupId: invitation.groupId, userId: created.id } },
                    create: { groupId: invitation.groupId, userId: created.id },
                    update: { leftAt: null },
                });
                await tx.groupInvitation.update({
                    where: { id: invitation.id },
                    data: { status: 'accepted', acceptedAt: new Date() },
                });
            }

            return created;
        });

        return this.toTokenResponse(user);
    }

    async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

        if (!user?.passwordHash || !(await verifyPassword(dto.password, user.passwordHash))) {
            throw new UnauthorizedException('Invalid email or password');
        }

        return this.toTokenResponse(user);
    }

    private async validateInvitationForRegistration(
        tx: Prisma.TransactionClient,
        rawToken: string,
        registeringEmail: string,
    ) {
        const invitation = await tx.groupInvitation.findUnique({
            where: { tokenHash: hashInvitationToken(rawToken) },
        });
        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }
        if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
            throw new ConflictException('This invitation is no longer valid');
        }
        if (invitation.email.toLowerCase() !== registeringEmail.toLowerCase()) {
            throw new BadRequestException('Email does not match the invitation');
        }
        return invitation;
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
