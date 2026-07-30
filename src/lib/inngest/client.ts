import { Inngest } from 'inngest';

const eventKey = process.env.INNGEST_EVENT_KEY;
const isDev = !eventKey || eventKey.trim().length <= 5;

console.log(`[INNGEST CLIENT INIT] Environment Check: INNGEST_EVENT_KEY = ${eventKey ? `SET (length=${eventKey.trim().length})` : 'MISSING/UNDEFINED'}, Computed isDev = ${isDev}`);

// Use local Dev Server mode when INNGEST_EVENT_KEY is missing or unconfigured
export const inngest = new Inngest({
  id: 'delta-workflow-engine',
  name: 'Delta Workflow Automation Engine',
  eventKey: eventKey && eventKey.trim().length > 5 ? eventKey.trim() : undefined,
  isDev,
});
