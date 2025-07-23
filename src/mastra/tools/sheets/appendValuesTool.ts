import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const appendValuesTool = createTool({
  id: "appendValues",
  description: "Append values to the end of a range in a Google Sheets spreadsheet",
  inputSchema: z.object({
    spreadsheetId: z.string().describe("The ID of the spreadsheet to append to"),
    range: z.string().describe("A1 notation range to append to (e.g., 'Sheet1!A:A' or 'Sheet1!A1:C1')"),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of values to append"),
    valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional().describe("How input data should be interpreted (default: USER_ENTERED)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string(),
    updatedRange: z.string().optional(),
    updatedRows: z.number().optional(),
    updatedColumns: z.number().optional(),
    updatedCells: z.number().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const spreadsheetId = input.context?.spreadsheetId;
    const range = input.context?.range;
    const values = input.context?.values;
    const valueInputOption = input.context?.valueInputOption || "USER_ENTERED";
    
    if (!spreadsheetId || !range || !values || values.length === 0) {
      throw new Error("Spreadsheet ID, range, and values are required");
    }

    try {
      // Append values to the range
      const response = await clients.sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: valueInputOption,
        requestBody: {
          values: values
        }
      });

      const updates = response.data.updates;

      return {
        success: true,
        spreadsheetId: spreadsheetId,
        updatedRange: updates?.updatedRange || undefined,
        updatedRows: updates?.updatedRows || undefined,
        updatedColumns: updates?.updatedColumns || undefined,
        updatedCells: updates?.updatedCells || undefined,
        message: `✅ Successfully appended ${updates?.updatedRows || 0} row(s) and ${updates?.updatedCells || 0} cell(s) to ${range}`
      };

    } catch (error) {
      console.error("Append values error:", error);
      return {
        success: false,
        spreadsheetId: spreadsheetId,
        message: `❌ Failed to append values to range '${range}'. Please check the range and data format.`
      };
    }
  }
}); 