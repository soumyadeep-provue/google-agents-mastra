
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { baseAgent } from './agents/baseAgent';
import { docsAgent } from './agents/docsAgent';
import { driveAgent } from './agents/driveAgent';
import { gmailAgent } from './agents/gmailAgent';
import { mapsAgent } from './agents/mapsAgent';
import { sheetsAgent } from './agents/sheetsAgent';

export { baseAgent } from './agents/baseAgent';
export { docsAgent } from './agents/docsAgent';
export { driveAgent } from './agents/driveAgent';
export { gmailAgent } from './agents/gmailAgent';
export { mapsAgent } from './agents/mapsAgent';
export { sheetsAgent } from './agents/sheetsAgent';

export const mastra = new Mastra({
  agents: { 
    baseAgent,
    docsAgent,
    driveAgent,
    gmailAgent,
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
