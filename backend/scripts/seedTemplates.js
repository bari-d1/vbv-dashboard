// One-time seed: inserts the default VBV Edits outreach template if the table is empty.
// Run with: node scripts/seedTemplates.js
// IMPORTANT: must be run once after the first deploy that introduces VbvTemplate — see the
// note in server.js near the VbvTemplate route registration.

const prisma = require('../db');

const TEMPLATE_NAME = 'VBV Edits Outreach';
const TEMPLATE_SUBJECT = 'Your sermons deserve a wider audience, {churchName}';

const TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VBV Edits Outreach</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:'Space Mono',monospace;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;">
    <tr>
      <td align="center" style="padding:40px 20px;">

        <!-- Email container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#0a0a0a;border:1px solid #1f1f1f;">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#e20415;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Logo block -->
          <tr>
            <td align="center" style="padding:36px 48px 28px 48px;background-color:#0a0a0a;">
              <!-- VBV Edits wordmark rendered in HTML since logo is a local file -->
              <div style="display:inline-block;">
                <span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:normal;letter-spacing:4px;text-transform:uppercase;color:#e20415;">VERSE BY VERSE</span>
                <span style="display:inline-block;margin-left:8px;background-color:#e20415;color:#ffffff;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:2px 7px;vertical-align:middle;">EDITS</span>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background-color:#1f1f1f;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 0 48px;">

              <!-- Greeting -->
              <p style="margin:0 0 24px 0;font-family:'Space Mono',monospace;font-size:16px;line-height:1.6;color:#ffffff;">
                Hi {churchName},
              </p>

              <!-- Opening statement -->
              <p style="margin:0 0 20px 0;font-family:'Space Mono',monospace;font-size:16px;line-height:1.7;color:#cccccc;">
                Every week your pastor preaches something worth sharing. Most of it never leaves the building.
              </p>

              <p style="margin:0 0 20px 0;font-family:'Space Mono',monospace;font-size:16px;line-height:1.7;color:#cccccc;">
                Not because the message isn't strong enough. But because turning a 45-minute sermon into consistent short-form content takes time and a team that most churches don't have.
              </p>

              <!-- Red accent line -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
                <tr>
                  <td style="width:3px;background-color:#e20415;">&nbsp;</td>
                  <td style="padding:4px 0 4px 16px;font-family:'Space Mono',monospace;font-size:17px;line-height:1.6;color:#ffffff;font-style:italic;">
                    That's the gap VBV Edits was built to close.
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px 0;font-family:'Space Mono',monospace;font-size:16px;line-height:1.7;color:#cccccc;">
                We take your sermon footage and turn it into high-quality vertical clips, captions, and hooks, delivered every week, handled entirely on our end.
              </p>

              <!-- Sample edit link -->
              <p style="margin:0 0 8px 0;font-family:'Space Mono',monospace;font-size:16px;line-height:1.7;color:#cccccc;">
                To show you what that could look like for {churchName}, we put together a quick sample edit using one of your recent sermons:
              </p>
              <p style="margin:0 0 32px 0;font-family:'Space Mono',monospace;font-size:15px;line-height:1.6;">
                <a href="{driveLink}" style="color:#e20415;text-decoration:none;border-bottom:1px solid #e20415;">{driveLink}</a>
              </p>

              <!-- CTA block -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 32px 0;background-color:#111111;border:1px solid #1f1f1f;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 20px 0;font-family:'Space Mono',monospace;font-size:15px;line-height:1.6;color:#aaaaaa;">
                      If that sounds worth a conversation, book a free 20-minute call below. Just a conversation about your church's content and whether we're the right fit.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:#e20415;">
                          <a href="https://cal.com/verse-by-verse-studio/vedits-intro-call"
                             style="display:inline-block;padding:14px 28px;font-family:'Space Mono',monospace;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">
                            Book a Free Call &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Sign off -->
              <p style="margin:0 0 6px 0;font-family:'Space Mono',monospace;font-size:15px;line-height:1.6;color:#cccccc;">
                Looking forward to hearing from you.
              </p>

            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:24px 48px 40px 48px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:3px;background-color:#e20415;">&nbsp;</td>
                  <td style="padding-left:14px;">
                    <p style="margin:0 0 2px 0;font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                      Dayo Adebari
                    </p>
                    <p style="margin:0 0 2px 0;font-family:'Space Mono',monospace;font-size:12px;color:#e20415;letter-spacing:1px;text-transform:uppercase;">
                      VBV Edits
                    </p>
                    <p style="margin:0;font-family:'Space Mono',monospace;font-size:12px;color:#666666;">
                      <a href="https://versebyverse.studio" style="color:#666666;text-decoration:none;">versebyverse.studio</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer bar -->
          <tr>
            <td style="background-color:#e20415;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Footer text -->
          <tr>
            <td align="center" style="padding:20px 48px;background-color:#0a0a0a;">
              <p style="margin:0;font-family:'Space Mono',monospace;font-size:11px;color:#444444;text-align:center;">
                VBV Edits &nbsp;&middot;&nbsp; versebyverse.studio &nbsp;&middot;&nbsp; @versebyverse.studio
              </p>
            </td>
          </tr>

        </table>
        <!-- End container -->

      </td>
    </tr>
  </table>

</body>
</html>
`;

async function main() {
  const existingCount = await prisma.vbvTemplate.count();
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing template(s) — skipping seed.`);
    return;
  }

  const template = await prisma.vbvTemplate.create({
    data: { name: TEMPLATE_NAME, subject: TEMPLATE_SUBJECT, bodyHtml: TEMPLATE_HTML },
  });

  console.log(`Seeded template "${template.name}" (id: ${template.id}).`);
}

main()
  .catch((err) => {
    console.error('Template seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
