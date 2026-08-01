import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { isOriginAllowed, parseAllowedOrigins } from './config/cors';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS ?? '');
    app.enableCors({
        origin: (
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void,
        ) => {
            callback(null, isOriginAllowed(origin, allowedOrigins));
        },
    });

    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
