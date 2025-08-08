import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { driveAgent } from "../../agents/driveAgent";

export const driveTool = createTool({
  id: "drive",
  description: `A high-level Google Drive orchestration tool that delegates planning and multi-step execution to the Drive Agent.

Provide a natural language goal (e.g., "find the latest report PDF and share with alice@company.com"). The Drive Agent will choose appropriate operations (find/createFolder/upload/download/move/share) and execute them.

## INPUT
- Natural language instruction for a Drive workflow

## OUTPUT
- Raw text from the Drive Agent response`,
  inputSchema: z.object({
    input: z.string().describe("Natural language instruction for the Drive Agent")
  }),
  outputSchema: z.object({
    raw: z.object({
      text: z.string().describe("Raw text output from the agent")
    })
  }),
  execute: async ({ context }) => {
    try {
      const response = await driveAgent.generate(context.input);
      const text = response?.text ?? "";
      return { raw: { text } };
    } catch (error) {
      return { raw: { text: String(error instanceof Error ? error.message : error) } };
    }
  }
}); 