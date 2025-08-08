
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { baseAgent } from './agents/baseAgent';
import { gmailAgent } from './agents/gmailAgent';
import { docsAgent } from './agents/docsAgent';
import { driveAgent } from './agents/driveAgent';
import { mapsAgent } from './agents/mapsAgent';
import { sheetsAgent } from './agents/sheetsAgent';

export const mastra = new Mastra({
  agents: { 
    baseAgent,
    gmailAgent,
    docsAgent,
    driveAgent,
    mapsAgent,
    sheetsAgent,
  },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'debug',
  }),
});
