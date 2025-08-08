import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const gmailTool = createTool({
  id: "gmail",
  description: `A natural language Gmail tool that delegates all operations to a specialized Gmail agent. Simply describe what you want to do with Gmail in plain English.

## HOW TO USE

Just describe your Gmail task naturally! The tool accepts natural language requests and handles all the complexity for you.

### Examples of Requests:

**Sending Emails:**
- "Send an email to john@company.com about tomorrow's meeting"
- "Send a message to the team about the project update with subject 'Weekly Progress'"
- "Email sarah@client.com with the contract details and CC mike@company.com"

**Reading Emails:**
- "Get my latest emails"
- "Show me emails from my boss from this week"
- "Find emails about the project proposal"
- "Get unread emails from the support team"

**Managing Drafts:**
- "Create a draft email to the investors about our funding"
- "Draft a message to the client about the delay"

**Replying:**
- "Reply to the email thread about the budget meeting"
- "Reply to all participants in the last discussion"

**Attachments:**
- "Download the attachment from the contract email"
- "Get the PDF attachment from yesterday's message"

**Labels & Organization:**
- "Show me all my Gmail labels"
- "Add the 'Important' label to the message from the CEO"
- "Organize emails from clients with the 'Client' label"

## WHAT YOU CAN PROVIDE

While the tool works with natural language, you can also provide specific details when available:

- **Recipient emails** (to, cc, bcc)
- **Subject lines** for clarity
- **Email body content**
- **Search queries** using Gmail syntax
- **Thread IDs** for replies
- **Message/Attachment IDs** for downloads
- **Label information** for organization

## INTELLIGENCE FEATURES

The Gmail specialist agent will:
- ✅ **Interpret your intent** from natural language
- ✅ **Ask for missing information** when needed
- ✅ **Handle authentication** automatically
- ✅ **Use best practices** for email management
- ✅ **Provide helpful responses** about what was accomplished
- ✅ **Handle complex workflows** like multi-step email operations

## SECURITY & PRIVACY

- All operations go through Google's secure APIs
- Authentication is handled safely
- Your email data remains private and secure
- Best practices for email privacy are automatically applied`,
  inputSchema: z.object({
    // Natural language request - let the Gmail agent interpret the intent
    request: z.string().describe("Natural language description of what you want to do with Gmail (e.g., 'Send an email to john@example.com about the meeting', 'Get my recent emails', 'Create a draft to the team')"),
    
    // Optional specific parameters that users can provide
    to: z.string().optional().describe("Recipient email address"),
    subject: z.string().optional().describe("Email subject"),
    body: z.string().optional().describe("Email body content"),
    cc: z.string().optional().describe("CC email address"),
    bcc: z.string().optional().describe("BCC email address"),
    query: z.string().optional().describe("Search query for emails"),
    maxResults: z.number().optional().describe("Maximum number of emails to return"),
    labelIds: z.array(z.string()).optional().describe("Array of label IDs to filter by"),
    threadId: z.string().optional().describe("ID of the thread to reply to"),
    replyAll: z.boolean().optional().describe("Whether to reply to all recipients"),
    messageId: z.string().optional().describe("ID of the message"),
    attachmentId: z.string().optional().describe("ID of the attachment to download"),
    outputPath: z.string().optional().describe("Local path where the attachment should be saved"),
    labelId: z.string().optional().describe("ID of the label to add")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    console.log("🔄 Gmail tool: Delegating all requests directly to Gmail specialist agent...");
    
    // Ensure we have access to the Mastra instance
    if (!mastra) {
      return {
        success: false,
        message: "Gmail specialist agent is not available. Unable to process Gmail requests.",
        error: "Mastra instance not provided"
      };
    }

    // Get the Gmail specialist agent
    const gmailAgent = mastra.getAgent("gmailAgent");
    if (!gmailAgent) {
      return {
        success: false,
        message: "Gmail specialist agent is not available. Please check your configuration.",
        error: "Gmail agent not found in Mastra instance"
      };
    }

    // Build a comprehensive prompt with the user's request and any provided parameters
    let prompt = `I need help with a Gmail task: ${context.request}`;
    
    // Add any specific parameters that were provided
    const providedParams = Object.entries(context)
      .filter(([key, value]) => key !== 'request' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
    
    if (providedParams) {
      prompt += `\n\nAdditional context provided: ${providedParams}`;
    }
    
    prompt += `\n\nPlease analyze this request and perform the appropriate Gmail operation. If you need authentication, use the loginTool first.`;

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
        agentResponse: result.text,
        delegatedToAgent: true,
        userRequest: context.request,
        providedContext: context,
      };
    } catch (error) {
      console.error("Gmail specialist agent failed:", error);
      return {
        success: false,
        message: "Gmail specialist agent failed to process the request. Please try again or provide more specific details about what you want to do with Gmail.",
        error: error instanceof Error ? error.message : 'Unknown error',
        userRequest: context.request,
        providedContext: context,
      };
    }
  }
}); 