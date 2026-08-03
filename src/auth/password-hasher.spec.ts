import { hashPassword, verifyPassword } from './password-hasher';

describe('password-hasher', () => {
    it('verifies a password against its own hash', async () => {
        const hash = await hashPassword('correct-horse-battery-staple');

        await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
    });

    it('rejects the wrong password', async () => {
        const hash = await hashPassword('correct-horse-battery-staple');

        await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    });

    it('produces a different hash each time due to random salt', async () => {
        const first = await hashPassword('same-password');
        const second = await hashPassword('same-password');

        expect(first).not.toBe(second);
    });

    it('rejects a malformed stored hash', async () => {
        await expect(verifyPassword('anything', 'not-a-valid-hash')).resolves.toBe(false);
    });

    it('rejects a stored hash with an empty key segment', async () => {
        await expect(verifyPassword('anything', 'somesalt:')).resolves.toBe(false);
    });
});
