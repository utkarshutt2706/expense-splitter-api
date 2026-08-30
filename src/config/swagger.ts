import { DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';

export function createSwaggerConfig(): Omit<OpenAPIObject, 'paths'> {
    return new DocumentBuilder()
        .setTitle('Expense Splitter API')
        .setDescription('REST API for the Expense Splitter application')
        .setVersion('0.0.1')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
        .build();
}
