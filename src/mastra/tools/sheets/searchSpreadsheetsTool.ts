import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const searchSpreadsheetsTool = createTool({
  id: "searchSpreadsheets",
  description: "Search for Google Sheets spreadsheets by name or retrieve all spreadsheets. Leave query empty to get all spreadsheets.",
  inputSchema: z.object({
    query: z.string().optional().describe("Search query for spreadsheet names (optional - leave empty to get all spreadsheets)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (default: 10)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    spreadsheets: z.array(z.object({
      id: z.string(),
      name: z.string(),
      webViewLink: z.string().optional(),
      modifiedTime: z.string().optional(),
      size: z.string().optional()
    })).optional(),
    totalFound: z.number().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const query = input.context?.query;
    const maxResults = input.context?.maxResults || 10;

    try {
      // Search for Google Sheets spreadsheets
      let searchQuery;
      if (query && query.trim() !== '') {
        // Search for spreadsheets matching the query
        searchQuery = `name contains '${query}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
      } else {
        // Get all spreadsheets when no query provided
        searchQuery = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
      }
      
      const response = await clients.drive.files.list({
        q: searchQuery,
        pageSize: maxResults,
        fields: 'files(id, name, webViewLink, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.data.files || [];
      
      const spreadsheets = files.map(file => ({
        id: file.id!,
        name: file.name!,
        webViewLink: file.webViewLink || undefined,
        modifiedTime: file.modifiedTime || undefined,
        size: file.size || undefined
      }));

      const message = query && query.trim() !== '' 
        ? `✅ Found ${spreadsheets.length} spreadsheet(s) matching '${query}'`
        : `✅ Found ${spreadsheets.length} spreadsheet(s) in your Google Sheets`;

      return {
        success: true,
        spreadsheets: spreadsheets,
        totalFound: spreadsheets.length,
        message: message
      };

    } catch (error) {
      console.error("Spreadsheet search error:", error);
      const errorMessage = query && query.trim() !== ''
        ? `❌ Failed to search spreadsheets for '${query}'. Please try again.`
        : `❌ Failed to retrieve your spreadsheets. Please try again.`;
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }
}); 