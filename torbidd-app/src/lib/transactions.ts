// =============================================================================
// lib/transactions.ts - Business Logic Database Transactions (ASVS V2.3.3)
// =============================================================================
// ASVS V2.3.3 Requirement:
// "Verify that transactions are being used at the business logic level such
// that either a business logic operation succeeds in its entirety or it is
// rolled back to the previous correct state."
// =============================================================================

import type { ClientSession } from 'mongoose';
import connectToDatabase from './mongodb';

export interface TransactionOptions {
  /**
   * Optional custom session timeout in milliseconds.
   */
  timeoutMs?: number;
}

/**
 * Checks whether the current MongoDB connection supports multi-document transactions.
 * Transactions in MongoDB require a replica set or sharded cluster.
 */
export async function isTransactionSupported(): Promise<boolean> {
  try {
    const conn = await connectToDatabase();
    // Check if client topology is a replica set or sharded cluster
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawConn = conn.connection as any;
    const client = typeof rawConn?.getClient === 'function' ? rawConn.getClient() : rawConn?.client;
    if (!client?.topology) return false;

    const description = client.topology.description;
    const type = description?.type;

    // ReplicaSetNoPrimary, ReplicaSetWithPrimary, Sharded, LoadBalanced all support transactions
    if (type && (type.includes('ReplicaSet') || type === 'Sharded' || type === 'LoadBalanced')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Executes a business logic operation inside a managed ACID MongoDB transaction.
 *
 * If any error is thrown during `operation`, the transaction is automatically
 * aborted and all database modifications made within the session are rolled back
 * to the previous correct state (ASVS V2.3.3).
 *
 * If the active MongoDB deployment is a standalone instance (such as local dev
 * without a replica set), it safely executes the operation with `session = null`
 * to maintain operational compatibility.
 *
 * @param operation The business logic callback receiving the active `ClientSession`.
 *                  All Mongoose queries inside should pass `{ session }`.
 */
export async function withTransaction<T>(
  operation: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const conn = await connectToDatabase();

  let session: ClientSession | null = null;
  try {
    session = await conn.startSession();
  } catch (sessionErr: unknown) {
    const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
    // Standalone MongoDB instances without replica sets cannot start transaction sessions
    console.warn(`[Transactions] Unable to start MongoDB session: ${msg}. Proceeding without transaction session.`);
    return operation(null);
  }

  try {
    let result: T;
    let transactionExecuted = false;

    try {
      await session.withTransaction(async () => {
        transactionExecuted = true;
        result = await operation(session);
      });
      return result!;
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      const fullMsg = `${msg} ${txErr && typeof txErr === 'object' ? JSON.stringify(txErr) : ''}`;
      const isStandaloneUnsupported =
        fullMsg.includes('replica set') ||
        fullMsg.includes('Standalone') ||
        fullMsg.includes('retryable writes') ||
        fullMsg.includes('Transaction numbers are only allowed') ||
        fullMsg.includes('Transactions are not supported') ||
        fullMsg.includes('IllegalOperation');

      if (isStandaloneUnsupported) {
        // Fallback for standalone test/dev databases without replica set enabled
        console.warn(`[Transactions] Deployment does not support replica set transactions. Executing standalone fallback: ${msg}`);
        return await operation(null);
      }

      // Re-throw to trigger upper-layer error handling after automatic rollback
      throw txErr;
    }
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
}
