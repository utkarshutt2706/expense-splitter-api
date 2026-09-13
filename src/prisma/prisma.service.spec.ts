import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
    let service: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PrismaService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: () => 'postgresql://user:password@localhost:5432/db',
                    },
                },
            ],
        }).compile();

        service = module.get(PrismaService);
    });

    it('connects on module init', async () => {
        const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

        await service.onModuleInit();

        expect(connectSpy).toHaveBeenCalled();
    });

    it('disconnects on module destroy', async () => {
        const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

        await service.onModuleDestroy();

        expect(disconnectSpy).toHaveBeenCalled();
    });

    afterEach(() => jest.restoreAllMocks());
    it.each(['onModuleInit', 'onModuleDestroy'] as const)(
        'propagates %s lifecycle errors',
        async (method) => {
            const error = new Error('connection lifecycle failed');
            jest.spyOn(
                service,
                method === 'onModuleInit' ? '$connect' : '$disconnect',
            ).mockRejectedValue(error);
            await expect(service[method]()).rejects.toBe(error);
        },
    );
    it('waits for connection completion before reporting initialized', async () => {
        let connected!: () => void;
        jest.spyOn(service, '$connect').mockReturnValue(
            new Promise<void>((resolve) => {
                connected = resolve;
            }),
        );
        let initialized = false;
        const result = service.onModuleInit().then(() => {
            initialized = true;
        });
        await Promise.resolve();
        expect(initialized).toBe(false);
        connected();
        await result;
        expect(initialized).toBe(true);
    });
});
