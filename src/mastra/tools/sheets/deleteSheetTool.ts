import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const deleteSheetTool = createTool({
  id: "deleteSheet",
  description: "Delete a sheet from a Google Sheets spreadsheet",
  inputSchema: z.object({
    spreadsheetId: z.string().describe("The ID of the spreadsheet containing the sheet to delete"),
    sheetId: z.number().describe("The ID of the sheet to delete (not the title)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string(),
    deletedSheetId: z.number(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const spreadsheetId = input.context?.spreadsheetId;
    const sheetId = input.context?.sheetId;
    
    if (!spreadsheetId || sheetId === undefined) {
      throw new Error("Spreadsheet ID and sheet ID are required");
    }

    try {
      // Delete the sheet
      const requests = [
        {
          deleteSheet: {
            sheetId: sheetId
          }
        }
      ];

      await clients.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: requests
        }
      });

      return {
        success: true,
        spreadsheetId: spreadsheetId,
        deletedSheetId: sheetId,
        message: `✅ Sheet with ID ${sheetId} deleted successfully from spreadsheet`
      };

    } catch (error) {
      console.error("Delete sheet error:", error);
      return {
        success: false,
        spreadsheetId: spreadsheetId,
        deletedSheetId: sheetId,
        message: `❌ Failed to delete sheet with ID ${sheetId} from spreadsheet. Please check the sheet ID and try again.`
      };
    }
  }
}); 