import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { EnvConfig } from '../config/env.validation';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService<EnvConfig, true>,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const providedKey = request.header('x-api-key');
        const expectedKey = this.configService.get('API_KEY', { infer: true });

        if (!providedKey || !this.safeCompare(providedKey, expectedKey)) {
            throw new UnauthorizedException('Invalid or missing API key');
        }

        return true;
    }

    private safeCompare(a: string, b: string): boolean {
        const bufferA = Buffer.from(a);
        const bufferB = Buffer.from(b);

        if (bufferA.length !== bufferB.length) {
            return false;
        }

        return timingSafeEqual(bufferA, bufferB);
    }
}
