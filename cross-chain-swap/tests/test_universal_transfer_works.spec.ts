import { RpcClient } from '@taquito/rpc';
import { InMemorySigner } from '@taquito/signer';
import { TezosToolkit, Contract } from '@taquito/taquito';
import { Storage } from '../types/UniversalTransfer.types';

// import { err, log, stringify, warn } from './test-helpers';
import {path} from 'rambda'
import fetch from 'node-fetch'
import { exec } from 'child_process'
// import { describe, test, expect, beforeAll } from '@jest/globals';



const getTaqueriaConfig = async (envname: 'development' | 'testing') => {
    // const config = await getConfigV2(process.env)



    let rpc_url = "https://ghostnet.ecadinfra.com"
    let alice_sk = "edskS1SivTJESudRQgn9KidKWtZjm8RnL2nyF5QFU8GSxi22u9PVpmHU5BHiF29BwwsJk6mdCV2XqeQ3JpVw9khzhvrUMXYpAm"
    let alice_address = "tz1Ys4iNA8odKJVBysTaZyQidvcHMKLTxvud"
    let bob_address = "tz1cPwxzsVciajsGHdbUYKqsCVVCKx3yK2sG"
    let bob_sk = "edskS3HnwZyg8parekZBktxYEBxYN7c52etbkwxQh7sC7GCeXZxZKFvmTeBB4e7buDuhDekUUT2CkxMtKgzpJeLi7NQEKLtHxh"

    let uni_transfer_address = "KT1BfKqFtHswtYeHzfJtH9d27pM6QiHFtGXx"
    let fa2_kt_address = "KT1KHtMYqCuBTMHmSjDb3JYRXvKY4c8yb4TY"

    if (envname == "development") {
        // const devEnv = V2.getEnv("development", config)
        // const alice_sk = String(path('accounts.alice.secretKey', devEnv)).replace('unencrypted:', '')
        // const rpc_url = devEnv['rpcUrl'] as string
        const Tezos = new TezosToolkit(rpc_url)
        const admin_signer = new InMemorySigner(alice_sk);
        Tezos.setSignerProvider(admin_signer);

        const BobTezos = new TezosToolkit(rpc_url)
        const bob_signer = new InMemorySigner(bob_sk);
        BobTezos.setSignerProvider(bob_signer);

        return {
            rpc_url,
            alice: alice_address,
            alice_sk: alice_sk,
            bob: bob_address,
            uni_transfer: uni_transfer_address,
            fa2_kt: fa2_kt_address,
            Tezos,
            admin_signer,
            BobTezos,
            bob_signer
        }
    }
}

export const setupTaqueriaTest = async () => {
    const config = await getTaqueriaConfig('development')
    if (!config) throw new Error('Could not get Taqueria config')
    
    const { Tezos, uni_transfer, fa2_kt, alice, bob, BobTezos } = config
    
    // Additional setup if needed
    return {
        Tezos,
        uni_transfer,
        fa2_kt,
        alice,
        bob,    
        BobTezos,
        // Add other needed properties
    }    
}

// create a generic jest describe suit with a simple test in it 2 + 2 = 4
describe('Trivial Tests', () => {
    it('should add 2 + 2 = 4', () => {
        expect(2 + 2).toBe(4);
    });
});


