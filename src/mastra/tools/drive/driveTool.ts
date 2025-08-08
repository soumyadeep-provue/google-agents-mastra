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
    action: z.enum(["find", "createFolder", "share", "move", "upload", "download"]).optional().describe("The specific Google Drive action to perform. If unclear or missing, will be handled by Drive specialist agent."),
    
    // Find files
    query: z.string().optional().describe("Search query for files (for find action - leave empty to get all files)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (for find action, default: 10)"),
    mimeType: z.string().optional().describe("Filter by specific MIME type (for find action, e.g., 'application/pdf')"),
    
    // Create folder
    name: z.string().optional().describe("Name of the folder to create (for createFolder action)"),
    parentId: z.string().optional().describe("ID of parent folder (for createFolder/upload actions, defaults to root)"),
    
    // Share file
    fileId: z.string().optional().describe("ID of the file (for share/move/download actions)"),
    email: z.string().optional().describe("Email address to share with (for share action)"),
    role: z.enum(["reader", "writer", "commenter"]).optional().describe("Permission role (for share action, default: reader)"),
    
    // Move file
    newParentId: z.string().optional().describe("ID of the destination folder (for move action)"),
    oldParentId: z.string().optional().describe("ID of the current parent folder (for move action)"),
    
    // Upload file
    filePath: z.string().optional().describe("Local path to the file to upload (for upload action)"),
    fileName: z.string().optional().describe("Name for the uploaded file (for upload action)"),
    
    // Download file
    outputPath: z.string().optional().describe("Local path where the file should be saved (for download action)"),
    
    // Fallback context for Drive specialist agent
    userIntent: z.string().optional().describe("Natural language description of what you want to do with Google Drive (used when action is unclear)")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    // Handle cases where action is missing - provide helpful guidance
    if (!context.action) {
      return {
        success: false,
        message: "I can help you with Google Drive tasks! Please specify what you'd like to do. For example:\n- Find files or folders (with optional search terms)\n- Create a new folder (provide folder name)\n- Share files with others (provide file ID and email)\n- Move files between folders\n- Upload local files to Drive\n- Download files to your computer",
        availableActions: ["find", "createFolder", "share", "move", "upload", "download"]
      };
    }

    // Validate required fields for each action and provide helpful guidance
    switch (context.action) {
      case "find":
        // Find doesn't require any fields - can search all files
        return await findFilesTool.execute({
          context: {
            query: context.query,
            maxResults: context.maxResults,
            mimeType: context.mimeType
          }
        });
        
      case "createFolder":
        if (!context.name) {
          return {
            success: false,
            message: "To create a folder, I need:\n- **Folder Name**: What would you like to name the folder?",
            required: ["name"],
            optional: ["parentId"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await createFolderTool.execute({
          context: {
            name: context.name,
            parentId: context.parentId
          }
        });
        
      case "share":
        if (!context.fileId || !context.email) {
          return {
            success: false,
            message: "To share a file, I need:\n- **File ID**: Which file would you like to share?\n- **Email**: Who should receive access to the file?",
            required: ["fileId", "email"],
            optional: ["role"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await shareFileTool.execute({
          context: {
            fileId: context.fileId,
            email: context.email,
            role: context.role
          }
        });
        
      case "move":
        if (!context.fileId || !context.newParentId) {
          return {
            success: false,
            message: "To move a file, I need:\n- **File ID**: Which file would you like to move?\n- **New Parent ID**: Which folder should it be moved to?",
            required: ["fileId", "newParentId"],
            optional: ["oldParentId"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await moveFileTool.execute({
          context: {
            fileId: context.fileId,
            newParentId: context.newParentId,
            oldParentId: context.oldParentId
          }
        });
        
      case "upload":
        if (!context.filePath) {
          return {
            success: false,
            message: "To upload a file, I need:\n- **File Path**: What is the local path to the file you want to upload?",
            required: ["filePath"],
            optional: ["fileName", "parentId"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await uploadFileTool.execute({
          context: {
            filePath: context.filePath,
            fileName: context.fileName,
            parentId: context.parentId
          }
        });
        
      case "download":
        if (!context.fileId || !context.outputPath) {
          return {
            success: false,
            message: "To download a file, I need:\n- **File ID**: Which file would you like to download?\n- **Output Path**: Where should I save the file on your computer?",
            required: ["fileId", "outputPath"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await downloadFileTool.execute({
          context: {
            fileId: context.fileId,
            outputPath: context.outputPath
          }
        });
        
      default:
        // Fallback to Drive specialist agent for unknown actions
        console.log(`🔄 Drive action unclear or unknown: "${context.action}". Delegating to Drive specialist agent...`);
        
        if (!mastra) {
          return {
            success: false,
            message: `Unknown Google Drive action: "${context.action}". Available actions are:\n- find: Search for files and folders\n- createFolder: Create new folders\n- share: Grant access to files/folders\n- move: Move files between folders\n- upload: Upload local files to Drive\n- download: Download files to your computer`,
            availableActions: ["find", "createFolder", "share", "move", "upload", "download"],
            unknownAction: context.action
          };
        }

        const driveAgent = mastra.getAgent("driveAgent");
        if (!driveAgent) {
          return {
            success: false,
            message: `Unknown Google Drive action: "${context.action}". Available actions are:\n- find: Search for files and folders\n- createFolder: Create new folders\n- share: Grant access to files/folders\n- move: Move files between folders\n- upload: Upload local files to Drive\n- download: Download files to your computer`,
            availableActions: ["find", "createFolder", "share", "move", "upload", "download"],
            unknownAction: context.action
          };
        }

        // Create a natural language prompt for the Drive specialist
        const contextDescription = Object.entries(context)
          .filter(([key, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(", ");

        const prompt = `I need help with a Google Drive task. Here's the context I received: ${contextDescription}

Please analyze this and perform the appropriate Google Drive operation. If you need authentication, use the loginTool first.`;

        try {
          const result = await driveAgent.generate(prompt, {
            memory: threadId && resourceId ? {
              thread: threadId,
              resource: resourceId,
            } : undefined,
            maxSteps: 8,
          });

          return {
            success: true,
            message: "✅ Google Drive task completed by specialist agent",
            specialistResponse: result.text,
            delegatedAction: true,
            originalContext: context,
          };
        } catch (error) {
          console.error("Drive specialist agent failed:", error);
          return {
            success: false,
            message: `Drive specialist agent failed to process the request. Available actions are:\n- find: Search for files and folders\n- createFolder: Create new folders\n- share: Grant access to files/folders\n- move: Move files between folders\n- upload: Upload local files to Drive\n- download: Download files to your computer`,
            error: error instanceof Error ? error.message : 'Unknown error',
            availableActions: ["find", "createFolder", "share", "move", "upload", "download"]
          };
        }
    }
  }
}); 