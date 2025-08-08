import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { findFilesTool } from "./findFilesTool";
import { createFolderTool } from "./createFolderTool";
import { shareFileTool } from "./shareFileTool";
import { moveFileTool } from "./moveFileTool";
import { uploadFileTool } from "./uploadFileTool";
import { downloadFileTool } from "./downloadFileTool";

export const driveTool = createTool({
  id: "drive",
  description: `A comprehensive tool for Google Drive operations: find files, create folders, share files, move files, upload, and download.

## AVAILABLE ACTIONS

### File Discovery & Search
- **"find"**: Search for files and folders in Google Drive
  - Leave query empty to get all files
  - Use specific terms to find files by name
  - Filter by MIME type (e.g., 'application/pdf', 'image/jpeg')
  - Set maxResults to limit results (default: 10)
  - Example: { action: "find", query: "presentation", mimeType: "application/vnd.google-apps.presentation" }

### Folder Management
- **"createFolder"**: Create new folders for organization
  - Provide descriptive folder names
  - Optionally specify parent folder ID
  - Returns folder ID for further operations
  - Example: { action: "createFolder", name: "Project Alpha Documents", parentId: "parent_folder_id" }

### File Operations
- **"upload"**: Upload local files to Google Drive
  - Specify local file path and optional custom name
  - Optionally place in specific parent folder
  - Supports all file types
  - Example: { action: "upload", filePath: "/Users/me/document.pdf", fileName: "Important Document.pdf" }

- **"download"**: Download files from Google Drive to local storage
  - Requires file ID and local output path
  - Preserves original file format when possible
  - Example: { action: "download", fileId: "abc123", outputPath: "/Users/me/Downloads/file.pdf" }

- **"move"**: Reorganize files by moving between folders
  - Specify file ID and destination folder ID
  - Optionally specify current parent for faster operation
  - Example: { action: "move", fileId: "abc123", newParentId: "folder456" }

### Sharing & Permissions
- **"share"**: Grant access to files and folders
  - Specify email address and permission level
  - Roles: "reader" (view), "writer" (edit), "commenter" (comment)
  - Example: { action: "share", fileId: "abc123", email: "colleague@company.com", role: "writer" }

## BEST PRACTICES

### Organization
- Use descriptive folder and file names
- Create logical folder hierarchies
- Group related files together

### Security
- Use appropriate permission levels (reader/writer/commenter)
- Regularly review sharing permissions
- Be cautious with sensitive file sharing

### Efficiency
- Search before asking users for file IDs
- Use batch operations when working with multiple files
- Cache folder IDs for organization workflows`,
  inputSchema: z.object({
    action: z.enum(["find", "createFolder", "share", "move", "upload", "download"]).describe("The action to perform"),
    
    // Find files
    query: z.string().optional().describe("Search query for files (optional for find action - leave empty to get all files)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (optional for find action, default: 10)"),
    mimeType: z.string().optional().describe("Filter by specific MIME type (optional for find action, e.g., 'application/pdf')"),
    
    // Create folder
    name: z.string().optional().describe("Name of the folder to create (required for createFolder action)"),
    parentId: z.string().optional().describe("ID of parent folder (optional for createFolder action, defaults to root)"),
    
    // Share file
    fileId: z.string().optional().describe("ID of the file (required for share/move/download actions)"),
    email: z.string().optional().describe("Email address to share with (required for share action)"),
    role: z.enum(["reader", "writer", "commenter"]).optional().describe("Permission role (optional for share action, default: reader)"),
    
    // Move file
    newParentId: z.string().optional().describe("ID of the destination folder (required for move action)"),
    oldParentId: z.string().optional().describe("ID of the current parent folder (optional for move action)"),
    
    // Upload file
    filePath: z.string().optional().describe("Local path to the file to upload (required for upload action)"),
    fileName: z.string().optional().describe("Name for the uploaded file (optional for upload action)"),
    
    // Download file
    outputPath: z.string().optional().describe("Local path where the file should be saved (required for download action)")
  }),
  execute: async ({ context }) => {
    switch (context.action) {
      case "find":
        return await findFilesTool.execute({
          context: {
            query: context.query,
            maxResults: context.maxResults,
            mimeType: context.mimeType
          }
        });
        
      case "createFolder":
        return await createFolderTool.execute({
          context: {
            name: context.name,
            parentId: context.parentId
          }
        });
        
      case "share":
        return await shareFileTool.execute({
          context: {
            fileId: context.fileId,
            email: context.email,
            role: context.role,
            shareType: "email"
          }
        });
        
      case "move":
        return await moveFileTool.execute({
          context: {
            fileId: context.fileId,
            newParentId: context.newParentId,
            oldParentId: context.oldParentId
          }
        });
        
      case "upload":
        return await uploadFileTool.execute({
          context: {
            filePath: context.filePath,
            fileName: context.fileName,
            parentId: context.parentId
          }
        });
        
      case "download":
        return await downloadFileTool.execute({
          context: {
            fileId: context.fileId,
            outputPath: context.outputPath
          }
        });
        
      default:
        throw new Error(`Unknown action: ${(context as any).action}`);
    }
  }
}); 