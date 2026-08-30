import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowMissingPhone } from '../common/decorators/allow-missing-phone.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtPayload } from '../common/jwt-payload';
import { BatchLookupUsersDto } from './dto/batch-lookup-users.dto';
import { LookupUserDto } from './dto/lookup-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PublicUser, UsersService } from './users.service';

@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('lookup')
    @ApiOperation({
        summary: 'Search registered users by name, email or phone',
        description:
            'Returns matching users whose name, email or phone contains the supplied query string.',
    })
    @ApiResponse({
        status: 200,
        description: 'Users matching the search.',
        type: [UserResponseDto],
    })
    @ApiResponse({
        status: 400,
        description: 'The query parameter is missing or empty.',
        type: ErrorResponseDto,
        example: errorExample('VALIDATION_ERROR', 'query is required'),
    })
    @ApiResponse({
        status: 401,
        description: 'Missing or invalid token.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
    })
    lookup(@Query() dto: LookupUserDto): Promise<PublicUser[]> {
        return this.usersService.lookup(dto);
    }

    @Post('batch')
    @ApiOperation({
        summary: 'Resolve multiple user ids to display-ready profiles',
        description:
            "Used to resolve a group's memberIds or an expense split's userIds to names/avatars. " +
            'Unknown ids are silently omitted, not an error.',
    })
    @ApiResponse({
        status: 200,
        description: 'Users matching the given ids (order not guaranteed).',
        type: [UserResponseDto],
    })
    @ApiResponse({
        status: 400,
        description: 'ids was empty or not an array of strings.',
        type: ErrorResponseDto,
        example: errorExample('VALIDATION_ERROR', 'Ids must contain at least 1 elements'),
    })
    @ApiResponse({
        status: 401,
        description: 'Missing or invalid token.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
    })
    findManyByIds(@Body() dto: BatchLookupUsersDto): Promise<PublicUser[]> {
        return this.usersService.findManyByIds(dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a user by id' })
    @ApiResponse({ status: 200, description: 'The user.', type: UserResponseDto })
    @ApiResponse({
        status: 401,
        description: 'Missing or invalid token.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
    })
    @ApiResponse({
        status: 404,
        description: 'No user with that id.',
        type: ErrorResponseDto,
        example: errorExample('NOT_FOUND', 'User does-not-exist not found'),
    })
    findOne(@Param('id') id: string): Promise<PublicUser> {
        return this.usersService.findOne(id);
    }

    @AllowMissingPhone()
    @Patch(':id')
    @ApiOperation({
        summary: "Update the caller's own account",
        description: 'Partial update -- send only the fields you want to change. Self only.',
    })
    @ApiResponse({ status: 200, description: 'Updated user.', type: UserResponseDto })
    @ApiResponse({
        status: 400,
        description: 'Validation error.',
        type: ErrorResponseDto,
        example: errorExample('VALIDATION_ERROR', 'Email must be an email'),
    })
    @ApiResponse({
        status: 401,
        description: 'Missing or invalid token.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
    })
    @ApiResponse({
        status: 403,
        description: 'id does not match the caller.',
        type: ErrorResponseDto,
        example: errorExample('FORBIDDEN', 'You can only modify your own account'),
    })
    @ApiResponse({
        status: 404,
        description: 'No user with that id.',
        type: ErrorResponseDto,
        example: errorExample('NOT_FOUND', 'User does-not-exist not found'),
    })
    @ApiResponse({
        status: 409,
        description: 'The new email/phone is already used by another user.',
        type: ErrorResponseDto,
        example: errorExample('CONFLICT', 'A user with this email already exists'),
    })
    update(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
        @Body() dto: UpdateUserDto,
    ): Promise<PublicUser> {
        this.assertSelf(user, id);
        return this.usersService.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: "Delete the caller's own account", description: 'Self only.' })
    @ApiResponse({ status: 204, description: 'Deleted.' })
    @ApiResponse({
        status: 401,
        description: 'Missing or invalid token.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
    })
    @ApiResponse({
        status: 403,
        description: 'id does not match the caller.',
        type: ErrorResponseDto,
        example: errorExample('FORBIDDEN', 'You can only modify your own account'),
    })
    @ApiResponse({
        status: 404,
        description: 'No user with that id.',
        type: ErrorResponseDto,
        example: errorExample('NOT_FOUND', 'User does-not-exist not found'),
    })
    @ApiResponse({
        status: 409,
        description: 'The user is referenced by an existing group or expense.',
        type: ErrorResponseDto,
        example: errorExample(
            'CONFLICT',
            'Cannot delete a user referenced by an existing group or expense',
        ),
    })
    async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
        this.assertSelf(user, id);
        await this.usersService.remove(id);
    }

    private assertSelf(user: JwtPayload, id: string): void {
        if (user.sub !== id) {
            throw new ForbiddenException('You can only modify your own account');
        }
    }
}
