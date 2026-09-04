import { BadRequestException } from '@nestjs/common';
import { SplitType } from '@prisma/client';
import { CreateExpenseDto } from './dto/create-expense.dto';
import {
    Split,
    calculateEqualSplit,
    calculatePercentageSplit,
    calculateSharesSplit,
    splitsReconcile,
    sumAmounts,
} from './split-calculator';

const RECONCILE_TOLERANCE_CENTS = 1;
const PERCENTAGE_SUM_TOLERANCE = 0.01;

export function expenseParticipantUserIds(dto: CreateExpenseDto): string[] {
    return [
        dto.paidByUserId,
        ...dto.splits.map((split) => split.userId),
        ...(dto.percentages?.map((entry) => entry.userId) ?? []),
        ...(dto.shares?.map((entry) => entry.userId) ?? []),
    ];
}

function expectedSplits(dto: CreateExpenseDto): Split[] {
    switch (dto.splitType) {
        case SplitType.equal:
            return calculateEqualSplit(
                dto.amount,
                dto.splits.map((split) => split.userId),
            );
        case SplitType.percentage: {
            if (!dto.percentages?.length) {
                throw new BadRequestException('percentages is required for a percentage split');
            }
            const total = dto.percentages.reduce((sum, entry) => sum + entry.percentage, 0);
            if (Math.abs(total - 100) > PERCENTAGE_SUM_TOLERANCE) {
                throw new BadRequestException('percentages must sum to 100');
            }
            return calculatePercentageSplit(dto.amount, dto.percentages);
        }
        case SplitType.shares:
            if (!dto.shares?.length) {
                throw new BadRequestException('shares is required for a shares split');
            }
            return calculateSharesSplit(dto.amount, dto.shares);
        default:
            throw new BadRequestException(`Unsupported split type: ${String(dto.splitType)}`);
    }
}

export function validateExpenseSplits(dto: CreateExpenseDto): void {
    if (dto.splitType === SplitType.exact) {
        if (Math.round(sumAmounts(dto.splits) * 100) !== Math.round(dto.amount * 100)) {
            throw new BadRequestException(
                'splits do not sum to the expense amount for an exact split',
            );
        }
        return;
    }
    if (!splitsReconcile(dto.splits, expectedSplits(dto), RECONCILE_TOLERANCE_CENTS)) {
        throw new BadRequestException(
            'submitted splits do not reconcile with the server-computed split',
        );
    }
}
