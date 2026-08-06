import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BRAND_COLOR = '#f27318';

const logoDataUri = `data:image/png;base64,${readFileSync(join(__dirname, 'assets/logo.png')).toString('base64')}`;

export interface InvitationEmailContent {
    inviteUrl: string;
    groupName: string;
    inviterName: string;
    expiresAt: Date;
}

function formatExpiry(expiresAt: Date): string {
    return expiresAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}

export function invitationEmailSubject({ inviterName, groupName }: InvitationEmailContent): string {
    return `${inviterName} invited you to join "${groupName}" on Expense Splitter`;
}

export function invitationEmailHtml({
    inviteUrl,
    groupName,
    inviterName,
    expiresAt,
}: InvitationEmailContent): string {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>You're invited to ${groupName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td align="center" style="background-color:${BRAND_COLOR};padding:32px 24px;">
                <img src="${logoDataUri}" width="56" height="56" alt="Expense Splitter" style="display:block;margin:0 auto 12px;" />
                <span style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">Expense Splitter</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#18181b;">
                  <strong>${inviterName}</strong> has invited you to join <strong>"${groupName}"</strong> on Expense Splitter, so you can track and split shared expenses together.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:${BRAND_COLOR};">
                      <a href="${inviteUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Accept invite
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#71717a;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="${inviteUrl}" style="color:${BRAND_COLOR};">${inviteUrl}</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#a1a1aa;">
                  This invite expires on ${formatExpiry(expiresAt)}. If you weren't expecting this,
                  you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function invitationEmailText({
    inviteUrl,
    groupName,
    inviterName,
    expiresAt,
}: InvitationEmailContent): string {
    return [
        `${inviterName} invited you to join "${groupName}" on Expense Splitter.`,
        '',
        `Accept your invite: ${inviteUrl}`,
        '',
        `This invite expires on ${formatExpiry(expiresAt)}. If you weren't expecting this, you can safely ignore this email.`,
    ].join('\n');
}
