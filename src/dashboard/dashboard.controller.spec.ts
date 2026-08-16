import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
    it('loads the dashboard for the authenticated user', async () => {
        const dashboard = {
            actualPaid: 100,
            currentUserShare: 50,
            memberShares: [],
            groupSpend: [],
        };
        const getDashboard = jest.fn().mockResolvedValue(dashboard);
        const controller = new DashboardController({ getDashboard } as unknown as DashboardService);

        await expect(
            controller.getDashboard({ sub: 'user-1', email: 'user@example.com' }),
        ).resolves.toEqual(dashboard);
        expect(getDashboard).toHaveBeenCalledWith('user-1');
    });
});
