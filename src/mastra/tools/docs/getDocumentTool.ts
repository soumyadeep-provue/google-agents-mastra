import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const getDocumentTool = createTool({
  id: "getDocument",
  description: "Get a Google Docs document by its ID",
  inputSchema: z.object({
    documentId: z.string().describe("The ID of the document to retrieve")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    documentId: z.string().optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    webViewLink: z.string().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.docs) {
      throw new Error("Google Docs not authenticated. Please run loginTool first.");
    }

    const documentId = input.context?.documentId;
    
    if (!documentId) {
      throw new Error("Document ID is required");
    }

    try {
      // Get the document
      const response = await clients.docs.documents.get({
        documentId: documentId
      });

      const document = response.data;
      
      // Extract text content from the document
      let content = "";
      if (document.body?.content) {
        for (const element of document.body.content) {
          if (element.paragraph?.elements) {
            for (const textElement of element.paragraph.elements) {
              if (textElement.textRun?.content) {
                content += textElement.textRun.content;
              }
            }
          }
        }
      }

      // Get the web view link from Drive API
      let webViewLink;
      if (clients.drive) {
        try {
          const driveResponse = await clients.drive.files.get({
            fileId: documentId,
            fields: 'webViewLink'
          });
          webViewLink = driveResponse.data.webViewLink;
        } catch (error) {
          console.log("Could not get web view link:", error);
        }
      }

      return {
        success: true,
        documentId: document.documentId!,
        title: document.title || "Untitled Document",
        content: content.trim(),
        webViewLink: webViewLink || undefined,
        message: `✅ Document '${document.title}' retrieved successfully`
      };

    } catch (error) {
      console.error("Document retrieval error:", error);
      return {
        success: false,
        message: `❌ Failed to retrieve document with ID '${documentId}'. Please check the ID and try again.`
      };
    }
  }
}); 