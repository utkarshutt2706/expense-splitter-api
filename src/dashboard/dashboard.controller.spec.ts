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
            controller.getDashboard(
                { sub: 'user-1', email: 'user@example.com' },
                { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' },
            ),
        ).resolves.toEqual(dashboard);
        expect(getDashboard).toHaveBeenCalledWith(
            'user-1',
            '2026-08-01T00:00:00.000Z',
            '2026-09-01T00:00:00.000Z',
        );
    });
});
