import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const batchGetValuesTool = createTool({
  id: "batchGetValues",
  description: "Read values from multiple ranges in a Google Sheets spreadsheet",
  inputSchema: z.object({
    spreadsheetId: z.string().describe("The ID of the spreadsheet to read from"),
    ranges: z.array(z.string()).describe("Array of A1 notation ranges to read (e.g., ['Sheet1!A1:C3', 'Sheet2!B2:D4'])"),
    valueRenderOption: z.enum(["FORMATTED_VALUE", "UNFORMATTED_VALUE", "FORMULA"]).optional().describe("How values should be represented (default: FORMATTED_VALUE)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string(),
    valueRanges: z.array(z.object({
      range: z.string(),
      values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional()
    })).optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const spreadsheetId = input.context?.spreadsheetId;
    const ranges = input.context?.ranges;
    const valueRenderOption = input.context?.valueRenderOption || "FORMATTED_VALUE";
    
    if (!spreadsheetId || !ranges || ranges.length === 0) {
      throw new Error("Spreadsheet ID and at least one range are required");
    }

    try {
      // Get values from multiple ranges
      const response = await clients.sheets.spreadsheets.values.batchGet({
        spreadsheetId: spreadsheetId,
        ranges: ranges,
        valueRenderOption: valueRenderOption
      });

      const valueRanges = response.data.valueRanges?.map(valueRange => ({
        range: valueRange.range || '',
        values: valueRange.values || []
      })) || [];

      return {
        success: true,
        spreadsheetId: spreadsheetId,
        valueRanges: valueRanges,
        message: `✅ Successfully read ${valueRanges.length} range(s) from spreadsheet`
      };

    } catch (error) {
      console.error("Batch get values error:", error);
      return {
        success: false,
        spreadsheetId: spreadsheetId,
        message: `❌ Failed to read values from spreadsheet. Please check the ranges and try again.`
      };
    }
  }
}); 