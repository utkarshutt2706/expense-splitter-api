import { SplitType } from '@prisma/client';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

type MockedExpensesService = {
    create: jest.Mock;
    findAllByGroup: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
};

describe('ExpensesController', () => {
    let controller: ExpensesController;
    let expensesService: MockedExpensesService;

    const expense: ExpenseResponseDto = {
        id: 'expense-1',
        groupId: 'group-1',
        description: 'Daaru',
        amount: 5200,
        paidByUserId: 'friend-divanshu',
        splitType: SplitType.equal,
        splits: [{ userId: 'user-1', amount: 1040 }],
        createdAt: '2026-07-23T10:00:00.000Z',
    };

    beforeEach(() => {
        expensesService = {
            create: jest.fn(),
            findAllByGroup: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };
        controller = new ExpensesController(expensesService as unknown as ExpensesService);
    });

    it('delegates create to the service', async () => {
        expensesService.create.mockResolvedValue(expense);

        const dto = {
            description: 'Daaru',
            amount: 5200,
            paidByUserId: 'friend-divanshu',
            splitType: SplitType.equal,
            splits: [{ userId: 'user-1', amount: 1040 }],
        };
        await expect(controller.create('group-1', dto)).resolves.toEqual(expense);
        expect(expensesService.create).toHaveBeenCalledWith('group-1', dto);
    });

    it('delegates findAllByGroup to the service', async () => {
        expensesService.findAllByGroup.mockResolvedValue([expense]);

        await expect(controller.findAllByGroup('group-1')).resolves.toEqual([expense]);
        expect(expensesService.findAllByGroup).toHaveBeenCalledWith('group-1');
    });

    it('delegates findOne to the service', async () => {
        expensesService.findOne.mockResolvedValue(expense);

        await expect(controller.findOne('group-1', 'expense-1')).resolves.toEqual(expense);
        expect(expensesService.findOne).toHaveBeenCalledWith('group-1', 'expense-1');
    });

    it('delegates update to the service', async () => {
        const updated = { ...expense, description: 'Daaru (updated)' };
        expensesService.update.mockResolvedValue(updated);

        const dto = {
            description: 'Daaru (updated)',
            amount: 5200,
            paidByUserId: 'friend-divanshu',
            splitType: SplitType.equal,
            splits: [{ userId: 'user-1', amount: 1040 }],
        };
        await expect(controller.update('group-1', 'expense-1', dto)).resolves.toEqual(updated);
        expect(expensesService.update).toHaveBeenCalledWith('group-1', 'expense-1', dto);
    });

    it('delegates remove to the service', async () => {
        expensesService.remove.mockResolvedValue(undefined);

        await expect(controller.remove('group-1', 'expense-1')).resolves.toBeUndefined();
        expect(expensesService.remove).toHaveBeenCalledWith('group-1', 'expense-1');
    });
});
