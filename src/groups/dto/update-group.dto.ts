import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class UpdateGroupDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name?: string;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @IsString({ each: true })
    memberIds?: string[];
}
