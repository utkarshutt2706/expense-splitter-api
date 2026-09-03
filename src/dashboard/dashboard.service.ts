import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { aggregateDashboard, dashboardGroupInclude } from './dashboard-aggregator';
import { dashboardDateRange } from './dashboard-date-range';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async getDashboard(userId: string, from?: string, to?: string): Promise<DashboardResponseDto> {
        const dateRange = dashboardDateRange(from, to);
        const groups = await this.prisma.group.findMany({
            where: { members: { some: { userId, leftAt: null } } },
            include: {
                ...dashboardGroupInclude,
                members: {
                    where: { leftAt: null },
                    include: { user: { select: { id: true, name: true } } },
                },
                expenses: { where: dateRange, include: { splits: true } },
                payments: { where: dateRange },
            },
        });
        return aggregateDashboard(groups, userId);
    }
}
