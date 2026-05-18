import "server-only";

type BuildEmailTemplateInput = {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildEmailTemplate({
  title,
  message,
  ctaLabel,
  ctaUrl,
}: BuildEmailTemplateInput) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  const safeCtaLabel = ctaLabel ? escapeHtml(ctaLabel) : "";
  const safeCtaUrl = ctaUrl ? escapeHtml(ctaUrl) : "";
  const showCta = Boolean(ctaLabel && ctaUrl);

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:28px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:36px 28px 18px;">
                <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:16px;">Workbit</div>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#0f172a;">${safeTitle}</h1>
                <p style="margin:0;font-size:16px;line-height:1.7;color:#334155;">${safeMessage}</p>
              </td>
            </tr>
            ${
              showCta
                ? `<tr>
              <td style="padding:8px 28px 32px;">
                <a href="${safeCtaUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;font-size:15px;">
                  ${safeCtaLabel}
                </a>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:0 28px 28px;font-size:13px;line-height:1.7;color:#94a3b8;">
                Questa email e stata inviata automaticamente da Workbit.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
