import 'dotenv/config';

export default function validateE2eEnvironment(): void {
    const databaseUrl = process.env['DATABASE_URL'];
    const nodeEnv = process.env['NODE_ENV'];

    if (!databaseUrl) {
        throw new Error('E2E tests require DATABASE_URL to point to an isolated test database.');
    }

    let databaseName: string;
    try {
        databaseName = new URL(databaseUrl).pathname.slice(1);
    } catch {
        throw new Error('E2E tests require a valid DATABASE_URL.');
    }

    if (nodeEnv !== 'test' || !/(?:^|[_-])(?:e2e|test)(?:[_-]|$)/i.test(databaseName)) {
        throw new Error(
            'Refusing to run E2E tests outside an isolated test database. Set NODE_ENV=test and use a database name containing "test" or "e2e".',
        );
    }
}
