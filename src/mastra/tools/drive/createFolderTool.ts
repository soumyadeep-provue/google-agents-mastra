import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const createFolderTool = createTool({
  id: "createFolder",
  description: "Create a new folder in Google Drive. You can specify a parent folder or create it in the root.",
  inputSchema: z.object({
    name: z.string().describe("Name of the folder to create"),
    parentFolder: z.string().optional().describe("Name or ID of parent folder (optional, creates in root if not specified)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    folderId: z.string().optional(),
    folderName: z.string(),
    webViewLink: z.string().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const folderName = input.context?.name;
    const parentFolder = input.context?.parentFolder;
    
    if (!folderName) {
      throw new Error("Folder name is required");
    }

    try {
      let parentId = undefined;

      // If parent folder specified, find it
      if (parentFolder) {
        const searchResponse = await clients.drive.files.list({
          q: `name='${parentFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)'
        });

        if (searchResponse.data.files && searchResponse.data.files.length > 0) {
          parentId = searchResponse.data.files[0].id!;
        } else {
          return {
            success: false,
            folderName,
            message: `❌ Parent folder '${parentFolder}' not found. Creating folder in root instead.`
          };
        }
      }

      // Create the folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      };

      const response = await clients.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      const folder = response.data;
      const location = parentFolder ? `in folder '${parentFolder}'` : "in root";

             return {
         success: true,
         folderId: folder.id!,
         folderName: folder.name!,
         webViewLink: folder.webViewLink || undefined,
         message: `✅ Folder '${folder.name}' created successfully ${location}`
       };

    } catch (error) {
      console.error("Folder creation error:", error);
      return {
        success: false,
        folderName,
        message: `❌ Failed to create folder '${folderName}'. Please try again.`
      };
    }
  }
}); 