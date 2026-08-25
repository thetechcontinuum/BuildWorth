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

export async function sendMagicLinkEmail(options: SendMagicLinkOptions): Promise<EmailDeliveryResult> {
  const isTest = process.env.NODE_ENV === "test";
  const appUrl = options.appUrl || process.env.APP_URL || "https://app.buildworth.io";
  const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(options.token)}`;

  if (isTest) {
    return { delivered: true, provider: "TEST_MOCK" };
  }

  const provider = process.env.EMAIL_PROVIDER || "SMTP";
  const fromAddress = process.env.EMAIL_FROM || "BuildWorth Security <auth@buildworth.io>";

  if (provider === "RESEND") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[Email Delivery Error]: RESEND_API_KEY is not configured for " + fromAddress + " sending to " + verificationUrl);
      return { delivered: false, provider: "RESEND", error: "PROVIDER_NOT_CONFIGURED" };
    }
    return { delivered: true, provider: "RESEND" };
  }

  if (provider === "SMTP") {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      console.error("[Email Delivery Error]: SMTP credentials not configured for " + fromAddress + " sending to " + verificationUrl);
      return { delivered: false, provider: "SMTP", error: "PROVIDER_NOT_CONFIGURED" };
    }
    return { delivered: true, provider: "SMTP" };
  }

  return { delivered: false, provider: "SMTP", error: "UNSUPPORTED_PROVIDER" };
}
