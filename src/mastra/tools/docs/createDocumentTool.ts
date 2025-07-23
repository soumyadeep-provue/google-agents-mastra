import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const createDocumentTool = createTool({
  id: "createDocument",
  description: "Create a new Google Docs document with an optional title",
  inputSchema: z.object({
    title: z.string().optional().describe("Title of the document (optional)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    documentId: z.string().optional(),
    title: z.string(),
    webViewLink: z.string().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.docs) {
      throw new Error("Google Docs not authenticated. Please run loginTool first.");
    }

    const title = input.context?.title || "Untitled Document";

    try {
      // Create the document
      const response = await clients.docs.documents.create({
        requestBody: {
          title: title
        }
      });

      const document = response.data;
      
      // Get the web view link from Drive API
      let webViewLink;
      if (clients.drive && document.documentId) {
        try {
          const driveResponse = await clients.drive.files.get({
            fileId: document.documentId,
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
        title: document.title || title,
        webViewLink: webViewLink || undefined,
        message: `✅ Document '${document.title || title}' created successfully`
      };

    } catch (error) {
      console.error("Document creation error:", error);
      return {
        success: false,
        title,
        message: `❌ Failed to create document '${title}'. Please try again.`
      };
    }
  }
}); 