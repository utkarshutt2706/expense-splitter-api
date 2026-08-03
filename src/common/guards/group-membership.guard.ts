import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class GroupMembershipGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const params = request.params as Record<string, string | undefined>;
        const groupId = params.groupId ?? params.id;

        if (!groupId) {
            throw new Error('GroupMembershipGuard requires a groupId or id route parameter');
        }

        const userId = request.user.sub;
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { where: { userId, leftAt: null } } },
        });

        if (!group) {
            throw new NotFoundException(`Group ${groupId} not found`);
        }

        if (group.members.length === 0) {
            throw new ForbiddenException('You are not a member of this group');
        }

        return true;
    }
}
