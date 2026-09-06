import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsDateString,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsTimeZone,
    MinLength,
    ValidateIf,
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

    @ApiPropertyOptional({
        description: 'IANA timezone used to validate paidOn against local today. Defaults to UTC.',
        example: 'Asia/Kolkata',
    })
    @ValidateIf((_dto: CreatePaymentDto, value: unknown) => value !== undefined)
    @IsTimeZone()
    timeZone?: string;
}
