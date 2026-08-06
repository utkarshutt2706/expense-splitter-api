import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { MailService } from '../../src/mail/mail.service';

export async function createTestApp(): Promise<INestApplication<App>> {
    const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
    })
        // e2e runs shouldn't make real calls to Resend -- specs that care who was
        // emailed and with what invite link spy on this instead.
        .overrideProvider(MailService)
        .useValue({ sendInvitationEmail: jest.fn().mockResolvedValue(undefined) })
        .compile();

    const app = moduleFixture.createNestApplication<INestApplication<App>>();

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    await app.init();
    return app;
}
