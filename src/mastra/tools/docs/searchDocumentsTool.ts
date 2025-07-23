import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const searchDocumentsTool = createTool({
  id: "searchDocuments",
  description: "Search for Google Docs documents by name or retrieve all documents. Leave query empty to get all documents.",
  inputSchema: z.object({
    query: z.string().optional().describe("Search query for document names (optional - leave empty to get all documents)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (default: 10)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    documents: z.array(z.object({
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
      // Search for Google Docs documents
      let searchQuery;
      if (query && query.trim() !== '') {
        // Search for documents matching the query
        searchQuery = `name contains '${query}' and mimeType='application/vnd.google-apps.document' and trashed=false`;
      } else {
        // Get all documents when no query provided
        searchQuery = `mimeType='application/vnd.google-apps.document' and trashed=false`;
      }
      
      const response = await clients.drive.files.list({
        q: searchQuery,
        pageSize: maxResults,
        fields: 'files(id, name, webViewLink, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.data.files || [];
      
      const documents = files.map(file => ({
        id: file.id!,
        name: file.name!,
        webViewLink: file.webViewLink || undefined,
        modifiedTime: file.modifiedTime || undefined,
        size: file.size || undefined
      }));

      const message = query && query.trim() !== '' 
        ? `✅ Found ${documents.length} document(s) matching '${query}'`
        : `✅ Found ${documents.length} document(s) in your Google Docs`;

      return {
        success: true,
        documents: documents,
        totalFound: documents.length,
        message: message
      };

    } catch (error) {
      console.error("Document search error:", error);
      const errorMessage = query && query.trim() !== ''
        ? `❌ Failed to search documents for '${query}'. Please try again.`
        : `❌ Failed to retrieve your documents. Please try again.`;
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }
}); 