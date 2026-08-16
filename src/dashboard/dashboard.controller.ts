import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/jwt-payload';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get()
    @ApiOperation({ summary: 'Get aggregate spending insights for the signed-in user' })
    @ApiResponse({
        status: 200,
        description: 'Dashboard spending summary.',
        type: DashboardResponseDto,
    })
    getDashboard(@CurrentUser() user: JwtPayload): Promise<DashboardResponseDto> {
        return this.dashboardService.getDashboard(user.sub);
    }
}
