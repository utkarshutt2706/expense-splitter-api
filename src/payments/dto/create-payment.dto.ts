import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CreatePaymentDto {
    @IsString()
    @MinLength(1)
    fromUserId: string;

    @IsString()
    @MinLength(1)
    toUserId: string;

    @IsNumber()
    @IsPositive()
    amount: number;
}
