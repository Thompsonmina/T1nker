import { RpcClient } from '@taquito/rpc';

import taquitoSigner from '@taquito/signer';
import taquito from '@taquito/taquito';
import { Storage,  } from '../../cross-chain-swap-tezos/types/EscrowManager.types';


// import { TezosToolkit, MichelsonMap, OpKind } from '@taquito/taquito';
import { BigNumber } from 'bignumber.js';
// import { buf2hex, stringToBytes } from '@taquito/utils';
import taquitoUtils from '@taquito/utils';
import crypto from 'crypto';



// console.log("taquitoSigner", taquitoSigner)
// console.log("taquito", taquito)

const getTaqueriaConfig = async () => {
    // const config = await getConfigV2(process.env)
    let rpc_url = "https://ghostnet.ecadinfra.com"

    let alice_sk = "edskS1SivTJESudRQgn9KidKWtZjm8RnL2nyF5QFU8GSxi22u9PVpmHU5BHiF29BwwsJk6mdCV2XqeQ3JpVw9khzhvrUMXYpAm"
    let alice_address = "tz1Ys4iNA8odKJVBysTaZyQidvcHMKLTxvud"
    let bob_address = "tz1cPwxzsVciajsGHdbUYKqsCVVCKx3yK2sG"
    let bob_sk = "edskS3HnwZyg8parekZBktxYEBxYN7c52etbkwxQh7sC7GCeXZxZKFvmTeBB4e7buDuhDekUUT2CkxMtKgzpJeLi7NQEKLtHxh"

    let escrow_manager_address = "KT1BFrmYaHYtoPVjkaPNK3fZzdnp2B4EgJZJ"
    let fa2_kt_address = "KT1KHtMYqCuBTMHmSjDb3JYRXvKY4c8yb4TY"


 
    const Tezos = new taquito.TezosToolkit(rpc_url)
    const admin_signer = new taquitoSigner.InMemorySigner(alice_sk);
    Tezos.setSignerProvider(admin_signer);

    console.log("bobs uncle")
    const BobTezos = new taquito.TezosToolkit(rpc_url)
    const bob_signer = new taquitoSigner.InMemorySigner(bob_sk);
    BobTezos.setSignerProvider(bob_signer);


        return {
            rpc_url,
            alice: alice_address,
            alice_sk: alice_sk,
            bob: bob_address,
            escrow_manager: escrow_manager_address,
            fa2_kt: fa2_kt_address,
            Tezos,
            admin_signer,
            BobTezos,
            bob_signer
        }
    
}

export const setupTaqueriaTest = async () => {
    const config = await getTaqueriaConfig()
    if (!config) throw new Error('Could not get Taqueria config')
    
    const { Tezos, escrow_manager, fa2_kt, alice, bob, BobTezos } = config
    
    // Additional setup if needed
    return {
        Tezos,
        escrow_manager,
        fa2_kt,
        alice,
        bob,    
        BobTezos,
        // Add other needed properties
    }    
}

const randomHex = (bytes: number) => '0x' + crypto.randomBytes(bytes).toString('hex');

const makeTimelocks = (now: number) => ({
    srcWithdrawal:       now + 10,
    srcPublicWithdrawal: now + 120,
    srcCancellation:     now + 121,
    srcPublicCancellation: now + 122,
    dstWithdrawal:       now + 10,
    dstPublicWithdrawal: now + 100,
    dstCancellation:     now + 101,
    deployedAt:          now          // timestamp (seconds)
});


// one place to tweak the escrowed amount for both tests
const XTZ_ESCROW_AMT = 20000;           // 2 ꜩ
const TOKEN_ESCROW_AMT = 100;     // 5 000 token-units
const SAFETY_DEPOSIT = 2000         // src side doesn’t send it


// create a generic jest describe suit with a simple test in it 2 + 2 = 4
describe('Trivial Test', () => {
    it('2 + 2 = 4', () => {
        expect(2 + 2).toBe(4);
    });
});


