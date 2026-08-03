import { InvitationStatus } from '@prisma/client';

export class InvitationResponseDto {
    id: string;
    groupId: string;
    email: string;
    status: InvitationStatus;
    expiresAt: string;
}
