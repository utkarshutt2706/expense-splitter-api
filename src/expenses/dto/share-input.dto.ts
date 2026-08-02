import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class ShareInputDto {
    @IsString()
    @MinLength(1)
    userId: string;

    @IsNumber()
    @IsPositive()
    shares: number;
}
