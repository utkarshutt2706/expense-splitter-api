import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { EnvConfig } from '../config/env.validation';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
    const API_KEY = 'a-sufficiently-long-secret';

    let reflector: Reflector;
    let configService: ConfigService<EnvConfig, true>;
    let guard: ApiKeyGuard;

    beforeEach(() => {
        reflector = new Reflector();
        configService = { get: () => API_KEY } as unknown as ConfigService<EnvConfig, true>;
        guard = new ApiKeyGuard(reflector, configService);
    });

    function contextWithHeader(header: string | undefined): ExecutionContext {
        return {
            getHandler: () => undefined,
            getClass: () => undefined,
            switchToHttp: () => ({
                getRequest: () => ({
                    header: () => header,
                }),
            }),
        } as unknown as ExecutionContext;
    }

    it('allows a public route without checking the header', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

        expect(guard.canActivate(contextWithHeader(undefined))).toBe(true);
    });

    it('allows the request when the header matches the configured key', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

        expect(guard.canActivate(contextWithHeader(API_KEY))).toBe(true);
    });

    it('rejects the request when the header is missing', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

        expect(() => guard.canActivate(contextWithHeader(undefined))).toThrow(
            UnauthorizedException,
        );
    });

    it('rejects the request when the header does not match', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

        expect(() => guard.canActivate(contextWithHeader('wrong-key'))).toThrow(
            UnauthorizedException,
        );
    });

    it('rejects the request when the header is a different length than the key', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

        expect(() => guard.canActivate(contextWithHeader('short'))).toThrow(UnauthorizedException);
    });
});
