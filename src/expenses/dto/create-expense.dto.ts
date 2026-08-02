import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsNumber,
    IsPositive,
    IsString,
    MaxLength,
    MinLength,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { SplitType } from '@prisma/client';
import { PercentageInputDto } from './percentage-input.dto';
import { ShareInputDto } from './share-input.dto';
import { SplitDto } from './split.dto';

export class CreateExpenseDto {
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    description: string;

    @IsNumber()
    @IsPositive()
    amount: number;

    @IsString()
    @MinLength(1)
    paidByUserId: string;

    @IsEnum(SplitType)
    splitType: SplitType;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SplitDto)
    splits: SplitDto[];

    @ValidateIf((dto: CreateExpenseDto) => dto.splitType === SplitType.percentage)
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PercentageInputDto)
    percentages?: PercentageInputDto[];

    @ValidateIf((dto: CreateExpenseDto) => dto.splitType === SplitType.shares)
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ShareInputDto)
    shares?: ShareInputDto[];
}
