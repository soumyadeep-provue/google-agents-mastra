import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const moveFileTool = createTool({
  id: "moveFile",
  description: "Move a file or folder to a different location in Google Drive. You can move to a specific folder or to the root.",
  inputSchema: z.object({
    fileName: z.string().describe("Name or ID of the file/folder to move"),
    targetFolder: z.string().optional().describe("Name or ID of destination folder (leave empty to move to root)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    fileName: z.string(),
    fromLocation: z.string(),
    toLocation: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const fileName = input.context?.fileName;
    const targetFolder = input.context?.targetFolder;

    if (!fileName) {
      throw new Error("File name is required");
    }

    try {
      // Find the file/folder to move
      const fileSearchResponse = await clients.drive.files.list({
        q: `name='${fileName}' and trashed=false`,
        fields: 'files(id, name, parents)'
      });

      if (!fileSearchResponse.data.files || fileSearchResponse.data.files.length === 0) {
        return {
          success: false,
          fileName,
          fromLocation: "Unknown",
          toLocation: targetFolder || "Root",
          message: `❌ File or folder '${fileName}' not found.`
        };
      }

      const file = fileSearchResponse.data.files[0];
      const fileId = file.id!;
      const currentParents = file.parents || [];

      let targetFolderId = null;
      let targetLocationName = "Root";

      // Find target folder if specified
      if (targetFolder) {
        const folderSearchResponse = await clients.drive.files.list({
          q: `name='${targetFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)'
        });

        if (!folderSearchResponse.data.files || folderSearchResponse.data.files.length === 0) {
          return {
            success: false,
            fileName,
            fromLocation: "Unknown",
            toLocation: targetFolder,
            message: `❌ Target folder '${targetFolder}' not found.`
          };
        }

        targetFolderId = folderSearchResponse.data.files[0].id!;
        targetLocationName = folderSearchResponse.data.files[0].name!;
      }

      // Get current parent folder name for better messaging
      let fromLocationName = "Root";
      if (currentParents.length > 0) {
        try {
          const parentResponse = await clients.drive.files.get({
            fileId: currentParents[0],
            fields: 'name'
          });
          fromLocationName = parentResponse.data.name || "Unknown Folder";
        } catch (error) {
          fromLocationName = "Unknown Folder";
        }
      }

      // Move the file
      const updateRequest: any = {
        fileId: fileId,
        addParents: targetFolderId || undefined,
        removeParents: currentParents.join(',') || undefined,
        fields: 'id, parents'
      };

      // Remove undefined properties
      if (!updateRequest.addParents) delete updateRequest.addParents;
      if (!updateRequest.removeParents) delete updateRequest.removeParents;

      await clients.drive.files.update(updateRequest);

      return {
        success: true,
        fileName: file.name!,
        fromLocation: fromLocationName,
        toLocation: targetLocationName,
        message: `✅ '${file.name}' moved from '${fromLocationName}' to '${targetLocationName}'`
      };

    } catch (error) {
      console.error("File move error:", error);
      return {
        success: false,
        fileName,
        fromLocation: "Unknown",
        toLocation: targetFolder || "Root",
        message: `❌ Failed to move '${fileName}'. Please try again.`
      };
    }
  }
}); 