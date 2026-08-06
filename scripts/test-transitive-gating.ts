import { prisma } from '../src/lib/prisma';

// Evaluate condition helper
function evaluateCondition(triggerAmount: number | string, field: string, operator: string, value: string): boolean {
  const numTrigger = parseFloat(String(triggerAmount || '0'));
  const numTarget = parseFloat(String(value || '0'));

  switch (operator) {
    case '>':
      return numTrigger > numTarget;
    case '>=':
      return numTrigger >= numTarget;
    case '<':
      return numTrigger < numTarget;
    case '<=':
      return numTrigger <= numTarget;
    case '==':
    case '=':
      return numTrigger === numTarget;
    default:
      return numTrigger > numTarget;
  }
}

interface AncestryCheckResult {
  active: boolean;
  reason?: string;
}

function checkNodeAncestry(
  targetNodeId: string,
  nodes: any[],
  edges: any[],
  triggerAmount: number | string,
  visited = new Set<string>()
): AncestryCheckResult {
  if (visited.has(targetNodeId)) {
    return { active: true };
  }
  visited.add(targetNodeId);

  const targetNode = nodes.find((n: any) => n.id === targetNodeId);
  if (!targetNode || targetNode.type === 'trigger') {
    return { active: true };
  }

  const incomingEdges = edges.filter((e: any) => e.target === targetNodeId);
  if (incomingEdges.length === 0) {
    return { active: true };
  }

  let anyPathActive = false;
  let lastInactivityReason = '';

  for (const edge of incomingEdges) {
    const parentNode = nodes.find((n: any) => n.id === edge.source);
    if (!parentNode) continue;

    if (parentNode.type === 'condition') {
      const field = parentNode.data?.field || 'triggerAmount';
      const operator = parentNode.data?.operator || '>';
      const targetValue = parentNode.data?.value || '10';
      const isConditionMet = evaluateCondition(triggerAmount, field, operator, targetValue);

      const requiredHandle = edge.sourceHandle || 'true';
      const branchMatches =
        (isConditionMet && requiredHandle === 'true') || (!isConditionMet && requiredHandle === 'false');

      if (!branchMatches) {
        lastInactivityReason = `Branch skipped: condition (${field} ${operator} ${targetValue} USDC) evaluated to ${
          isConditionMet ? 'TRUE' : 'FALSE'
        } but node is on '${requiredHandle}' branch`;
        continue;
      }

      const parentAncestry = checkNodeAncestry(parentNode.id, nodes, edges, triggerAmount, new Set(visited));
      if (parentAncestry.active) {
        anyPathActive = true;
        break;
      } else {
        lastInactivityReason = parentAncestry.reason || 'Parent condition path is inactive';
      }
    } else {
      const parentAncestry = checkNodeAncestry(parentNode.id, nodes, edges, triggerAmount, new Set(visited));
      if (parentAncestry.active) {
        anyPathActive = true;
        break;
      } else {
        lastInactivityReason = parentAncestry.reason || `Upstream node (${parentNode.type}) is on an inactive branch`;
      }
    }
  }

  if (anyPathActive) {
    return { active: true };
  }

  return {
    active: false,
    reason: lastInactivityReason || 'All incoming paths to this node are inactive',
  };
}

async function runTest() {
  console.log('--- STARTING TRANSITIVE CONDITION GATING SUITE ---\n');

  // Define nodes for two-branch workflow:
  // Trigger -> Condition (amount > 10)
  //   TRUE branch  -> Swap_True -> Bridge_True
  //   FALSE branch -> Swap_False -> Send_False
  const nodes = [
    { id: 'trigger-1', type: 'trigger', data: { label: 'USDC Deposit' } },
    { id: 'cond-1', type: 'condition', data: { label: 'Check Deposit > 10', field: 'triggerAmount', operator: '>', value: '10' } },
    { id: 'swap-true', type: 'swap', data: { label: 'TRUE Swap 100%', percentage: '100' } },
    { id: 'bridge-true', type: 'bridge', data: { label: 'TRUE Bridge 100%', percentage: '100', destinationChain: 'Base_Sepolia' } },
    { id: 'swap-false', type: 'swap', data: { label: 'FALSE Swap 40%', percentage: '40' } },
    { id: 'send-false', type: 'send', data: { label: 'FALSE Send 30%', percentage: '30' } },
  ];

  const edges = [
    { id: 'e1', source: 'trigger-1', target: 'cond-1' },
    { id: 'e2', source: 'cond-1', target: 'swap-true', sourceHandle: 'true' },
    { id: 'e3', source: 'swap-true', target: 'bridge-true' },
    { id: 'e4', source: 'cond-1', target: 'swap-false', sourceHandle: 'false' },
    { id: 'e5', source: 'swap-false', target: 'send-false' },
  ];

  // TEST 1: Trigger with 20 USDC (Condition > 10 is TRUE)
  console.log('== TEST 1: Deposit = 20 USDC (Condition > 10 is TRUE) ==');
  for (const n of nodes) {
    if (n.type === 'trigger') continue;
    if (n.type === 'condition') {
      const isTrue = evaluateCondition('20', 'triggerAmount', '>', '10');
      console.log(`[NODE] ${n.id} (${n.data.label}): Evaluated condition -> ${isTrue ? 'TRUE' : 'FALSE'}`);
      continue;
    }

    const check = checkNodeAncestry(n.id, nodes, edges, '20');
    console.log(`[NODE] ${n.id} (${n.data.label}): ${check.active ? '✅ EXECUTED (ACTIVE)' : `⏭️ SKIPPED (${check.reason})`}`);
  }

  console.log('\n== TEST 2: Deposit = 5 USDC (Condition > 10 is FALSE) ==');
  for (const n of nodes) {
    if (n.type === 'trigger') continue;
    if (n.type === 'condition') {
      const isTrue = evaluateCondition('5', 'triggerAmount', '>', '10');
      console.log(`[NODE] ${n.id} (${n.data.label}): Evaluated condition -> ${isTrue ? 'TRUE' : 'FALSE'}`);
      continue;
    }

    const check = checkNodeAncestry(n.id, nodes, edges, '5');
    console.log(`[NODE] ${n.id} (${n.data.label}): ${check.active ? '✅ EXECUTED (ACTIVE)' : `⏭️ SKIPPED (${check.reason})`}`);
  }

  // TEST 3: Linear workflow (Trigger -> Swap -> Send, NO Condition)
  console.log('\n== TEST 3: Linear Workflow without Condition (Trigger -> Swap -> Send) ==');
  const linearNodes = [
    { id: 'trigger-1', type: 'trigger', data: { label: 'USDC Deposit' } },
    { id: 'swap-1', type: 'swap', data: { label: 'Swap 50%', percentage: '50' } },
    { id: 'send-1', type: 'send', data: { label: 'Send 50%', percentage: '50' } },
  ];

  const linearEdges = [
    { id: 'le1', source: 'trigger-1', target: 'swap-1' },
    { id: 'le2', source: 'swap-1', target: 'send-1' },
  ];

  for (const n of linearNodes) {
    if (n.type === 'trigger') continue;
    const check = checkNodeAncestry(n.id, linearNodes, linearEdges, '20');
    console.log(`[NODE] ${n.id} (${n.data.label}): ${check.active ? '✅ EXECUTED (ACTIVE)' : `⏭️ SKIPPED (${check.reason})`}`);
  }

  console.log('\n--- ALL TEST SCENARIOS COMPLETED ---');
}

runTest();
