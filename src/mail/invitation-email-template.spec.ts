import {
    invitationEmailHtml,
    invitationEmailSubject,
    invitationEmailText,
    type InvitationEmailContent,
} from './invitation-email-template';

describe('invitation email template', () => {
    const content: InvitationEmailContent = {
        inviteUrl: 'https://frontend.example.com/register?invite=raw-token',
        groupName: 'Goa Trip',
        inviterName: 'Alice',
        expiresAt: new Date('2026-08-13T00:00:00.000Z'),
        frontendUrl: 'https://frontend.example.com',
    };

    describe('invitationEmailSubject', () => {
        it('names the inviter and the group', () => {
            expect(invitationEmailSubject(content)).toBe(
                'Alice invited you to join "Goa Trip" on Expense Splitter',
            );
        });
    });

    describe('invitationEmailHtml', () => {
        it('includes the inviter, group name, and a hosted (not embedded) logo', () => {
            const html = invitationEmailHtml(content);

            expect(html).toContain('Alice');
            expect(html).toContain('Goa Trip');
            expect(html).toContain('https://frontend.example.com/web-app-manifest-192x192.png');
            expect(html).not.toContain('data:image');
        });

        it('includes the invite link both as a button and as plain fallback text', () => {
            const html = invitationEmailHtml(content);

            const occurrences = html.split(content.inviteUrl).length - 1;
            expect(occurrences).toBeGreaterThanOrEqual(2);
            expect(html).toContain('Accept invite');
            expect(html).toContain("If the button doesn't work");
        });

        it('states the expiry date', () => {
            const html = invitationEmailHtml(content);

            expect(html).toContain('August 13, 2026');
        });
    });

    describe('invitationEmailText', () => {
        it('includes the invite link and expiry as a plain-text fallback', () => {
            const text = invitationEmailText(content);

            expect(text).toContain(content.inviteUrl);
            expect(text).toContain('Alice');
            expect(text).toContain('Goa Trip');
            expect(text).toContain('August 13, 2026');
        });
    });
});
