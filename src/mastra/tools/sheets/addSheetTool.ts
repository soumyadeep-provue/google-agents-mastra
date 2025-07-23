import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const addSheetTool = createTool({
  id: "addSheet",
  description: "Add a new sheet to an existing Google Sheets spreadsheet",
  inputSchema: z.object({
    spreadsheetId: z.string().describe("The ID of the spreadsheet to add a sheet to"),
    sheetTitle: z.string().describe("Title of the new sheet"),
    rowCount: z.number().optional().describe("Number of rows (default: 1000)"),
    columnCount: z.number().optional().describe("Number of columns (default: 26)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string(),
    sheetId: z.number().optional(),
    sheetTitle: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const spreadsheetId = input.context?.spreadsheetId;
    const sheetTitle = input.context?.sheetTitle;
    const rowCount = input.context?.rowCount || 1000;
    const columnCount = input.context?.columnCount || 26;
    
    if (!spreadsheetId || !sheetTitle) {
      throw new Error("Spreadsheet ID and sheet title are required");
    }

    try {
      // Add the new sheet
      const requests = [
        {
          addSheet: {
            properties: {
              title: sheetTitle,
              gridProperties: {
                rowCount: rowCount,
                columnCount: columnCount
              }
            }
          }
        }
      ];

      const response = await clients.sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: requests
        }
      });

      const addSheetResponse = response.data.replies?.[0]?.addSheet;
      const newSheetId = addSheetResponse?.properties?.sheetId;

      return {
        success: true,
        spreadsheetId: spreadsheetId,
        sheetId: newSheetId || undefined,
        sheetTitle: sheetTitle,
        message: `✅ Sheet '${sheetTitle}' added successfully to spreadsheet`
      };

    } catch (error) {
      console.error("Add sheet error:", error);
      return {
        success: false,
        spreadsheetId: spreadsheetId,
        sheetTitle: sheetTitle,
        message: `❌ Failed to add sheet '${sheetTitle}' to spreadsheet. Please try again.`
      };
    }
  }
}); 