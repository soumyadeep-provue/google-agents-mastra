import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const createSpreadsheetTool = createTool({
  id: "createSpreadsheet",
  description: "Create a new Google Sheets spreadsheet with an optional title",
  inputSchema: z.object({
    title: z.string().optional().describe("Title of the spreadsheet (optional)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheetId: z.string().optional(),
    title: z.string(),
    webViewLink: z.string().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.sheets) {
      throw new Error("Google Sheets not authenticated. Please run loginTool first.");
    }

    const title = input.context?.title || "Untitled Spreadsheet";

    try {
      // Create the spreadsheet
      const response = await clients.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title
          }
        }
      });

      const spreadsheet = response.data;
      
      // Get the web view link from Drive API
      let webViewLink;
      if (clients.drive && spreadsheet.spreadsheetId) {
        try {
          const driveResponse = await clients.drive.files.get({
            fileId: spreadsheet.spreadsheetId,
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
        title: spreadsheet.properties?.title || title,
        webViewLink: webViewLink || undefined,
        message: `✅ Spreadsheet '${spreadsheet.properties?.title || title}' created successfully`
      };

    } catch (error) {
      console.error("Spreadsheet creation error:", error);
      return {
        success: false,
        title,
        message: `❌ Failed to create spreadsheet '${title}'. Please try again.`
      };
    }
  }
}); 