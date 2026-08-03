import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentsService } from './payments.service';

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
