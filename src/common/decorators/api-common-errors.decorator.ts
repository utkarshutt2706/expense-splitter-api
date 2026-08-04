import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { errorExample, ErrorResponseDto } from '../dto/error-response.dto';

export function ApiUnauthorizedError(): ReturnType<typeof applyDecorators> {
    return ApiResponse({
        status: 401,
        description: 'Missing or invalid token.',
        type: ErrorResponseDto,
        example: errorExample('UNAUTHORIZED', 'Invalid or expired token'),
    });
}

export function ApiNotGroupMemberError(): ReturnType<typeof applyDecorators> {
    return ApiResponse({
        status: 403,
        description: 'The caller is not a member of this group.',
        type: ErrorResponseDto,
        example: errorExample('FORBIDDEN', 'You are not a member of this group'),
    });
}

export function ApiGroupNotFoundError(): ReturnType<typeof applyDecorators> {
    return ApiResponse({
        status: 404,
        description: 'No group with that id.',
        type: ErrorResponseDto,
        example: errorExample('NOT_FOUND', 'Group does-not-exist not found'),
    });
}

/** The 401/403/404 trio every group-scoped, guarded endpoint produces identically. */
export function ApiGroupScopedErrors(): ReturnType<typeof applyDecorators> {
    return applyDecorators(
        ApiUnauthorizedError(),
        ApiNotGroupMemberError(),
        ApiGroupNotFoundError(),
    );
}
