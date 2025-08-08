import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const moveFileTool = createTool({
  id: "moveFile",
  description: "Move a file or folder to a different location in Google Drive. You can move to a specific folder or to the root.",
  inputSchema: z.object({
    fileName: z.string().optional().describe("Name of the file/folder to move"),
    fileId: z.string().optional().describe("ID of the file/folder to move"),
    targetFolder: z.string().optional().describe("Name of destination folder (leave empty to move to root)"),
    newParentId: z.string().optional().describe("ID of destination folder (leave empty to move to root)"),
    oldParentId: z.string().optional().describe("ID of current parent folder (optional)")
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
    const fileId = input.context?.fileId;
    const targetFolder = input.context?.targetFolder;
    const newParentId = input.context?.newParentId;
    const oldParentId = input.context?.oldParentId;

    // We need either fileName or fileId
    if (!fileName && !fileId) {
      throw new Error("Either file name or file ID is required");
    }

    try {
      let file;
      let fileIdToUse;

      // If we have fileId, use it directly, otherwise search by name
      if (fileId) {
        const fileResponse = await clients.drive.files.get({
          fileId: fileId,
          fields: 'id, name, parents'
        });
        file = fileResponse.data;
        fileIdToUse = fileId;
      } else {
        // Find the file/folder by name
        const fileSearchResponse = await clients.drive.files.list({
          q: `name='${fileName}' and trashed=false`,
          fields: 'files(id, name, parents)'
        });
        
        if (!fileSearchResponse.data.files || fileSearchResponse.data.files.length === 0) {
          return {
            success: false,
            fileName: fileName || fileId || "Unknown",
            fromLocation: "Unknown",
            toLocation: targetFolder || newParentId || "Root",
            message: `❌ File or folder '${fileName}' not found.`
          };
        }
        
        file = fileSearchResponse.data.files[0];
        fileIdToUse = file.id!;
      }


      const currentParents = file.parents || [];

      let targetFolderId = newParentId || null;
      let targetLocationName = "Root";

      // Find target folder if specified (either by name or ID)
      if (targetFolder && !newParentId) {
        const folderSearchResponse = await clients.drive.files.list({
          q: `name='${targetFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)'
        });

        if (!folderSearchResponse.data.files || folderSearchResponse.data.files.length === 0) {
          return {
            success: false,
            fileName: fileName || file.name || "Unknown",
            fromLocation: "Unknown",
            toLocation: targetFolder,
            message: `❌ Target folder '${targetFolder}' not found.`
          };
        }

        targetFolderId = folderSearchResponse.data.files[0].id!;
        targetLocationName = folderSearchResponse.data.files[0].name!;
      } else if (newParentId) {
        // If we have newParentId, try to get the folder name for better messaging
        try {
          const folderResponse = await clients.drive.files.get({
            fileId: newParentId,
            fields: 'name'
          });
          targetLocationName = folderResponse.data.name || "Unknown Folder";
        } catch (error) {
          targetLocationName = "Target Folder";
        }
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
        fileId: fileIdToUse,
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
        fileName: fileName || fileId || "Unknown",
        fromLocation: "Unknown", 
        toLocation: targetFolder || newParentId || "Root",
        message: `❌ Failed to move '${fileName || fileId}'. Please try again.`
      };
    }
  }
}); 