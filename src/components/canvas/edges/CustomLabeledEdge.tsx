'use client';

import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from '@xyflow/react';

export default function CustomLabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const percentageStr =
    typeof data?.percentage === 'string' || typeof data?.percentage === 'number'
      ? String(data.percentage)
      : null;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {percentageStr && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan rounded-full bg-slate-900/90 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-bold font-mono text-indigo-300 shadow-md backdrop-blur-sm"
          >
            {percentageStr}%
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
