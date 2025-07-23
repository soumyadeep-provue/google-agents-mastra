import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const deleteContentTool = createTool({
  id: "deleteContent",
  description: "Delete content from a Google Docs document within a specified range",
  inputSchema: z.object({
    documentId: z.string().describe("The ID of the document to modify"),
    startIndex: z.number().describe("Start position of content to delete"),
    endIndex: z.number().describe("End position of content to delete")
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
    const startIndex = input.context?.startIndex;
    const endIndex = input.context?.endIndex;
    
    if (!documentId || startIndex === undefined || endIndex === undefined) {
      throw new Error("Document ID, startIndex, and endIndex are required");
    }

    if (startIndex >= endIndex) {
      throw new Error("startIndex must be less than endIndex");
    }

    try {
      // Delete the content range
      const requests = [
        {
          deleteContentRange: {
            range: {
              startIndex: startIndex,
              endIndex: endIndex
            }
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
        message: `✅ Deleted content from index ${startIndex} to ${endIndex}`
      };

    } catch (error) {
      console.error("Content deletion error:", error);
      return {
        success: false,
        documentId: documentId,
        message: `❌ Failed to delete content from document. Please check the indices and try again.`
      };
    }
  }
}); 