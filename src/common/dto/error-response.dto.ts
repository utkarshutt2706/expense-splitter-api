import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
    @ApiProperty({
        example: 'VALIDATION_ERROR',
        enum: [
            'VALIDATION_ERROR',
            'UNAUTHORIZED',
            'FORBIDDEN',
            'NOT_FOUND',
            'CONFLICT',
            'TOO_MANY_REQUESTS',
            'SERVICE_UNAVAILABLE',
            'ERROR',
        ],
    })
    code: string;

    @ApiProperty({ example: 'A human-readable description of what went wrong' })
    message: string;
}

export class ErrorResponseDto {
    @ApiProperty({ type: ErrorDetailDto })
    error: ErrorDetailDto;
}

/** Builds a per-response Swagger example matching the real error shape, since
 * ErrorResponseDto's own @ApiProperty examples are shared across every status
 * code that references the class -- this lets each @ApiResponse show the
 * message it actually produces instead of a generic placeholder. */
export function errorExample(
    code: string,
    message: string,
): { error: { code: string; message: string } } {
    return { error: { code, message } };
}
