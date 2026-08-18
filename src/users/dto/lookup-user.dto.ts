import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class LookupUserDto {
    @IsString()
    @Transform(({ value }: { value: unknown }): string => {
        if (typeof value !== 'string') {
            return '';
        }

        return value.trim();
    })
    query!: string;
}
