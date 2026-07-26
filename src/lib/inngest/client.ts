import { Inngest } from 'inngest';

const eventKey = process.env.INNGEST_EVENT_KEY;

// Use local Dev Server mode when INNGEST_EVENT_KEY is missing or unconfigured
export const inngest = new Inngest({
  id: 'delta-workflow-engine',
  name: 'Delta Workflow Automation Engine',
  eventKey: eventKey && eventKey.length > 5 ? eventKey : undefined,
  isDev: !eventKey || eventKey.length <= 5,
});
