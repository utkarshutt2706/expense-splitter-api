import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtPayload } from '../common/jwt-payload';
import { FriendResponseDto } from './dto/friend-response.dto';
import { Friend, FriendsService } from './friends.service';

@ApiBearerAuth('access-token')
@Controller('users/me/friends')
export class FriendsController {
    constructor(private readonly friendsService: FriendsService) {}

    @Get()
    @ApiOperation({
        summary: "List the caller's friends",
        description:
            'Derived, not stored: active members of groups the caller currently belongs to, ' +
            'deduplicated across shared groups.',
    })
    @ApiResponse({
        status: 200,
        description: 'The friend list (may be empty).',
        type: [FriendResponseDto],
    })
    @ApiResponse({
        status: 401,
        description: 'Missing or invalid token.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
    })
    findFriends(@CurrentUser() user: JwtPayload): Promise<Friend[]> {
        return this.friendsService.findFriends(user.sub);
    }
}
