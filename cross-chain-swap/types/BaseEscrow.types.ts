
import { ContractAbstractionFromContractType, WalletContractAbstractionFromContractType } from './type-utils';
import { bytes } from './type-aliases';

export type Storage = boolean;

type Methods = {
    default: (
        secret: bytes,
        hashlock: bytes,
    ) => Promise<void>;
};

export type DefaultParams = bytes

type MethodsObject = {
    default: (params: {
        secret: bytes,
        hashlock: bytes,
    }) => Promise<void>;
};

type contractTypes = { methods: Methods, methodsObject: MethodsObject, storage: Storage, code: { __type: 'BaseEscrowCode', protocol: string, code: object[] } };
export type BaseEscrowContractType = ContractAbstractionFromContractType<contractTypes>;
export type BaseEscrowWalletType = WalletContractAbstractionFromContractType<contractTypes>;
