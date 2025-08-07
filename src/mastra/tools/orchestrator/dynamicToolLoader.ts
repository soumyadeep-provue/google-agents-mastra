import { getActiveAgents } from "./addAgentTool";
import { getAgentCapability } from "./toolRegistry";

/**
 * Get all tools from currently active agents
 * This is the core dynamic tool loading functionality
 */
export const getActiveAgentTools = (): Record<string, any> => {
  const activeAgentIds = getActiveAgents();
  const allTools: Record<string, any> = {};
  
  for (const agentId of activeAgentIds) {
    const capability = getAgentCapability(agentId);
    if (capability) {
      // Add all tools from this agent to the combined tool set
      Object.assign(allTools, capability.tools);
    }
  }
  
  return allTools;
};

/**
 * Dynamic tool provider function for the orchestrator agent
 * This is where the "magic" happens - tools become available based on active agents
 */
export const getDynamicTools = ({ runtimeContext }: { runtimeContext?: any } = {}) => {
  return getActiveAgentTools();
}; 