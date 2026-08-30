import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiGroupScopedErrors } from '../common/decorators/api-common-errors.decorator';
import { errorExample, ErrorResponseDto } from '../common/dto/error-response.dto';
import { GroupMembershipGuard } from '../common/guards/group-membership.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsService } from './payments.service';

@ApiBearerAuth('access-token')
@UseGuards(GroupMembershipGuard)
@Controller('groups/:groupId/payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post()
    @ApiOperation({
        summary: 'Record a payment settling debt within a group',
    })
    @ApiResponse({ status: 201, description: 'Payment recorded.', type: PaymentResponseDto })
    @ApiResponse({
        status: 400,
        description:
            'Validation error, fromUserId equals toUserId, or a participant is not an active ' +
            'group member.',
        type: ErrorResponseDto,
        examples: {
            sameUser: {
                summary: 'fromUserId equals toUserId',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'fromUserId and toUserId must be different',
                ),
            },
            unknownUser: {
                summary: 'Participant is not an active group member',
                value: errorExample(
                    'VALIDATION_ERROR',
                    'All participants must be active group members; invalid userId(s): user-3',
                ),
            },
        },
    })
    @ApiGroupScopedErrors()
    create(
        @Param('groupId') groupId: string,
        @Body() dto: CreatePaymentDto,
    ): Promise<PaymentResponseDto> {
        return this.paymentsService.create(groupId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all payments in a group' })
    @ApiResponse({ status: 200, description: 'The payments.', type: [PaymentResponseDto] })
    @ApiGroupScopedErrors()
    findAllByGroup(@Param('groupId') groupId: string): Promise<PaymentResponseDto[]> {
        return this.paymentsService.findAllByGroup(groupId);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'Replace a payment',
        description:
            'Full replacement, not a partial patch -- resend payer, recipient, and amount.',
    })
    @ApiResponse({ status: 200, description: 'Updated payment.', type: PaymentResponseDto })
    @ApiResponse({
        status: 400,
        description: 'Validation error, identical payer and recipient, or an unknown user.',
        type: ErrorResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'No group with that id, or no payment with that id in this group.',
        type: ErrorResponseDto,
    })
    @ApiGroupScopedErrors()
    update(
        @Param('groupId') groupId: string,
        @Param('id') id: string,
        @Body() dto: UpdatePaymentDto,
    ): Promise<PaymentResponseDto> {
        return this.paymentsService.update(groupId, id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a payment' })
    @ApiResponse({ status: 204, description: 'Deleted.' })
    @ApiResponse({
        status: 404,
        description: 'No group with that id, or no payment with that id in this group.',
        type: ErrorResponseDto,
    })
    @ApiGroupScopedErrors()
    async remove(@Param('groupId') groupId: string, @Param('id') id: string): Promise<void> {
        await this.paymentsService.remove(groupId, id);
    }
}
