import { IsNumber, IsString, MinLength } from 'class-validator';

export class SplitDto {
    @IsString()
    @MinLength(1)
    userId: string;

    @IsNumber()
    amount: number;
}
