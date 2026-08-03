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
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload';
import { BatchLookupUsersDto } from './dto/batch-lookup-users.dto';
import { LookupUserDto } from './dto/lookup-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUser, UsersService } from './users.service';

@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('lookup')
    lookup(@Query() dto: LookupUserDto): Promise<PublicUser> {
        return this.usersService.lookup(dto);
    }

    @Get('me/friends')
    findFriends(@CurrentUser() user: JwtPayload): Promise<PublicUser[]> {
        return this.usersService.findFriends(user.sub);
    }

    @Post('batch')
    findManyByIds(@Body() dto: BatchLookupUsersDto): Promise<PublicUser[]> {
        return this.usersService.findManyByIds(dto);
    }

    @Get(':id')
    findOne(@Param('id') id: string): Promise<PublicUser> {
        return this.usersService.findOne(id);
    }

    @Patch(':id')
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
