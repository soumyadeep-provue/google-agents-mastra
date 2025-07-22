import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Buffer } from "buffer";
import { setupGmailClient } from "./auth";

export const sendMessageTool = createTool({
  id: "sendMessage",
  description: "Sends an email via Gmail",
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string()
  }),
  outputSchema: z.object({
    messageId: z.string()
  }),
  execute: async (input: any) => {
    const gmail = setupGmailClient();
    if (!gmail) {
      throw new Error("Gmail client not authenticated. Please run loginTool first.");
    }

    const rawMessage = Buffer.from(
      `To: ${input.context.to}\r\n` +
      `Subject: ${input.context.subject}\r\n\r\n` +
      `${input.context.body}`
    ).toString("base64url"); // URL-safe base64

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage
      }
    });

    return {
      messageId: res.data.id || "unknown"
    };
  }
});
