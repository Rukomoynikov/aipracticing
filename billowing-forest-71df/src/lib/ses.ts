import { AwsClient } from "aws4fetch";

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  fromEmail: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const aws = new AwsClient({
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    region: opts.region,
    service: "ses",
  });

  const payload = {
    FromEmailAddress: opts.fromEmail,
    Destination: {
      ToAddresses: [opts.to],
    },
    Content: {
      Simple: {
        Subject: { Data: opts.subject },
        Body: {
          Html: { Data: opts.htmlBody },
          Text: { Data: opts.textBody },
        },
      },
    },
  };

  const url = `https://email.${opts.region}.amazonaws.com/v2/email/outbound-emails`;

  const response = await aws.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SES error ${response.status}: ${body}`);
  }
}
