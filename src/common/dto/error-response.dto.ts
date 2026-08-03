import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
    @ApiProperty({
        example: 'VALIDATION_ERROR',
        enum: ['VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'ERROR'],
    })
    code: string;

    @ApiProperty({ example: 'A human-readable description of what went wrong' })
    message: string;
}

export class ErrorResponseDto {
    @ApiProperty({ type: ErrorDetailDto })
    error: ErrorDetailDto;
}
