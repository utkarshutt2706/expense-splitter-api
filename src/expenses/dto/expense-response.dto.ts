import { SplitType } from '@prisma/client';

export class ExpenseSplitResponseDto {
    userId: string;
    amount: number;
}

export class ExpenseResponseDto {
    id: string;
    groupId: string;
    description: string;
    amount: number;
    paidByUserId: string;
    createdByUserId: string;
    splitType: SplitType;
    splits: ExpenseSplitResponseDto[];
    paidOn: string;
    createdAt: string;
}
