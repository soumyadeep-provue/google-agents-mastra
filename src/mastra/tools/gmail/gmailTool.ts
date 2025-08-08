import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { gmailAgent } from "../../agents/gmailAgent";

export const gmailTool = createTool({
  id: "gmail",
  description: `A high-level Gmail orchestration tool that delegates planning and multi-step execution to the Gmail Agent.

Provide a natural language goal (e.g., "draft an email to the team with this update and attach the latest PDF"). The Gmail Agent will choose appropriate operations (getEmails/sendEmail/createDraft/reply/getAttachment/listLabels/addLabel) and execute them.

## INPUT
- Natural language instruction for a Gmail workflow

## OUTPUT
- Raw text from the Gmail Agent response`,
  inputSchema: z.object({
    input: z.string().describe("Natural language instruction for the Gmail Agent")
  }),
  outputSchema: z.object({
    raw: z.object({
      text: z.string().describe("Raw text output from the agent")
    })
  }),
  execute: async ({ context }) => {
    try {
      const response = await gmailAgent.generate(context.input);
      const text = response?.text ?? "";
      return { raw: { text } };
    } catch (error) {
      return { raw: { text: String(error instanceof Error ? error.message : error) } };
    }
  }
}); 