import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateGroupDto {
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @IsString({ each: true })
    memberIds: string[];
}
