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
    action: z.enum(["getEmails", "sendEmail", "createDraft", "reply", "getAttachment", "addLabel", "listLabels"]).optional().describe("The specific Gmail action to perform. If unclear or missing, will be handled by Gmail specialist agent."),
    
    // Get emails
    query: z.string().optional().describe("Search query for emails (for getEmails action)"),
    maxResults: z.number().optional().describe("Maximum number of emails to return (for getEmails action, default: 10)"),
    labelIds: z.array(z.string()).optional().describe("Array of label IDs to filter by (for getEmails action)"),
    
    // Send email / Create draft
    to: z.string().optional().describe("Recipient email address (for sendEmail/createDraft actions)"),
    subject: z.string().optional().describe("Email subject (for sendEmail/createDraft actions)"),
    body: z.string().optional().describe("Email body content (for sendEmail/createDraft/reply actions)"),
    cc: z.string().optional().describe("CC email address (for sendEmail/createDraft actions)"),
    bcc: z.string().optional().describe("BCC email address (for sendEmail/createDraft actions)"),
    
    // Reply to thread
    threadId: z.string().optional().describe("ID of the thread to reply to (for reply action)"),
    replyAll: z.boolean().optional().describe("Whether to reply to all recipients (for reply action, default: false)"),
    
    // Get attachment
    messageId: z.string().optional().describe("ID of the message (for getAttachment/addLabel actions)"),
    attachmentId: z.string().optional().describe("ID of the attachment to download (for getAttachment action)"),
    outputPath: z.string().optional().describe("Local path where the attachment should be saved (for getAttachment action)"),
    
    // Add label
    labelId: z.string().optional().describe("ID of the label to add (for addLabel action)"),
    
    // Fallback context for Gmail specialist agent
    userIntent: z.string().optional().describe("Natural language description of what you want to do with Gmail (used when action is unclear)")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    // Handle cases where action is missing - provide helpful guidance instead of delegating
    if (!context.action) {
      return {
        success: false,
        message: "I can help you with Gmail tasks! Please specify what you'd like to do. For example:\n- Send an email (provide recipient, subject, and message)\n- Get your emails (optionally with search terms)\n- Create a draft\n- Reply to an email thread\n- Download attachments\n- Manage labels",
        availableActions: ["getEmails", "sendEmail", "createDraft", "reply", "getAttachment", "addLabel", "listLabels"]
      };
    }

    // Validate required fields for each action and provide helpful guidance
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
        if (!context.to || !context.subject || !context.body) {
          return {
            success: false,
            message: "To send an email, I need:\n- **Recipient** (to): Who should receive the email?\n- **Subject**: What is the email about?\n- **Message** (body): What would you like to say?",
            required: ["to", "subject", "body"],
            optional: ["cc", "bcc"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
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
        if (!context.to || !context.subject || !context.body) {
          return {
            success: false,
            message: "To create an email draft, I need:\n- **Recipient** (to): Who will receive the email?\n- **Subject**: What is the email about?\n- **Message** (body): What would you like to say?",
            required: ["to", "subject", "body"],
            optional: ["cc", "bcc"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
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
        if (!context.threadId || !context.body) {
          return {
            success: false,
            message: "To reply to an email, I need:\n- **Thread ID**: Which email thread to reply to?\n- **Message** (body): What would you like to say in your reply?",
            required: ["threadId", "body"],
            optional: ["replyAll"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await replyToThreadTool.execute({
          context: {
            threadId: context.threadId,
            body: context.body,
            replyAll: context.replyAll
          }
        });
        
      case "getAttachment":
        if (!context.messageId || !context.attachmentId || !context.outputPath) {
          return {
            success: false,
            message: "To download an email attachment, I need:\n- **Message ID**: Which email contains the attachment?\n- **Attachment ID**: Which attachment to download?\n- **Output Path**: Where should I save the file?",
            required: ["messageId", "attachmentId", "outputPath"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await getAttachmentTool.execute({
          context: {
            messageId: context.messageId,
            attachmentId: context.attachmentId,
            outputPath: context.outputPath
          }
        });
        
      case "addLabel":
        if (!context.messageId || !context.labelId) {
          return {
            success: false,
            message: "To add a label to an email, I need:\n- **Message ID**: Which email to label?\n- **Label ID**: Which label to add?",
            required: ["messageId", "labelId"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
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
        // Fallback to Gmail specialist agent for unknown actions
        console.log(`🔄 Gmail action unclear or unknown: "${context.action}". Delegating to Gmail specialist agent...`);
        
        if (!mastra) {
          return {
            success: false,
            message: `Unknown Gmail action: "${context.action}". Available actions are:\n- getEmails: Retrieve your emails\n- sendEmail: Send a new email\n- createDraft: Create an email draft\n- reply: Reply to an email thread\n- getAttachment: Download email attachments\n- addLabel: Add labels to emails\n- listLabels: Get all your Gmail labels`,
            availableActions: ["getEmails", "sendEmail", "createDraft", "reply", "getAttachment", "addLabel", "listLabels"],
            unknownAction: context.action
          };
        }

        const gmailAgent = mastra.getAgent("gmailAgent");
        if (!gmailAgent) {
          return {
            success: false,
            message: `Unknown Gmail action: "${context.action}". Available actions are:\n- getEmails: Retrieve your emails\n- sendEmail: Send a new email\n- createDraft: Create an email draft\n- reply: Reply to an email thread\n- getAttachment: Download email attachments\n- addLabel: Add labels to emails\n- listLabels: Get all your Gmail labels`,
            availableActions: ["getEmails", "sendEmail", "createDraft", "reply", "getAttachment", "addLabel", "listLabels"],
            unknownAction: context.action
          };
        }

        // Create a natural language prompt for the Gmail specialist
        const contextDescription = Object.entries(context)
          .filter(([key, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(", ");

        const prompt = `I need help with a Gmail task. Here's the context I received: ${contextDescription}

Please analyze this and perform the appropriate Gmail operation. If you need authentication, use the loginTool first.`;

        try {
          const result = await gmailAgent.generate(prompt, {
            memory: threadId && resourceId ? {
              thread: threadId,
              resource: resourceId,
            } : undefined,
            maxSteps: 8,
          });

          return {
            success: true,
            message: "✅ Gmail task completed by specialist agent",
            specialistResponse: result.text,
            delegatedAction: true,
            originalContext: context,
          };
        } catch (error) {
          console.error("Gmail specialist agent failed:", error);
          return {
            success: false,
            message: `Gmail specialist agent failed to process the request. Available actions are:\n- getEmails: Retrieve your emails\n- sendEmail: Send a new email\n- createDraft: Create an email draft\n- reply: Reply to an email thread\n- getAttachment: Download email attachments\n- addLabel: Add labels to emails\n- listLabels: Get all your Gmail labels`,
            error: error instanceof Error ? error.message : 'Unknown error',
            availableActions: ["getEmails", "sendEmail", "createDraft", "reply", "getAttachment", "addLabel", "listLabels"]
          };
        }
    }
  }
}); 