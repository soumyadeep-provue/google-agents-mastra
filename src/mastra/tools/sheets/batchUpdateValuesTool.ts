import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const batchUpdateValuesTool = createTool({
  id: "batchUpdateValues",
  description: "Write values to multiple ranges in a Google Sheets spreadsheet",
  inputSchema: z.object({
    spreadsheetId: z.string().describe("The ID of the spreadsheet to write to"),
    valueRanges: z.array(z.object({
      range: z.string().describe("A1 notation range (e.g., 'Sheet1!A1:C3')"),
      values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of values to write")
    })).describe("Array of range and value pairs"),
    valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional().describe("How input data should be interpreted (default: USER_ENTERED)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string(),
    updatedRanges: z.number().optional(),
    updatedCells: z.number().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const spreadsheetId = input.context?.spreadsheetId;
    const valueRanges = input.context?.valueRanges;
    const valueInputOption = input.context?.valueInputOption || "USER_ENTERED";
    
    if (!spreadsheetId || !valueRanges || valueRanges.length === 0) {
      throw new Error("Spreadsheet ID and at least one value range are required");
    }

    try {
      // Validate data format before API call
      console.log("📝 Batch update request:", JSON.stringify({
        spreadsheetId,
        valueRanges: valueRanges.map((vr: any) => ({
          range: vr.range,
          valuesCount: vr.values?.length || 0,
          firstRowSample: vr.values?.[0]
        })),
        valueInputOption
      }, null, 2));

      // Update values in multiple ranges
      const response = await clients.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          valueInputOption: valueInputOption,
          data: valueRanges
        }
      });

      const updatedRanges = response.data.responses?.length || 0;
      const updatedCells = response.data.totalUpdatedCells || 0;

      return {
        success: true,
        spreadsheetId: spreadsheetId,
        updatedRanges: updatedRanges,
        updatedCells: updatedCells,
        message: `✅ Successfully updated ${updatedRanges} range(s) and ${updatedCells} cell(s) in spreadsheet`
      };

    } catch (error: any) {
      console.error("Batch update values error:", error);
      
      let errorMessage = "❌ Failed to update values in spreadsheet.";
      
      // Provide specific error guidance
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        
        if (apiError.message?.includes("Unable to parse range")) {
          errorMessage = `❌ Range parsing failed. This usually means the sheet name doesn't exist. Range attempted: ${valueRanges?.map((vr: any) => vr.range).join(", ")}. Please verify the sheet name exists and matches exactly (case-sensitive).`;
        } else if (apiError.message?.includes("Requested writing within range")) {
          errorMessage = `❌ Range size mismatch. The data doesn't fit the specified range. Check that your values array matches the range dimensions.`;
        } else if (apiError.message?.includes("does not exist")) {
          errorMessage = `❌ Sheet not found. Make sure the sheet name in your range exists. Current ranges: ${valueRanges?.map((vr: any) => vr.range).join(", ")}`;
        } else {
          errorMessage = `❌ Google Sheets API error: ${apiError.message}. Debug info: ${JSON.stringify({ code: apiError.code, status: apiError.status, ranges: valueRanges?.map((vr: any) => vr.range) })}`;
        }
      } else if (error.message?.includes("auth")) {
        errorMessage = "❌ Authentication error. Please run loginTool to re-authenticate.";
      }
      
      return {
        success: false,
        spreadsheetId: spreadsheetId,
        message: errorMessage
      };
    }
  }
}); 