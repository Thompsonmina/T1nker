
import taquitoSigner from '@taquito/signer';
import taquito from '@taquito/taquito';
import { Storage,  } from '../../cross-chain-swap-tezos/types/EscrowManager.types';


// import { TezosToolkit, MichelsonMap, OpKind } from '@taquito/taquito';
import { BigNumber } from 'bignumber.js';

import taquitoUtils from '@taquito/utils';
import crypto from 'crypto';
import keccak from 'keccak';
import { expect } from '@jest/globals';



// console.log("taquitoSigner", taquitoSigner)
// console.log("taquito", taquito)

const getTaqueriaConfig = async () => {
    // const config = await getConfigV2(process.env)
    let rpc_url = "https://ghostnet.ecadinfra.com"

    let alice_sk = "edskS1SivTJESudRQgn9KidKWtZjm8RnL2nyF5QFU8GSxi22u9PVpmHU5BHiF29BwwsJk6mdCV2XqeQ3JpVw9khzhvrUMXYpAm"
    let alice_address = "tz1Ys4iNA8odKJVBysTaZyQidvcHMKLTxvud"
    let bob_address = "tz1cPwxzsVciajsGHdbUYKqsCVVCKx3yK2sG"
    let bob_sk = "edskS3HnwZyg8parekZBktxYEBxYN7c52etbkwxQh7sC7GCeXZxZKFvmTeBB4e7buDuhDekUUT2CkxMtKgzpJeLi7NQEKLtHxh"

    let escrow_manager_address = "KT1FYq23axy7oXwBY4bJ5cKAsA44TAZFapiT"
    let fa2_kt_address = "KT1KHtMYqCuBTMHmSjDb3JYRXvKY4c8yb4TY"


 
    const Tezos = new taquito.TezosToolkit(rpc_url)
    Tezos.setStreamProvider(rpc_url);
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

// Creates timelock intervals for escrow operations, all times in seconds from deployment
const makeTimelocks = (now: number) => ({
    // Source chain timelock intervals:
    srcWithdrawal:       now + 10,    // Taker can withdraw after 10s
    srcPublicWithdrawal: now + 120,   // Anyone can withdraw after 2min
    srcCancellation:     now + 121,   // Maker can cancel after 2min 1s
    srcPublicCancellation: now + 122, // Anyone can cancel after 2min 2s

    // Destination chain timelock intervals:  
    dstWithdrawal:       now + 10,    // Taker can withdraw after 10s
    dstPublicWithdrawal: now + 100,   // Anyone can withdraw after 1min 40s
    dstCancellation:     now + 101,   // Maker can cancel after 1min 41s
    
    deployedAt:          now          // Timestamp when escrow was created
});

const buildImmutables = (
    tokenOpt: string | null,
    amount: number,
    now: number = 1735689600,
    maker: string,
    taker: string,
    orderHash: string = 'b157e8fa0faaed7c0d56196dd78430dfb8b416a7e41d6d89058caa7a4462c617',
    hashlock: string = 'd64b150ee5d350ec6284c7f6c7af8985d0e5dee26640e04befa2584797f40e3e'
  ) => ({
    orderHash:      orderHash,
    hashlock:       hashlock,
    maker:          maker,
    taker:          taker,
    token:          tokenOpt ? tokenOpt : null,
    amount,                         // nat
    safetyDeposit: SAFETY_DEPOSIT, // nat
    timelocks:      makeTimelocks(now)
    // timelocks:      makeTimelocks(Math.floor(Date.now() / 1000))
});


// one place to tweak the escrowed amount for both tests
const XTZ_ESCROW_AMT = 20000;           // 2 ꜩ
const TOKEN_ESCROW_AMT = 100;     // 5 000 token-units
const SAFETY_DEPOSIT = 2000         // src side doesn’t send it


async function get_escrow_manager_storage(escrow_manager_contract: taquito.Contract): Promise<Storage> {
    const storage = await escrow_manager_contract.storage<Storage>();
    // console.log("storage", storage)
    return storage;
}

const hasSrcCreatedEvent = (opResults: any[]): boolean => {
    const intOps = opResults?.[0]?.metadata?.internal_operation_results ?? [];
    return intOps.some((r: any) => r.kind === 'event' && r.tag === 'EscrowSrcCreated');
};

// const getDstCreatedEventPayload = (opResults: any[]): any | null => {
//     const intOps = opResults?.[0]?.metadata?.internal_operation_results ?? [];
//     const event = intOps.find((r: any) => r.kind === 'event' && r.tag === 'EscrowDstCreated');
//     // Taquito automatically decodes the event payload into a JS object.
//     return event ? event.payload : null;
// };


const create_tez_src_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any) => {
    
    const op = await escrow_manager_contract.methodsObject
      .createSrcEscrow({ immutables, rescue_delay: 6000 })
      .send({ amount: XTZ_ESCROW_AMT + SAFETY_DEPOSIT, mutez: true }); // Source now requires amount + safety deposit
    await op.confirmation(1);
    return op;
}

