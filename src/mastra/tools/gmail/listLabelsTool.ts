import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const listLabelsTool = createTool({
  id: "listLabels",
  description: "List all available labels in your Gmail account, including system labels and custom labels.",
  inputSchema: z.object({
    includeSystem: z.boolean().optional().describe("Include system labels like INBOX, SENT, DRAFT (default: true)"),
    customOnly: z.boolean().optional().describe("Show only custom user-created labels (default: false)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    labels: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      messagesTotal: z.number().optional(),
      messagesUnread: z.number().optional(),
      threadsTotal: z.number().optional(),
      threadsUnread: z.number().optional()
    })),
    totalLabels: z.number(),
    customLabels: z.number(),
    systemLabels: z.number(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.gmail) {
      throw new Error("Gmail not authenticated. Please run loginTool first.");
    }

    const includeSystem = input.context?.includeSystem !== false; // Default true
    const customOnly = input.context?.customOnly || false;

    try {
      // Get all labels
      const response = await clients.gmail.users.labels.list({
        userId: 'me'
      });

      const allLabels = response.data.labels || [];
      
      // System labels (Gmail built-in)
      const systemLabelTypes = [
        'INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED',
        'IMPORTANT', 'CHAT', 'CHATS', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL',
        'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'
      ];

      // Filter and categorize labels
      let filteredLabels = allLabels.filter(label => {
        if (!label.name || !label.id) return false;
        
        const isSystemLabel = systemLabelTypes.includes(label.id) || 
                             label.type === 'system' ||
                             label.name.startsWith('CATEGORY_') ||
                             ['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH'].includes(label.name);
        
        if (customOnly) {
          return !isSystemLabel;
        } else if (!includeSystem) {
          return !isSystemLabel;
        }
        
        return true;
      });

      // Format the labels
      const formattedLabels = filteredLabels.map(label => ({
        id: label.id!,
        name: label.name!,
        type: getLabeLType(label),
        messagesTotal: label.messagesTotal || undefined,
        messagesUnread: label.messagesUnread || undefined,
        threadsTotal: label.threadsTotal || undefined,
        threadsUnread: label.threadsUnread || undefined
      }));

      // Sort labels: system first, then custom alphabetically
      formattedLabels.sort((a, b) => {
        if (a.type === 'system' && b.type === 'user') return -1;
        if (a.type === 'user' && b.type === 'system') return 1;
        return a.name.localeCompare(b.name);
      });

      // Count labels by type
      const systemCount = formattedLabels.filter(l => l.type === 'system').length;
      const customCount = formattedLabels.filter(l => l.type === 'user').length;

      // Create summary message
      let summaryMessage = `📋 Found ${formattedLabels.length} labels total`;
      
      if (!customOnly) {
        summaryMessage += ` (${systemCount} system, ${customCount} custom)`;
      } else {
        summaryMessage += ` (custom labels only)`;
      }

      return {
        success: true,
        labels: formattedLabels,
        totalLabels: formattedLabels.length,
        customLabels: customCount,
        systemLabels: systemCount,
        message: summaryMessage
      };

    } catch (error) {
      console.error("List labels error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        labels: [],
        totalLabels: 0,
        customLabels: 0,
        systemLabels: 0,
        message: `❌ Failed to retrieve labels: ${errorMessage}`
      };
    }
  }
});

function getLabeLType(label: any): string {
  // System labels
  const systemLabelTypes = [
    'INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED',
    'IMPORTANT', 'CHAT', 'CHATS', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL',
    'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'
  ];

  if (label.type === 'system' || 
      systemLabelTypes.includes(label.id) ||
      ['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH'].includes(label.name) ||
      label.name?.startsWith('CATEGORY_')) {
    return 'system';
  }
  
  return 'user';
} 