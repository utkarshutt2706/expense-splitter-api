import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ControllerErrorLoggingInterceptor } from './common/interceptors/controller-error-logging.interceptor';
import { createDocsBasicAuthMiddleware } from './common/middleware/docs-basic-auth.middleware';
import { isOriginAllowed, parseAllowedOrigins } from './config/cors';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalInterceptors(new ControllerErrorLoggingInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    const apiKey = process.env.API_KEY ?? '';
    app.use(['/docs', '/docs-json', '/docs-yaml'], createDocsBasicAuthMiddleware(apiKey));

    const swaggerConfig = new DocumentBuilder()
        .setTitle('Expense Splitter API')
        .setDescription('REST API for the Expense Splitter application')
        .setVersion('0.0.1')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
        .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);

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
