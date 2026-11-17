// =============================================================================
// lib/__tests__/transactions.test.ts - Unit Tests for Business Logic Transactions
// ASVS Requirement V2.3.3: Business Logic Level Database Transactions
// =============================================================================

import { withTransaction } from '../transactions';
import mongoose from 'mongoose';

// Mock connectToDatabase so tests run without requiring external live MongoDB instance
jest.mock('../mongodb', () => {
  return {
    __esModule: true,
    connectToDatabase: jest.fn().mockImplementation(async () => {
      return mongoose;
    }),
    default: jest.fn().mockImplementation(async () => {
      return mongoose;
    }),
  };
});

describe('ASVS V2.3.3: Business Logic Level Database Transactions', () => {
  let mockSession: mongoose.ClientSession;

  beforeEach(() => {
    mockSession = {
      withTransaction: jest.fn().mockImplementation(async (cb) => {
        return await cb();
      }),
      endSession: jest.fn().mockResolvedValue(undefined),
    } as unknown as mongoose.ClientSession;

    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes operation successfully within transaction session when no errors occur', async () => {
    const result = await withTransaction(async (session) => {
      expect(session).toBe(mockSession);
      const step1 = 'step1_completed';
      const step2 = 'step2_completed';
      return { step1, step2, sessionBound: session !== null };
    });

    expect(result.step1).toBe('step1_completed');
    expect(result.step2).toBe('step2_completed');
    expect(result.sessionBound).toBe(true);
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('automatically rolls back and re-throws when an error occurs during transaction', async () => {
    let intermediateStateChanged = false;

    (mockSession.withTransaction as jest.Mock).mockImplementationOnce(async (cb) => {
      try {
        await cb();
      } catch (err) {
        // Simulates MongoDB driver aborting transaction and re-throwing
        throw err;
      }
    });

    await expect(
      withTransaction(async () => {
        intermediateStateChanged = true;
        throw new Error('Simulated database error in business logic step 2');
      }),
    ).rejects.toThrow('Simulated database error in business logic step 2');

    expect(intermediateStateChanged).toBe(true);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('handles replica-set unsupported error by falling back gracefully without crash', async () => {
    (mockSession.withTransaction as jest.Mock).mockRejectedValueOnce(
      new Error(
        'Transaction numbers are only allowed on a storage engine supporting replica sets',
      ),
    );

    const fallbackResult = await withTransaction(async (session) => {
      expect(session).toBeNull();
      return 'executed_in_standalone_fallback';
    });

    expect(fallbackResult).toBe('executed_in_standalone_fallback');
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('ensures session is ended in finally block even if transaction fails', async () => {
    (mockSession.withTransaction as jest.Mock).mockRejectedValueOnce(
      new Error('Failure during transactional operation'),
    );

    await expect(
      withTransaction(async () => {
        // Operation
      }),
    ).rejects.toThrow('Failure during transactional operation');

    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });
});
