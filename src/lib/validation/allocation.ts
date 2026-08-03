export interface BranchTotal {
  groupKey: string;
  groupName: string;
  total: number;
  nodeIds: string[];
}

export interface AllocationValidationResult {
  valid: boolean;
  branchTotals: BranchTotal[];
  maxTotal: number;
  hasBranches: boolean;
  error?: string;
}

/**
 * Graph-aware allocation validator for Delta visual workflows.
 * Calculates allocation percentages per execution branch rather than globally summing all nodes.
 * Mutually exclusive branches (e.g., TRUE vs FALSE handles of a Condition node) are validated independently.
 */
export function validateAllocationGraph(nodesInput: any, edgesInput: any): AllocationValidationResult {
  try {
    const nodes: any[] = typeof nodesInput === 'string' ? JSON.parse(nodesInput) : (nodesInput || []);
    const edges: any[] = typeof edgesInput === 'string' ? JSON.parse(edgesInput) : (edgesInput || []);

    const actionNodes = nodes.filter(
      (n: any) => n.type !== 'trigger' && n.type !== 'condition' && n.type !== 'agent'
    );

    if (actionNodes.length === 0) {
      return {
        valid: true,
        branchTotals: [{ groupKey: 'root', groupName: 'Main Flow', total: 0, nodeIds: [] }],
        maxTotal: 0,
        hasBranches: false,
      };
    }

    const branchMap = new Map<string, BranchTotal>();

    for (const node of actionNodes) {
      const percentage = parseFloat(node.data?.percentage || '0');
      if (isNaN(percentage) || percentage < 0) {
        return {
          valid: false,
          branchTotals: [],
          maxTotal: 0,
          hasBranches: false,
          error: `Invalid percentage value on node "${node.data?.label || node.id}"`,
        };
      }

      // Trace backwards to find the nearest ancestor Condition/Agent gate node and handle ID
      const ancestorBranch = findNearestConditionAncestor(node.id, nodes, edges);

      const groupKey = ancestorBranch
        ? `${ancestorBranch.conditionId}:${ancestorBranch.handle}`
        : 'root';

      const groupName = ancestorBranch
        ? `${ancestorBranch.conditionName} → ${ancestorBranch.handle.toUpperCase()}`
        : 'Main Flow';

      if (!branchMap.has(groupKey)) {
        branchMap.set(groupKey, {
          groupKey,
          groupName,
          total: 0,
          nodeIds: [],
        });
      }

      const entry = branchMap.get(groupKey)!;
      entry.total = Math.round((entry.total + percentage) * 100) / 100;
      entry.nodeIds.push(node.id);
    }

    const branchTotalsArray = Array.from(branchMap.values());
    let maxTotal = 0;
    let firstError: string | undefined;

    for (const branch of branchTotalsArray) {
      if (branch.total > maxTotal) {
        maxTotal = branch.total;
      }
      if (branch.total > 100 && !firstError) {
        firstError = `Branch "${branch.groupName}" totals ${branch.total}% (max 100%)`;
      }
    }

    const hasBranches = branchMap.size > 1 || (branchMap.size === 1 && !branchMap.has('root'));

    return {
      valid: !firstError,
      branchTotals: branchTotalsArray,
      maxTotal,
      hasBranches,
      error: firstError,
    };
  } catch (err: any) {
    return {
      valid: false,
      branchTotals: [],
      maxTotal: 0,
      hasBranches: false,
      error: 'Malformed node/edge graph structure',
    };
  }
}

/**
 * BFS backwards from a target action node to find its nearest upstream Condition/Agent node and output handle.
 */
function findNearestConditionAncestor(
  startNodeId: string,
  nodes: any[],
  edges: any[]
): { conditionId: string; conditionName: string; handle: string } | null {
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Find incoming edges to currentId
    const incomingEdges = edges.filter((e) => e.target === currentId);

    for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;

      if (sourceNode.type === 'condition' || sourceNode.type === 'agent') {
        const handle = (edge.sourceHandle || 'true').toLowerCase();
        const conditionName = sourceNode.data?.label || 'Condition Gate';
        return {
          conditionId: sourceNode.id,
          conditionName,
          handle,
        };
      }

      if (!visited.has(sourceNode.id)) {
        queue.push(sourceNode.id);
      }
    }
  }

  return null;
}
