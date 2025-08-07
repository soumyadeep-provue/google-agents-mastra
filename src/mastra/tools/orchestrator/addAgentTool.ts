import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAgentCapability, findAgentsByKeywords, TOOL_REGISTRY } from "./toolRegistry";

// Storage for currently active agent capabilities
let activeAgents: Set<string> = new Set();
let activatedTools: Map<string, any> = new Map();

export const addAgentTool = createTool({
  id: "addAgent",
  description: `Dynamically add agent capabilities based on user needs. 
  Use this when the user requests functionality that requires specific Google services:
  - "google-gmail" for email operations (send, read, reply, labels)
  - "google-drive" for file operations (upload, download, share, organize)  
  - "google-docs" for document creation and editing
  - "google-sheets" for spreadsheet operations and data management
  - "google-maps" for location services and navigation
  
  You can also use keywords to find the right agent if unsure of the exact ID.`,
  
  inputSchema: z.object({
    agentId: z.string().describe("The agent ID to activate (e.g., 'google-gmail', 'google-drive') or keywords to search"),
    reason: z.string().optional().describe("Why this agent is needed for the current task")
  }),
  
  execute: async ({ context, mastra }) => {
    const { agentId, reason } = context;
    
    // First try exact match
    let capability = getAgentCapability(agentId);
    
    // If no exact match, try keyword search
    if (!capability) {
      const keywords = agentId.split(/\s+/);
      const matches = findAgentsByKeywords(keywords);
      
      if (matches.length === 0) {
        const availableAgents = Object.keys(TOOL_REGISTRY).join(", ");
        return {
          success: false,
          message: `No agent found for "${agentId}". Available agents: ${availableAgents}`,
          availableAgents: Object.values(TOOL_REGISTRY).map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            keywords: a.keywords
          }))
        };
      }
      
      // Use the first/best match
      capability = matches[0];
    }
    
    const { id, name, tools, description } = capability;
    
    // Check if already active
    if (activeAgents.has(id)) {
      return {
        success: true,
        message: `${name} is already active`,
        agentId: id,
        agentName: name,
        toolCount: Object.keys(tools).length,
        alreadyActive: true
      };
    }
    
    try {
      // Add to active agents
      activeAgents.add(id);
      
      // Store tools for potential removal later
      for (const [toolName, tool] of Object.entries(tools)) {
        activatedTools.set(`${id}:${toolName}`, tool);
      }
      
      // In a real implementation, you would dynamically add these tools to the agent
      // For now, we'll simulate this by storing the state
      // The actual tool availability will be handled by the orchestrator agent
      
      return {
        success: true,
        message: `Successfully activated ${name}${reason ? ` - ${reason}` : ''}`,
        agentId: id,
        agentName: name,
        description,
        toolCount: Object.keys(tools).length,
        availableTools: Object.keys(tools),
        alreadyActive: false
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to activate ${name}: ${error.message}`,
        agentId: id,
        error: error.message
      };
    }
  }
});

export const removeAgentTool = createTool({
  id: "removeAgent", 
  description: "Remove/deactivate an agent and its tools to free up resources",
  
  inputSchema: z.object({
    agentId: z.string().describe("The agent ID to deactivate"),
    reason: z.string().optional().describe("Why this agent is no longer needed")
  }),
  
  execute: async ({ context }) => {
    const { agentId, reason } = context;
    
    if (!activeAgents.has(agentId)) {
      return {
        success: false,
        message: `Agent "${agentId}" is not currently active`,
        agentId,
        activeAgents: Array.from(activeAgents)
      };
    }
    
    try {
      // Remove from active agents
      activeAgents.delete(agentId);
      
      // Remove associated tools
      const removedTools: string[] = [];
      for (const [key] of activatedTools.entries()) {
        if (key.startsWith(`${agentId}:`)) {
          activatedTools.delete(key);
          removedTools.push(key.split(':')[1]);
        }
      }
      
      const capability = getAgentCapability(agentId);
      
      return {
        success: true,
        message: `Successfully deactivated ${capability?.name || agentId}${reason ? ` - ${reason}` : ''}`,
        agentId,
        agentName: capability?.name,
        removedToolCount: removedTools.length,
        removedTools,
        remainingActiveAgents: Array.from(activeAgents)
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to deactivate agent "${agentId}": ${error.message}`,
        agentId,
        error: error.message
      };
    }
  }
});

export const listActiveAgentsTool = createTool({
  id: "listActiveAgents",
  description: "List all currently active agents and their capabilities",
  
  inputSchema: z.object({}),
  
  execute: async ({ context }) => {
    const activeAgentDetails = Array.from(activeAgents).map(agentId => {
      const capability = getAgentCapability(agentId);
      return {
        id: agentId,
        name: capability?.name,
        description: capability?.description,
        toolCount: capability ? Object.keys(capability.tools).length : 0,
        keywords: capability?.keywords
      };
    });
    
    return {
      success: true,
      activeAgentCount: activeAgents.size,
      activeAgents: activeAgentDetails,
      totalAvailableAgents: Object.keys(TOOL_REGISTRY).length
    };
  }
});

// Helper function to get current state
export const getActiveAgents = (): string[] => Array.from(activeAgents); 