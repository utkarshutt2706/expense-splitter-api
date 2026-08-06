class InvitationGroupDto {
    id: string;
    name: string;
}

export class ValidateInvitationResponseDto {
    email: string;
    group: InvitationGroupDto;
    inviterName: string;
}
