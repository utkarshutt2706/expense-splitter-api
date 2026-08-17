export class GroupSummaryResponseDto {
    id: string;
    name: string;
    memberIds: string[];
    memberCount: number;
    currentUserBalance: number;
    hasFinancialActivity: boolean;
    lastActivityAt: string | null;
    createdAt: string;
}
