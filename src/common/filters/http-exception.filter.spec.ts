import {
    ArgumentsHost,
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

type MockResponse = {
    status: jest.Mock;
    json: jest.Mock;
};

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;

    function mockHost(res: MockResponse): ArgumentsHost {
        return {
            switchToHttp: () => ({
                getResponse: () => res,
            }),
        } as unknown as ArgumentsHost;
    }

    function mockResponse(): MockResponse {
        return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
    }

    beforeEach(() => {
        filter = new HttpExceptionFilter();
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('maps NotFoundException to a NOT_FOUND error', () => {
        const res = mockResponse();

        filter.catch(new NotFoundException('user user-1 not found'), mockHost(res));

        expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'NOT_FOUND', message: 'User user-1 not found' },
        });
    });

    it('maps ConflictException to a CONFLICT error', () => {
        const res = mockResponse();

        filter.catch(new ConflictException('already exists'), mockHost(res));

        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'CONFLICT', message: 'Already exists' },
        });
    });

    it('maps UnauthorizedException to an UNAUTHORIZED error', () => {
        const res = mockResponse();

        filter.catch(new UnauthorizedException('invalid or missing API key'), mockHost(res));

        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
        });
    });

    it('capitalizes the first letter of each validation message', () => {
        const res = mockResponse();
        const exception = new BadRequestException(['name must be a string', 'name is required']);

        filter.catch(exception, mockHost(res));

        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Name must be a string; Name is required',
            },
        });
    });

    it('trims whitespace and capitalizes the first letter of the message', () => {
        const res = mockResponse();

        filter.catch(new BadRequestException('  name is required  '), mockHost(res));

        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'VALIDATION_ERROR', message: 'Name is required' },
        });
    });

    it('preserves the remaining message casing', () => {
        const res = mockResponse();

        filter.catch(new BadRequestException('user ID is invalid'), mockHost(res));

        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'VALIDATION_ERROR', message: 'User ID is invalid' },
        });
    });

    it('falls back to a generic ERROR code for unmapped HTTP statuses', () => {
        const res = mockResponse();
        const exception = new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT);

        filter.catch(exception, mockHost(res));

        expect(res.status).toHaveBeenCalledWith(HttpStatus.I_AM_A_TEAPOT);
        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'ERROR', message: 'Teapot' },
        });
    });

    it('maps unrecognized errors to a 500 INTERNAL_ERROR without leaking details', () => {
        const res = mockResponse();

        filter.catch(new Error('database connection string is invalid'), mockHost(res));

        expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
    });
});
