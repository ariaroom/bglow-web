import nodemailer from 'nodemailer';

// Sends from the real bglowteam@gmail.com via Gmail SMTP using an app password.
// Server-only; the app password must never reach the browser or the repo.
let transporter;

function tx() {
    if (transporter) return transporter;
    const user = process.env.GMAIL_USER;
    const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
    if (!user || !pass) throw new Error('Missing GMAIL_USER / GMAIL_APP_PASSWORD');
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });
    return transporter;
}

function money(n) {
    return '$' + Number(n).toFixed(2);
}

// A warm, on-brand HTML ticket. Inline styles + table layout for email clients.
function ticketHtml(t) {
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#efe9dd;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe9dd;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fdfbf6;border-radius:16px;overflow:hidden;border:1px solid #e3dbcb;">

        <tr><td style="background:#3f4c37;padding:30px 34px;">
          <div style="font-family:Georgia,'Times New Roman',serif;color:#f3ead6;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Immersive Solo Exhibition</div>
          <div style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:30px;font-weight:bold;letter-spacing:1px;margin-top:6px;">Love's Last Letter</div>
          <div style="font-family:Georgia,serif;color:#d9c9a8;font-style:italic;font-size:16px;margin-top:8px;">The words you couldn't say.</div>
        </td></tr>

        <tr><td style="padding:30px 34px 8px;">
          <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a8275;">Your Ticket</div>
          <div style="font-family:Georgia,serif;font-size:22px;color:#33302b;margin-top:4px;">You're all set, ${t.name ? t.name : 'friend'}.</div>
          <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#5f584d;margin-top:10px;">
            Your reservation is confirmed. Please show this email at the door.
          </div>
        </td></tr>

        <tr><td style="padding:16px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece4d3;border-bottom:1px solid #ece4d3;">
            ${row('Date', t.dayLabel)}
            ${row('Time', t.timeLabel)}
            ${row('Location', 'A Space Gallery<br>13 Grattan St #402, Brooklyn, NY 11206')}
            ${row('Guests', String(t.quantity))}
            ${row('Order', t.orderRef)}
            ${row(t.amountLabel ? 'Admission' : 'Total paid', t.amountLabel || money(t.amount))}
          </table>
        </td></tr>

        <tr><td style="padding:8px 34px 4px;">
          <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#6c6459;background:rgba(198,154,95,0.10);border-radius:10px;padding:14px 16px;">
            <strong>Please bring your own earphones or headphones</strong> — this is an immersive experience with audio, and your own set makes it most personal.<br><br>
            Each session runs about <strong>60 minutes</strong>. Please arrive <strong>10 minutes early</strong>.
            Sessions are limited to 9 guests.
          </div>
        </td></tr>

        <tr><td style="padding:22px 34px 6px;">
          <div style="font-family:Georgia,serif;font-size:16px;font-style:italic;line-height:1.7;color:#3f4c37;">
            This is only the beginning. Love's Last Letter is one chapter of a longer story —
            and B-Glow would love to walk the rest of it with you. We'll share what comes next:
            new exhibitions, performances, and quiet moments worth being present for.
          </div>
        </td></tr>

        <tr><td style="padding:18px 34px 30px;">
          <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#9a9488;">
            ${t.refundPolicy || ''}<br><br>
            Questions? Just reply to this email or write to bglowteam@gmail.com.<br>
            With warmth,<br>The B-Glow team
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label, value) {
    return `<tr>
      <td style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8a8275;padding:12px 0 12px;vertical-align:top;width:38%;">${label}</td>
      <td style="font-family:Arial,sans-serif;font-size:15px;color:#33302b;padding:12px 0 12px;vertical-align:top;">${value}</td>
    </tr>`;
}

function ticketText(t) {
    return [
        "LOVE'S LAST LETTER — Immersive Solo Exhibition",
        '',
        'Your reservation is confirmed. Please show this email at the door.',
        '',
        'Date:     ' + t.dayLabel,
        'Time:     ' + t.timeLabel,
        'Location: A Space Gallery, 13 Grattan St #402, Brooklyn, NY 11206',
        'Guests:   ' + t.quantity,
        'Order:    ' + t.orderRef,
        (t.amountLabel ? 'Admission: ' + t.amountLabel : 'Total:    ' + money(t.amount)),
        '',
        'Please BRING YOUR OWN EARPHONES/HEADPHONES — this is an immersive audio experience.',
        'Please arrive 10 minutes early. Each session runs about 60 minutes.',
        '',
        "This is only the beginning — B-Glow will share what comes next.",
        'Questions? Reply to this email or write to bglowteam@gmail.com.'
    ].join('\n');
}

export async function sendTicketEmail(ticket) {
    const from = `"B-Glow" <${process.env.GMAIL_USER}>`;
    return tx().sendMail({
        from,
        to: ticket.to,
        subject: "Your ticket — Love's Last Letter",
        text: ticketText(ticket),
        html: ticketHtml(ticket)
    });
}
