import mongoose from "mongoose";

/**
 * Executes the provided callback inside a MongoDB transaction session.
 * If the MongoDB instance is a standalone deployment (which doesn't support transactions),
 * it gracefully falls back to direct execution.
 * 
 * @param callback The function containing database queries to run.
 */
export async function runInTransaction<T>(
  callback: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    try {
      session.startTransaction();
      result = await callback(session);
      await session.commitTransaction();
    } catch (error) {
      const txError = error as Error & { codeName?: string; code?: number };
      // Check if it's a replica set transaction constraint error.
      // Error code 20 corresponds to 'TransactionNumbersCannotBeBegan'.
      // standalone servers typically raise this error.
      const isReplicaSetError =
        txError.message?.includes("Replica Set") ||
        txError.message?.includes("replica set") ||
        txError.codeName === "TransactionReceiverError" ||
        txError.code === 20;

      if (isReplicaSetError) {
        // Standalone Server detected. Abort the transaction locally and fall back.
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        console.warn(
          "MongoDB is not running as a Replica Set. Falling back to ordered non-transaction execution."
        );
        // Execute without a transaction session
        result = await callback();
      } else {
        // Real application query / validation / conflict error: abort and bubble up.
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        throw txError;
      }
    }
    return result;
  } finally {
    session.endSession();
  }
}
