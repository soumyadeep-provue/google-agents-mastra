import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

/**
 * Find Files Tool - Reliable Google Drive Search
 * 
 * Handles common queries:
 * - "what's in my drive" / "list all files" / "show everything"
 * - "what's in test folder" / "contents of folder X"
 * - "find file X" / "search for Y"
 * - "find all folders" / "show all documents"
 */

export const findFilesTool = createTool({
  id: "findFiles",
  description: "Find files and folders in Google Drive. Use queries like: 'what's in my drive', 'what's in test folder', 'find file X', 'show all folders', etc.",
  inputSchema: z.object({
    query: z.string().describe("Search query - examples: 'what's in my drive', 'contents of test folder', 'find klavis txt', 'show all folders'"),
    maxResults: z.number().optional().describe("Maximum number of files to return (default: 50)")
  }),
  outputSchema: z.object({
    files: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      size: z.string().optional(),
      modifiedTime: z.string(),
      webViewLink: z.string().optional(),
      owners: z.array(z.string()).optional(),
      shared: z.boolean(),
      parentFolder: z.string().optional()
    })),
    totalFound: z.number(),
    searchQuery: z.string(),
    searchType: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.drive) {
      throw new Error("Google Drive not authenticated. Please run loginTool first.");
    }

    const userQuery = input.context?.query || "";
    const maxResults = input.context?.maxResults || 50;
    const lowerQuery = userQuery.toLowerCase().trim();
    
    console.log(`🔍 Processing query: "${userQuery}"`);
    
    let driveQuery = "";
    let searchType = "general";
    let targetFolderName = "";

    // 1. GENERAL DRIVE CONTENT QUERIES
    if (lowerQuery.includes("what's in my drive") || 
        lowerQuery.includes("whats in my drive") ||
        lowerQuery.includes("list all") ||
        lowerQuery.includes("show everything") ||
        lowerQuery.includes("what is in the drive") ||
        lowerQuery.includes("whats in the drive")) {
      
      driveQuery = "trashed=false";
      searchType = "all_content";
      console.log("📁 Searching for all content in Drive");
    }
    
    // 2. FOLDER CONTENT QUERIES
    else if (lowerQuery.includes("what's in") && lowerQuery.includes("folder") ||
             lowerQuery.includes("whats in") && lowerQuery.includes("folder") ||
             lowerQuery.includes("contents of")) {
      
      // Extract folder name from query
      const folderMatch = lowerQuery.match(/(?:what's in|whats in|contents of)\s+(?:the\s+)?([^?\s]+)(?:\s+folder)?/);
      if (folderMatch) {
        targetFolderName = folderMatch[1].trim();
        searchType = "folder_contents";
        console.log(`📂 Searching for contents of folder: "${targetFolderName}"`);
      } else {
        driveQuery = "trashed=false";
        searchType = "all_content";
      }
    }
    
    // 3. FOLDER LISTING QUERIES
    else if (lowerQuery.includes("folders") || lowerQuery.includes("all folders") || lowerQuery.includes("fetch all the folders")) {
      driveQuery = "mimeType='application/vnd.google-apps.folder' and trashed=false";
      searchType = "folders_only";
      console.log("📁 Searching for all folders");
    }
    
    // 4. FILE TYPE SPECIFIC QUERIES
    else if (lowerQuery.includes("documents") || lowerQuery.includes("docs")) {
      driveQuery = "(mimeType='application/vnd.google-apps.document' or mimeType contains 'document') and trashed=false";
      searchType = "documents";
    }
    else if (lowerQuery.includes("spreadsheets") || lowerQuery.includes("sheets")) {
      driveQuery = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
      searchType = "spreadsheets";
    }
    else if (lowerQuery.includes("presentations") || lowerQuery.includes("slides")) {
      driveQuery = "mimeType='application/vnd.google-apps.presentation' and trashed=false";
      searchType = "presentations";
    }
    else if (lowerQuery.includes("images") || lowerQuery.includes("photos")) {
      driveQuery = "mimeType contains 'image/' and trashed=false";
      searchType = "images";
    }
    
    // 5. SPECIFIC FILE SEARCH
    else {
      // Remove common words and search for file name
      const cleanQuery = userQuery.replace(/^(find|search|locate)\s+/i, "").trim();
      driveQuery = `name contains '${cleanQuery}' and trashed=false`;
      searchType = "file_search";
      console.log(`🔎 Searching for files containing: "${cleanQuery}"`);
    }

    try {
      let files: any[] = [];
      
      // Handle folder content search separately
      if (searchType === "folder_contents" && targetFolderName) {
        // First, find the folder
        const folderResponse = await clients.drive.files.list({
          q: `name='${targetFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        if (folderResponse.data.files && folderResponse.data.files.length > 0) {
          const folderId = folderResponse.data.files[0].id;
          
          // Then, find contents of that folder
          const contentResponse = await clients.drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            pageSize: maxResults,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, owners, shared, parents)',
            orderBy: 'folder,name',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
          });
          
          files = contentResponse.data.files || [];
          driveQuery = `Contents of folder '${targetFolderName}'`;
        } else {
          return {
            files: [],
            totalFound: 0,
            searchQuery: `Folder '${targetFolderName}' not found`,
            searchType: "folder_not_found"
          };
        }
      } else {
        // Regular search
        const response = await clients.drive.files.list({
          q: driveQuery,
          pageSize: maxResults,
          fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, owners, shared, parents)',
          orderBy: 'folder,name',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        files = response.data.files || [];
      }
      
      // Get parent folder names for context (limit to avoid too many API calls)
      const parentFolderNames = new Map<string, string>();
      
      if (files.length > 0 && files.length <= 20) { // Only fetch parent names for reasonable result sets
        const allParentIds = [...new Set(files.flatMap(f => f.parents || []))].slice(0, 10); // Limit to 10 parent lookups
        
        // Fetch parent folder names individually (Google Drive API doesn't support id searches in queries)
        for (const parentId of allParentIds) {
          try {
            const parentFile = await clients.drive.files.get({
              fileId: parentId,
              fields: 'id, name',
              supportsAllDrives: true
            });
            
            if (parentFile.data.id && parentFile.data.name) {
              parentFolderNames.set(parentFile.data.id, parentFile.data.name);
            }
          } catch (error) {
            // If we can't get parent folder name, just skip it - this is optional info
            continue;
          }
        }
      }
      
      const formattedFiles = files.map(file => {
        const parentId = file.parents?.[0];
        const parentName = parentId ? parentFolderNames.get(parentId) : undefined;
        
        return {
          id: file.id!,
          name: file.name || "Unknown",
          type: getFileType(file.mimeType || ""),
          size: file.size ? formatFileSize(parseInt(file.size)) : undefined,
          modifiedTime: formatDate(file.modifiedTime || ""),
          webViewLink: file.webViewLink || undefined,
          owners: file.owners?.map((owner: any) => owner.displayName || owner.emailAddress || "Unknown") || [],
          shared: file.shared || false,
          parentFolder: parentName || (parentId ? "Unknown Folder" : "Root")
        };
      });

      console.log(`✅ Found ${formattedFiles.length} items`);
      
      return {
        files: formattedFiles,
        totalFound: formattedFiles.length,
        searchQuery: driveQuery,
        searchType: searchType
      };
      
    } catch (error) {
      console.error("Drive search error:", error);
      throw new Error(`Failed to search Google Drive: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
});

function getFileType(mimeType: string): string {
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('document')) return 'Document';
  if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
  if (mimeType.includes('presentation')) return 'Presentation';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('audio')) return 'Audio';
  if (mimeType.includes('text')) return 'Text File';
  return 'File';
}

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  if (!dateString) return "Unknown";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch {
    return dateString;
  }
} 