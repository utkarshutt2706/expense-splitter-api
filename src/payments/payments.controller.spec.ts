import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

type MockedPaymentsService = {
    create: jest.Mock;
    findAllByGroup: jest.Mock;
    update: jest.Mock;
};

describe('PaymentsController', () => {
    let controller: PaymentsController;
    let paymentsService: MockedPaymentsService;

    const payment: PaymentResponseDto = {
        id: 'payment-1',
        groupId: 'group-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amount: 500,
        createdAt: '2026-07-24T10:00:00.000Z',
    };

    beforeEach(() => {
        paymentsService = {
            create: jest.fn(),
            findAllByGroup: jest.fn(),
            update: jest.fn(),
        };
        controller = new PaymentsController(paymentsService as unknown as PaymentsService);
    });

    it('delegates create to the service', async () => {
        paymentsService.create.mockResolvedValue(payment);

        const dto = { fromUserId: 'user-1', toUserId: 'user-2', amount: 500 };
        await expect(controller.create('group-1', dto)).resolves.toEqual(payment);
        expect(paymentsService.create).toHaveBeenCalledWith('group-1', dto);
    });

    it('delegates findAllByGroup to the service', async () => {
        paymentsService.findAllByGroup.mockResolvedValue([payment]);

        await expect(controller.findAllByGroup('group-1')).resolves.toEqual([payment]);
        expect(paymentsService.findAllByGroup).toHaveBeenCalledWith('group-1');
    });

    it('delegates update to the service', async () => {
        const updated = { ...payment, amount: 750 };
        paymentsService.update.mockResolvedValue(updated);
        const dto = { fromUserId: 'user-1', toUserId: 'user-2', amount: 750 };

        await expect(controller.update('group-1', 'payment-1', dto)).resolves.toEqual(updated);
        expect(paymentsService.update).toHaveBeenCalledWith('group-1', 'payment-1', dto);
    });
});
