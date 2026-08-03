import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupMembershipGuard } from './group-membership.guard';

describe('GroupMembershipGuard', () => {
    let prisma: { group: { findUnique: jest.Mock } };
    let guard: GroupMembershipGuard;

    beforeEach(() => {
        prisma = { group: { findUnique: jest.fn() } };
        guard = new GroupMembershipGuard(prisma as unknown as PrismaService);
    });

    function mockContext(params: Record<string, string>): ExecutionContext {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    params,
                    user: { sub: 'user-1', email: 'user-1@example.com' },
                }),
            }),
        } as unknown as ExecutionContext;
    }

    it('allows the request when the user is a member of the group', async () => {
        prisma.group.findUnique.mockResolvedValue({
            id: 'group-1',
            members: [{ groupId: 'group-1', userId: 'user-1' }],
        });

        await expect(guard.canActivate(mockContext({ groupId: 'group-1' }))).resolves.toBe(true);
        expect(prisma.group.findUnique).toHaveBeenCalledWith({
            where: { id: 'group-1' },
            include: { members: { where: { userId: 'user-1', leftAt: null } } },
        });
    });

    it('throws ForbiddenException when the user has left the group', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'group-1', members: [] });

        await expect(guard.canActivate(mockContext({ groupId: 'group-1' }))).rejects.toThrow(
            ForbiddenException,
        );
        expect(prisma.group.findUnique).toHaveBeenCalledWith({
            where: { id: 'group-1' },
            include: { members: { where: { userId: 'user-1', leftAt: null } } },
        });
    });

    it('falls back to the id route parameter when groupId is absent', async () => {
        prisma.group.findUnique.mockResolvedValue({
            id: 'group-1',
            members: [{ groupId: 'group-1', userId: 'user-1' }],
        });

        await expect(guard.canActivate(mockContext({ id: 'group-1' }))).resolves.toBe(true);
    });

    it('throws NotFoundException when the group does not exist', async () => {
        prisma.group.findUnique.mockResolvedValue(null);

        await expect(guard.canActivate(mockContext({ groupId: 'missing' }))).rejects.toThrow(
            NotFoundException,
        );
    });

    it('throws ForbiddenException when the group exists but the user is not a member', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'group-1', members: [] });

        await expect(guard.canActivate(mockContext({ groupId: 'group-1' }))).rejects.toThrow(
            ForbiddenException,
        );
    });

    it('throws when neither groupId nor id is present on the route', async () => {
        await expect(guard.canActivate(mockContext({}))).rejects.toThrow(
            'GroupMembershipGuard requires a groupId or id route parameter',
        );
    });
});