describe('Test Escrow Manager', () => {
    
    const TEST_TIME_OUT = 30000;
    let Tezos: taquito.TezosToolkit;
    let escrow_manager: string;
    let escrow_manager_contract: taquito.Contract;
    let fa2_kt: string;
    let fa2_kt_contract: taquito.Contract;
    let alice: string;
    let bob: string;
    let BobTezos: taquito.TezosToolkit;

    beforeAll(async () => {
        // Get config
        const config = await setupTaqueriaTest();
        Tezos = config.Tezos;
        alice = config.alice;
        bob = config.bob;
        escrow_manager = config.escrow_manager;
        fa2_kt = config.fa2_kt;
        BobTezos = config.BobTezos;
        // await Tezos.contract.transfer({
        //     to:     uni_transfer,
        //     amount: 1                                    // 3 ꜩ
        // }).then(op => op.confirmation());
            

        // Initialize contract
        escrow_manager_contract = await Tezos.contract.at(escrow_manager);
        fa2_kt_contract = await BobTezos.contract.at(fa2_kt);
    });

    async function get_escrow_manager_storage(): Promise<Storage> {
        const storage = await escrow_manager_contract.storage<Storage>();
        // console.log("storage", storage)
        return storage;
    }

    const buildImmutables = (
        tokenOpt: string | null,
        amount: number
      ) => ({
        orderHash:      'b157e8fa0faaed7c0d56196dd78430dfb8b416a7e41d6d89058caa7a4462c617',
        hashlock:       'd64b150ee5d350ec6284c7f6c7af8985d0e5dee26640e04befa2584797f40e3e',
        maker:          alice,
        taker:          bob,
        token:          tokenOpt ? tokenOpt : null,
        amount,                         // nat
        safetyDeposit: SAFETY_DEPOSIT, // nat
        timelocks:      makeTimelocks(1735689600)
        // timelocks:      makeTimelocks(Math.floor(Date.now() / 1000))
    });
    
    const hasSrcCreatedEvent = (opResults: any[]): boolean => {
        const intOps = opResults?.[0]?.metadata?.internal_operation_results ?? [];
        return intOps.some((r: any) => r.kind === 'event' && r.tag === 'EscrowSrcCreated');
    };
    


    // Helper to fetch tez balance of an implicit account
    const getBalance = async (addr: string) =>
        Number(await Tezos.tz.getBalance(addr));


    async function fa2Balance(addr: string): Promise<number> {           // FA2 contract
        /* Michelson view expects (pair address nat)      →  {0: addr, 1: tokenId} */
        const res = await fa2_kt_contract.contractViews.get_balance_of([{ token_id: 0, owner: addr }]).executeView({ viewCaller: fa2_kt_contract.address }) // token-id 0
        console.log("res", Number(res[0].balance))
        return Number(res[0].balance);
      }
  

    test('Contract has all required entrypoints', async () => {
        try {
            const methods = escrow_manager_contract.parameterSchema.ExtractSignatures();
            const requiredMethods = ['createSrcEscrow', 'createDstEscrow', 'rescueFunds', 'srcCancel', 'dstCancel',
                'srcPublicWithdraw', 'dstPublicWithdraw', 'srcWithdraw', 'srcWithdrawTo', 'dstWithdraw'];
            requiredMethods.forEach(method => {
                expect(JSON.stringify(methods)).toContain(method);
            });
        } catch (error) {
            throw new Error(
                `Error checking contract methods: ${error}\n` +
                'Did you run "npm run originate:development"?'
            );
        }
    }, TEST_TIME_OUT);

    test('creates a source escrow in tez and emits EscrowSrcCreated', async () => {
        const immutables = buildImmutables(null, XTZ_ESCROW_AMT);
    
        const aliceBalBefore   = await getBalance(alice);
        const mgrBalBefore     = await getBalance(escrow_manager);
    
        const op = await escrow_manager_contract.methodsObject
          .createSrcEscrow({ immutables, rescue_delay: 6000 })
          .send({ amount: XTZ_ESCROW_AMT, mutez: true });          // amount in ꜩ
        await op.confirmation(1);
    
        expect(op.status).toBe('applied');
        expect(hasSrcCreatedEvent(op.results)).toBe(true);
    
        const aliceBalAfter    = await getBalance(alice);
        const mgrBalAfter = await getBalance(escrow_manager);
        const storage = await get_escrow_manager_storage();
        console.log("storage", storage)

    
        // Alice paid the escrow amount (+gas); manager received it
        expect(mgrBalAfter - mgrBalBefore).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT);
        expect(aliceBalBefore - aliceBalAfter).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT);
      }, TEST_TIME_OUT);

    // // test alice and bob have tez
    // test('alice and bob have tez', async () => {
    //     const alice_balance = await getBalance(alice);
    //     const bob_balance = await getBalance(bob);
    //     expect(alice_balance).toBeGreaterThan(0);
    //     expect(bob_balance).toBeGreaterThan(0);
    //     console.log("alice_balance", alice_balance)
    //     console.log("bob_balance", bob_balance)
    // }, TEST_TIME_OUT);

    // test('alice and bob have fa2 tokens', async () => {
    //     const alice_balance = await fa2Balance(alice);
    //     const bob_balance = await fa2Balance(bob);
    //     expect(alice_balance).toBeGreaterThan(0);
    //     expect(bob_balance).toBeGreaterThan(0);
    // }, TEST_TIME_OUT);

    // test(
    //     'Contract can transfer tez to implicit accounts',
    //     async () => {
    //       const beforeA = await getBalance(alice);
    //         const beforeB = await getBalance(bob);
    //         console.log("beforeA", beforeA)
    //         console.log("beforeB", beforeB)

    
    //       const tezParam = {
    //         token_opt: null,                 // None() in JS = null
    //         from_: uni_transfer_contract.address,
    //         to_:   bob,
    //         amount: 2_000               // mutez  → 2ꜩ
    //       };
    
    //       const op = await uni_transfer_contract.methodsObject.transfer(tezParam).send({amount: 1});
    //       await op.confirmation();                                  // 1 conf is fine
    
    //       const afterA = await getBalance(alice);
    //       const afterB = await getBalance(bob);
    
    //       // fee < 0.1ꜩ ensures simple ≥ check is robust
    //       expect(afterA).toBeLessThan(beforeA - 1_900);         // spent 2ꜩ + fee
    //       expect(afterB).toBe(beforeB + 2_000);
    //       console.log("afterA", afterA)
    //       console.log("afterB", afterB)
    //     },
    //     TEST_TIME_OUT
    // );
    

    // test(
    //     'Contract can transfer FA2 tokens to implicit accounts',
    //     async () => {
    //       const beforeA = await fa2Balance(alice);
    //         const beforeB = await fa2Balance(bob);

    //          // transfer 100 units of token 0 from bob to the contract
    //         const from_ = bob;                            // Alice
    //         const to_ = uni_transfer_contract.address;
    //         // contract
    //         await fa2_kt_contract.methodsObject.transfer([
    //           { from_, txs: [{ to_, token_id: 0, amount: 100 }] }                            // 100 units
    //         ]).send().then(op => op.confirmation());


    //       const fa2Param = {
    //         token_opt: fa2_kt,                // Some(address) in JS
    //         from_: uni_transfer_contract.address,
    //         to_:   alice,
    //         amount: 100
    //       };
    
    //       const op = await uni_transfer_contract.methodsObject.transfer(fa2Param).send();
    //       await op.confirmation();
    
    //       const afterA = await fa2Balance(alice);
    //       const afterB = await fa2Balance(bob);
    
    //       expect(afterB).toBe(beforeB - 100);
    //         expect(afterA).toBe(beforeA + 100);
            
    //       console.log("beforeA", beforeA)
    //       console.log("beforeB", beforeB)
    //       console.log("afterA", afterA)
    //       console.log("afterB", afterB)
    //     },
    //     TEST_TIME_OUT
    // );

    // test alice can transfer tez to bob
});
