import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class FriendGroupBalanceDto {
    @ApiProperty()
    groupId: string;

    @ApiProperty()
    groupName: string;

    @ApiProperty()
    balance: number;
}

export class FriendResponseDto extends UserResponseDto {
    @ApiProperty({ minimum: 1 })
    sharedGroupCount: number;

    @ApiProperty()
    netBalance: number;

    @ApiProperty({ type: [FriendGroupBalanceDto] })
    groupBalances: FriendGroupBalanceDto[];
}
