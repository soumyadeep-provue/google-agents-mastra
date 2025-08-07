import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getEmailsTool } from "./getEmailsTool";
import { sendMessageTool } from "./sendEmailTool";
import { createDraftTool } from "./createDraftTool";
import { replyToThreadTool } from "./replyToThreadTool";
import { getAttachmentTool } from "./getAttachmentTool";
import { addLabelTool } from "./addLabelTool";
import { listLabelsTool } from "./listLabelsTool";

export const gmailTool = createTool({
  id: "gmail",
  description: `A comprehensive tool for Gmail operations: get emails, send messages, create drafts, reply to threads, handle attachments, and manage labels.

## AVAILABLE ACTIONS

### Email Management
- **"getEmails"**: Retrieve emails from Gmail
  - Use query parameter for search (Gmail search syntax supported)
  - Filter by label IDs for specific folders/labels
  - Set maxResults to limit results (default: 10)
  - Example: { action: "getEmails", query: "from:boss@company.com", maxResults: 5 }

- **"sendEmail"**: Send new email messages
  - Specify recipient, subject, and body content
  - Optionally add CC and BCC recipients
  - Supports plain text and basic formatting
  - Example: { action: "sendEmail", to: "colleague@company.com", subject: "Project Update", body: "Here's the latest..." }

### Draft Management
- **"createDraft"**: Create email drafts for later sending
  - Same parameters as sendEmail but saves as draft
  - Useful for preparing emails that need review
  - Example: { action: "createDraft", to: "client@company.com", subject: "Proposal", body: "Draft content..." }

### Conversation Management
- **"reply"**: Reply to existing email threads
  - Requires thread ID from previous email retrieval
  - Set replyAll to true for replying to all recipients
  - Maintains conversation threading
  - Example: { action: "reply", threadId: "thread123", body: "Thank you for the update", replyAll: false }

### Attachment Handling
- **"getAttachment"**: Download email attachments
  - Requires message ID and attachment ID from email details
  - Specify local output path for saved file
  - Preserves original filename and format
  - Example: { action: "getAttachment", messageId: "msg123", attachmentId: "att456", outputPath: "/Downloads/document.pdf" }

### Label Management
- **"listLabels"**: Get all available Gmail labels
  - Returns both system labels (Inbox, Sent, etc.) and custom labels
  - Useful for understanding organization structure
  - Example: { action: "listLabels" }

- **"addLabel"**: Apply labels to emails for organization
  - Requires message ID and label ID
  - Use with listLabels to find appropriate label IDs
  - Example: { action: "addLabel", messageId: "msg123", labelId: "label456" }

## BEST PRACTICES

### Email Communication
- Use clear, descriptive subject lines
- Keep email bodies concise and well-structured
- Be mindful of CC/BCC usage for privacy

### Search & Organization
- Use Gmail search syntax for precise email filtering
- Leverage labels for better organization
- Search before manually browsing for specific emails

### Security & Privacy
- Verify recipient email addresses before sending
- Be cautious with sensitive information in emails
- Use appropriate reply vs reply-all etiquette

### Efficiency
- Use drafts for complex emails that need review
- Batch label operations when organizing multiple emails
- Cache thread IDs for ongoing conversations`,
  inputSchema: z.object({
    action: z.enum(["getEmails", "sendEmail", "createDraft", "reply", "getAttachment", "addLabel", "listLabels"]).describe("The action to perform"),
    
    // Get emails
    query: z.string().optional().describe("Search query for emails (optional for getEmails action)"),
    maxResults: z.number().optional().describe("Maximum number of emails to return (optional for getEmails action, default: 10)"),
    labelIds: z.array(z.string()).optional().describe("Array of label IDs to filter by (optional for getEmails action)"),
    
    // Send email / Create draft
    to: z.string().optional().describe("Recipient email address (required for sendEmail/createDraft actions)"),
    subject: z.string().optional().describe("Email subject (required for sendEmail/createDraft actions)"),
    body: z.string().optional().describe("Email body content (required for sendEmail/createDraft/reply actions)"),
    cc: z.string().optional().describe("CC email address (optional for sendEmail/createDraft actions)"),
    bcc: z.string().optional().describe("BCC email address (optional for sendEmail/createDraft actions)"),
    
    // Reply to thread
    threadId: z.string().optional().describe("ID of the thread to reply to (required for reply action)"),
    replyAll: z.boolean().optional().describe("Whether to reply to all recipients (optional for reply action, default: false)"),
    
    // Get attachment
    messageId: z.string().optional().describe("ID of the message (required for getAttachment/addLabel actions)"),
    attachmentId: z.string().optional().describe("ID of the attachment to download (required for getAttachment action)"),
    outputPath: z.string().optional().describe("Local path where the attachment should be saved (required for getAttachment action)"),
    
    // Add label
    labelId: z.string().optional().describe("ID of the label to add (required for addLabel action)")
  }),
  execute: async ({ context }) => {
    switch (context.action) {
      case "getEmails":
        return await getEmailsTool.execute({
          context: {
            query: context.query,
            maxResults: context.maxResults,
            labelIds: context.labelIds
          }
        });
        
      case "sendEmail":
        return await sendMessageTool.execute({
          context: {
            to: context.to,
            subject: context.subject,
            body: context.body,
            cc: context.cc,
            bcc: context.bcc
          }
        });
        
      case "createDraft":
        return await createDraftTool.execute({
          context: {
            to: context.to,
            subject: context.subject,
            body: context.body,
            cc: context.cc,
            bcc: context.bcc
          }
        });
        
      case "reply":
        return await replyToThreadTool.execute({
          context: {
            threadId: context.threadId,
            body: context.body,
            replyAll: context.replyAll
          }
        });
        
      case "getAttachment":
        return await getAttachmentTool.execute({
          context: {
            messageId: context.messageId,
            attachmentId: context.attachmentId,
            outputPath: context.outputPath
          }
        });
        
      case "addLabel":
        return await addLabelTool.execute({
          context: {
            messageId: context.messageId,
            labelId: context.labelId
          }
        });
        
      case "listLabels":
        return await listLabelsTool.execute({
          context: {}
        });
        
      default:
        throw new Error(`Unknown action: ${(context as any).action}`);
    }
  }
}); 