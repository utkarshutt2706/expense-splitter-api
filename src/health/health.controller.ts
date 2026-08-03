import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
    @Public()
    @Get()
    @ApiOperation({
        summary: 'Uptime check',
        description: 'Always public, no authentication required.',
    })
    @ApiResponse({
        status: 200,
        description: 'Service is up.',
        schema: { example: { status: 'ok' } },
    })
    check(): { status: 'ok' } {
        return { status: 'ok' };
    }
}
