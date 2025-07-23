import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const insertTextTool = createTool({
  id: "insertText",
  description: "Insert text into a Google Docs document at a specific location or at the end",
  inputSchema: z.object({
    documentId: z.string().describe("The ID of the document to insert text into"),
    text: z.string().describe("The text to insert"),
    index: z.number().optional().describe("Position to insert text (optional, defaults to end of document)")
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
    const text = input.context?.text;
    let index = input.context?.index;
    
    if (!documentId || !text) {
      throw new Error("Document ID and text are required");
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
        index = endIndex - 1; // Insert before the last character (usually a newline)
      }

      // Insert the text
      const requests = [
        {
          insertText: {
            location: {
              index: index
            },
            text: text
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
        message: `✅ Text inserted successfully into document`
      };

    } catch (error) {
      console.error("Text insertion error:", error);
      return {
        success: false,
        documentId: documentId,
        message: `❌ Failed to insert text into document. Please try again.`
      };
    }
  }
}); 