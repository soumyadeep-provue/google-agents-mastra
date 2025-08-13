import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";
import { humanApprovalTool } from "../auth/humanApprovalTool";

export const replyToThreadTool = createTool({
  id: "replyToThread",
  description: "Reply to an email thread/conversation in Gmail. Maintains the conversation context and thread structure.",
  inputSchema: z.object({
    threadId: z.string().optional().describe("Thread ID to reply to (if known)"),
    messageId: z.string().optional().describe("Specific message ID to reply to (if known)"),
    emailSubject: z.string().optional().describe("Original email subject to find and reply to"),
    replyBody: z.string().describe("Your reply message content"),
    replyToAll: z.boolean().optional().describe("Reply to all recipients (default: false)"),
    isHtml: z.boolean().optional().describe("Whether reply body is HTML format (default: false)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    threadId: z.string().optional(),
    subject: z.string(),
    recipients: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.gmail) {
      throw new Error("Gmail not authenticated. Please run loginTool first.");
    }

    const threadId = input.context?.threadId;
    const messageId = input.context?.messageId;
    const emailSubject = input.context?.emailSubject;
    const replyBody = input.context?.replyBody;
    const replyToAll = input.context?.replyToAll || false;
    const isHtml = input.context?.isHtml || false;

    if (!replyBody) {
      throw new Error("Reply body is required");
    }

    if (!threadId && !messageId && !emailSubject) {
      throw new Error("Must provide either threadId, messageId, or emailSubject to identify the conversation to reply to");
    }

    // HUMAN APPROVAL REQUIRED - Get thread info first for preview
    let targetThreadId = threadId;
    let originalMessage: any = null;

    // Find the thread/message if not provided directly
    if (!targetThreadId) {
      if (messageId) {
        // Get message to find its thread
        const messageResponse = await clients.gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });
        
        targetThreadId = messageResponse.data.threadId!;
        originalMessage = messageResponse.data;
      } else if (emailSubject) {
        // Search for emails with this subject
        const searchResponse = await clients.gmail.users.messages.list({
          userId: 'me',
          q: `subject:"${emailSubject}"`,
          maxResults: 1
        });

        if (!searchResponse.data.messages || searchResponse.data.messages.length === 0) {
          return {
            success: false,
            subject: emailSubject,
            recipients: "",
            message: `❌ No email found with subject: "${emailSubject}"`
          };
        }

        const messageResponse = await clients.gmail.users.messages.get({
          userId: 'me',
          id: searchResponse.data.messages[0].id!,
          format: 'full'
        });

        targetThreadId = messageResponse.data.threadId!;
        originalMessage = messageResponse.data;
      }
    }

    // Get the latest message in the thread if we don't have original message
    if (!originalMessage && targetThreadId) {
      const threadResponse = await clients.gmail.users.threads.get({
        userId: 'me',
        id: targetThreadId,
        format: 'full'
      });

      // Get the latest message from the thread
      const messages = threadResponse.data.messages || [];
      originalMessage = messages[messages.length - 1];
    }

    if (!originalMessage) {
      throw new Error("Could not find the original message to reply to");
    }

    // Parse headers from original message for preview
    const headers = originalMessage.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const originalSubject = getHeader('Subject');
    const originalFrom = getHeader('From');
    const originalTo = getHeader('To');
    const originalCc = getHeader('Cc');

    // Construct reply details for preview
    const replySubject = originalSubject.startsWith('Re: ') ? originalSubject : `Re: ${originalSubject}`;
    let replyTo = originalFrom;
    let replyCc = '';
    
    if (replyToAll) {
      const allRecipients = [originalTo, originalCc].filter(Boolean).join(', ');
      replyCc = allRecipients;
    }

    // Create email preview
    const emailPreview = `Subject: ${replySubject}
To: ${replyTo}${replyCc ? `\nCc: ${replyCc}` : ''}

${replyBody}`;

    // Request human approval
    const approvalResult = await humanApprovalTool.execute({
      context: {
        approvalType: 'content_confirmation',
        action: 'Reply to Email Thread',
        details: `Replying to thread: ${originalSubject}\nReply All: ${replyToAll ? 'Yes' : 'No'}\nOriginal sender: ${originalFrom}`,
        contentPreview: emailPreview,
        severity: 'high'
      },
      runtimeContext: input.runtimeContext
    });

    if (!approvalResult.approved) {
      return {
        success: false,
        subject: replySubject,
        recipients: `${replyTo}${replyCc ? ` (+ ${replyCc})` : ''}`,
        message: `❌ Reply cancelled: ${approvalResult.reason}`
      };
    }

    try {
      // Continue with original logic
      const originalMessageId = getHeader('Message-ID');

      // Construct the reply email
      const replyHeaders = [
        `To: ${replyTo}`,
        replyCc ? `Cc: ${replyCc}` : null,
        `Subject: ${replySubject}`,
        originalMessageId ? `In-Reply-To: ${originalMessageId}` : null,
        originalMessageId ? `References: ${originalMessageId}` : null,
        isHtml ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8",
        "", // Empty line to separate headers from body
        replyBody
      ].filter(Boolean).join("\r\n");

      // Send the reply
      const response = await clients.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          threadId: targetThreadId,
          raw: Buffer.from(replyHeaders).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        }
      });

      const sentMessage = response.data;

      return {
        success: true,
        messageId: sentMessage.id || undefined,
        threadId: sentMessage.threadId || targetThreadId,
        subject: replySubject,
        recipients: `${replyTo}${replyCc ? ` (+ ${replyCc})` : ''}`,
        message: `✅ Reply sent successfully in thread! Subject: "${replySubject}" | To: ${replyTo}${replyToAll ? ' (Reply All)' : ''}`
      };

    } catch (error) {
      console.error("Reply error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        subject: emailSubject || "Unknown",
        recipients: "",
        message: `❌ Failed to send reply: ${errorMessage}`
      };
    }
  }
}); 