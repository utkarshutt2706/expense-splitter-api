import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;

    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password: string;
}
