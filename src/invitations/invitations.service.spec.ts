import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
    let service: InvitationsService;
    let prisma: {
        user: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
        groupMember: { findFirst: jest.Mock };
        groupInvitation: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
        group: { findUniqueOrThrow: jest.Mock };
    };
    let mailService: { sendInvitationEmail: jest.Mock };
    let configService: { get: jest.Mock };

    const invitation = {
        id: 'invitation-1',
        groupId: 'group-1',
        email: 'bob@example.com',
        invitedByUserId: 'user-1',
        tokenHash: 'hash',
        status: 'pending',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date(),
    };

    beforeEach(() => {
        prisma = {
            user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
            groupMember: { findFirst: jest.fn() },
            groupInvitation: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
            group: { findUniqueOrThrow: jest.fn() },
        };
        mailService = { sendInvitationEmail: jest.fn() };
        configService = { get: jest.fn().mockReturnValue('https://frontend.example.com') };
        service = new InvitationsService(
            prisma as unknown as PrismaService,
            mailService as unknown as MailService,
            configService as unknown as ConfigService<EnvConfig, true>,
        );
    });

    describe('create', () => {
        it('throws ConflictException when the email already belongs to a registered user', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

            await expect(
                service.create('group-1', 'user-1', { email: 'bob@example.com' }),
            ).rejects.toThrow(ConflictException);
        });

        it('throws ConflictException when the email is already an active member', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.groupMember.findFirst.mockResolvedValue({ groupId: 'group-1', userId: 'x' });

            await expect(
                service.create('group-1', 'user-1', { email: 'bob@example.com' }),
            ).rejects.toThrow(ConflictException);
        });

        it('returns the existing invitation when a pending one already exists', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.groupMember.findFirst.mockResolvedValue(null);
            prisma.groupInvitation.findFirst.mockResolvedValue(invitation);

            const result = await service.create('group-1', 'user-1', { email: 'bob@example.com' });

            expect(result.id).toBe('invitation-1');
            expect(prisma.groupInvitation.create).not.toHaveBeenCalled();
            expect(mailService.sendInvitationEmail).not.toHaveBeenCalled();
        });

        it('creates a new invitation and fires the email without awaiting it', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.groupMember.findFirst.mockResolvedValue(null);
            prisma.groupInvitation.findFirst.mockResolvedValue(null);
            prisma.group.findUniqueOrThrow.mockResolvedValue({ id: 'group-1', name: 'Goa Trip' });
            prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', name: 'Alice' });
            prisma.groupInvitation.create.mockResolvedValue(invitation);
            // Never resolves -- if create() awaited this, the test would time out.
            mailService.sendInvitationEmail.mockReturnValue(new Promise(() => {}));

            const result = await service.create('group-1', 'user-1', { email: 'bob@example.com' });

            expect(result).toEqual({
                id: 'invitation-1',
                groupId: 'group-1',
                email: 'bob@example.com',
                status: 'pending',
                expiresAt: invitation.expiresAt.toISOString(),
            });
            expect(mailService.sendInvitationEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'bob@example.com',
                    groupName: 'Goa Trip',
                    inviterName: 'Alice',
                    inviteUrl: expect.stringContaining(
                        'https://frontend.example.com/register?invite=',
                    ) as string,
                }),
            );
        });
    });

    describe('validate', () => {
        it('throws NotFoundException when no invitation matches the token', async () => {
            prisma.groupInvitation.findUnique.mockResolvedValue(null);

            await expect(service.validate('some-token')).rejects.toThrow(NotFoundException);
        });

        it('throws ConflictException when the invitation is expired', async () => {
            prisma.groupInvitation.findUnique.mockResolvedValue({
                ...invitation,
                expiresAt: new Date(Date.now() - 1000),
                group: { id: 'group-1', name: 'Goa Trip' },
                invitedBy: { name: 'Alice' },
            });

            await expect(service.validate('some-token')).rejects.toThrow(ConflictException);
        });

        it('throws ConflictException when the invitation is already accepted', async () => {
            prisma.groupInvitation.findUnique.mockResolvedValue({
                ...invitation,
                status: 'accepted',
                group: { id: 'group-1', name: 'Goa Trip' },
                invitedBy: { name: 'Alice' },
            });

            await expect(service.validate('some-token')).rejects.toThrow(ConflictException);
        });

        it('returns the email, group, and inviter name for a valid pending invitation', async () => {
            prisma.groupInvitation.findUnique.mockResolvedValue({
                ...invitation,
                group: { id: 'group-1', name: 'Goa Trip' },
                invitedBy: { name: 'Alice' },
            });

            await expect(service.validate('some-token')).resolves.toEqual({
                email: 'bob@example.com',
                group: { id: 'group-1', name: 'Goa Trip' },
                inviterName: 'Alice',
            });
        });
    });
});
