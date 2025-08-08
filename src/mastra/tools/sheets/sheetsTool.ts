import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sheetsAgent } from "../../agents/sheetsAgent";

export const sheetsTool = createTool({
  id: "sheets",
  description: `A high-level Google Sheets orchestration tool that delegates planning and multi-step execution to the Sheets Agent.

Provide a natural language goal (e.g., "create a spreadsheet, add a Summary sheet, and append the latest sales data"). The Sheets Agent will choose appropriate operations (search/get/create/addSheet/deleteSheet/batchGet/batchUpdate/append/clear) and execute them.

## INPUT
- Natural language instruction for a Sheets workflow

## OUTPUT
- Raw text from the Sheets Agent response`,
  inputSchema: z.object({
    input: z.string().describe("Natural language instruction for the Sheets Agent")
  }),
  outputSchema: z.object({
    raw: z.object({
      text: z.string().describe("Raw text output from the agent")
    })
  }),
  execute: async ({ context }) => {
    try {
      const response = await sheetsAgent.generate(context.input);
      const text = response?.text ?? "";
      return { raw: { text } };
    } catch (error) {
      return { raw: { text: String(error instanceof Error ? error.message : error) } };
    }
  }
}); 