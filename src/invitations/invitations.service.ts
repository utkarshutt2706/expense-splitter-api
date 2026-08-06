import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroupInvitation } from '@prisma/client';
import { EnvConfig } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { ValidateInvitationResponseDto } from './dto/validate-invitation-response.dto';
import { generateInvitationToken, hashInvitationToken } from './invitation-token';

export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService<EnvConfig, true>,
    ) {}

    async create(
        groupId: string,
        invitedByUserId: string,
        dto: CreateInvitationDto,
    ): Promise<InvitationResponseDto> {
        const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existingUser) {
            throw new ConflictException(
                'A user with this email is already registered -- add them to the group directly instead of inviting',
            );
        }

        const activeMembership = await this.prisma.groupMember.findFirst({
            where: { groupId, leftAt: null, user: { email: dto.email } },
        });
        if (activeMembership) {
            throw new ConflictException('This email is already a member of the group');
        }

        const existingPending = await this.prisma.groupInvitation.findFirst({
            where: {
                groupId,
                email: dto.email,
                status: 'pending',
                expiresAt: { gt: new Date() },
            },
        });
        if (existingPending) {
            return this.toResponse(existingPending);
        }

        const [group, inviter] = await Promise.all([
            this.prisma.group.findUniqueOrThrow({ where: { id: groupId } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: invitedByUserId } }),
        ]);

        const { rawToken, tokenHash } = generateInvitationToken();
        const invitation = await this.prisma.groupInvitation.create({
            data: {
                groupId,
                email: dto.email,
                invitedByUserId,
                tokenHash,
                expiresAt: new Date(Date.now() + INVITATION_EXPIRY_MS),
            },
        });

        const frontendUrl = this.configService.get('FRONTEND_URL', { infer: true });
        await this.mailService.sendInvitationEmail({
            to: dto.email,
            inviteUrl: `${frontendUrl}/register?invite=${rawToken}`,
            groupName: group.name,
            inviterName: inviter.name,
            expiresAt: invitation.expiresAt,
        });

        return this.toResponse(invitation);
    }

    async validate(rawToken: string): Promise<ValidateInvitationResponseDto> {
        const invitation = await this.prisma.groupInvitation.findUnique({
            where: { tokenHash: hashInvitationToken(rawToken) },
            include: { group: true },
        });
        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }
        if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
            throw new ConflictException('This invitation is no longer valid');
        }
        return {
            email: invitation.email,
            group: { id: invitation.group.id, name: invitation.group.name },
        };
    }

    private toResponse(invitation: GroupInvitation): InvitationResponseDto {
        return {
            id: invitation.id,
            groupId: invitation.groupId,
            email: invitation.email,
            status: invitation.status,
            expiresAt: invitation.expiresAt.toISOString(),
        };
    }
}
