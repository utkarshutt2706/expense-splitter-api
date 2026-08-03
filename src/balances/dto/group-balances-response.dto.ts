export class NetBalanceDto {
    userId: string;
    balance: number;
}

export class SettlementTransactionDto {
    fromUserId: string;
    toUserId: string;
    amount: number;
}

export class GroupBalancesResponseDto {
    balances: NetBalanceDto[];
    settlements: SettlementTransactionDto[];
}
