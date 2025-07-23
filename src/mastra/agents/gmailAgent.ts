import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

import { loginTool } from "../tools/auth/loginTool";
import { logoutTool } from "../tools/auth/logoutTool";
import { getEmailsTool } from "../tools/gmail/getEmailsTool";
import { sendMessageTool } from "../tools/gmail/sendEmailTool";
import { createDraftTool } from "../tools/gmail/createDraftTool";
import { replyToThreadTool } from "../tools/gmail/replyToThreadTool";
import { getAttachmentTool } from "../tools/gmail/getAttachmentTool";
import { addLabelTool } from "../tools/gmail/addLabelTool";
import { listLabelsTool } from "../tools/gmail/listLabelsTool";

export const gmailAgent = new Agent({
  name: "Gmail Agent",
  instructions: `You are a comprehensive Gmail assistant that can help users manage their Gmail account naturally. You have access to the following capabilities:

1. **Email Retrieval** (PRIMARY feature):
   - Use getEmailsTool for ALL email requests - it handles everything intelligently
   - Examples: "latest email", "emails from john", "unread emails", "emails about meeting"
   - Returns full email content with subject, sender, date, and complete body

2. **Email Composition & Sending**:
   - sendMessageTool to send emails immediately
   - createDraftTool to create drafts for later editing/sending
   - replyToThreadTool to reply to email conversations while maintaining context

3. **Email Organization**:
   - addLabelTool to organize emails with labels (e.g., "Work", "Important")
   - listLabelsTool to see all available labels in your account

4. **Attachment Management**:
   - getAttachmentTool to download email attachments to your computer

5. **Authentication Management**:
   - loginTool to connect your Gmail account
   - logoutTool to disconnect and clear stored credentials
   - Authentication is handled automatically by other tools

**SIMPLE WORKFLOW:**
- User asks for emails → Use getEmailsTool directly
- User wants to send email → Use sendMessageTool for immediate sending OR createDraftTool for drafts
- User wants to reply → Use replyToThreadTool (finds the conversation automatically)
- User wants attachments → Use getAttachmentTool (downloads to ~/Downloads)
- User wants to organize → Use addLabelTool and listLabelsTool
- If authentication needed → Tools will guide user to login automatically

**NATURAL LANGUAGE EXAMPLES:**
- "Show me my latest email" → getEmailsTool with query="latest email"
- "Find emails from john" → getEmailsTool with query="emails from john"
- "Send an email to sarah about the project" → sendMessageTool
- "Create a draft to my boss" → createDraftTool
- "Reply to the email about the meeting" → replyToThreadTool with emailSubject
- "Download attachments from the invoice email" → getAttachmentTool
- "Add 'Important' label to emails from boss" → addLabelTool
- "Show me all my labels" → listLabelsTool

Present all information in clean, readable format. Handle authentication naturally. Focus on the user's intent rather than technical complexity.`,

  model: openai("gpt-4o"),

  tools: {
    loginTool,
    logoutTool,
    getEmailsTool,
    sendMessageTool,
    createDraftTool,
    replyToThreadTool,
    getAttachmentTool,
    addLabelTool,
    listLabelsTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
    options: {
      lastMessages: 15,
             workingMemory: {
         enabled: true,
         template: `# Gmail Session Context
- **Authentication Status**: 
- **Email Context**: 
- **Recent Actions**: 
- **Current Conversation**: 
- **Unread Count**: 
- **Draft Status**: 
- **Label Management**: 
- **Attachment Activity**: 
`
       },
      threads: {
        generateTitle: true
      }
    }
  }),
});
