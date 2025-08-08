import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { mapsAgent } from "../../agents/mapsAgent";

export const mapsTool = createTool({
  id: "maps",
  description: `A high-level Google Maps orchestration tool that delegates planning and execution to the Maps Agent.

Provide a natural language goal (e.g., "find the top-rated pizza near me and give directions from my current location"). The Maps Agent will choose appropriate operations (textSearch/nearbySearch/directions/distanceMatrix/geocoding/reverseGeocoding/getCurrentLocation) and execute them.

## INPUT
- Natural language instruction for a Maps workflow

## OUTPUT
- Raw text from the Maps Agent response`,
  inputSchema: z.object({
    input: z.string().describe("Natural language instruction for the Maps Agent")
  }),
  outputSchema: z.object({
    raw: z.object({
      text: z.string().describe("Raw text output from the agent")
    })
  }),
  execute: async ({ context }) => {
    try {
      const response = await mapsAgent.generate(context.input);
      const text = response?.text ?? "";
      return { raw: { text } };
    } catch (error) {
      return { raw: { text: String(error instanceof Error ? error.message : error) } };
    }
  }
}); 