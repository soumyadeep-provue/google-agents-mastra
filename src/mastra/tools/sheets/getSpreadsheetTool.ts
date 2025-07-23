import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const getSpreadsheetTool = createTool({
  id: "getSpreadsheet",
  description: "Get Google Sheets spreadsheet information and metadata",
  inputSchema: z.object({
    spreadsheetId: z.string().describe("The ID of the spreadsheet to retrieve")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string().optional(),
    title: z.string().optional(),
    sheetCount: z.number().optional(),
    sheets: z.array(z.object({
      sheetId: z.number(),
      title: z.string(),
      index: z.number(),
      sheetType: z.string().optional(),
      gridProperties: z.object({
        rowCount: z.number().optional(),
        columnCount: z.number().optional()
      }).optional()
    })).optional(),
    webViewLink: z.string().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const spreadsheetId = input.context?.spreadsheetId;
    
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID is required");
    }

    try {
      // Get the spreadsheet
      const response = await clients.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });

      const spreadsheet = response.data;
      
      // Extract sheet information
      const sheets = spreadsheet.sheets?.map(sheet => ({
        sheetId: sheet.properties?.sheetId || 0,
        title: sheet.properties?.title || "Untitled Sheet",
        index: sheet.properties?.index || 0,
        sheetType: sheet.properties?.sheetType || "GRID",
        gridProperties: {
          rowCount: sheet.properties?.gridProperties?.rowCount || 0,
          columnCount: sheet.properties?.gridProperties?.columnCount || 0
        }
      })) || [];

      // Get the web view link from Drive API
      let webViewLink;
      if (clients.drive) {
        try {
          const driveResponse = await clients.drive.files.get({
            fileId: spreadsheetId,
            fields: 'webViewLink'
          });
          webViewLink = driveResponse.data.webViewLink;
        } catch (error) {
          console.log("Could not get web view link:", error);
        }
      }

      return {
        success: true,
        spreadsheetId: spreadsheet.spreadsheetId!,
        title: spreadsheet.properties?.title || "Untitled Spreadsheet",
        sheetCount: sheets.length,
        sheets: sheets,
        webViewLink: webViewLink || undefined,
        message: `✅ Spreadsheet '${spreadsheet.properties?.title}' retrieved successfully with ${sheets.length} sheet(s)`
      };

    } catch (error) {
      console.error("Spreadsheet retrieval error:", error);
      return {
        success: false,
        message: `❌ Failed to retrieve spreadsheet with ID '${spreadsheetId}'. Please check the ID and try again.`
      };
    }
  }
}); 