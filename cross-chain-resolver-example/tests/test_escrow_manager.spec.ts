
import taquitoSigner from '@taquito/signer';
import taquito from '@taquito/taquito';

import taquitoUtils from '@taquito/utils';
import crypto from 'crypto';
import keccak from 'keccak';
import { expect } from '@jest/globals';


import { config } from './tezos_config';
import { buildImmutables, makeTimelocks } from './tezos_escrow_factory_helpers';
import { create_tez_src_escrow, create_tez_dst_escrow, create_fa2_src_escrow, create_fa2_dst_escrow } from './tezos-escrow-factory';
import { tzktPayloadToImmutables, hasSrcCreatedEvent, escrowExists, getBalance, fa2Balance, getLatestEventPayload } from './tezos-escrow-factory';


const getTaqueriaConfig = async () => {
 
    const Tezos = new taquito.TezosToolkit(config.rpc_url)
    Tezos.setStreamProvider(config.rpc_url);
    const alice_signer = new taquitoSigner.InMemorySigner(config.accounts.alice.sk);
    Tezos.setSignerProvider(alice_signer);

    const BobTezos = new taquito.TezosToolkit(config.rpc_url)
    const bob_signer = new taquitoSigner.InMemorySigner(config.accounts.bob.sk);
    BobTezos.setSignerProvider(bob_signer);


        return {
            rpc_url: config.rpc_url,
            alice: config.accounts.alice.address,
            alice_sk: config.accounts.alice.sk,
            bob: config.accounts.bob.address,
            escrow_manager: config.accounts.escrow_factory.address,
            fa2_kt: config.accounts.fa2_token.address,
            Tezos,
            alice_signer,
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


// one place to tweak the escrowed amount for both tests
const XTZ_ESCROW_AMT = 20000;          
const TOKEN_ESCROW_AMT = 100;     
const SAFETY_DEPOSIT = 2000         



// create a generic jest describe suit with a simple test in it 2 + 2 = 4, sanity test
describe('Trivial Test', () => {
    it('2 + 2 = 4', () => {
        expect(2 + 2).toBe(4);
    });
});


describe('Test Escrow Manager => Src Escrow and dst escrow creation', () => {
    
    const TEST_TIME_OUT = 30000;
    let Tezos: taquito.TezosToolkit;
    let escrow_manager: string;
    let escrow_manager_contract: taquito.Contract;
    let fa2_kt: string;
    let fa2_kt_contract: taquito.Contract;
    let alice_fa2_kt_contract: taquito.Contract;
    let alice: string;
    let bob: string;
    let BobTezos: taquito.TezosToolkit;

    let tez_src_escrow_immutables: any;
    let fa2_src_escrow_immutables: any;
    let tez_dst_escrow_immutables: any;
    let fa2_dst_escrow_immutables: any;

    beforeAll(async () => {
        // Get config
        const config = await setupTaqueriaTest();
        Tezos = config.Tezos;
        alice = config.alice;
        bob = config.bob;
        escrow_manager = config.escrow_manager;
        fa2_kt = config.fa2_kt;
        BobTezos = config.BobTezos;

        escrow_manager_contract = await Tezos.contract.at(escrow_manager);

        fa2_kt_contract = await BobTezos.contract.at(fa2_kt);
        alice_fa2_kt_contract = await Tezos.contract.at(fa2_kt); // Initialize contract with Alice's signer
        
        tez_src_escrow_immutables = buildImmutables(null, XTZ_ESCROW_AMT, 1735689600, alice, bob);
        fa2_src_escrow_immutables = buildImmutables(fa2_kt, TOKEN_ESCROW_AMT, 1735689600, alice, bob);

        tez_dst_escrow_immutables = buildImmutables(null, XTZ_ESCROW_AMT, 1735689600 + 1000, alice, bob);
        fa2_dst_escrow_immutables = buildImmutables(fa2_kt, TOKEN_ESCROW_AMT, 1735689600 + 1000, alice, bob);

        // Initialize contract
        
    });  

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



    test('creates a tez source escrow and emits EscrowSrcCreated', async () => {
        
        const aliceBalBefore   = await getBalance(Tezos, alice);
        const mgrBalBefore     = await getBalance(Tezos, escrow_manager);
    

        const op = await create_tez_src_escrow(escrow_manager_contract, tez_src_escrow_immutables, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);
    
        expect(op.status).toBe('applied');
        expect(hasSrcCreatedEvent(op.results)).toBe(true);
    

        const aliceBalAfter    = await getBalance(Tezos, alice);
        const mgrBalAfter = await getBalance(Tezos, escrow_manager);

        // const storage = await get_escrow_manager_storage(escrow_manager_contract);
        // console.log("storage", storage)
    
        // Alice paid the escrow amount (+gas); manager received it
        expect(mgrBalAfter - mgrBalBefore).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
        expect(aliceBalBefore - aliceBalAfter).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
        
        let escrow_exists = await escrowExists(escrow_manager_contract, tez_src_escrow_immutables);
        expect(escrow_exists).toBe(true);

    }, TEST_TIME_OUT);

    test('creates a tez destination escrow and emits EscrowDstCreated', async () => {
      // 1. Get balances before
      const aliceBalBefore = await getBalance(Tezos, alice);
      const mgrBalBefore = await getBalance(Tezos, escrow_manager);

      // 2. Define a valid source cancellation timestamp
      const src_cancellation_timestamp = tez_dst_escrow_immutables.timelocks.dstCancellation + 100;

      // 3. Create the destination escrow
      const op = await create_tez_dst_escrow(escrow_manager_contract, tez_dst_escrow_immutables, src_cancellation_timestamp, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);
      expect(op.status).toBe('applied');
      
      // Add a small delay to allow the indexer to catch up with the blockchain.
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Fetch the latest event from TzKT to get the on-chain immutables
      const rawPayload = await getLatestEventPayload(escrow_manager, 'EscrowDstCreated');
      const onChainImmutables = tzktPayloadToImmutables(rawPayload);
      expect(onChainImmutables).toBeDefined();
      console.log("onChainImmutables", onChainImmutables)

      // 5. Check balances after
      const aliceBalAfter = await getBalance(Tezos, alice);
      const mgrBalAfter = await getBalance(Tezos, escrow_manager);
      expect(mgrBalAfter - mgrBalBefore).toBe(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
      expect(aliceBalBefore - aliceBalAfter).toBeGreaterThanOrEqual(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);

      // 6. Verify existence using the decoded event payload
      const escrow_exists = await escrowExists(escrow_manager_contract, onChainImmutables);
      expect(escrow_exists).toBe(true);

    }, TEST_TIME_OUT);

    test('creates a fa2 source escrow and emits EscrowSrcCreated', async () => {
        // 1. Approve the escrow manager to spend Alice's FA2 tokens
        const approve_op = await alice_fa2_kt_contract.methodsObject.update_operators([
            { add_operator: { owner: alice, operator: escrow_manager, token_id: 0 } }
        ]).send();
        await approve_op.confirmation(1);
        expect(approve_op.status).toBe('applied');

        // 2. Get balances before creating the escrow
        const aliceTezBalBefore = await getBalance(Tezos, alice);
        const mgrTezBalBefore = await getBalance(Tezos, escrow_manager);
        const aliceFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, alice);
        const mgrFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, escrow_manager);

        // 3. Create the FA2 source escrow
        const op = await create_fa2_src_escrow(escrow_manager_contract, fa2_src_escrow_immutables, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);

        // 4. Assertions
        expect(op.status).toBe('applied');
        expect(hasSrcCreatedEvent(op.results)).toBe(true);

        const aliceTezBalAfter = await getBalance(Tezos, alice);
        const mgrTezBalAfter = await getBalance(Tezos, escrow_manager);
        const aliceFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, alice);
        const mgrFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, escrow_manager);


       // Tez balances should reflect the safety deposit
       expect(mgrTezBalAfter - mgrTezBalBefore).toBe(SAFETY_DEPOSIT);
       expect(aliceTezBalBefore - aliceTezBalAfter).toBeGreaterThanOrEqual(SAFETY_DEPOSIT);
       
       // Alice's FA2 balance should decrease, manager's should increase
       expect(aliceFa2BalBefore - aliceFa2BalAfter).toBe(TOKEN_ESCROW_AMT);
       expect(mgrFa2BalAfter - mgrFa2BalBefore).toBe(TOKEN_ESCROW_AMT);


        const escrow_exists = await escrowExists(escrow_manager_contract, fa2_src_escrow_immutables);
        expect(escrow_exists).toBe(true);

    }, TEST_TIME_OUT);

    test('creates a fa2 destination escrow and emits EscrowDstCreated', async () => {
        // 1. Approve the escrow manager to spend Alice's FA2 tokens for the main amount
        const approve_op = await alice_fa2_kt_contract.methodsObject.update_operators([
            { add_operator: { owner: alice, operator: escrow_manager, token_id: 0 } }
        ]).send();
        await approve_op.confirmation(1);
        expect(approve_op.status).toBe('applied');

        // 2. Get balances before
        const aliceTezBalBefore = await getBalance(Tezos, alice);
        const mgrTezBalBefore = await getBalance(Tezos, escrow_manager);
        const aliceFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, alice);
        const mgrFa2BalBefore = await fa2Balance(alice_fa2_kt_contract, escrow_manager);

        // 3. Define a valid source cancellation timestamp
        const src_cancellation_timestamp = fa2_dst_escrow_immutables.timelocks.dstCancellation + 100;
        
        // 4. Create the destination escrow
        const op = await create_fa2_dst_escrow(escrow_manager_contract, fa2_dst_escrow_immutables, src_cancellation_timestamp, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);
        expect(op.status).toBe('applied');
        
        // Add a small delay for the indexer
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. Fetch the latest event from TzKT
        const rawPayload = await getLatestEventPayload(escrow_manager, 'EscrowDstCreated');
        const onChainImmutables = tzktPayloadToImmutables(rawPayload);
        expect(onChainImmutables).toBeDefined();

        // 6. Check balances after
        const aliceTezBalAfter = await getBalance(Tezos, alice);
        const mgrTezBalAfter = await getBalance(Tezos, escrow_manager);
        const aliceFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, alice);
        const mgrFa2BalAfter = await fa2Balance(alice_fa2_kt_contract, escrow_manager);

        // Tez balances should reflect the safety deposit
        expect(mgrTezBalAfter - mgrTezBalBefore).toBe(SAFETY_DEPOSIT);
        expect(aliceTezBalBefore - aliceTezBalAfter).toBeGreaterThanOrEqual(SAFETY_DEPOSIT);

        // FA2 balances should reflect the token amount
        expect(aliceFa2BalBefore - aliceFa2BalAfter).toBe(TOKEN_ESCROW_AMT);
        expect(mgrFa2BalAfter - mgrFa2BalBefore).toBe(TOKEN_ESCROW_AMT);

        // 7. Verify existence using the decoded event payload
        const escrow_exists = await escrowExists(escrow_manager_contract, onChainImmutables);
        expect(escrow_exists).toBe(true);

    }, TEST_TIME_OUT);
    
});


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
    let secret = '0x' + crypto.randomBytes(32).toString('hex');
    console.log("secret wiht ox", secret)
   
    let hashlock = keccak('keccak256').update(secret.substring(2), 'hex').digest('hex');
    
    secret = secret.substring(2);

    console.log("secret", secret, "hashlock", hashlock)
    console.log("first_time")

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
        const tezOp = await create_tez_src_escrow(escrow_manager_contract, tez_src_escrow_immutables, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);
        await tezOp.confirmation(1);
        expect(tezOp.status).toBe('applied');
        console.log("Tez source escrow created.");

        let orderHash2 = crypto.randomBytes(32).toString('hex');
        console.log("orderHash2", orderHash2, hashlock, "hashlock")
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
        await approve_op.confirmation(1);
        
        const fa2Op = await create_fa2_src_escrow(escrow_manager_contract, fa2_src_escrow_immutables, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);
        await fa2Op.confirmation(1);
        expect(fa2Op.status).toBe('applied');
        console.log("FA2 source escrow created.");

    }, TEST_TIME_OUT * 3);

    test('allows the taker to withdraw tez from a source escrow', async () => {
        // 1. Arrange: Get balances before withdrawal
        const aliceBalBefore = await getBalance(Tezos, alice);
        const bobBalBefore = await getBalance(BobTezos, bob);
        const mgrBalBefore = await getBalance(Tezos, escrow_manager);

        console.log(aliceBalBefore, bobBalBefore, mgrBalBefore)

        // 2. Act: Bob (the taker) calls srcWithdraw with the secret

        let hashed_secret = keccak('keccak256').update(secret, 'hex').digest('hex')
        console.log("hashed_secret", hashed_secret)
        console.log(hashlock == hashed_secret, "hashlock == hashed_secret")
        const op = await bob_escrow_manager_contract.methodsObject.srcWithdraw({
            secret: secret, // Use the secret (preimage), not the hash
            immutables: tez_src_escrow_immutables
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

        // Escrow should no longer exist in active state since a withdrawal has occured
        const escrow_exists = await escrowExists(escrow_manager_contract, tez_src_escrow_immutables);
        expect(escrow_exists).toBe(false);

        // Check that the withdrawal event was emitted with the correct secret
        await new Promise(resolve => setTimeout(resolve, 2000)); // Allow indexer to catch up
        const eventPayload = await getLatestEventPayload(escrow_manager, 'EscrowWithdrawSrc');
        expect(eventPayload).not.toBeNull();
        expect(eventPayload).toBe(secret);
        
    }, TEST_TIME_OUT);

    test('allows the taker to withdraw FA2 tokens from a source escrow', async () => {
        // 1. Arrange: Get balances before withdrawal
        const aliceTezBalBefore = await getBalance(Tezos, alice);
        const mgrFa2BalBefore = await fa2Balance(fa2_kt_contract, escrow_manager);
        const bobFa2BalBefore = await fa2Balance(fa2_kt_contract, bob);
        
        // 2. Act: Bob (the taker) calls srcWithdraw with the secret
        const op = await bob_escrow_manager_contract.methodsObject.srcWithdraw({
            secret: secret, // Use the secret (preimage), not the hash
            immutables: fa2_src_escrow_immutables
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

        
        // Escrow should no longer exist in active state since a withdrawal has occured
        const escrow_exists = await escrowExists(escrow_manager_contract, fa2_src_escrow_immutables);
        expect(escrow_exists).toBe(false);

        // Check that the withdrawal event was emitted with the correct secret
        await new Promise(resolve => setTimeout(resolve, 2000)); // Allow indexer to catch up
        const eventPayload = await getLatestEventPayload(escrow_manager, 'EscrowWithdrawSrc');
        expect(eventPayload).not.toBeNull();
        expect(eventPayload).toBe(secret);

    }, TEST_TIME_OUT);
});





describe('Test Escrow Manager => Dst Escrow Withdrawals', () => {
    const TEST_TIME_OUT = 60000;
    let Tezos: taquito.TezosToolkit;
    let BobTezos: taquito.TezosToolkit;
    let escrow_manager: string;
    let escrow_manager_contract: taquito.Contract;
    let bob_escrow_manager_contract: taquito.Contract;
    let fa2_kt_contract: taquito.Contract;
    let alice: string;
    let bob: string;

    let tez_dst_escrow_immutables_onchain: any;
    let fa2_dst_escrow_immutables_onchain: any;

    let secret = '0x' + crypto.randomBytes(32).toString('hex');
    let hashlock = keccak('keccak256').update(secret.substring(2), 'hex').digest('hex');
    secret = secret.substring(2);
    
    beforeAll(async () => {
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
        const alice_fa2_kt_contract = await Tezos.contract.at(fa2_kt);

        const now = Math.floor(Date.now() / 1000);
        
        // 1. Create a tez destination escrow
        const tez_dst_immutables_local = buildImmutables(null, XTZ_ESCROW_AMT, now, alice, bob, crypto.randomBytes(32).toString('hex'), hashlock);
        const tezOp = await create_tez_dst_escrow(escrow_manager_contract, tez_dst_immutables_local, now + 1000, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);
        await tezOp.confirmation(1);
        expect(tezOp.status).toBe('applied');

            // Fetch the on-chain data from the event
        await new Promise(resolve => setTimeout(resolve, 2000));
        const tezRawPayload = await getLatestEventPayload(escrow_manager, 'EscrowDstCreated');
        tez_dst_escrow_immutables_onchain = tzktPayloadToImmutables(tezRawPayload);
        expect(tez_dst_escrow_immutables_onchain).toBeDefined();



        // 2. Create an FA2 destination escrow
        const approve_op = await alice_fa2_kt_contract.methodsObject.update_operators([
            { add_operator: { owner: alice, operator: escrow_manager, token_id: 0 } }
        ]).send();
         await approve_op.confirmation(1);

        const fa2_dst_immutables_local = buildImmutables(fa2_kt, TOKEN_ESCROW_AMT, now + 1, alice, bob, crypto.randomBytes(32).toString('hex'), hashlock);
        const fa2Op = await create_fa2_dst_escrow(escrow_manager_contract, fa2_dst_immutables_local, now + 1001, XTZ_ESCROW_AMT, SAFETY_DEPOSIT);
        await fa2Op.confirmation(1);
        expect(fa2Op.status).toBe('applied');
        // Fetch the on-chain data from the event
        await new Promise(resolve => setTimeout(resolve, 2000));
        const fa2RawPayload = await getLatestEventPayload(escrow_manager, 'EscrowDstCreated');
        fa2_dst_escrow_immutables_onchain = tzktPayloadToImmutables(fa2RawPayload);
        expect(fa2_dst_escrow_immutables_onchain).toBeDefined();

    }, TEST_TIME_OUT * 4);

    test('allows the taker to withdraw from a tez destination escrow', async () => {
        const aliceBalBefore = await getBalance(Tezos, alice);
        const bobBalBefore = await getBalance(BobTezos, bob);
         const mgrBalBefore = await getBalance(Tezos, escrow_manager);

        const op = await bob_escrow_manager_contract.methodsObject.dstWithdraw({
            secret: secret,
            immutables: tez_dst_escrow_immutables_onchain
        }).send();
        await op.confirmation(1);
        expect(op.status).toBe('applied');

        const aliceBalAfter = await getBalance(Tezos, alice);
        const bobBalAfter = await getBalance(BobTezos, bob);
        const mgrBalAfter = await getBalance(Tezos, escrow_manager);

        // Manager's balance decreases by full amount
        expect(mgrBalBefore - mgrBalAfter).toBe(XTZ_ESCROW_AMT + SAFETY_DEPOSIT);
        // Alice (maker) gets the main escrow amount
        expect(aliceBalAfter - aliceBalBefore).toBe(XTZ_ESCROW_AMT);
        // Bob's (taker's) balance increases by safety deposit (minus gas)
        expect(bobBalAfter).toBeGreaterThan(bobBalBefore);

        const escrow_exists = await escrowExists(escrow_manager_contract, tez_dst_escrow_immutables_onchain);
        expect(escrow_exists).toBe(false);

        await new Promise(resolve => setTimeout(resolve, 2000));
        const eventPayload = await getLatestEventPayload(escrow_manager, 'EscrowWithdrawDst');
        expect(eventPayload).not.toBeNull();
        expect(eventPayload).toBe(secret);
    }, TEST_TIME_OUT);

    test('allows the taker to withdraw from an FA2 destination escrow', async () => {
        const aliceFa2BalBefore = await fa2Balance(fa2_kt_contract, alice);
        const bobTezBalBefore = await getBalance(BobTezos, bob);
        const mgrFa2BalBefore = await fa2Balance(fa2_kt_contract, escrow_manager);

        const op = await bob_escrow_manager_contract.methodsObject.dstWithdraw({
            secret: secret,
            immutables: fa2_dst_escrow_immutables_onchain
        }).send();
        await op.confirmation(1);
        expect(op.status).toBe('applied');

        const aliceFa2BalAfter = await fa2Balance(fa2_kt_contract, alice);
        const bobTezBalAfter = await getBalance(BobTezos, bob);
        const mgrFa2BalAfter = await fa2Balance(fa2_kt_contract, escrow_manager);

        // Bob gets his safety deposit back in tez
        expect(bobTezBalAfter).toBeGreaterThan(bobTezBalBefore);
        // Alice (maker) gets the FA2 tokens
        expect(aliceFa2BalAfter - aliceFa2BalBefore).toBe(TOKEN_ESCROW_AMT);
        expect(mgrFa2BalAfter).toBe(mgrFa2BalBefore - TOKEN_ESCROW_AMT);

        const escrow_exists = await escrowExists(escrow_manager_contract, fa2_dst_escrow_immutables_onchain);
        expect(escrow_exists).toBe(false);

        await new Promise(resolve => setTimeout(resolve, 2000));
        const eventPayload = await getLatestEventPayload(escrow_manager, 'EscrowWithdrawDst');
        expect(eventPayload).not.toBeNull();
        expect(eventPayload).toBe(secret);
    }, TEST_TIME_OUT);
    
});
