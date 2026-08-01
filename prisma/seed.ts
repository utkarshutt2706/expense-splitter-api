import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USERS = [
    {
        id: 'current-user',
        name: 'Utkarsh Srivastava',
        email: 'utkarshutt2706@gmail.com',
        phone: '9935744820',
    },
    {
        id: 'friend-abhay',
        name: 'Abhay',
        email: 'abhay.verma@example.com',
        phone: '9876543210',
    },
    {
        id: 'friend-divanshu',
        name: 'Divanshu',
        email: 'divanshu.gupta@example.com',
        phone: '9123456780',
    },
    {
        id: 'friend-abhinav',
        name: 'Abhinav',
        email: 'abhinav.singh@example.com',
        phone: '9988776655',
    },
    {
        id: 'friend-khem',
        name: 'Khem',
        email: 'khem.chandra@example.com',
        phone: '9871234560',
    },
];

const GROUP_ID = 'group-daaru-party';

const EXPENSES = [
    {
        description: 'Daaru',
        amount: 5200,
        paidByUserId: 'friend-divanshu',
        createdAt: '2026-07-23T10:00:00.000Z',
        splits: [
            { userId: 'current-user', amount: 1040 },
            { userId: 'friend-abhay', amount: 1040 },
            { userId: 'friend-divanshu', amount: 1040 },
            { userId: 'friend-abhinav', amount: 1040 },
            { userId: 'friend-khem', amount: 1040 },
        ],
    },
    {
        description: 'Sutta',
        amount: 960,
        paidByUserId: 'friend-divanshu',
        createdAt: '2026-07-23T11:00:00.000Z',
        splits: [
            { userId: 'current-user', amount: 240 },
            { userId: 'friend-abhinav', amount: 240 },
            { userId: 'friend-khem', amount: 240 },
            { userId: 'friend-abhay', amount: 240 },
        ],
    },
    {
        description: 'Chakna',
        amount: 569,
        paidByUserId: 'friend-divanshu',
        createdAt: '2026-07-23T12:00:00.000Z',
        splits: [
            { userId: 'current-user', amount: 113.8 },
            { userId: 'friend-abhay', amount: 113.8 },
            { userId: 'friend-divanshu', amount: 113.8 },
            { userId: 'friend-abhinav', amount: 113.8 },
            { userId: 'friend-khem', amount: 113.8 },
        ],
    },
    {
        description: 'Pizza',
        amount: 1647.45,
        paidByUserId: 'friend-divanshu',
        createdAt: '2026-07-23T13:00:00.000Z',
        splits: [
            { userId: 'current-user', amount: 329.49 },
            { userId: 'friend-abhay', amount: 329.49 },
            { userId: 'friend-divanshu', amount: 329.49 },
            { userId: 'friend-abhinav', amount: 329.49 },
            { userId: 'friend-khem', amount: 329.49 },
        ],
    },
    {
        description: 'Chicken',
        amount: 1293.68,
        paidByUserId: 'current-user',
        createdAt: '2026-07-24T10:00:00.000Z',
        splits: [
            { userId: 'friend-khem', amount: 431.23 },
            { userId: 'friend-abhinav', amount: 431.23 },
            { userId: 'current-user', amount: 431.22 },
        ],
    },
    {
        description: 'Chicken',
        amount: 460,
        paidByUserId: 'current-user',
        createdAt: '2026-07-23T14:00:00.000Z',
        splits: [
            { userId: 'friend-abhay', amount: 153.34 },
            { userId: 'friend-abhinav', amount: 153.33 },
            { userId: 'current-user', amount: 153.33 },
        ],
    },
];

async function main(): Promise<void> {
    const existingUserCount = await prisma.user.count();
    if (existingUserCount > 0) {
        console.log('Seed data already present, skipping.');
        return;
    }

    await prisma.user.createMany({ data: USERS });

    await prisma.group.create({
        data: {
            id: GROUP_ID,
            name: 'Daaru Party',
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
            members: {
                create: USERS.map((user) => ({ userId: user.id })),
            },
        },
    });

    for (const expense of EXPENSES) {
        await prisma.expense.create({
            data: {
                groupId: GROUP_ID,
                description: expense.description,
                amount: expense.amount,
                paidByUserId: expense.paidByUserId,
                splitType: 'equal',
                createdAt: new Date(expense.createdAt),
                splits: {
                    create: expense.splits,
                },
            },
        });
    }

    console.log('Seed data created.');
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
