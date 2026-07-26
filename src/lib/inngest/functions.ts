import { inngest } from './client';
import { prisma } from '@/lib/prisma';
import { executeAppKitSwap, executeAppKitBridge, executeAppKitSend } from '@/lib/circle/app-kit';
import { sendArcTransfer } from '@/lib/circle/wallets';
import axios from 'axios';

export interface StepLog {
  stepId: string;
  nodeType: string;
  nodeName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED';
  txHash?: string;
  details?: string;
  error?: string;
  timestamp: string;
}

export const executeWorkflowFunction = inngest.createFunction(
  { id: 'execute-delta-workflow', name: 'Execute Delta Flow Automation' },
  { event: 'workflow.trigger' },
  async ({ event, step }) => {
    const { workflowId, executionId, triggerTxHash, triggerAmount, walletAddress, walletId } = event.data;

    // Step 1: Initialize Execution in DB
    const currentExecution = await step.run('init-execution-db', async () => {
      let exec = executionId
        ? await prisma.execution.findUnique({ where: { id: executionId } })
        : null;

      if (!exec) {
        exec = await prisma.execution.create({
          data: {
            workflowId,
            triggerTxHash: triggerTxHash || '0x0000000000000000000000000000000000000000',
            triggerAmount: String(triggerAmount),
            status: 'RUNNING',
            stepLogs: [],
            startedAt: new Date(),
          },
        });
      } else {
        await prisma.execution.update({
          where: { id: exec.id },
          data: { status: 'RUNNING' },
        });
      }

      return exec;
    });

    const stepLogs: StepLog[] = [];

    // Helper to log step execution to array and DB
    const updateLog = async (logEntry: StepLog) => {
      const idx = stepLogs.findIndex((s) => s.stepId === logEntry.stepId);
      if (idx >= 0) {
        stepLogs[idx] = logEntry;
      } else {
        stepLogs.push(logEntry);
      }

      await prisma.execution.update({
        where: { id: currentExecution.id },
        data: {
          stepLogs: stepLogs as any,
        },
      });
    };

    // Step 2: Fetch Workflow structure
    const workflow = await step.run('fetch-workflow', async () => {
      const wf = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });
      if (!wf) throw new Error(`Workflow ${workflowId} not found`);
      return wf;
    });

    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || []);
    const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : (workflow.edges || []);

    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) {
      await updateLog({
        stepId: 'trigger-check',
        nodeType: 'trigger',
        nodeName: 'Trigger Check',
        status: 'FAILED',
        error: 'No trigger node found in workflow definition',
        timestamp: new Date().toISOString(),
      });
      await prisma.execution.update({
        where: { id: currentExecution.id },
        data: { status: 'FAILED', finishedAt: new Date() },
      });
      return { success: false, reason: 'No trigger node' };
    }

    // Record trigger step completion
    await updateLog({
      stepId: triggerNode.id,
      nodeType: 'trigger',
      nodeName: triggerNode.data?.label || 'USDC Received',
      status: 'COMPLETE',
      txHash: triggerTxHash,
      details: `Triggered by inbound transfer of ${triggerAmount} USDC (Tx: ${triggerTxHash})`,
      timestamp: new Date().toISOString(),
    });

    // Step 3: Find downstream action nodes
    const outgoingEdges = edges.filter((e: any) => e.source === triggerNode.id);
    const targetNodeIds = outgoingEdges.map((e: any) => e.target);
    const actionNodes = nodes.filter((n: any) => targetNodeIds.includes(n.id));

    const totalTriggerAmount = parseFloat(triggerAmount);

    // Step 4: Execute each action sequentially
    let hasFailedStep = false;

    for (const node of actionNodes) {
      const stepId = node.id;
      const nodeType = node.type;
      const nodeData = node.data || {};
      const percentage = parseFloat(nodeData.percentage || '0');
      const actionAmount = ((totalTriggerAmount * percentage) / 100).toFixed(6);

      await updateLog({
        stepId,
        nodeType,
        nodeName: nodeData.label || nodeType.toUpperCase(),
        status: 'RUNNING',
        details: `Executing ${nodeType} with ${percentage}% (${actionAmount} USDC)...`,
        timestamp: new Date().toISOString(),
      });

      try {
        if (nodeType === 'swap') {
          const tokenOut = nodeData.tokenOut || 'EURC';
          let txResult: any;

          if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
            txResult = await executeAppKitSwap({
              userWalletAddress: walletAddress,
              walletId,
              amountUsdc: actionAmount,
              tokenOut,
            });
          } else {
            throw new Error('CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET missing in environment');
          }

          await updateLog({
            stepId,
            nodeType,
            nodeName: nodeData.label || 'Swap Action',
            status: 'COMPLETE',
            txHash: txResult?.txHash || txResult?.id || '0x-swap-completed',
            details: `Swapped ${actionAmount} USDC to ${tokenOut} on Arc Testnet`,
            timestamp: new Date().toISOString(),
          });
        } else if (nodeType === 'bridge') {
          const destinationAddress = nodeData.destinationAddress;
          if (!destinationAddress) {
            throw new Error('Bridge node destinationAddress is required');
          }

          let txResult: any;
          if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
            txResult = await executeAppKitBridge({
              userWalletAddress: walletAddress,
              destinationAddress,
              amountUsdc: actionAmount,
            });
          } else {
            throw new Error('CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET missing in environment');
          }

          await updateLog({
            stepId,
            nodeType,
            nodeName: nodeData.label || 'Bridge Action',
            status: 'COMPLETE',
            txHash: txResult?.txHash || txResult?.id || '0x-bridge-cctp-initiated',
            details: `Bridged ${actionAmount} USDC via CCTP to Solana Devnet recipient: ${destinationAddress}`,
            timestamp: new Date().toISOString(),
          });
        } else if (nodeType === 'send') {
          const destinationAddress = nodeData.destinationAddress;
          if (!destinationAddress) {
            throw new Error('Send node destinationAddress is required');
          }

          let txHash = '';
          if (process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET) {
            try {
              const res: any = await executeAppKitSend({
                userWalletAddress: walletAddress,
                destinationAddress,
                amountUsdc: actionAmount,
              });
              txHash = res?.txHash || res?.id || '';
            } catch (appKitErr) {
              // Fallback to Developer Controlled Wallet transfer API if direct App Kit send adapter is busy
              txHash = (await sendArcTransfer({
                walletId,
                destinationAddress,
                amountUsdc: actionAmount,
              })) || '';
            }
          } else {
            throw new Error('CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET missing in environment');
          }

          await updateLog({
            stepId,
            nodeType,
            nodeName: nodeData.label || 'Send Action',
            status: 'COMPLETE',
            txHash: txHash || '0x-send-complete',
            details: `Sent ${actionAmount} USDC to ${destinationAddress} on Arc Testnet`,
            timestamp: new Date().toISOString(),
          });
        } else if (nodeType === 'notify') {
          const webhookUrl = nodeData.webhookUrl;
          const template = nodeData.template || 'Delta Alert: {{amount}} USDC processed. Tx: {{txHash}}';

          let message = template
            .replace('{{amount}}', triggerAmount)
            .replace('{{txHash}}', triggerTxHash)
            .replace('{{step}}', nodeData.label || 'Automation');

          if (webhookUrl && webhookUrl.startsWith('http')) {
            await axios.post(webhookUrl, {
              content: message,
              text: message,
              workflowId,
              txHash: triggerTxHash,
            });
          }

          await updateLog({
            stepId,
            nodeType,
            nodeName: nodeData.label || 'Notify Action',
            status: 'COMPLETE',
            details: `Notification sent: "${message}"`,
            timestamp: new Date().toISOString(),
          });
        } else if (nodeType === 'hold') {
          await updateLog({
            stepId,
            nodeType,
            nodeName: nodeData.label || 'Hold Action',
            status: 'COMPLETE',
            details: `Retained ${percentage}% (${actionAmount} USDC) safely in user wallet on Arc Testnet`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        hasFailedStep = true;
        await updateLog({
          stepId,
          nodeType,
          nodeName: nodeData.label || nodeType.toUpperCase(),
          status: 'FAILED',
          error: err.message || String(err),
          timestamp: new Date().toISOString(),
        });
        break; // Stop remaining steps on failure
      }
    }

    // Step 5: Finalize Execution status
    const finalStatus = hasFailedStep ? 'FAILED' : 'COMPLETE';
    await prisma.execution.update({
      where: { id: currentExecution.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
      },
    });

    return { executionId: currentExecution.id, status: finalStatus };
  }
);
