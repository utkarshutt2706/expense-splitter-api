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
});
