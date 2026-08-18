import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class LookupUserDto {
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    query!: string;
}
