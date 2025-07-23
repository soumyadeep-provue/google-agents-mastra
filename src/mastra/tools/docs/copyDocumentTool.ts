import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const copyDocumentTool = createTool({
  id: "copyDocument",
  description: "Copy/duplicate a Google Docs document",
  inputSchema: z.object({
    documentId: z.string().describe("The ID of the document to copy"),
    title: z.string().optional().describe("Title for the copied document (optional)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    originalDocumentId: z.string(),
    newDocumentId: z.string().optional(),
    newTitle: z.string().optional(),
    webViewLink: z.string().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const documentId = input.context?.documentId;
    const title = input.context?.title;
    
    if (!documentId) {
      throw new Error("Document ID is required");
    }

    try {
      // Copy the document using Drive API
      const copyMetadata: any = {};
      if (title) {
        copyMetadata.name = title;
      } else {
        copyMetadata.name = "Copy of Document";
      }

      const response = await clients.drive.files.copy({
        fileId: documentId,
        requestBody: copyMetadata,
        fields: 'id, name, webViewLink'
      });

      const copiedFile = response.data;

      return {
        success: true,
        originalDocumentId: documentId,
        newDocumentId: copiedFile.id!,
        newTitle: copiedFile.name!,
        webViewLink: copiedFile.webViewLink || undefined,
        message: `✅ Document copied successfully as '${copiedFile.name}'`
      };

    } catch (error) {
      console.error("Document copy error:", error);
      return {
        success: false,
        originalDocumentId: documentId,
        message: `❌ Failed to copy document. Please check the document ID and try again.`
      };
    }
  }
}); 