const create_tez_dst_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any, src_cancellation_timestamp: number) => {
    const op = await escrow_manager_contract.methodsObject
      .createDstEscrow({ immutables, rescue_delay: 6000, src_cancellation_timestamp })
      .send({ amount: XTZ_ESCROW_AMT + SAFETY_DEPOSIT, mutez: true }); // Dst requires amount + safety deposit
    await op.confirmation(1);
    return op;
}


const create_fa2_src_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any) => {
    const op = await escrow_manager_contract.methodsObject
      .createSrcEscrow({ immutables, rescue_delay: 6000 })
      .send({ amount: SAFETY_DEPOSIT, mutez: true }); // FA2 source now requires safety deposit in tez
    await op.confirmation(1);
    return op;
}

const create_fa2_dst_escrow = async (escrow_manager_contract: taquito.Contract, immutables: any, src_cancellation_timestamp: number) => {
    const op = await escrow_manager_contract.methodsObject
        .createDstEscrow({ immutables, rescue_delay: 6000, src_cancellation_timestamp })
        .send({ amount: SAFETY_DEPOSIT, mutez: true }); // Dst FA2 only requires the safety deposit in tez
    await op.confirmation(1);
    return op;
}



// Converts a payload from TzKT (with string numbers/timestamps) to a format Taquito's views expect.
function tzktPayloadToImmutables(payload: any): any {
    if (!payload) return null;

    // Convert numeric strings to BigNumber for Taquito.
    const amount = new BigNumber(payload.amount);
    const safetyDeposit = new BigNumber(payload.safetyDeposit);

    // Convert ISO timestamp strings to seconds-since-epoch numbers.
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

// function waitForEvent(tezos: taquito.TezosToolkit, address: string, tag: string): Promise<any> {
//     return new Promise((resolve, reject) => {
//         const sub = tezos.stream.subscribeEvent({
//             tag: tag,
//             address: address,
//         });

//         const timeout = setTimeout(() => {
//             sub.close();
//             reject(new Error(`Timeout waiting for event '${tag}'`));
//         }, 30000); // 30s timeout for the event

//         sub.on('data', (data: any) => {
//             clearTimeout(timeout);
//             sub.close();
//             // The streaming provider automatically decodes the payload
//             resolve(data);
//         });

//         sub.on('error', (err) => {
//             clearTimeout(timeout);
//             sub.close();
//             reject(err);
//         });
//     });
// }





// Helper to fetch tez balance of an implicit account


// Fetches the latest event payload directly from the TzKT indexer API.
async function getLatestEventPayload(contractAddress: string, tag: string): Promise<any | null> {
    
    try {
        // TzKT API provides sorted, decoded event data.
        const url = `https://api.ghostnet.tzkt.io/v1/contracts/events?contract=${contractAddress}&tag=${tag}&sort.desc=id&limit=1`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch events from TzKT: ${response.statusText}`);
        }
        const events = await response.json();
        if (events && events.length > 0) {
            // Return the payload of the most recent event.
            return events[0].payload;
        }
        return null;
    } catch (error) {
        console.error("Error fetching latest event payload:", error);
        return null;
    }
}

const getBalance = async (tezoshandler: taquito.TezosToolkit, addr: string) =>
    Number(await tezoshandler.tz.getBalance(addr));

async function fa2Balance(fa2_kt_contract: taquito.Contract, addr: string): Promise<number> {           // FA2 contract
    /* Michelson view expects (pair address nat)      →  {0: addr, 1: tokenId} */
    const res = await fa2_kt_contract.contractViews.get_balance_of([{ token_id: 0, owner: addr }]).executeView({ viewCaller: fa2_kt_contract.address }) // token-id 0
    console.log("res", Number(res[0].balance))
    return Number(res[0].balance);
}

async function escrowExists(escrow_manager_contract: taquito.Contract, immutables: any): Promise<boolean> {
    try {
        // Directly call the contract's on-chain view
        const isActive = await escrow_manager_contract.contractViews
            .escrow_exists(immutables)
            .executeView({ viewCaller: escrow_manager_contract.address });
        return isActive;
    } catch (error: any) {
        // The view is designed to fail if the escrow doesn't exist.
        // We check for the specific error message to confirm this is the case.
        if (error.message.includes("No Escrows exist")) {
            return false;
        }
        // If it's a different error, we re-throw it to fail the test.
        throw error;
    }
}

// create a generic jest describe suit with a simple test in it 2 + 2 = 4
describe('Trivial Test', () => {
    it('2 + 2 = 4', () => {
        expect(2 + 2).toBe(4);
    });
});


// describe('Test Escrow Manager => Src Escrow and dst escrow creation', () => {
    
//     const TEST_TIME_OUT = 30000;
//     let Tezos: taquito.TezosToolkit;
//     let escrow_manager: string;
//     let escrow_manager_contract: taquito.Contract;
//     let fa2_kt: string;
//     let fa2_kt_contract: taquito.Contract;
//     let alice_fa2_kt_contract: taquito.Contract;
//     let alice: string;
//     let bob: string;
//     let BobTezos: taquito.TezosToolkit;

//     let tez_src_escrow_immutables: any;
//     let fa2_src_escrow_immutables: any;
//     let tez_dst_escrow_immutables: any;
//     let fa2_dst_escrow_immutables: any;

//     beforeAll(async () => {
//         // Get config
//         const config = await setupTaqueriaTest();
//         Tezos = config.Tezos;
//         alice = config.alice;
//         bob = config.bob;
//         escrow_manager = config.escrow_manager;
//         fa2_kt = config.fa2_kt;
//         BobTezos = config.BobTezos;

//         escrow_manager_contract = await Tezos.contract.at(escrow_manager);


//         fa2_kt_contract = await BobTezos.contract.at(fa2_kt);
//         alice_fa2_kt_contract = await Tezos.contract.at(fa2_kt); // Initialize contract with Alice's signer
        

//         tez_src_escrow_immutables = buildImmutables(null, XTZ_ESCROW_AMT, 1735689600, alice, bob);
//         fa2_src_escrow_immutables = buildImmutables(fa2_kt, TOKEN_ESCROW_AMT, 1735689600, alice, bob);

//         tez_dst_escrow_immutables = buildImmutables(null, XTZ_ESCROW_AMT, 1735689600 + 1000, alice, bob);
//         fa2_dst_escrow_immutables = buildImmutables(fa2_kt, TOKEN_ESCROW_AMT, 1735689600 + 1000, alice, bob);


//         // Initialize contract
        
//     });
  

//     test('Contract has all required entrypoints', async () => {
//         try {
//             const methods = escrow_manager_contract.parameterSchema.ExtractSignatures();
//             const requiredMethods = ['createSrcEscrow', 'createDstEscrow', 'rescueFunds', 'srcCancel', 'dstCancel',
//                 'srcPublicWithdraw', 'dstPublicWithdraw', 'srcWithdraw', 'srcWithdrawTo', 'dstWithdraw'];
//             requiredMethods.forEach(method => {
//                 expect(JSON.stringify(methods)).toContain(method);
//             });
//         } catch (error) {
//             throw new Error(
//                 `Error checking contract methods: ${error}\n` +
//                 'Did you run "npm run originate:development"?'
//             );
//         }
//     }, TEST_TIME_OUT);



//     test('creates a tez source escrow and emits EscrowSrcCreated', async () => {
        
//         const aliceBalBefore   = await getBalance(Tezos, alice);
//         const mgrBalBefore     = await getBalance(Tezos, escrow_manager);
    

//         const op = await create_tez_src_escrow(escrow_manager_contract, tez_src_escrow_immutables);
    
//         expect(op.status).toBe('applied');
//         expect(hasSrcCreatedEvent(op.results)).toBe(true);
        
    
//         const aliceBalAfter    = await getBalance(Tezos, alice);
//         const mgrBalAfter = await getBalance(Tezos, escrow_manager);

//         // const storage = await get_escrow_manager_storage(escrow_manager_contract);
//         // console.log("storage", storage)
    
//         // Alice paid the escrow amount (+gas); manager received it
//         expect(mgrBalAfter - mgrBalBefore).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
//         expect(aliceBalBefore - aliceBalAfter).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
        
//         let escrow_exists = await escrowExists(escrow_manager_contract, tez_src_escrow_immutables);
//         expect(escrow_exists).toBe(true);

//     }, TEST_TIME_OUT);

//     test('creates a tez destination escrow and emits EscrowDstCreated', async () => {
//       // 1. Get balances before
//       const aliceBalBefore = await getBalance(Tezos, alice);
//       const mgrBalBefore = await getBalance(Tezos, escrow_manager);

//       // 2. Define a valid source cancellation timestamp
//       const src_cancellation_timestamp = tez_dst_escrow_immutables.timelocks.dstCancellation + 100;

//       // 3. Create the destination escrow
//       const op = await create_tez_dst_escrow(escrow_manager_contract, tez_dst_escrow_immutables, src_cancellation_timestamp);
//       expect(op.status).toBe('applied');
      
//       // Add a small delay to allow the indexer to catch up with the blockchain.
//       await new Promise(resolve => setTimeout(resolve, 2000));

//       // 4. Fetch the latest event from TzKT to get the on-chain immutables
//       const rawPayload = await getLatestEventPayload(escrow_manager, 'EscrowDstCreated');
//       const onChainImmutables = tzktPayloadToImmutables(rawPayload);
//       expect(onChainImmutables).toBeDefined();
//       console.log("onChainImmutables", onChainImmutables)

//       // 5. Check balances after
//       const aliceBalAfter = await getBalance(Tezos, alice);
//       const mgrBalAfter = await getBalance(Tezos, escrow_manager);
//       expect(mgrBalAfter - mgrBalBefore).toBe(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
//       expect(aliceBalBefore - aliceBalAfter).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);

//       // 6. Verify existence using the decoded event payload
//       const escrow_exists = await escrowExists(escrow_manager_contract, onChainImmutables);
//       expect(escrow_exists).toBe(true);

//     }, TEST_TIME_OUT);

//     test('creates a fa2 source escrow and emits EscrowSrcCreated', async () => {
//         // 1. Approve the escrow manager to spend Alice's FA2 tokens
//         const approve_op = await alice_fa2_kt_contract.methodsObject.update_operators([
//             { add_operator: { owner: alice, operator: escrow_manager, token_id: 0 } }
//         ]).send();
//         await approve_op.confirmation(1);
//         expect(approve_op.status).toBe('applied');

//         // 2. Get balances before creating the escrow
//         const aliceTezBalBefore = await getBalance(Tezos, alice);
//         const mgrTezBalBefore = await getBalance(Tezos, escrow_manager);
//         const aliceFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, alice);
//         const mgrFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, escrow_manager);

//         // 3. Create the FA2 source escrow
//         const op = await create_fa2_src_escrow(escrow_manager_contract, fa2_src_escrow_immutables);

//         // 4. Assertions
//         expect(op.status).toBe('applied');
//         expect(hasSrcCreatedEvent(op.results)).toBe(true);

//         const aliceTezBalAfter = await getBalance(Tezos, alice);
//         const mgrTezBalAfter = await getBalance(Tezos, escrow_manager);
//         const aliceFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, alice);
//         const mgrFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, escrow_manager);


//        // Tez balances should reflect the safety deposit
//        expect(mgrTezBalAfter - mgrTezBalBefore).toBe(SAFETY_DEPOSIT);
//        expect(aliceTezBalBefore - aliceTezBalAfter).toBeGreaterThanOrEqual(SAFETY_DEPOSIT);
       
//        // Alice's FA2 balance should decrease, manager's should increase
//        expect(aliceFa2BalBefore - aliceFa2BalAfter).toBe(TOKEN_ESCROW_AMT);
//        expect(mgrFa2BalAfter - mgrFa2BalBefore).toBe(TOKEN_ESCROW_AMT);


//         const escrow_exists = await escrowExists(escrow_manager_contract, fa2_src_escrow_immutables);
//         expect(escrow_exists).toBe(true);

//     }, TEST_TIME_OUT);

//     test('creates a fa2 destination escrow and emits EscrowDstCreated', async () => {
//         // 1. Approve the escrow manager to spend Alice's FA2 tokens for the main amount
//         const approve_op = await alice_fa2_kt_contract.methodsObject.update_operators([
//             { add_operator: { owner: alice, operator: escrow_manager, token_id: 0 } }
//         ]).send();
//         await approve_op.confirmation(1);
//         expect(approve_op.status).toBe('applied');

//         // 2. Get balances before
//         const aliceTezBalBefore = await getBalance(Tezos, alice);
//         const mgrTezBalBefore = await getBalance(Tezos, escrow_manager);
//         const aliceFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, alice);
//         const mgrFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, escrow_manager);

//         // 3. Define a valid source cancellation timestamp
//         const src_cancellation_timestamp = fa2_dst_escrow_immutables.timelocks.dstCancellation + 100;
        
//         // 4. Create the destination escrow
//         const op = await create_fa2_dst_escrow(escrow_manager_contract, fa2_dst_escrow_immutables, src_cancellation_timestamp);
//         expect(op.status).toBe('applied');
        
//         // Add a small delay for the indexer
//         await new Promise(resolve => setTimeout(resolve, 2000));

//         // 5. Fetch the latest event from TzKT
//         const rawPayload = await getLatestEventPayload(escrow_manager, 'EscrowDstCreated');
//         const onChainImmutables = tzktPayloadToImmutables(rawPayload);
//         expect(onChainImmutables).toBeDefined();

//         // 6. Check balances after
//         const aliceTezBalAfter = await getBalance(Tezos, alice);
//         const mgrTezBalAfter = await getBalance(Tezos, escrow_manager);
//         const aliceFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, alice);
//         const mgrFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, escrow_manager);

//         // Tez balances should reflect the safety deposit
//         expect(mgrTezBalAfter - mgrTezBalBefore).toBe(SAFETY_DEPOSIT);
//         expect(aliceTezBalBefore - aliceTezBalAfter).toBeGreaterThanOrEqual(SAFETY_DEPOSIT);

//         // FA2 balances should reflect the token amount
//         expect(aliceFa2BalBefore - aliceFa2BalAfter).toBe(TOKEN_ESCROW_AMT);
//         expect(mgrFa2BalAfter - mgrFa2BalBefore).toBe(TOKEN_ESCROW_AMT);

//         // 7. Verify existence using the decoded event payload
//         const escrow_exists = await escrowExists(escrow_manager_contract, onChainImmutables);
//         expect(escrow_exists).toBe(true);

//     }, TEST_TIME_OUT);
    


//     // // test alice and bob have tez
//     // test('alice and bob have tez', async () => {
//     //     const alice_balance = await getBalance(alice);
//     //     const bob_balance = await getBalance(bob);
//     //     expect(alice_balance).toBeGreaterThan(0);
//     //     expect(bob_balance).toBeGreaterThan(0);
//     //     console.log("alice_balance", alice_balance)
//     //     console.log("bob_balance", bob_balance)
//     // }, TEST_TIME_OUT);

//     // test('alice and bob have fa2 tokens', async () => {
//     //     const alice_balance = await fa2Balance(alice);
//     //     const bob_balance = await fa2Balance(bob);
//     //     expect(alice_balance).toBeGreaterThan(0);
//     //     expect(bob_balance).toBeGreaterThan(0);
//     // }, TEST_TIME_OUT);

//     // test(
//     //     'Contract can transfer tez to implicit accounts',
//     //     async () => {
//     //       const beforeA = await getBalance(alice);
//     //         const beforeB = await getBalance(bob);
//     //         console.log("beforeA", beforeA)
//     //         console.log("beforeB", beforeB)

    
//     //       const tezParam = {
//     //         token_opt: null,                 // None() in JS = null
//     //         from_: uni_transfer_contract.address,
//     //         to_:   bob,
//     //         amount: 2_000               // mutez  → 2ꜩ
//     //       };
    
//     //       const op = await uni_transfer_contract.methodsObject.transfer(tezParam).send({amount: 1});
//     //       await op.confirmation();                                  // 1 conf is fine
    
//     //       const afterA = await getBalance(alice);
//     //       const afterB = await getBalance(bob);
    
//     //       // fee < 0.1ꜩ ensures simple ≥ check is robust
//     //       expect(afterA).toBeLessThan(beforeA - 1_900);         // spent 2ꜩ + fee
//     //       expect(afterB).toBe(beforeB + 2_000);
//     //       console.log("afterA", afterA)
//     //       console.log("afterB", afterB)
//     //     },
//     //     TEST_TIME_OUT
//     // );
    

//     // test(
//     //     'Contract can transfer FA2 tokens to implicit accounts',
//     //     async () => {
//     //       const beforeA = await fa2Balance(alice);
//     //         const beforeB = await fa2Balance(bob);

//     //          // transfer 100 units of token 0 from bob to the contract
//     //         const from_ = bob;                            // Alice
//     //         const to_ = uni_transfer_contract.address;
//     //         // contract
//     //         await fa2_kt_contract.methodsObject.transfer([
//     //           { from_, txs: [{ to_, token_id: 0, amount: 100 }] }                            // 100 units
//     //         ]).send().then(op => op.confirmation());


//     //       const fa2Param = {
//     //         token_opt: fa2_kt,                // Some(address) in JS
//     //         from_: uni_transfer_contract.address,
//     //         to_:   alice,
//     //         amount: 100
//     //       };
    
//     //       const op = await uni_transfer_contract.methodsObject.transfer(fa2Param).send();
//     //       await op.confirmation();
    
//     //       const afterA = await fa2Balance(alice);
//     //       const afterB = await fa2Balance(bob);
    
//     //       expect(afterB).toBe(beforeB - 100);
//     //         expect(afterA).toBe(beforeA + 100);
            
//     //       console.log("beforeA", beforeA)
//     //       console.log("beforeB", beforeB)
//     //       console.log("afterA", afterA)
//     //       console.log("afterB", afterB)
//     //     },
//     //     TEST_TIME_OUT
//     // );

//     // test alice can transfer tez to bob
// });


describe('Test Escrow Manager => Src Escrow Withdrawals', () => {
    const TEST_TIME_OUT = 60000; // Increased timeout for multi-step operations
    let Tezos: taquito.TezosToolkit;
    let BobTezos: taquito.TezosToolkit;
    let escrow_manager: string;
    let escrow_manager_contract: taquito.Contract;
    let bob_escrow_manager_contract: taquito.Contract; // Bob's instance to call withdrawal
    let fa2_kt_contract: taquito.Contract;
    let alice: string;
    let bob: string;

    let tez_src_escrow_immutables: any;
    let fa2_src_escrow_immutables: any;
    // The secret is the preimage to the hashlock. It's revealed by the taker to claim the funds.
    const secret = '0x' + crypto.randomBytes(32).toString('hex');
    //const hashlock = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
    const hashlock = keccak('keccak256').update(secret.substring(2), 'hex').digest('hex');


    beforeAll(async () => {
        // 1. Setup
        const config = await setupTaqueriaTest();
        Tezos = config.Tezos;
        BobTezos = config.BobTezos;
        alice = config.alice;
        bob = config.bob;
        escrow_manager = config.escrow_manager;
        const fa2_kt = config.fa2_kt;

        escrow_manager_contract = await Tezos.contract.at(escrow_manager);
        bob_escrow_manager_contract = await BobTezos.contract.at(escrow_manager);
        fa2_kt_contract = await Tezos.contract.at(fa2_kt);

        const now = Math.floor(Date.now() / 1000);
        
        // 2. Define unique immutables for a tez escrow
        let orderHash1 = crypto.randomBytes(32).toString('hex');
        console.log("orderHash1", orderHash1)
        tez_src_escrow_immutables = {
            orderHash: orderHash1,
            hashlock: hashlock,
            maker: alice,
            taker: bob,
            token: null,
            amount: XTZ_ESCROW_AMT,
            safetyDeposit: SAFETY_DEPOSIT,
            timelocks: makeTimelocks(now)
        };

        // 3. Create the tez source escrow to be used in tests
        console.log("Creating tez source escrow for withdrawal tests...");
        const tezOp = await create_tez_src_escrow(escrow_manager_contract, tez_src_escrow_immutables);
        await tezOp.confirmation(2);
        expect(tezOp.status).toBe('applied');
        console.log("Tez source escrow created.");

        let orderHash2 = crypto.randomBytes(32).toString('hex');
        console.log("orderHash2", orderHash2, hashlock)
        // 4. Define unique immutables for an FA2 escrow
        fa2_src_escrow_immutables = {
            orderHash: orderHash2,
            hashlock: hashlock,
            maker: alice,
            taker: bob,
            token: fa2_kt,
            amount: TOKEN_ESCROW_AMT,
            safetyDeposit: SAFETY_DEPOSIT,
            timelocks: makeTimelocks(now + 1)
        };

        

        // 5. Create the FA2 source escrow to be used in tests
        console.log("Creating FA2 source escrow for withdrawal tests...");
        const approve_op = await fa2_kt_contract.methodsObject.update_operators([
            { add_operator: { owner: alice, operator: escrow_manager, token_id: 0 } }
        ]).send();
        await approve_op.confirmation(2);
        
        const fa2Op = await create_fa2_src_escrow(escrow_manager_contract, fa2_src_escrow_immutables);
        await fa2Op.confirmation(2);
        expect(fa2Op.status).toBe('applied');
        console.log("FA2 source escrow created.");

    }, TEST_TIME_OUT * 3);

    test('allows the taker to withdraw tez from a source escrow', async () => {
        // 1. Arrange: Get balances before withdrawal
        const aliceBalBefore = await getBalance(Tezos, alice);
        const bobBalBefore = await getBalance(BobTezos, bob);
        const mgrBalBefore = await getBalance(Tezos, escrow_manager);

        // 2. Act: Bob (the taker) calls srcWithdraw with the secret
        const op = await bob_escrow_manager_contract.methodsObject.srcWithdraw({
            hashlock: secret, // Use the secret (preimage), not the hash
            orderHash: tez_src_escrow_immutables.orderHash
        }).send();
        await op.confirmation(1);

        // 3. Assert
        expect(op.status).toBe('applied');

        const aliceBalAfter = await getBalance(Tezos, alice);
        const bobBalAfter = await getBalance(BobTezos, bob);
        const mgrBalAfter = await getBalance(Tezos, escrow_manager);

        // Manager's balance decreases by the full escrowed amount
        expect(mgrBalBefore - mgrBalAfter).toBe(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
        
        // Alice (maker) gets her safety deposit back exactly
        expect(aliceBalAfter - aliceBalBefore).toBe(SAFETY_DEPOSIT);

        // Bob's balance increases. A precise check is difficult due to gas,
        // but we know it must be greater than before.
        expect(bobBalAfter).toBeGreaterThan(bobBalBefore);

        // Escrow should no longer exist
        const escrow_exists = await escrowExists(escrow_manager_contract, tez_src_escrow_immutables);
        expect(escrow_exists).toBe(false);

        
    }, TEST_TIME_OUT);

    test('allows the taker to withdraw FA2 tokens from a source escrow', async () => {
        // 1. Arrange: Get balances before withdrawal
        const aliceTezBalBefore = await getBalance(Tezos, alice);
        const mgrFa2BalBefore = await fa2Balance(fa2_kt_contract, escrow_manager);
        const bobFa2BalBefore = await fa2Balance(fa2_kt_contract, bob);
        
        // 2. Act: Bob (the taker) calls srcWithdraw with the secret
        const op = await bob_escrow_manager_contract.methodsObject.srcWithdraw({
            hashlock: secret.substring(2), // Pass the raw hex secret (preimage), without '0x'
            orderHash: fa2_src_escrow_immutables.orderHash
        }).send();
        await op.confirmation(1);

        // 3. Assert
        expect(op.status).toBe('applied');

        const aliceTezBalAfter = await getBalance(Tezos, alice);
        const mgrFa2BalAfter = await fa2Balance(fa2_kt_contract, escrow_manager);
        const bobFa2BalAfter = await fa2Balance(fa2_kt_contract, bob);
        
        // Alice gets her safety deposit back in tez
        expect(aliceTezBalAfter - aliceTezBalBefore).toBe(SAFETY_DEPOSIT);

        // FA2 token balances are updated
        expect(mgrFa2BalAfter).toBe(mgrFa2BalBefore - TOKEN_ESCROW_AMT);
        expect(bobFa2BalAfter).toBe(bobFa2BalBefore + TOKEN_ESCROW_AMT);

        // Escrow should no longer exist
        const escrow_exists = await escrowExists(escrow_manager_contract, fa2_src_escrow_immutables);
        expect(escrow_exists).toBe(false);
    }, TEST_TIME_OUT);
});



