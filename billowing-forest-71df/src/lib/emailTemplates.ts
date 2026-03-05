export function confirmationEmail(confirmUrl: string): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your email</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#18181b;padding:32px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.3px;">AI Together</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">Confirm your email</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#52525b;line-height:1.6;">
                Thanks for signing up! Click the button below to confirm your email address and secure your spot.
              </p>
              <a href="${confirmUrl}"
                 style="display:inline-block;background:#18181b;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:-0.2px;">
                Confirm my email
              </a>
              <p style="margin:32px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
                Or copy and paste this link into your browser:<br />
                <a href="${confirmUrl}" style="color:#52525b;word-break:break-all;">${confirmUrl}</a>
              </p>
              <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;">
                If you didn't sign up for AI Together, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Confirm your email — AI Together

Thanks for signing up! Click the link below to confirm your email address:

${confirmUrl}

If you didn't sign up for AI Together, you can safely ignore this email.`;

  return { html, text };
}

export function passwordResetEmail(resetUrl: string): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#18181b;padding:32px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.3px;">AI Together</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#18181b;letter-spacing:-0.5px;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:16px;color:#52525b;line-height:1.6;">
                We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;background:#18181b;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:-0.2px;">
                Reset my password
              </a>
              <p style="margin:32px 0 0;font-size:13px;color:#a1a1aa;line-height:1.6;">
                Or copy and paste this link into your browser:<br />
                <a href="${resetUrl}" style="color:#52525b;word-break:break-all;">${resetUrl}</a>
              </p>
              <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Reset your password — AI Together

We received a request to reset your password. Click the link below to choose a new one (expires in 1 hour):

${resetUrl}

If you didn't request a password reset, you can safely ignore this email.`;

  return { html, text };
}
