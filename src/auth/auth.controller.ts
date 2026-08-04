import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
import { AuthService } from './auth.service';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('register')
    @ApiOperation({
        summary: 'Register a new account',
        description:
            'Creates a User and returns a ready-to-use accessToken, same shape as Login. Pass ' +
            'inviteToken (from a group invitation link) to atomically join that group as part of ' +
            'registration -- the invitation email must match the email you register with.',
    })
    @ApiResponse({ status: 201, description: 'Account created.', type: AuthTokenResponseDto })
    @ApiResponse({
        status: 400,
        description:
            'Validation error, or (with inviteToken) the email does not match the invitation.',
        type: ErrorResponseDto,
        examples: {
            validation: {
                summary: 'Validation error',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'Email must be an email; Password must be longer than or equal to 8 characters; Name must be a string',
                ),
            },
            invitationEmailMismatch: {
                summary: 'inviteToken email mismatch',
                value: errorExample('VALIDATION_ERROR', 'Email does not match the invitation'),
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'inviteToken does not match any invitation.',
        type: ErrorResponseDto,
        example: errorExample('NOT_FOUND', 'Invitation not found'),
    })
    @ApiResponse({
        status: 409,
        description:
            'Email already registered, or (with inviteToken) the invitation is expired, revoked, ' +
            'or already accepted.',
        type: ErrorResponseDto,
        examples: {
            emailAlreadyRegistered: {
                summary: 'Email already registered',
                value: errorExample('CONFLICT', 'A user with this email already exists'),
            },
            invitationNoLongerValid: {
                summary: 'Invitation expired, revoked, or already accepted',
                value: errorExample('CONFLICT', 'This invitation is no longer valid'),
            },
        },
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
}
