
import { ContractAbstractionFromContractType, WalletContractAbstractionFromContractType } from './type-utils';
import { address, BigMap, bytes, int, nat, timestamp, unit } from './type-aliases';

export type Storage = BigMap<bytes, {
    escrow_state: (
        { active: unit }
        | { cancelled: unit }
        | { finalized: unit }
    );
    escrow_type: (
        { source: unit }
        | { destination: unit }
    );
    rescue_delay: int;
}>;

type Methods = {
    dstCancel: (
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        deployedAt: timestamp,
        srcWithdrawal: timestamp,
        srcPublicWithdrawal: timestamp,
        srcCancellation: timestamp,
        srcPublicCancellation: timestamp,
        dstWithdrawal: timestamp,
        dstPublicWithdrawal: timestamp,
        dstCancellation: timestamp,
    ) => Promise<void>;
    dstPublicWithdraw: (
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    ) => Promise<void>;
    dstWithdraw: (
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    ) => Promise<void>;
    srcCancel: (
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        deployedAt: timestamp,
        srcWithdrawal: timestamp,
        srcPublicWithdrawal: timestamp,
        srcCancellation: timestamp,
        srcPublicCancellation: timestamp,
        dstWithdrawal: timestamp,
        dstPublicWithdrawal: timestamp,
        dstCancellation: timestamp,
    ) => Promise<void>;
    srcPublicWithdraw: (
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    ) => Promise<void>;
    srcWithdrawTo: (
        secret: bytes,
        target: address,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    ) => Promise<void>;
    srcWithdraw: (
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    ) => Promise<void>;
    rescueFunds: (
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
        rescueDelay: int,
        token_opt: {Some: address} | null,
        amount: nat,
    ) => Promise<void>;
    createDstEscrow: (
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
        rescue_delay: int,
        src_cancellation_timestamp: timestamp,
    ) => Promise<void>;
    createSrcEscrow: (
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
        rescue_delay: int,
    ) => Promise<void>;
};

export type DstCancelParams = bytes
export type DstPublicWithdrawParams = bytes
export type DstWithdrawParams = bytes
export type SrcCancelParams = bytes
export type SrcPublicWithdrawParams = bytes
export type SrcWithdrawToParams = bytes
export type SrcWithdrawParams = bytes
export type RescueFundsParams = bytes
export type CreateDstEscrowParams = bytes
export type CreateSrcEscrowParams = bytes

type MethodsObject = {
    dstCancel: (params: {
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        deployedAt: timestamp,
        srcWithdrawal: timestamp,
        srcPublicWithdrawal: timestamp,
        srcCancellation: timestamp,
        srcPublicCancellation: timestamp,
        dstWithdrawal: timestamp,
        dstPublicWithdrawal: timestamp,
        dstCancellation: timestamp,
    }) => Promise<void>;
    dstPublicWithdraw: (params: {
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    }) => Promise<void>;
    dstWithdraw: (params: {
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    }) => Promise<void>;
    srcCancel: (params: {
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        deployedAt: timestamp,
        srcWithdrawal: timestamp,
        srcPublicWithdrawal: timestamp,
        srcCancellation: timestamp,
        srcPublicCancellation: timestamp,
        dstWithdrawal: timestamp,
        dstPublicWithdrawal: timestamp,
        dstCancellation: timestamp,
    }) => Promise<void>;
    srcPublicWithdraw: (params: {
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    }) => Promise<void>;
    srcWithdrawTo: (params: {
        secret: bytes,
        target: address,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    }) => Promise<void>;
    srcWithdraw: (params: {
        secret: bytes,
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
    }) => Promise<void>;
    rescueFunds: (params: {
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
        rescueDelay: int,
        token_opt: {Some: address} | null,
        amount: nat,
    }) => Promise<void>;
    createDstEscrow: (params: {
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
        rescue_delay: int,
        src_cancellation_timestamp: timestamp,
    }) => Promise<void>;
    createSrcEscrow: (params: {
        orderHash: bytes,
        hashlock: bytes,
        maker: address,
        taker: address,
        token: {Some: address} | null,
        amount: nat,
        safetyDeposit: nat,
        timelocks: {
            deployedAt: timestamp;
            srcWithdrawal: timestamp;
            srcPublicWithdrawal: timestamp;
            srcCancellation: timestamp;
            srcPublicCancellation: timestamp;
            dstWithdrawal: timestamp;
            dstPublicWithdrawal: timestamp;
            dstCancellation: timestamp;
        },
        rescue_delay: int,
    }) => Promise<void>;
};

type contractTypes = { methods: Methods, methodsObject: MethodsObject, storage: Storage, code: { __type: 'EscrowManagerCode', protocol: string, code: object[] } };
export type EscrowManagerContractType = ContractAbstractionFromContractType<contractTypes>;
export type EscrowManagerWalletType = WalletContractAbstractionFromContractType<contractTypes>;
