import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DashboardQueryDto {
    @ApiPropertyOptional({ description: 'Inclusive ISO-8601 start instant.' })
    @IsOptional()
    @IsISO8601({ strict: true })
    from?: string;

    @ApiPropertyOptional({ description: 'Exclusive ISO-8601 end instant.' })
    @IsOptional()
    @IsISO8601({ strict: true })
    to?: string;
}
