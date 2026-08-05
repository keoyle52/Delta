import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TYPICAL_WAIT_SECONDS, TYPICAL_FEE_USD } from '@/lib/arc-advantage-constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const executions = await prisma.execution.findMany({
      where: {
        status: 'COMPLETE',
        workflow: {
          user: {
            isSimulated: false,
          },
        },
      },
      include: {
        workflow: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { finishedAt: 'desc' },
    });

    const allowedNodeTypes = ['bridge', 'swap', 'send'] as const;
    type AllowedNodeType = typeof allowedNodeTypes[number];

    const byType: Record<
      AllowedNodeType,
      {
        count: number;
        totalTimeSavedSeconds: number;
        totalFeeSavedUsd: number;
        avgActualDurationSeconds: number | null;
        avgActualFeeUsd: number | null;
        durationSumSec: number;
        durationCount: number;
        feeSumUsd: number;
        feeCount: number;
      }
    > = {
      bridge: {
        count: 0,
        totalTimeSavedSeconds: 0,
        totalFeeSavedUsd: 0,
        avgActualDurationSeconds: null,
        avgActualFeeUsd: null,
        durationSumSec: 0,
        durationCount: 0,
        feeSumUsd: 0,
        feeCount: 0,
      },
      swap: {
        count: 0,
        totalTimeSavedSeconds: 0,
        totalFeeSavedUsd: 0,
        avgActualDurationSeconds: null,
        avgActualFeeUsd: null,
        durationSumSec: 0,
        durationCount: 0,
        feeSumUsd: 0,
        feeCount: 0,
      },
      send: {
        count: 0,
        totalTimeSavedSeconds: 0,
        totalFeeSavedUsd: 0,
        avgActualDurationSeconds: null,
        avgActualFeeUsd: null,
        durationSumSec: 0,
        durationCount: 0,
        feeSumUsd: 0,
        feeCount: 0,
      },
    };

    const recentTxList: Array<{
      txHash: string;
      nodeType: AllowedNodeType;
      actualDurationSeconds: number | null;
      actualFeeUsd: number | null;
      timeSavedSeconds: number | null;
      feeSavedUsd: number | null;
      workflowName: string;
      completedAt: string;
    }> = [];

    let totalRealTransactions = 0;

    for (const exec of executions) {
      const logs = typeof exec.stepLogs === 'string' ? JSON.parse(exec.stepLogs) : (exec.stepLogs || []);
      if (!Array.isArray(logs)) continue;

      for (const log of logs) {
        if (!log || log.simulated || log.status !== 'COMPLETE') continue;
        const nodeType = log.nodeType as AllowedNodeType;
        if (!allowedNodeTypes.includes(nodeType)) continue;

        totalRealTransactions++;
        const category = byType[nodeType];
        category.count++;

        // Calculate actual duration & time saved
        let actualDurationSeconds: number | null = null;
        let timeSavedSeconds: number | null = null;

        const startIso = log.startedAt || log.timestamp;
        const endIso = log.completedAt || log.timestamp;

        if (startIso && endIso) {
          const startTime = new Date(startIso).getTime();
          const endTime = new Date(endIso).getTime();
          if (!isNaN(startTime) && !isNaN(endTime) && endTime >= startTime) {
            actualDurationSeconds = Math.round(((endTime - startTime) / 1000) * 10) / 10;
            const typicalWait = TYPICAL_WAIT_SECONDS[nodeType] || 60;
            timeSavedSeconds = Math.max(0, Math.round((typicalWait - actualDurationSeconds) * 10) / 10);

            category.durationSumSec += actualDurationSeconds;
            category.durationCount++;
            category.totalTimeSavedSeconds += timeSavedSeconds;
          }
        }

        // Calculate actual fee paid & fee saved
        let actualFeeUsd: number | null = null;
        let feeSavedUsd: number | null = null;

        if (typeof log.feePaidUsdc === 'number' && log.feePaidUsdc >= 0) {
          actualFeeUsd = Math.round(log.feePaidUsdc * 10000) / 10000;
          const typicalFee = TYPICAL_FEE_USD[nodeType] || 1.0;
          feeSavedUsd = Math.max(0, Math.round((typicalFee - actualFeeUsd) * 10000) / 10000);

          category.feeSumUsd += actualFeeUsd;
          category.feeCount++;
          category.totalFeeSavedUsd += feeSavedUsd;
        }

        if (log.txHash) {
          recentTxList.push({
            txHash: log.txHash,
            nodeType,
            actualDurationSeconds,
            actualFeeUsd,
            timeSavedSeconds,
            feeSavedUsd,
            workflowName: exec.workflow?.name || 'Automated Flow',
            completedAt: endIso || new Date().toISOString(),
          });
        }
      }
    }

    // Compute averages per node type
    for (const key of allowedNodeTypes) {
      const cat = byType[key];
      if (cat.durationCount > 0) {
        cat.avgActualDurationSeconds = Math.round((cat.durationSumSec / cat.durationCount) * 10) / 10;
      }
      if (cat.feeCount > 0) {
        cat.avgActualFeeUsd = Math.round((cat.feeSumUsd / cat.feeCount) * 10000) / 10000;
      }
      cat.totalTimeSavedSeconds = Math.round(cat.totalTimeSavedSeconds * 10) / 10;
      cat.totalFeeSavedUsd = Math.round(cat.totalFeeSavedUsd * 100) / 100;
    }

    const totalTimeSavedSeconds = Math.round(
      (byType.bridge.totalTimeSavedSeconds + byType.swap.totalTimeSavedSeconds + byType.send.totalTimeSavedSeconds) * 10
    ) / 10;

    const totalFeeSavedUsd = Math.round(
      (byType.bridge.totalFeeSavedUsd + byType.swap.totalFeeSavedUsd + byType.send.totalFeeSavedUsd) * 100
    ) / 100;

    // Clean internal helper properties before returning
    const cleanedByType = {
      bridge: {
        count: byType.bridge.count,
        totalTimeSavedSeconds: byType.bridge.totalTimeSavedSeconds,
        totalFeeSavedUsd: byType.bridge.totalFeeSavedUsd,
        avgActualDurationSeconds: byType.bridge.avgActualDurationSeconds,
        avgActualFeeUsd: byType.bridge.avgActualFeeUsd,
      },
      swap: {
        count: byType.swap.count,
        totalTimeSavedSeconds: byType.swap.totalTimeSavedSeconds,
        totalFeeSavedUsd: byType.swap.totalFeeSavedUsd,
        avgActualDurationSeconds: byType.swap.avgActualDurationSeconds,
        avgActualFeeUsd: byType.swap.avgActualFeeUsd,
      },
      send: {
        count: byType.send.count,
        totalTimeSavedSeconds: byType.send.totalTimeSavedSeconds,
        totalFeeSavedUsd: byType.send.totalFeeSavedUsd,
        avgActualDurationSeconds: byType.send.avgActualDurationSeconds,
        avgActualFeeUsd: byType.send.avgActualFeeUsd,
      },
    };

    return NextResponse.json({
      byType: cleanedByType,
      totals: {
        totalRealTransactions,
        totalTimeSavedSeconds,
        totalFeeSavedUsd,
      },
      recentTransactions: recentTxList.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
