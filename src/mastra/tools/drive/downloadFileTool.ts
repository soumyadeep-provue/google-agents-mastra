import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";
import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";

export const downloadFileTool = createTool({
  id: "downloadFile",
  description: "Download a file from Google Drive and save it locally to your computer's Downloads folder.",
  inputSchema: z.object({
    fileName: z.string().describe("Name or ID of the file to download"),
    format: z.enum(["original", "pdf", "docx", "xlsx", "pptx"]).optional().describe("Export format for Google Docs/Sheets/Slides (default: original)"),
    localPath: z.string().optional().describe("Custom local directory path to save the file (default: ~/Downloads)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    fileName: z.string(),
    fileType: z.string(),
    localFilePath: z.string().optional(),
    fileSize: z.string().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const fileName = input.context?.fileName;
    const format = input.context?.format || "original";
    const customPath = input.context?.localPath;

    if (!fileName) {
      throw new Error("File name is required");
    }

    // Set up download directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const downloadDir = customPath || path.join(homeDir, "Downloads");
    
    // Create download directory if it doesn't exist
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    try {
      // Find the file (by name or ID)
      let searchResponse;
      
      // Check if fileName looks like a Google Drive file ID (contains alphanumeric characters and is reasonably long)
      const isFileId = /^[a-zA-Z0-9_-]{25,}$/.test(fileName);
      
      if (isFileId) {
        // Search by file ID
        try {
          const fileResponse = await clients.drive.files.get({
            fileId: fileName,
            fields: 'id, name, mimeType, size, webViewLink, webContentLink',
            supportsAllDrives: true
          });
          
          searchResponse = {
            data: {
              files: [fileResponse.data]
            }
          };
        } catch (idError) {
          // If ID search fails, try name search as fallback
          searchResponse = await clients.drive.files.list({
            q: `name='${fileName}' and trashed=false`,
            fields: 'files(id, name, mimeType, size, webViewLink, webContentLink)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
          });
        }
      } else {
        // Search by file name
        searchResponse = await clients.drive.files.list({
          q: `name='${fileName}' and trashed=false`,
          fields: 'files(id, name, mimeType, size, webViewLink, webContentLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
      }

      if (!searchResponse.data.files || searchResponse.data.files.length === 0) {
        return {
          success: false,
          fileName,
          fileType: "Unknown",
          message: `❌ File '${fileName}' not found in Google Drive.`
        };
      }

      const file = searchResponse.data.files[0];
      const fileId = file.id!;
      const mimeType = file.mimeType!;
      const fileSize = file.size ? formatFileSize(parseInt(file.size)) : "Unknown";

      // Handle Google Docs, Sheets, Slides (need export)
      if (mimeType.includes('google-apps')) {
        let exportMimeType = mimeType;
        let fileExtension = "";

        // Determine export format
        if (mimeType.includes('document')) {
          if (format === "pdf") {
            exportMimeType = "application/pdf";
            fileExtension = ".pdf";
          } else {
            exportMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            fileExtension = ".docx";
          }
        } else if (mimeType.includes('spreadsheet')) {
          if (format === "pdf") {
            exportMimeType = "application/pdf";
            fileExtension = ".pdf";
          } else {
            exportMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            fileExtension = ".xlsx";
          }
        } else if (mimeType.includes('presentation')) {
          if (format === "pdf") {
            exportMimeType = "application/pdf";
            fileExtension = ".pdf";
          } else {
            exportMimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            fileExtension = ".pptx";
          }
        }

        try {
          const exportResponse = await clients.drive.files.export({
            fileId: fileId,
            mimeType: exportMimeType
          });

          // Create local file path
          const safeFileName = sanitizeFileName(file.name! + fileExtension);
          const localFilePath = getUniqueFilePath(downloadDir, safeFileName);

          // Save exported file to disk
          if (exportMimeType.includes('text') || exportMimeType.includes('json')) {
            // Text-based content
            fs.writeFileSync(localFilePath, exportResponse.data as string, 'utf8');
          } else {
            // Binary content
            fs.writeFileSync(localFilePath, exportResponse.data as Buffer);
          }

          return {
            success: true,
            fileName: file.name! + fileExtension,
            fileType: getFileType(exportMimeType),
            localFilePath: localFilePath,
            fileSize,
            message: `✅ File '${file.name}' downloaded and saved to: ${localFilePath}`
          };
        } catch (exportError) {
          console.error("Export error:", exportError);
          return {
            success: false,
            fileName: file.name!,
            fileType: getFileType(mimeType),
            message: `❌ Failed to export '${file.name}' as ${format} format.`
          };
        }
      } else {
        // Handle regular files - download and save them locally
        try {
          const response = await clients.drive.files.get({
            fileId: fileId,
            alt: 'media'
          });

          // Create local file path
          const safeFileName = sanitizeFileName(file.name!);
          const localFilePath = getUniqueFilePath(downloadDir, safeFileName);

          // Save file to disk
          if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('csv')) {
            // Text-based content
            fs.writeFileSync(localFilePath, response.data as string, 'utf8');
          } else {
            // Binary content
            fs.writeFileSync(localFilePath, response.data as Buffer);
          }

          return {
            success: true,
            fileName: file.name!,
            fileType: getFileType(mimeType),
            localFilePath: localFilePath,
            fileSize,
            message: `✅ File '${file.name}' downloaded and saved to: ${localFilePath}`
          };
        } catch (downloadError) {
          console.error("Download error:", downloadError);
          return {
            success: false,
            fileName: file.name!,
            fileType: getFileType(mimeType),
            message: `❌ Failed to download '${file.name}': ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`
          };
        }
      }

    } catch (error) {
      console.error("File download error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        fileName,
        fileType: "Unknown",
        message: `❌ Failed to download '${fileName}': ${errorMessage}`
      };
    }
  }
});

function sanitizeFileName(fileName: string): string {
  // Remove or replace characters that are invalid in file names
  return fileName
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters with dash
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/\.+$/, '') // Remove trailing dots
    .trim();
}

function getUniqueFilePath(downloadDir: string, fileName: string): string {
  const baseName = path.parse(fileName).name;
  const extension = path.parse(fileName).ext;
  let counter = 0;
  let filePath = path.join(downloadDir, fileName);
  
  // If file exists, add a counter to make it unique
  while (fs.existsSync(filePath)) {
    counter++;
    const newFileName = `${baseName}(${counter})${extension}`;
    filePath = path.join(downloadDir, newFileName);
  }
  
  return filePath;
}

function getFileType(mimeType: string): string {
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('document')) return 'Document';
  if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
  if (mimeType.includes('presentation')) return 'Presentation';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('audio')) return 'Audio';
  if (mimeType.includes('text')) return 'Text';
  return 'File';
}

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
} 