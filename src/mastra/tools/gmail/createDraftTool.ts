import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const createDraftTool = createTool({
  id: "createDraft",
  description: "Create an email draft in Gmail that can be edited and sent later.",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address(es), comma-separated if multiple"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email content/message"),
    cc: z.string().optional().describe("CC email addresses, comma-separated"),
    bcc: z.string().optional().describe("BCC email addresses, comma-separated"),
    isHtml: z.boolean().optional().describe("Whether body is HTML format (default: false)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    draftId: z.string().optional(),
    messageId: z.string().optional(),
    subject: z.string(),
    to: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.gmail) {
      throw new Error("Gmail not authenticated. Please run loginTool first.");
    }

    const to = input.context?.to;
    const subject = input.context?.subject;
    const body = input.context?.body;
    const cc = input.context?.cc;
    const bcc = input.context?.bcc;
    const isHtml = input.context?.isHtml || false;

    if (!to || !subject || !body) {
      throw new Error("Recipient (to), subject, and body are required");
    }

    try {
      // Construct email headers
      const headers = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : null,
        bcc ? `Bcc: ${bcc}` : null,
        `Subject: ${subject}`,
        isHtml ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8",
        "", // Empty line to separate headers from body
        body
      ].filter(Boolean).join("\r\n");

      // Create the draft
      const response = await clients.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: Buffer.from(headers).toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '')
          }
        }
      });

      const draft = response.data;
      
      if (!draft.id) {
        throw new Error("Failed to create draft - no draft ID returned");
      }

      return {
        success: true,
        draftId: draft.id,
        messageId: draft.message?.id || undefined,
        subject: subject,
        to: to,
        message: `✅ Draft created successfully! Subject: "${subject}" | Recipients: ${to}${cc ? ` (CC: ${cc})` : ""}${bcc ? ` (BCC: ${bcc})` : ""}`
      };

    } catch (error) {
      console.error("Draft creation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        subject: subject,
        to: to,
        message: `❌ Failed to create draft: ${errorMessage}`
      };
    }
  }
}); 