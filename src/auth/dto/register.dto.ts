import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @Length(10, 10)
    @Matches(/^[6-9]\d{9}$/)
    phone: string;

    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password: string;
}
