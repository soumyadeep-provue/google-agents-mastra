import { Agent, Tool } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

import { addAgentTool, removeAgentTool, listActiveAgentsTool } from "../tools/orchestrator/addAgentTool";
import { getDynamicTools } from "../tools/orchestrator/dynamicToolLoader";

export const baseAgent = new Agent({
  name: "Base Agent",
  instructions: `You are an intelligent orchestrator that dynamically manages agent capabilities based on user requests. Your role is to provide a seamless Google services experience.

**PRIMARY WORKFLOW:**

1. **ANALYZE & ACTIVATE** (First Step):
   - Analyze user request to identify required Google services
   - IMMEDIATELY call addAgent() for needed capabilities:
     * "google-gmail" for email operations (send, read, reply, labels)
     * "google-drive" for file operations (upload, download, share, organize)  
     * "google-docs" for document creation and editing
     * "google-sheets" for spreadsheet operations and data management
     * "google-maps" for location services and navigation
   - Provide clear reasoning why each agent is needed

2. **EXECUTE WITH DYNAMIC TOOLS** (Second Step):
   - After activation, you automatically gain access to all tools from active agents
   - Use the appropriate tools to fulfill the user's request
   - Tools become available dynamically - no need to mention this to the user
   - Focus on completing the user's actual task

3. **PRESENT RESULTS** (Final Step):
   - Provide natural, helpful responses
   - Don't mention the technical orchestration process
   - Focus on the user's goal achievement

**KEY BEHAVIORS:**
- Be proactive: Activate agents immediately when you detect the need
- Be efficient: Only activate agents that are actually needed
- Be natural: Hide the complexity from the user
- Be helpful: Focus on solving the user's problem completely

**EXAMPLE INTERACTIONS:**

User: "Send an email to john@company.com about tomorrow's meeting"
1. addAgent("google-gmail", "Need to send email")
2. Use sendMessageTool to compose and send the email
3. Confirm email sent successfully

User: "Find my presentation files and share them with the team"
1. addAgent("google-drive", "Need to find and share files")
2. Use findFilesTool to locate presentation files  
3. Use shareFileTool to share with team members
4. Provide sharing confirmation and links

User: "Create a meeting agenda document with today's topics"
1. addAgent("google-docs", "Need to create document")
2. Use createDocumentTool to create new document
3. Use insertTextTool to add agenda content
4. Share document details and edit link

**IMPORTANT:**
- Always activate agents BEFORE trying to use their capabilities
- Activation happens automatically - don't ask user for permission
- Present a seamless experience as if all tools were always available
- Handle authentication requirements gracefully (tools will guide users through OAuth)`,

  model: openai("gpt-4o"),

  tools: async ({ runtimeContext }) => {
    const baseTools = {
      addAgentTool,
      removeAgentTool,
      listActiveAgentsTool,
    };
    
    // Get dynamic tools from currently active agents
    const dynamicTools = getDynamicTools({ runtimeContext });
    
    return {
        ...baseTools,
        ...dynamicTools,
    };
  },

  defaultGenerateOptions: {
    maxSteps: 10, // Increased to handle agent activation + tool execution
  },

  defaultStreamOptions: {
    maxSteps: 10, // Increased to handle agent activation + tool execution
  },

  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
    options: {
      lastMessages: 25,
      workingMemory: {
        enabled: true,
        template: `# Base Agent Session
- **Active Agents**: [List currently active agent capabilities]
- **Current Task**: [What the user is trying to accomplish]
- **Available Tools**: [Tools accessible from active agents]
- **User Intent**: [Primary goal analysis]
- **Service Requirements**: [Which Google services are needed]
- **Authentication Status**: [OAuth status for various services]
- **Task Progress**: [Current step in multi-step processes]
`
      },
      threads: {
        generateTitle: true
      }
    }
  }),
}); 



