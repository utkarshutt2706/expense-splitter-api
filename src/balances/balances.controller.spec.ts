import { GroupBalancesResponseDto } from './dto/group-balances-response.dto';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';

type MockedBalancesService = {
    getGroupBalances: jest.Mock;
};

describe('BalancesController', () => {
    let controller: BalancesController;
    let balancesService: MockedBalancesService;

    const response: GroupBalancesResponseDto = {
        balances: [
            { userId: 'a', balance: 50 },
            { userId: 'b', balance: -50 },
        ],
        settlements: [{ fromUserId: 'b', toUserId: 'a', amount: 50 }],
    };

    beforeEach(() => {
        balancesService = { getGroupBalances: jest.fn() };
        controller = new BalancesController(balancesService as unknown as BalancesService);
    });

    it('delegates to the service', async () => {
        balancesService.getGroupBalances.mockResolvedValue(response);

        await expect(controller.getGroupBalances('group-1')).resolves.toEqual(response);
        expect(balancesService.getGroupBalances).toHaveBeenCalledWith('group-1');
    });
});
