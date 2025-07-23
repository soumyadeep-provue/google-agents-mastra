import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";
import * as fs from "fs";
import * as path from "path";

export const getAttachmentTool = createTool({
  id: "getAttachment",
  description: "Download email attachments from Gmail and save them locally to your computer.",
  inputSchema: z.object({
    messageId: z.string().optional().describe("Specific message ID containing the attachment"),
    emailSubject: z.string().optional().describe("Email subject to find and get attachments from"),
    attachmentName: z.string().optional().describe("Specific attachment name to download (optional, downloads all if not specified)"),
    localPath: z.string().optional().describe("Custom local directory to save attachments (default: ~/Downloads)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    attachments: z.array(z.object({
      filename: z.string(),
      size: z.string(),
      localPath: z.string()
    })),
    totalAttachments: z.number(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.gmail) {
      throw new Error("Gmail not authenticated. Please run loginTool first.");
    }

    const messageId = input.context?.messageId;
    const emailSubject = input.context?.emailSubject;
    const attachmentName = input.context?.attachmentName;
    const customPath = input.context?.localPath;

    if (!messageId && !emailSubject) {
      throw new Error("Must provide either messageId or emailSubject to identify the email");
    }

    // Set up download directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const downloadDir = customPath || path.join(homeDir, "Downloads");
    
    // Create download directory if it doesn't exist
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    try {
      let targetMessageId = messageId;

      // Find message by subject if messageId not provided
      if (!targetMessageId && emailSubject) {
        const searchResponse = await clients.gmail.users.messages.list({
          userId: 'me',
          q: `subject:"${emailSubject}" has:attachment`,
          maxResults: 1
        });

        if (!searchResponse.data.messages || searchResponse.data.messages.length === 0) {
          return {
            success: false,
            attachments: [],
            totalAttachments: 0,
            message: `❌ No email found with subject: "${emailSubject}" that has attachments`
          };
        }

        targetMessageId = searchResponse.data.messages[0].id!;
      }

      // Get the message with full details
      const messageResponse = await clients.gmail.users.messages.get({
        userId: 'me',
        id: targetMessageId!,
        format: 'full'
      });

      const message = messageResponse.data;
      const attachments: Array<{filename: string, size: string, localPath: string}> = [];

      // Helper function to extract attachments from parts
      const extractAttachments = async (parts: any[], prefix = '') => {
        for (const part of parts) {
          if (part.parts) {
            // Nested parts
            await extractAttachments(part.parts, prefix);
          } else if (part.body?.attachmentId && part.filename) {
            // Found an attachment
            const filename = part.filename;
            
            // Skip if specific attachment name requested and this doesn't match
            if (attachmentName && !filename.toLowerCase().includes(attachmentName.toLowerCase())) {
              continue;
            }

            try {
              // Get the attachment data
              const attachmentResponse = await clients.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: targetMessageId!,
                id: part.body.attachmentId
              });

              // Decode the attachment data
              const data = attachmentResponse.data.data!
                .replace(/-/g, '+')
                .replace(/_/g, '/');
              
              const buffer = Buffer.from(data, 'base64');
              
              // Create safe filename and unique path
              const safeFilename = sanitizeFileName(filename);
              const localFilePath = getUniqueFilePath(downloadDir, safeFilename);
              
              // Save to disk
              fs.writeFileSync(localFilePath, buffer);
              
              attachments.push({
                filename: filename,
                size: formatFileSize(buffer.length),
                localPath: localFilePath
              });

              console.log(`📎 Downloaded attachment: ${filename} to ${localFilePath}`);
              
            } catch (attachmentError) {
              console.error(`Failed to download attachment ${filename}:`, attachmentError);
            }
          }
        }
      };

      // Extract attachments from message payload
      if (message.payload?.parts) {
        await extractAttachments(message.payload.parts);
      } else if (message.payload?.body?.attachmentId && message.payload?.filename) {
        // Single attachment case
        await extractAttachments([message.payload]);
      }

      if (attachments.length === 0) {
        const searchText = attachmentName ? ` named "${attachmentName}"` : '';
        return {
          success: false,
          attachments: [],
          totalAttachments: 0,
          message: `❌ No attachments found${searchText} in the specified email`
        };
      }

      return {
        success: true,
        attachments: attachments,
        totalAttachments: attachments.length,
        message: `✅ Downloaded ${attachments.length} attachment${attachments.length > 1 ? 's' : ''} to ${downloadDir}`
      };

    } catch (error) {
      console.error("Attachment download error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        attachments: [],
        totalAttachments: 0,
        message: `❌ Failed to download attachments: ${errorMessage}`
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

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
} 