import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export const MIN_USER_LOOKUP_LENGTH = 3;

export class LookupUserDto {
    @IsString()
    @MinLength(MIN_USER_LOOKUP_LENGTH)
    @Transform(({ value }: { value: unknown }): string => {
        if (typeof value !== 'string') {
            return '';
        }

        return value.trim();
    })
    query!: string;
}
