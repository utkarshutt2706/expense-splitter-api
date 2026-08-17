import { ApiProperty } from '@nestjs/swagger';

export class DashboardMemberShareDto {
    @ApiProperty({ example: 'user-id' })
    userId: string;

    @ApiProperty({ example: 'Utkarsh' })
    name: string;

    @ApiProperty({ example: 1250.5 })
    amount: number;

    @ApiProperty({ example: true })
    isCurrentUser: boolean;
}

export class DashboardMonthlySpendDto {
    @ApiProperty({ example: '2026-08' })
    month: string;

    @ApiProperty({ example: 4800 })
    amount: number;

    @ApiProperty({ example: 3200 })
    actualPaid: number;

    @ApiProperty({ example: 1600 })
    currentUserShare: number;
}

export class DashboardGroupSpendDto {
    @ApiProperty({ example: 'group-id' })
    groupId: string;

    @ApiProperty({ example: 'Goa trip' })
    name: string;

    @ApiProperty({ example: 4800 })
    amount: number;

    @ApiProperty({ example: 3200 })
    actualPaid: number;

    @ApiProperty({ example: 1600 })
    currentUserShare: number;

    @ApiProperty({ example: 250, description: 'Settlement-aware balance; positive means owed.' })
    currentBalance: number;

    @ApiProperty({ type: [DashboardMemberShareDto] })
    memberShares: DashboardMemberShareDto[];

    @ApiProperty({ type: [DashboardMonthlySpendDto] })
    spendingByMonth: DashboardMonthlySpendDto[];
}

export class DashboardResponseDto {
    @ApiProperty({ example: 5200 })
    actualPaid: number;

    @ApiProperty({ example: 1850.5 })
    currentUserShare: number;

    @ApiProperty({ type: [DashboardGroupSpendDto] })
    groupSpend: DashboardGroupSpendDto[];
}
