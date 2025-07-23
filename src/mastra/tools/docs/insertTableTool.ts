import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const insertTableTool = createTool({
  id: "insertTable",
  description: "Insert a table into a Google Docs document",
  inputSchema: z.object({
    documentId: z.string().describe("The ID of the document to insert table into"),
    rows: z.number().describe("Number of rows for the table"),
    columns: z.number().describe("Number of columns for the table"),
    index: z.number().optional().describe("Position to insert table (optional, defaults to end of document)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    documentId: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.docs) {
      throw new Error("Google Docs not authenticated. Please run loginTool first.");
    }

    const documentId = input.context?.documentId;
    const rows = input.context?.rows;
    const columns = input.context?.columns;
    let index = input.context?.index;
    
    if (!documentId || !rows || !columns) {
      throw new Error("Document ID, rows, and columns are required");
    }

    if (rows < 1 || columns < 1) {
      throw new Error("Rows and columns must be at least 1");
    }

    try {
      // If no index specified, get the document to find the end
      if (index === undefined) {
        const docResponse = await clients.docs.documents.get({
          documentId: documentId
        });
        
        // Find the end index of the document
        let endIndex = 1; // Default start
        if (docResponse.data.body?.content) {
          for (const element of docResponse.data.body.content) {
            if (element.endIndex) {
              endIndex = Math.max(endIndex, element.endIndex);
            }
          }
        }
        index = endIndex - 1; // Insert before the last character
      }

      // Insert the table
      const requests = [
        {
          insertTable: {
            location: {
              index: index
            },
            rows: rows,
            columns: columns
          }
        }
      ];

      await clients.docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
          requests: requests
        }
      });

      return {
        success: true,
        documentId: documentId,
        message: `✅ Table (${rows}x${columns}) inserted successfully at position ${index}`
      };

    } catch (error) {
      console.error("Table insertion error:", error);
      return {
        success: false,
        documentId: documentId,
        message: `❌ Failed to insert table. Please try again.`
      };
    }
  }
}); 