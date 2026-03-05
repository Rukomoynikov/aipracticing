import { describe, it, expect } from "vitest";
import { confirmationEmail, passwordResetEmail } from "./emailTemplates";

describe("confirmationEmail", () => {
  const url = "https://example.com/api/auth/confirm?token=abc123";

  it("includes the confirm URL in HTML and plain text", () => {
    const { html, text } = confirmationEmail(url);
    expect(html).toContain(url);
    expect(text).toContain(url);
  });

  it("returns valid HTML with DOCTYPE", () => {
    const { html } = confirmationEmail(url);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("plain text does not contain HTML tags", () => {
    const { text } = confirmationEmail(url);
    expect(text).not.toMatch(/<[^>]+>/);
  });
});

describe("passwordResetEmail", () => {
  const url = "https://example.com/reset-password?token=xyz789";

  it("includes the reset URL in HTML and plain text", () => {
    const { html, text } = passwordResetEmail(url);
    expect(html).toContain(url);
    expect(text).toContain(url);
  });

  it("mentions the 1-hour expiry in both formats", () => {
    const { html, text } = passwordResetEmail(url);
    expect(html).toContain("1 hour");
    expect(text).toContain("1 hour");
  });

  it("plain text does not contain HTML tags", () => {
    const { text } = passwordResetEmail(url);
    expect(text).not.toMatch(/<[^>]+>/);
  });
});
