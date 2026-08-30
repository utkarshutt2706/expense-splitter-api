import { Body, Controller, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtPayload } from '../common/jwt-payload';
import { AuthService } from './auth.service';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('register')
    @ApiOperation({
        summary: 'Register a new account',
        description: 'Creates a User and returns a ready-to-use accessToken, same shape as Login.',
    })
    @ApiResponse({ status: 201, description: 'Account created.', type: AuthTokenResponseDto })
    @ApiResponse({
        status: 400,
        description: 'Validation error.',
        type: ErrorResponseDto,
        examples: {
            validation: {
                summary: 'Validation error',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'Email must be an email; Password must be longer than or equal to 8 characters; Name must be a string',
                ),
            },
        },
    })
    @ApiResponse({
        status: 409,
        description: 'Email already registered.',
        type: ErrorResponseDto,
        example: errorExample('CONFLICT', 'A user with this email already exists'),
    })
    register(@Body() dto: RegisterDto): Promise<AuthTokenResponseDto> {
        return this.authService.register(dto);
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Log in with email and password' })
    @ApiResponse({ status: 200, description: 'Credentials valid.', type: AuthTokenResponseDto })
    @ApiResponse({
        status: 401,
        description: 'Email not registered, no password set, or wrong password.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid email or password'),
    })
    login(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
        return this.authService.login(dto);
    }

    @Patch('password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: "Change the caller's own password",
        description:
            'Requires the current password even though the caller is already authenticated via ' +
            "JWT -- a leaked/stolen token alone shouldn't be enough to lock the real account owner " +
            'out.',
    })
    @ApiResponse({ status: 204, description: 'Password changed.' })
    @ApiResponse({
        status: 400,
        description: 'Validation error.',
        type: ErrorResponseDto,
        example: errorExample(
            'VALIDATION_ERROR',
            'New password must be longer than or equal to 8 characters',
        ),
    })
    @ApiResponse({
        status: 401,
        description: 'Missing or invalid token, or currentPassword is wrong.',
        type: ErrorResponseDto,
        examples: {
            unauthorized: {
                summary: 'Missing/invalid token',
                value: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
            },
            wrongPassword: {
                summary: 'currentPassword is wrong',
                value: errorExample('UNAUTHORIZED', 'Current password is incorrect'),
            },
        },
    })
    async changePassword(
        @CurrentUser() user: JwtPayload,
        @Body() dto: ChangePasswordDto,
    ): Promise<void> {
        await this.authService.changePassword(user.sub, dto);
    }
}
