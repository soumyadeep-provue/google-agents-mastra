import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { docsAgent } from "../../agents/docsAgent";

export const docsTool = createTool({
  id: "docs",
  description: `A high-level Google Docs orchestration tool that delegates complex planning and multi-step execution to the Docs Agent.

This tool wraps the agent and accepts natural language instructions (no rigid action schema). It plans the appropriate sequence (search/get/create/insert/replace/delete/copy/insertTable) and returns a concise, structured summary of what happened.

## WHEN TO USE
- You want the agent to autonomously choose the right Docs operations
- You have a multi-step goal (e.g., "create a doc, add sections, and share the link")
- You prefer natural language over enumerating specific actions/indices

## EXPECTED BEHAVIOR
- Agent will: search first when needed, fetch current content before edits, and favor replace over delete+insert for bulk changes
- If authentication is missing, it will instruct to run loginTool and retry
- Responses include documentId/webViewLink when applicable and counts for edits

## INPUT
- Provide a clear natural language goal for the Docs workflow

## OUTPUT
- Raw text from the Docs Agent response`,
  inputSchema: z.object({
    input: z.string().describe("Natural language instruction for the Docs Agent")
  }),
  outputSchema: z.object({
    raw: z.object({
      text: z.string().describe("Raw text output from the agent")
    })
  }),
  execute: async ({ context }) => {
    const agent = docsAgent;
    try {
      const response = await agent.generate(context.input);
      const text = response?.text ?? "";
      return { raw: { text } };
    } catch (error) {
      return { raw: { text: String(error instanceof Error ? error.message : error) } };
    }
  }
});