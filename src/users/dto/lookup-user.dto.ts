import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class LookupUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;
}
