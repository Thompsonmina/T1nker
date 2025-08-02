
import { ContractAbstractionFromContractType, WalletContractAbstractionFromContractType } from './type-utils';
import { address, nat, unit } from './type-aliases';

export type Storage = unit;

type Methods = {
    default: (
        token_opt: {Some: address} | null,
        from_: address,
        to_: address,
        amount: nat,
    ) => Promise<void>;
};

export type DefaultParams = {Some: address} | null

type MethodsObject = {
    default: (params: {
        token_opt: {Some: address} | null,
        from_: address,
        to_: address,
        amount: nat,
    }) => Promise<void>;
};

type contractTypes = { methods: Methods, methodsObject: MethodsObject, storage: Storage, code: { __type: 'UniversalTransferCode', protocol: string, code: object[] } };
export type UniversalTransferContractType = ContractAbstractionFromContractType<contractTypes>;
export type UniversalTransferWalletType = WalletContractAbstractionFromContractType<contractTypes>;
