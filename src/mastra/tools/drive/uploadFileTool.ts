import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

/**
 * Upload File Tool - Google Drive API v3 Compliant
 * 
 * Implements multipart upload as per Google Drive API specification:
 * https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create
 * 
 * Features:
 * - Supports both My Drive and shared drives (supportsAllDrives: true)
 * - Text files are automatically made searchable (useContentAsIndexableText)
 * - Auto-detects MIME types from file extensions
 * - Handles both text and binary content (base64 encoded)
 */

export const uploadFileTool = createTool({
  id: "uploadFile",
  description: "Upload a file to Google Drive using multipart upload. Supports both My Drive and shared drives. Text files are made searchable automatically.",
  inputSchema: z.object({
    fileName: z.string().describe("Name for the file in Drive (include extension)"),
    fileContent: z.string().describe("File content - can be plain text or base64 encoded data"),
    mimeType: z.string().optional().describe("MIME type of the file (auto-detected from extension if not provided)"),
    folder: z.string().optional().describe("Name of destination folder (optional, uploads to root if not specified)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    fileId: z.string().optional(),
    fileName: z.string(),
    webViewLink: z.string().optional(),
    location: z.string(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const fileName = input.context?.fileName;
    const fileContent = input.context?.fileContent;
    const folder = input.context?.folder;

    if (!fileName || !fileContent) {
      throw new Error("File name and content are required");
    }

    // Auto-detect MIME type from file extension if not provided
    let mimeType = input.context?.mimeType;
    if (!mimeType) {
      const extension = fileName.split('.').pop()?.toLowerCase();
      mimeType = getMimeTypeFromExtension(extension || '');
    }

    console.log(`Starting upload: ${fileName} (${mimeType})`);
    console.log(`Content length: ${fileContent.length} characters`);

    try {
      let parentId = undefined;
      let locationName = "Root";

      // Find destination folder if specified
      if (folder) {
        const folderSearchResponse = await clients.drive.files.list({
          q: `name='${folder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
          supportsAllDrives: true, // Support both My Drive and shared drives
          includeItemsFromAllDrives: true // Include files from all drives user has access to
        });

        if (folderSearchResponse.data.files && folderSearchResponse.data.files.length > 0) {
          parentId = folderSearchResponse.data.files[0].id!;
          locationName = folderSearchResponse.data.files[0].name!;
        } else {
          return {
            success: false,
            fileName,
            location: folder,
            message: `❌ Folder '${folder}' not found. Please create it first or upload to root.`
          };
        }
      }

      // Prepare file metadata
      const fileMetadata = {
        name: fileName,
        parents: parentId ? [parentId] : undefined
      };

      // Prepare content for upload
      let uploadContent: string | Buffer;
      
      // Simple approach: if it's a text-based MIME type, use as string, otherwise try base64
      if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) {
        uploadContent = fileContent;
        console.log("Uploading as text content");
      } else {
        // For binary files, expect base64 and decode it
        try {
          uploadContent = Buffer.from(fileContent, 'base64');
          console.log("Uploading as base64 decoded binary content");
        } catch (error) {
          // If base64 decode fails, upload as text anyway
          uploadContent = fileContent;
          console.log("Base64 decode failed, uploading as text");
        }
      }

      console.log(`Uploading to ${locationName}: ${fileName} (${mimeType})`);
      
      // Upload the file following Google Drive API v3 specification
      // Using multipart upload as per: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create
      const response = await clients.drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: mimeType,
          body: uploadContent
        },
        // Required parameters according to API documentation
        uploadType: 'multipart', // Since we're uploading both metadata and media
        supportsAllDrives: true, // Support both My Drive and shared drives
        useContentAsIndexableText: mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml'), // Make text files searchable
        fields: 'id, name, webViewLink, size, parents, mimeType'
      });

      const uploadedFile = response.data;

      return {
        success: true,
        fileId: uploadedFile.id!,
        fileName: uploadedFile.name!,
        webViewLink: uploadedFile.webViewLink || undefined,
        location: locationName,
        message: `✅ File '${uploadedFile.name}' uploaded successfully to '${locationName}' (${uploadedFile.size ? `${uploadedFile.size} bytes, ` : ''}${mimeType})`
      };

    } catch (error) {
      console.error("File upload error:", error);
      let errorMessage = "Unknown error";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages for common Google Drive API errors
        if (errorMessage.includes('insufficient permissions')) {
          errorMessage = "Insufficient permissions. Please ensure you have write access to the destination folder.";
        } else if (errorMessage.includes('quota')) {
          errorMessage = "Google Drive storage quota exceeded. Please free up space or upgrade your storage.";
        } else if (errorMessage.includes('invalid credentials')) {
          errorMessage = "Authentication expired. Please run the login tool again.";
        }
      }
      
      return {
        success: false,
        fileName,
        location: folder || "Root",
        message: `❌ Failed to upload '${fileName}': ${errorMessage}`
      };
    }
  }
});

// Helper function to determine MIME type from file extension
function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    // Text files
    'txt': 'text/plain',
    'md': 'text/markdown',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'csv': 'text/csv',
    'xml': 'text/xml',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    
    // Audio/Video
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime'
  };

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
} 