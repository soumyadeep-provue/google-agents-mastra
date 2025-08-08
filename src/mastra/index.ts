
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

// Import the enhanced agent system
import { baseAgent } from './agents/baseAgent';
import { plannerAgent } from './agents/plannerAgent';
import { summarizerAgent } from './agents/summarizerAgent';


export const mastra = new Mastra({
  agents: { 
    // Main enhanced agent that orchestrates everything
    baseAgent,
    
    // Core system agents
    plannerAgent,
    summarizerAgent,
  },
  storage: new LibSQLStore({
    url: ":memory:", // Use in-memory for development; change to file:../mastra.db for persistence
  }),
  logger: new PinoLogger({
    name: 'Enhanced Mastra System',
    level: 'debug', // Changed to info to reduce noise
  }),
});
