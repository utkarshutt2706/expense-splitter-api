import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentsService } from './payments.service';

@ApiBearerAuth('access-token')
@UseGuards(GroupMembershipGuard)
@Controller('groups/:groupId/payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post()
    create(
        @Param('groupId') groupId: string,
        @Body() dto: CreatePaymentDto,
    ): Promise<PaymentResponseDto> {
        return this.paymentsService.create(groupId, dto);
    }

    @Get()
    findAllByGroup(@Param('groupId') groupId: string): Promise<PaymentResponseDto[]> {
        return this.paymentsService.findAllByGroup(groupId);
    }
}
