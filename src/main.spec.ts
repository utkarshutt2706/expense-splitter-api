import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));

describe('production bootstrap', () => {
    const originalEnv = { ...process.env };
    afterEach(() => {
        process.env = { ...originalEnv };
        jest.restoreAllMocks();
    });

    it.each([undefined, '4000'])(
        'configures security, validation and listen port %p',
        async (port) => {
            if (port === undefined) delete process.env.PORT;
            else process.env.PORT = port;
            process.env.API_KEY = 'docs-test-key';
            process.env.CORS_ALLOWED_ORIGINS = 'https://client.example.com';
            await jest.isolateModulesAsync(async () => {
                const { NestFactory } =
                    jest.requireActual<typeof import('@nestjs/core')>('@nestjs/core');
                const { SwaggerModule } =
                    jest.requireActual<typeof import('@nestjs/swagger')>('@nestjs/swagger');
                const { ValidationPipe } =
                    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
                const { HttpExceptionFilter } = jest.requireActual<
                    typeof import('./common/filters/http-exception.filter')
                >('./common/filters/http-exception.filter');
                const { ControllerErrorLoggingInterceptor } = jest.requireActual<
                    typeof import('./common/interceptors/controller-error-logging.interceptor')
                >('./common/interceptors/controller-error-logging.interceptor');
                let listened!: () => void;
                const listening = new Promise<void>((resolve) => {
                    listened = resolve;
                });
                const app = {
                    set: jest.fn(),
                    useGlobalInterceptors: jest.fn(),
                    useGlobalFilters: jest.fn(),
                    useGlobalPipes: jest.fn(),
                    use: jest.fn(),
                    enableCors: jest.fn(),
                    listen: jest.fn().mockImplementation(() => {
                        listened();
                        return Promise.resolve();
                    }),
                };
                jest.spyOn(NestFactory, 'create').mockResolvedValue(app as never);
                const document = {
                    openapi: '3.0.0',
                    info: { title: 'test', version: '1' },
                    paths: {},
                };
                jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue(document);
                const setup = jest
                    .spyOn(SwaggerModule, 'setup')
                    .mockImplementation(() => undefined);
                jest.requireActual<typeof import('./main')>('./main');
                await listening;
                expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
                expect(app.useGlobalInterceptors).toHaveBeenCalledWith(
                    expect.any(ControllerErrorLoggingInterceptor),
                );
                expect(app.useGlobalFilters).toHaveBeenCalledWith(expect.any(HttpExceptionFilter));
                const pipe = (
                    app.useGlobalPipes.mock.calls as [InstanceType<typeof ValidationPipe>][]
                )[0][0];
                expect(pipe).toBeInstanceOf(ValidationPipe);
                const { CreatePaymentDto } = jest.requireActual<
                    typeof import('./payments/dto/create-payment.dto')
                >('./payments/dto/create-payment.dto');
                await expect(
                    pipe.transform(
                        { fromUserId: 'a', toUserId: 'b', amount: '1', extra: true },
                        { type: 'body', metatype: CreatePaymentDto },
                    ),
                ).rejects.toThrow();
                expect(app.use).toHaveBeenCalledWith(
                    ['/docs', '/docs-json', '/docs-yaml'],
                    expect.any(Function),
                );
                expect(setup).toHaveBeenCalledWith('docs', app, document);
                const cors = (app.enableCors.mock.calls as [CorsOptions][])[0][0];
                expect(cors.credentials).toBe(true);
                const origin = cors.origin as (
                    value: string | undefined,
                    callback: (error: Error | null, allow?: boolean) => void,
                ) => void;
                for (const [value, expected] of [
                    ['https://client.example.com', true],
                    ['https://attacker.example.com', false],
                    [undefined, true],
                ] as const) {
                    const callback = jest.fn();
                    origin(value, callback);
                    expect(callback).toHaveBeenCalledWith(null, expected);
                }
                expect(app.listen).toHaveBeenCalledWith(port ?? 3000);
            });
        },
    );
});
