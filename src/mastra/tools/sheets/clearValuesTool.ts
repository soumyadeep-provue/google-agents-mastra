import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const clearValuesTool = createTool({
  id: "clearValues",
  description: "Clear values from one or more ranges in a Google Sheets spreadsheet",
  inputSchema: z.object({
    spreadsheetId: z.string().describe("The ID of the spreadsheet to clear values from"),
    ranges: z.array(z.string()).describe("Array of A1 notation ranges to clear (e.g., ['Sheet1!A1:C3', 'Sheet2!B2:D4'])")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string(),
    clearedRanges: z.array(z.string()).optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const spreadsheetId = input.context?.spreadsheetId;
    const ranges = input.context?.ranges;
    
    if (!spreadsheetId || !ranges || ranges.length === 0) {
      throw new Error("Spreadsheet ID and at least one range are required");
    }

    try {
      // Clear values from multiple ranges
      const response = await clients.sheets.spreadsheets.values.batchClear({
        spreadsheetId: spreadsheetId,
        requestBody: {
          ranges: ranges
        }
      });

      const clearedRanges = response.data.clearedRanges || [];

      return {
        success: true,
        spreadsheetId: spreadsheetId,
        clearedRanges: clearedRanges,
        message: `✅ Successfully cleared ${clearedRanges.length} range(s) in spreadsheet`
      };

    } catch (error) {
      console.error("Clear values error:", error);
      return {
        success: false,
        spreadsheetId: spreadsheetId,
        message: `❌ Failed to clear values from spreadsheet. Please check the ranges and try again.`
      };
    }
  }
}); 