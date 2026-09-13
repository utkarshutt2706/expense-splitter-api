import { Request, Response } from 'express';
import { createDocsBasicAuthMiddleware } from './docs-basic-auth.middleware';

type MockResponse = {
    setHeader: jest.Mock;
    status: jest.Mock;
    send: jest.Mock;
};

describe('createDocsBasicAuthMiddleware', () => {
    const API_KEY = 'a-sufficiently-long-secret';
    const middleware = createDocsBasicAuthMiddleware(API_KEY);

    function requestWithAuthorization(header: string | undefined): Request {
        return { headers: { authorization: header } } as unknown as Request;
    }

    function mockResponse(): MockResponse {
        return {
            setHeader: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
    }

    function basicAuthHeader(username: string, password: string): string {
        return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    it('calls next when the Basic auth password matches the API key', () => {
        const next = jest.fn();
        const req = requestWithAuthorization(basicAuthHeader('any-user', API_KEY));

        middleware(req, mockResponse() as unknown as Response, next);

        expect(next).toHaveBeenCalled();
    });

    it('rejects with 401 when the Authorization header is missing', () => {
        const next = jest.fn();
        const res = mockResponse();

        middleware(requestWithAuthorization(undefined), res as unknown as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('rejects with 401 when the Authorization scheme is not Basic', () => {
        const next = jest.fn();
        const res = mockResponse();

        middleware(requestWithAuthorization('Bearer some-token'), res as unknown as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('rejects with 401 when the password does not match', () => {
        const next = jest.fn();
        const res = mockResponse();
        const req = requestWithAuthorization(basicAuthHeader('any-user', 'wrong-key'));

        middleware(req, res as unknown as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', expect.any(String));
    });

    it.each([
        'Basic ',
        'Basic !!!',
        `Basic ${Buffer.from('no-separator').toString('base64')}`,
        `Basic ${Buffer.from('user:').toString('base64')}`,
    ])('rejects malformed credentials %s with the complete challenge', (header) => {
        const next = jest.fn();
        const res = mockResponse();
        middleware(requestWithAuthorization(header), res as unknown as Response, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.setHeader).toHaveBeenCalledWith(
            'WWW-Authenticate',
            'Basic realm="Expense Splitter API Docs"',
        );
        expect(res.send).toHaveBeenCalledWith('Authentication required');
    });
});
