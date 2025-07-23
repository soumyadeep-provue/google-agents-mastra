
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { gmailAgent } from './agents/gmailAgent';
import { driveAgent } from './agents/driveAgent';
import { mapsAgent } from './agents/mapsAgent';
import { docsAgent } from './agents/docsAgent';

export const mastra = new Mastra({
  agents: { 
    gmailAgent,
    driveAgent,
    mapsAgent,
    docsAgent,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
