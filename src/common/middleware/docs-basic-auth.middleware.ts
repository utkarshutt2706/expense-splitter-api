import { NextFunction, Request, Response } from 'express';
import { timingSafeCompare } from '../timing-safe-compare';

const BASIC_AUTH_PREFIX = 'Basic ';

export function createDocsBasicAuthMiddleware(
    apiKey: string,
): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
        const header = req.headers.authorization;
        const providedKey = header?.startsWith(BASIC_AUTH_PREFIX)
            ? Buffer.from(header.slice(BASIC_AUTH_PREFIX.length), 'base64')
                  .toString('utf8')
                  .split(':')[1]
            : undefined;

        if (providedKey && timingSafeCompare(providedKey, apiKey)) {
            next();
            return;
        }

        res.setHeader('WWW-Authenticate', 'Basic realm="Expense Splitter API Docs"');
        res.status(401).send('Authentication required');
    };
}
