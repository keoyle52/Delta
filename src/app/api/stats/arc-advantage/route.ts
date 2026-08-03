import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      select: {
        startedAt: true,
        finishedAt: true,
      },
    });

    if (!executions || executions.length === 0) {
      return NextResponse.json({
        avgCompletionTimeSeconds: null,
        totalRealExecutions: 0,
      });
    }

    let totalDurationMs = 0;
    let validCount = 0;

    for (const exec of executions) {
      if (exec.startedAt && exec.finishedAt) {
        const start = new Date(exec.startedAt).getTime();
        const end = new Date(exec.finishedAt).getTime();
        const duration = end - start;
        if (duration > 0) {
          totalDurationMs += duration;
          validCount++;
        }
      }
    }

    if (validCount === 0) {
      return NextResponse.json({
        avgCompletionTimeSeconds: null,
        totalRealExecutions: 0,
      });
    }

    const avgCompletionTimeSeconds = Math.round((totalDurationMs / validCount / 1000) * 10) / 10;

    return NextResponse.json({
      avgCompletionTimeSeconds,
      totalRealExecutions: validCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
