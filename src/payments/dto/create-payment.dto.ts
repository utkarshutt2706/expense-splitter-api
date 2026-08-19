import {
    IsDateString,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MinLength,
} from 'class-validator';
import { IsNotFutureDate } from '../../common/decorators/is-not-future-date.decorator';

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

    @IsOptional()
    @IsDateString()
    @IsNotFutureDate()
    paidOn?: string;
}
