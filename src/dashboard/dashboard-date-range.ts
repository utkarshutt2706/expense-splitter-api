import { BadRequestException } from '@nestjs/common';
export type DashboardDateRange = { paidOn?: { gte: Date; lt: Date } };
export function dashboardDateRange(from?: string, to?: string): DashboardDateRange {
    if (!from && !to) return {};
    if (!from || !to) throw new BadRequestException('Both from and to are required');
    const start = new Date(from);
    const end = new Date(to);
    if (start >= end) throw new BadRequestException('from must be before to');
    const maximumEnd = new Date(start);
    maximumEnd.setUTCFullYear(maximumEnd.getUTCFullYear() + 1);
    if (end > maximumEnd)
        throw new BadRequestException('Dashboard date range cannot exceed one year');
    return { paidOn: { gte: start, lt: end } };
}
