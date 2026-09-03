import { Prisma } from '@prisma/client';

const DEFAULT_ATTEMPTS = 3;

export async function runSerializableTransaction<T>(
    prisma: {
        $transaction: <R>(
            operation: (tx: Prisma.TransactionClient) => Promise<R>,
            options: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) => Promise<R>;
    },
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    attempts = DEFAULT_ATTEMPTS,
): Promise<T> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await prisma.$transaction(operation, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (error) {
            const retryable =
                error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
            if (!retryable || attempt === attempts) throw error;
        }
    }
    throw new Error('Serializable transaction retry limit exceeded');
}
