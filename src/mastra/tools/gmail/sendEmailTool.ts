import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Buffer } from "buffer";
import { setupGmailClient } from "../auth/auth";
import { humanApprovalTool } from "../auth/humanApprovalTool";

export const sendMessageTool = createTool({
  id: "sendMessage",
  description: "Sends an email via Gmail",
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    cc: z.string().optional(),
    bcc: z.string().optional()
  }),
  outputSchema: z.object({
    messageId: z.string(),
    success: z.boolean(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const gmail = await setupGmailClient();
    if (!gmail) {
      throw new Error("Gmail client not authenticated. Please run loginTool first.");
    }

    const to = input.context.to;
    const subject = input.context.subject;
    const body = input.context.body;
    const cc = input.context.cc;
    const bcc = input.context.bcc;

    // Create email preview
    const emailPreview = `To: ${to}${cc ? `\nCc: ${cc}` : ''}${bcc ? `\nBcc: ${bcc}` : ''}
Subject: ${subject}

${body}`;

    // Request human approval with preview
    const approvalResult = await humanApprovalTool.execute({
      context: {
        approvalType: 'content_confirmation',
        action: 'Send Email via Gmail',
        details: `Sending email to: ${to}${cc ? ` (Cc: ${cc})` : ''}${bcc ? ` (Bcc: ${bcc})` : ''}\nSubject: ${subject}`,
        contentPreview: emailPreview,
        severity: 'high'
      },
      runtimeContext: input.runtimeContext
    });

    if (!approvalResult.approved) {
      return {
        messageId: "cancelled",
        success: false,
        message: `❌ Email sending cancelled: ${approvalResult.reason}`
      };
    }

    try {
      const rawMessage = Buffer.from(
        `To: ${to}\r\n` +
        (cc ? `Cc: ${cc}\r\n` : '') +
        (bcc ? `Bcc: ${bcc}\r\n` : '') +
        `Subject: ${subject}\r\n\r\n` +
        `${body}`
      ).toString("base64url"); // URL-safe base64

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: rawMessage
        }
      });

      return {
        messageId: res.data.id || "unknown",
        success: true,
        message: `✅ Email sent successfully to ${to}`
      };

    } catch (error) {
      console.error("Email sending error:", error);
      return {
        messageId: "failed",
        success: false,
        message: `❌ Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});
