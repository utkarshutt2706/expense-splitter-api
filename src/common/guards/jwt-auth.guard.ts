import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ALLOW_MISSING_PHONE_KEY } from '../decorators/allow-missing-phone.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { JwtPayload } from '../jwt-payload';
import { PrismaService } from '../../prisma/prisma.service';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const allowMissingPhone = this.reflector.getAllAndOverride<boolean>(
            ALLOW_MISSING_PHONE_KEY,
            [context.getHandler(), context.getClass()],
        );

        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const authHeader = request.header('authorization');
        const token = authHeader?.startsWith(BEARER_PREFIX)
            ? authHeader.slice(BEARER_PREFIX.length)
            : undefined;

        if (!token) {
            throw new UnauthorizedException('Missing or invalid Authorization header');
        }

        try {
            request.user = await this.jwtService.verifyAsync<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: request.user.sub },
            select: { phone: true },
        });

        if (!user || (!user.phone && !allowMissingPhone)) {
            throw new ForbiddenException(
                'Phone number is required. Please add your phone number before continuing.',
            );
        }

        return true;
    }
}