describe('Universal Transfer Tests', () => {
    
    const TEST_TIME_OUT = 30000;
    let Tezos: TezosToolkit;
    let uni_transfer: string;
    let uni_transfer_contract: Contract;
    let fa2_kt: string;
    let fa2_kt_contract: Contract;
    let alice: string;
    let bob: string;
    let BobTezos: TezosToolkit;

    beforeAll(async () => {
        // Get config
        const config = await setupTaqueriaTest();
        Tezos = config.Tezos;
        alice = config.alice;
        bob = config.bob;
        uni_transfer = config.uni_transfer;
        fa2_kt = config.fa2_kt;
        BobTezos = config.BobTezos;
        // await Tezos.contract.transfer({
        //     to:     uni_transfer,
        //     amount: 1                                    // 3 ꜩ
        // }).then(op => op.confirmation());
            

        // Initialize contract
        uni_transfer_contract = await Tezos.contract.at(uni_transfer);
        fa2_kt_contract = await BobTezos.contract.at(fa2_kt);
    });

    // Helper to fetch tez balance of an implicit account
    const getBalance = async (addr: string) =>
        Number(await Tezos.tz.getBalance(addr));

    
    // // Helper to call the FA2 on-chain view `get_balance`
    // async function fa2Balance(addr: string): Promise<number> {
    //     // Parameter structure: pair addr nat(tokenId)
    //     const res: any = await fa2_kt_contract.views.get_balance({ nat: 0, address: addr }).read();  // proto V views
    //     return Number(res);
    // }

    async function fa2Balance(addr: string): Promise<number> {           // FA2 contract
        /* Michelson view expects (pair address nat)      →  {0: addr, 1: tokenId} */
        const res = await fa2_kt_contract.contractViews.get_balance_of([{ token_id: 0, owner: addr }]).executeView({ viewCaller: fa2_kt_contract.address }) // token-id 0
        console.log("res", Number(res[0].balance))
        return Number(res[0].balance);
      }
  

    test('Contract has all required entrypoints', async () => {
        try {
            const methods = uni_transfer_contract.parameterSchema.ExtractSignatures();
            const requiredMethods = ['transfer'];

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

    // test alice and bob have tez
    test('alice and bob have tez', async () => {
        const alice_balance = await getBalance(alice);
        const bob_balance = await getBalance(bob);
        expect(alice_balance).toBeGreaterThan(0);
        expect(bob_balance).toBeGreaterThan(0);
        console.log("alice_balance", alice_balance)
        console.log("bob_balance", bob_balance)
    }, TEST_TIME_OUT);

    test('alice and bob have fa2 tokens', async () => {
        const alice_balance = await fa2Balance(alice);
        const bob_balance = await fa2Balance(bob);
        expect(alice_balance).toBeGreaterThan(0);
        expect(bob_balance).toBeGreaterThan(0);
    }, TEST_TIME_OUT);

    test(
        'Contract can transfer tez to implicit accounts',
        async () => {
          const beforeA = await getBalance(alice);
            const beforeB = await getBalance(bob);
            console.log("beforeA", beforeA)
            console.log("beforeB", beforeB)

    
          const tezParam = {
            token_opt: null,                 // None() in JS = null
            from_: uni_transfer_contract.address,
            to_:   bob,
            amount: 2_000               // mutez  → 2ꜩ
          };
    
          const op = await uni_transfer_contract.methodsObject.transfer(tezParam).send({amount: 1});
          await op.confirmation();                                  // 1 conf is fine
    
          const afterA = await getBalance(alice);
          const afterB = await getBalance(bob);
    
          // fee < 0.1ꜩ ensures simple ≥ check is robust
          expect(afterA).toBeLessThan(beforeA - 1_900);         // spent 2ꜩ + fee
          expect(afterB).toBe(beforeB + 2_000);
          console.log("afterA", afterA)
          console.log("afterB", afterB)
        },
        TEST_TIME_OUT
    );
    

    test(
        'Contract can transfer FA2 tokens to implicit accounts',
        async () => {
          const beforeA = await fa2Balance(alice);
            const beforeB = await fa2Balance(bob);
            console.log("beforeA", beforeA)
            console.log("beforeB", beforeB)


             // transfer 100 units of token 0 from bob to the contract
            const from_ = bob;                            // Alice
            const to_ = uni_transfer_contract.address;
            // contract
            await fa2_kt_contract.methodsObject.transfer([
              { from_, txs: [{ to_, token_id: 0, amount: 100 }] }                            // 100 units
            ]).send().then(op => op.confirmation());



          const fa2Param = {
            token_opt: fa2_kt,                // Some(address) in JS
            from_: uni_transfer_contract.address,
            to_:   alice,
            amount: 100
          };
    
          const op = await uni_transfer_contract.methodsObject.transfer(fa2Param).send();
          await op.confirmation();
    
          const afterA = await fa2Balance(alice);
          const afterB = await fa2Balance(bob);
    
          expect(afterB).toBe(beforeB - 100);
        expect(afterA).toBe(beforeA + 100);
          console.log("afterA", afterA)
          console.log("afterB", afterB)
        },
        TEST_TIME_OUT
    );

    // test alice can transfer tez to bob
});
