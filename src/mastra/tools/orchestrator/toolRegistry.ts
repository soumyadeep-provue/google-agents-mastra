// Tool Registry - Maps agent IDs to their tools for dynamic loading

// Import all tools from existing agents
import { loginTool } from "../auth/loginTool";
import { logoutTool } from "../auth/logoutTool";

// Gmail tools
import { getEmailsTool } from "../gmail/getEmailsTool";
import { sendMessageTool } from "../gmail/sendEmailTool";
import { createDraftTool } from "../gmail/createDraftTool";
import { replyToThreadTool } from "../gmail/replyToThreadTool";
import { getAttachmentTool } from "../gmail/getAttachmentTool";
import { addLabelTool } from "../gmail/addLabelTool";
import { listLabelsTool } from "../gmail/listLabelsTool";

// Drive tools
import { findFilesTool } from "../drive/findFilesTool";
import { createFolderTool } from "../drive/createFolderTool";
import { shareFileTool } from "../drive/shareFileTool";
import { moveFileTool } from "../drive/moveFileTool";
import { uploadFileTool } from "../drive/uploadFileTool";
import { downloadFileTool } from "../drive/downloadFileTool";

// Docs tools
import { searchDocumentsTool } from "../docs/searchDocumentsTool";
import { getDocumentTool } from "../docs/getDocumentTool";
import { createDocumentTool } from "../docs/createDocumentTool";
import { insertTextTool } from "../docs/insertTextTool";
import { replaceTextTool } from "../docs/replaceTextTool";
import { deleteContentTool } from "../docs/deleteContentTool";
import { insertTableTool } from "../docs/insertTableTool";
import { copyDocumentTool } from "../docs/copyDocumentTool";

// Sheets tools
import { searchSpreadsheetsTool } from "../sheets/searchSpreadsheetsTool";
import { getSpreadsheetTool } from "../sheets/getSpreadsheetTool";
import { createSpreadsheetTool } from "../sheets/createSpreadsheetTool";
import { addSheetTool } from "../sheets/addSheetTool";
import { deleteSheetTool } from "../sheets/deleteSheetTool";
import { batchGetValuesTool } from "../sheets/batchGetValuesTool";
import { batchUpdateValuesTool } from "../sheets/batchUpdateValuesTool";
import { appendValuesTool } from "../sheets/appendValuesTool";
import { clearValuesTool } from "../sheets/clearValuesTool";

// Maps tools
import { textSearchTool } from "../maps/textSearchTool";
import { getDirectionsTool } from "../maps/getDirectionsTool";
import { nearbySearchTool } from "../maps/nearbySearchTool";
import { geocodingTool } from "../maps/geocodingTool";
import { distanceMatrixTool } from "../maps/distanceMatrixTool";
import { getCurrentLocationTool } from "../maps/getCurrentLocationTool";

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  tools: Record<string, any>;
  keywords: string[];
}

export const TOOL_REGISTRY: Record<string, AgentCapability> = {
  "google-gmail": {
    id: "google-gmail",
    name: "Gmail Agent",
    description: "Manage Gmail emails - read, send, reply, organize with labels",
    tools: {
      loginTool,
      logoutTool,
      getEmailsTool,
      sendMessageTool,
      createDraftTool,
      replyToThreadTool,
      getAttachmentTool,
      addLabelTool,
      listLabelsTool,
    },
    keywords: ["email", "gmail", "send", "reply", "inbox", "message", "mail", "draft", "attachment", "label"]
  },

  "google-drive": {
    id: "google-drive",
    name: "Google Drive Agent",
    description: "Manage Google Drive files and folders - upload, download, share, organize",
    tools: {
      loginTool,
      logoutTool,
      findFilesTool,
      createFolderTool,
      shareFileTool,
      moveFileTool,
      uploadFileTool,
      downloadFileTool,
    },
    keywords: ["drive", "file", "folder", "upload", "download", "share", "storage", "document", "pdf", "image"]
  },

  "google-docs": {
    id: "google-docs",
    name: "Google Docs Agent", 
    description: "Create and edit Google Documents - write, format, collaborate",
    tools: {
      loginTool,
      logoutTool,
      searchDocumentsTool,
      getDocumentTool,
      createDocumentTool,
      insertTextTool,
      replaceTextTool,
      deleteContentTool,
      insertTableTool,
      copyDocumentTool,
    },
    keywords: ["docs", "document", "write", "text", "edit", "format", "table", "copy", "create"]
  },

  "google-sheets": {
    id: "google-sheets",
    name: "Google Sheets Agent",
    description: "Manage Google Sheets spreadsheets - create, edit, calculate, organize data",
    tools: {
      loginTool,
      logoutTool,
      searchSpreadsheetsTool,
      getSpreadsheetTool,
      createSpreadsheetTool,
      addSheetTool,
      deleteSheetTool,
      batchGetValuesTool,
      batchUpdateValuesTool,
      appendValuesTool,
      clearValuesTool,
    },
    keywords: ["sheets", "spreadsheet", "data", "calculate", "table", "rows", "columns", "formula", "chart"]
  },

  "google-maps": {
    id: "google-maps",
    name: "Google Maps Agent",
    description: "Location services and navigation - find places, get directions, search nearby",
    tools: {
      textSearchTool,
      getDirectionsTool,
      nearbySearchTool,
      geocodingTool,
      distanceMatrixTool,
      getCurrentLocationTool,
    },
    keywords: ["maps", "location", "directions", "navigate", "address", "place", "restaurant", "nearby", "route", "gps"]
  }
};

export const getAllAgentIds = (): string[] => {
  return Object.keys(TOOL_REGISTRY);
};

export const getAgentCapability = (agentId: string): AgentCapability | undefined => {
  return TOOL_REGISTRY[agentId];
};

export const findAgentsByKeywords = (keywords: string[]): AgentCapability[] => {
  const results: AgentCapability[] = [];
  const searchTerms = keywords.map(k => k.toLowerCase());
  
  for (const capability of Object.values(TOOL_REGISTRY)) {
    const hasMatch = searchTerms.some(term => 
      capability.keywords.some(keyword => keyword.includes(term)) ||
      capability.name.toLowerCase().includes(term) ||
      capability.description.toLowerCase().includes(term)
    );
    
    if (hasMatch) {
      results.push(capability);
    }
  }
  
  return results;
}; 