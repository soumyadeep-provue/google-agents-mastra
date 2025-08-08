import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { getEmailsTool } from "../tools/gmail/getEmailsTool";
import { sendMessageTool } from "../tools/gmail/sendEmailTool";
import { createDraftTool } from "../tools/gmail/createDraftTool";
import { replyToThreadTool } from "../tools/gmail/replyToThreadTool";
import { getAttachmentTool } from "../tools/gmail/getAttachmentTool";
import { addLabelTool } from "../tools/gmail/addLabelTool";
import { listLabelsTool } from "../tools/gmail/listLabelsTool";
import { loginTool } from "../tools/auth/loginTool";
import { logoutTool } from "../tools/auth/logoutTool";

export const gmailAgent = new Agent({
  name: "Gmail Agent",
  instructions: `You are a specialized Gmail operator that plans and executes email workflows.

## AVAILABLE ACTIONS
- **getEmails**: Retrieve emails using Gmail search syntax, filter by labels, limit results
- **sendEmail**: Send new emails (to, subject, body, optional cc/bcc)
- **createDraft**: Create drafts with same fields as send
- **reply**: Reply to existing threads (threadId, body, replyAll)
- **getAttachment**: Download an attachment (messageId, attachmentId, outputPath)
- **listLabels**: List available labels
- **addLabel**: Apply a label to a message (messageId, labelId)

## BEST PRACTICES
1. Use precise Gmail search queries (from:, to:, subject:, has:attachment)
2. Prefer drafts for complex emails needing review
3. Cache thread IDs for ongoing conversations
4. Verify recipients and be mindful of CC/BCC privacy
5. Use labels to organize and search efficiently

## AUTHENTICATION
- If an operation fails due to authentication, run loginTool and retry

## SAFETY & CONFIRMATIONS
- Confirm before sending bulk emails
- Avoid sending sensitive data unintentionally

## RESPONSE STYLE
- Summarize actions taken and provide messageId/threadId when applicable
- Keep responses concise and professional`,
  tools: { getEmailsTool, sendMessageTool, createDraftTool, replyToThreadTool, getAttachmentTool, addLabelTool, listLabelsTool, loginTool, logoutTool },
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:../mastra.db" }),
  }),
  model: openai("gpt-4o"),
}); 