import { Inngest } from 'inngest';

// Inngest client defaults to local Dev Server mode (inngest-cli dev) when INNGEST_EVENT_KEY is omitted
export const inngest = new Inngest({
  id: 'delta-workflow-engine',
  name: 'Delta Workflow Automation Engine',
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
});
