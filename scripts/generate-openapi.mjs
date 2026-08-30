import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://contract:contract@localhost:5432/contract';
process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:5173';
process.env.API_KEY ??= 'contract-generation-key';
process.env.JWT_SECRET ??= 'contract-generation-secret-at-least-32-characters';

const [{ AppModule }, { createSwaggerConfig }] = await Promise.all([
    import('../dist/app.module.js'),
    import('../dist/config/swagger.js'),
]);

const app = await NestFactory.create(AppModule, { logger: false });
const document = SwaggerModule.createDocument(app, createSwaggerConfig());
const outputPath = resolve('openapi.json');
const serializedDocument = `${JSON.stringify(document, null, 2)}\n`;

if (process.argv.includes('--check')) {
    const committedDocument = await readFile(outputPath, 'utf8');
    if (JSON.stringify(JSON.parse(committedDocument)) !== JSON.stringify(document)) {
        throw new Error('openapi.json is stale. Run pnpm generate:openapi.');
    }
    console.log('openapi.json is up to date');
} else {
    await writeFile(outputPath, serializedDocument);
    console.log(`Generated ${outputPath}`);
}

await app.close();
