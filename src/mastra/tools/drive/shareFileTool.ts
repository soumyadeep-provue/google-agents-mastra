import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const shareFileTool = createTool({
  id: "shareFile",
  description: "Share a file or folder in Google Drive with specific people or create a shareable link. You can set different permission levels.",
  inputSchema: z.object({
    fileName: z.string().optional().describe("Name of the file/folder to share"),
    fileId: z.string().optional().describe("ID of the file/folder to share"),
    shareWith: z.string().optional().describe("Email address to share with (optional, creates public link if not specified)"),
    email: z.string().optional().describe("Email address to share with (alternative parameter name)"),
    permission: z.enum(["view", "edit", "comment"]).optional().describe("Permission level (default: view)"),
    role: z.enum(["reader", "writer", "commenter"]).optional().describe("Permission role (alternative parameter name)"),
    shareType: z.enum(["email", "link", "public"]).optional().describe("How to share: email (specific person), link (anyone with link), public (anyone can find)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    fileName: z.string(),
    shareLink: z.string().optional(),
    sharedWith: z.string().optional(),
    permission: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const fileName = input.context?.fileName;
    const fileId = input.context?.fileId;
    const shareWith = input.context?.shareWith || input.context?.email;
    const permission = input.context?.permission || (input.context?.role === "writer" ? "edit" : 
                      input.context?.role === "commenter" ? "comment" : "view");
    const shareType = input.context?.shareType || (shareWith ? "email" : "link");

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
          fields: 'id, name, mimeType, webViewLink'
        });
        file = fileResponse.data;
        fileIdToUse = fileId;
      } else {
        // Find the file/folder by name
        const searchResponse = await clients.drive.files.list({
          q: `name='${fileName}' and trashed=false`,
          fields: 'files(id, name, mimeType, webViewLink)'
        });

        if (!searchResponse.data.files || searchResponse.data.files.length === 0) {
          return {
            success: false,
            fileName: fileName || fileId || "Unknown",
            permission,
            message: `❌ File or folder '${fileName}' not found.`
          };
        }

        file = searchResponse.data.files[0];
        fileIdToUse = file.id!;
      }

      // Set up permission based on share type
      let permissionResource: any = {
        role: permission === "edit" ? "writer" : permission === "comment" ? "commenter" : "reader"
      };

      if (shareType === "email" && shareWith) {
        // Share with specific person
        permissionResource.type = "user";
        permissionResource.emailAddress = shareWith;
        
        await clients.drive.permissions.create({
          fileId: fileIdToUse,
          requestBody: permissionResource,
          sendNotificationEmail: true
        });

        return {
          success: true,
          fileName: file.name!,
          sharedWith: shareWith,
          permission,
          message: `✅ '${file.name}' shared with ${shareWith} (${permission} access)`
        };

      } else if (shareType === "link") {
        // Create shareable link (anyone with link)
        permissionResource.type = "anyone";
        
        await clients.drive.permissions.create({
          fileId: fileIdToUse,
          requestBody: permissionResource
        });

        return {
          success: true,
          fileName: file.name!,
          shareLink: file.webViewLink!,
          permission,
          message: `✅ '${file.name}' is now shareable via link (${permission} access)`
        };

      } else if (shareType === "public") {
        // Make publicly discoverable
        permissionResource.type = "anyone";
        permissionResource.allowFileDiscovery = true;
        
        await clients.drive.permissions.create({
          fileId: fileIdToUse,
          requestBody: permissionResource
        });

        return {
          success: true,
          fileName: file.name!,
          shareLink: file.webViewLink!,
          permission,
          message: `✅ '${file.name}' is now public and discoverable (${permission} access)`
        };
      }

      return {
        success: false,
        fileName,
        permission,
        message: "❌ Invalid share configuration"
      };

    } catch (error) {
      console.error("File sharing error:", error);
      return {
        success: false,
        fileName: fileName || fileId || "Unknown",
        permission,
        message: `❌ Failed to share '${fileName || fileId}'. Please try again.`
      };
    }
  }
}); 