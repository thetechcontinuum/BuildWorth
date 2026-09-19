export interface SendMagicLinkOptions {
  email: string;
  token: string;
  appUrl?: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  provider: "SMTP" | "RESEND" | "TEST_MOCK";
  error?: string;
}

export async function sendMagicLinkEmail(
  options: SendMagicLinkOptions,
): Promise<EmailDeliveryResult> {
  const isTest = process.env.NODE_ENV === "test";
  const appUrl = options.appUrl || process.env.APP_URL || "https://app.buildworth.io";
  const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(options.token)}`;

  if (isTest) {
    return { delivered: true, provider: "TEST_MOCK" };
  }

  const provider = (process.env.EMAIL_PROVIDER || "RESEND").toUpperCase();
  const fromAddress = process.env.EMAIL_FROM || "BuildWorth Security <auth@buildworth.io>";

  if (provider === "RESEND") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error(
        `[Email Delivery Error]: RESEND_API_KEY is not configured for ${fromAddress} sending to ${verificationUrl}`,
      );
      return { delivered: false, provider: "RESEND", error: "PROVIDER_NOT_CONFIGURED" };
    }

    try {
      // Native HTTPS request to Resend API endpoint (https://api.resend.com/emails)
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [options.email],
          subject: "BuildWorth Administrator Verification Token",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; rounded: 8px;">
              <h2 style="color: #18181b; font-size: 20px; font-weight: 700; margin-bottom: 16px;">BuildWorth Admin Verification</h2>
              <p style="color: #3f3f46; font-size: 14px; line-height: 22px;">A one-time verification token was requested to authenticate your BuildWorth administrator account.</p>
              <div style="background-color: #f4f4f5; padding: 14px; border-radius: 6px; font-family: monospace; font-size: 16px; font-weight: 600; letter-spacing: 1px; color: #09090b; margin: 20px 0; word-break: break-all; text-align: center;">
                ${options.token}
              </div>
              <p style="color: #71717a; font-size: 12px; line-height: 18px;">This token expires in 15 minutes and can only be used once. If you did not request this login, please immediately review your organization security logs.</p>
            </div>
          `,
          text: `BuildWorth Admin Verification Token:\n\n${options.token}\n\nThis token expires in 15 minutes and can only be used once.`,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        console.error(`[Email Delivery Error] Resend API returned status ${res.status}: ${errorBody}`);
        return {
          delivered: false,
          provider: "RESEND",
          error: `RESEND_API_ERROR: HTTP ${res.status}`,
        };
      }

      return { delivered: true, provider: "RESEND" };
    } catch (err: any) {
      console.error("[Email Delivery Error] Network failure connecting to Resend API:", err);
      return {
        delivered: false,
        provider: "RESEND",
        error: `RESEND_NETWORK_ERROR: ${err?.message || "Unknown"}`,
      };
    }
  }

  if (provider === "SMTP") {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      console.error(
        "[Email Delivery Error]: SMTP credentials not configured for " +
          fromAddress +
          " sending to " +
          verificationUrl,
      );
      return { delivered: false, provider: "SMTP", error: "PROVIDER_NOT_CONFIGURED" };
    }
    // SMTP transport requires socket connectivity
    return { delivered: false, provider: "SMTP", error: "SMTP_TRANSPORT_REQUIRES_ACTIVE_DAEMON" };
  }

  return { delivered: false, provider: "RESEND", error: "UNSUPPORTED_PROVIDER" };
}
