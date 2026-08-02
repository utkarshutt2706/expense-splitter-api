import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class PercentageInputDto {
    @IsString()
    @MinLength(1)
    userId: string;

    @IsNumber()
    @IsPositive()
    percentage: number;
}
