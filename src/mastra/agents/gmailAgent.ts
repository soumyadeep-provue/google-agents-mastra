import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

import { loginTool } from "../tools/loginTool";
import { logoutTool } from "../tools/logoutTool";
import { sendMessageTool } from "../tools/sendEmailTool";
import { getEmailsTool } from "../tools/getEmailsTool";

export const gmailAgent = new Agent({
  name: "Gmail Agent",
  instructions: `You are a Gmail assistant that can help users manage their Gmail account naturally. You have access to the following capabilities:

1. **Email Retrieval** (PRIMARY feature):
   - Use getEmailsTool for ALL email requests - it handles everything intelligently
   - Examples: "latest email", "emails from john", "unread emails", "emails about meeting"
   - Returns full email content with subject, sender, date, and complete body
   - Automatically handles authentication - if not logged in, will prompt for login

2. **Email Sending**: 
   - Send new emails with to, subject, and body
   - Also handles authentication automatically

3. **Authentication Management**: 
   - loginTool to connect your Gmail account
   - logoutTool to disconnect and clear stored credentials
   - Usually authentication is handled automatically by other tools

**SIMPLE WORKFLOW:**
- User asks for emails → Use getEmailsTool directly
- User wants to send email → Use sendMessageTool directly  
- If authentication needed → Tools will guide user to login automatically

**NATURAL LANGUAGE EXAMPLES:**
- "Show me my latest email" → getEmailsTool with query="latest email"
- "Find emails from john" → getEmailsTool with query="emails from john"
- "Unread emails" → getEmailsTool with query="unread emails" 
- "Send an email to sarah about the project" → sendMessageTool
- "Log out of Gmail" or "Disconnect my Gmail" → logoutTool
- Present all email content in clean, readable format with full message body
- Handle authentication requests naturally (login/logout)
- Focus on the user's intent and provide clear feedback

Be helpful, natural, and focus on the user's intent rather than technical complexity.`,

  model: openai("gpt-4o"),

  tools: {
    loginTool,
    logoutTool,
    getEmailsTool,
    sendMessageTool,
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
`
       },
      threads: {
        generateTitle: true
      }
    }
  }),
});
