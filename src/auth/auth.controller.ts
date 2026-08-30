import {
    Body,
    Controller,
    ForbiddenException,
    Headers,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtPayload } from '../common/jwt-payload';
import { AuthService } from './auth.service';
import { AUTH_RATE_LIMITS } from './auth-rate-limits';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
    readCookie,
    REFRESH_COOKIE_NAME,
    REFRESH_SESSION_TTL_MS,
    SESSION_REQUEST_HEADER,
    SESSION_REQUEST_HEADER_VALUE,
} from './refresh-session';

const refreshCookieBaseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
    path: '/auth',
};
const refreshCookieOptions = {
    ...refreshCookieBaseOptions,
    maxAge: REFRESH_SESSION_TTL_MS,
};

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('register')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: AUTH_RATE_LIMITS.register })
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
    @ApiResponse({
        status: 429,
        description: 'Too many registration attempts from this client.',
        type: ErrorResponseDto,
        example: errorExample('TOO_MANY_REQUESTS', 'Too many requests. Please try again later.'),
    })
    async register(
        @Body() dto: RegisterDto,
        @Res({ passthrough: true }) response: Response,
    ): Promise<AuthTokenResponseDto> {
        const session = await this.authService.register(dto);
        const refreshToken = await this.authService.createRefreshSession(session.user.id);
        response.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
        return session;
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: AUTH_RATE_LIMITS.login })
    @ApiOperation({ summary: 'Log in with email and password' })
    @ApiResponse({ status: 200, description: 'Credentials valid.', type: AuthTokenResponseDto })
    @ApiResponse({
        status: 401,
        description: 'Email not registered, no password set, or wrong password.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid email or password'),
    })
    @ApiResponse({
        status: 429,
        description: 'Too many login attempts from this client.',
        type: ErrorResponseDto,
        example: errorExample('TOO_MANY_REQUESTS', 'Too many requests. Please try again later.'),
    })
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) response: Response,
    ): Promise<AuthTokenResponseDto> {
        const session = await this.authService.login(dto);
        const refreshToken = await this.authService.createRefreshSession(session.user.id);
        response.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
        return session;
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: AUTH_RATE_LIMITS.refresh })
    @ApiOperation({ summary: 'Restore a session from the secure refresh cookie' })
    @ApiResponse({
        status: 200,
        description: 'A restored session, or null.',
        type: AuthTokenResponseDto,
    })
    async refresh(
        @Headers(SESSION_REQUEST_HEADER) sessionRequest: string | undefined,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<AuthTokenResponseDto | null> {
        this.assertSessionRequest(sessionRequest);
        const token = readCookie(request.headers.cookie, REFRESH_COOKIE_NAME);
        if (!token) return null;

        const session = await this.authService.refresh(token);
        if (!session) response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBaseOptions);
        return session;
    }

    @Public()
    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Revoke the refresh session and clear its cookie' })
    @ApiResponse({ status: 204, description: 'Session revoked.' })
    async logout(
        @Headers(SESSION_REQUEST_HEADER) sessionRequest: string | undefined,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<void> {
        this.assertSessionRequest(sessionRequest);
        const token = readCookie(request.headers.cookie, REFRESH_COOKIE_NAME);
        if (token) await this.authService.revokeRefreshSession(token);
        response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieBaseOptions);
    }

    private assertSessionRequest(value: string | undefined): void {
        if (value !== SESSION_REQUEST_HEADER_VALUE) {
            throw new ForbiddenException('Invalid session request');
        }
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
