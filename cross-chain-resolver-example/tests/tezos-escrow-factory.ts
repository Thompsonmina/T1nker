
import taquitoSigner from '@taquito/signer';
import taquito from '@taquito/taquito';
import { Storage } from '../cross-chain-swap-tezos/types/EscrowManager.types';
import { BigNumber } from 'bignumber.js';


async function get_escrow_manager_storage(escrow_manager_contract: taquito.Contract): Promise<Storage> {
    const storage = await escrow_manager_contract.storage<Storage>();
    // console.log("storage", storage)
    return storage;
}

export const create_tez_src_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any, XTZ_ESCROW_AMT: number, SAFETY_DEPOSIT: number) => {
    const op = await escrow_manager_contract.methodsObject
      .createSrcEscrow({ immutables, rescue_delay: 6000 })
      .send({ amount: XTZ_ESCROW_AMT + SAFETY_DEPOSIT, mutez: true });
    await op.confirmation(1);
    return op;
}

export const create_tez_dst_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any, src_cancellation_timestamp: number, XTZ_ESCROW_AMT: number, SAFETY_DEPOSIT: number) => {
    const op = await escrow_manager_contract.methodsObject
      .createDstEscrow({ immutables, rescue_delay: 6000, src_cancellation_timestamp })
      .send({ amount: XTZ_ESCROW_AMT + SAFETY_DEPOSIT, mutez: true });
    await op.confirmation(1);
    return op;
}

export const create_fa2_src_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any, XTZ_ESCROW_AMT: number, SAFETY_DEPOSIT: number) => {
    const op = await escrow_manager_contract.methodsObject
      .createSrcEscrow({ immutables, rescue_delay: 6000 })
      .send({ amount: SAFETY_DEPOSIT, mutez: true });
    await op.confirmation(1);
    return op;
}

export const create_fa2_dst_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any, src_cancellation_timestamp: number, XTZ_ESCROW_AMT: number, SAFETY_DEPOSIT: number) => {
    const op = await escrow_manager_contract.methodsObject
        .createDstEscrow({ immutables, rescue_delay: 6000, src_cancellation_timestamp })
        .send({ amount: SAFETY_DEPOSIT, mutez: true });
    await op.confirmation(1);
    return op;
}

export function tzktPayloadToImmutables(payload: any): any {
    if (!payload) return null;

    const amount = new BigNumber(payload.amount);
    const safetyDeposit = new BigNumber(payload.safetyDeposit);

    const timelocksInSeconds: { [key: string]: number } = {};
    for (const key in payload.timelocks) {
        timelocksInSeconds[key] = Math.floor(new Date(payload.timelocks[key]).getTime() / 1000);
    }

    return {
        ...payload,
        amount,
        safetyDeposit,
        timelocks: timelocksInSeconds
    };
}

export async function getLatestEventPayload(contractAddress: string, tag: string): Promise<any | null> {
    try {
        const url = `https://api.ghostnet.tzkt.io/v1/contracts/events?contract=${contractAddress}&tag=${tag}&sort.desc=id&limit=1`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch events from TzKT: ${response.statusText}`);
        }
        const events = await response.json();
        if (events && events.length > 0) {
            return events[0].payload;
        }
        return null;
    } catch (error) {
        console.error("Error fetching latest event payload:", error);
        return null;
    }
}

export const getBalance = async (tezoshandler: taquito.TezosToolkit, addr: string) =>
    Number(await tezoshandler.tz.getBalance(addr));

export async function fa2Balance(fa2_kt_contract: taquito.Contract, addr: string): Promise<number> {
    const res = await fa2_kt_contract.contractViews.get_balance_of([{ token_id: 0, owner: addr }]).executeView({ viewCaller: fa2_kt_contract.address })
    return Number(res[0].balance);
}

export const hasSrcCreatedEvent = (opResults: any[]): boolean => {
    const intOps = opResults?.[0]?.metadata?.internal_operation_results ?? [];
    return intOps.some((r: any) => r.kind === 'event' && r.tag === 'EscrowSrcCreated');
};


export async function escrowExists(escrow_manager_contract: taquito.Contract, immutables: any): Promise<boolean> {
    try {
        const isActive = await escrow_manager_contract.contractViews
            .escrow_exists(immutables)
            .executeView({ viewCaller: escrow_manager_contract.address });
        return isActive;
    } catch (error: any) {
        if (error.message.includes("No Escrows exist")) {
            return false;
        }
        throw error;
    }
}