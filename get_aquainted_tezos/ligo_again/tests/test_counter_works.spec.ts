import { RpcClient } from '@taquito/rpc';
import { InMemorySigner } from '@taquito/signer';
import { TezosToolkit, Contract } from '@taquito/taquito';
import { Storage } from '../types/Counter.types';
// import {getConfigV2, V2} from "@taqueria/toolkit"
// import {getEnv} from "@taqueria/toolkit/lib/env"
import { err, log, stringify, warn } from './test-helpers';
import {path} from 'rambda'
import fetch from 'node-fetch'
import { exec } from 'child_process'
// import { describe, test, expect, beforeAll } from '@jest/globals';



const getTaqueriaConfig = async (envname: 'development' | 'testing') => {
    // const config = await getConfigV2(process.env)


    // let rpc_url = "http://localhost:20001"
    // let alice_sk = "edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq"
    // let alice_address = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"

    let rpc_url = "https://ghostnet.ecadinfra.com"
    let alice_sk = "edskS1SivTJESudRQgn9KidKWtZjm8RnL2nyF5QFU8GSxi22u9PVpmHU5BHiF29BwwsJk6mdCV2XqeQ3JpVw9khzhvrUMXYpAm"
    let alice_address = "tz1Ys4iNA8odKJVBysTaZyQidvcHMKLTxvud"


    let counter_address = "KT1CVam5N3YeFuNKyf9ECQTMwDxj21Wy6Fih"
    

    if (envname == "development") {
        // const devEnv = V2.getEnv("development", config)
        // const alice_sk = String(path('accounts.alice.secretKey', devEnv)).replace('unencrypted:', '')
        // const rpc_url = devEnv['rpcUrl'] as string
        const Tezos = new TezosToolkit(rpc_url)
        const admin_signer = new InMemorySigner(alice_sk);
        Tezos.setSignerProvider(admin_signer);

        return {
            rpc_url,
            alice: alice_address,
            alice_sk: alice_sk,
            joe: "tz1MVGjgD1YtAPwohsSfk8i3ZiT1yEGM2YXB",
            counter: counter_address,
            Tezos,
            admin_signer
        }
    }
}

export const setupTaqueriaTest = async () => {
    const config = await getTaqueriaConfig('development')
    if (!config) throw new Error('Could not get Taqueria config')
    
    const { Tezos, counter } = config
    
    // Additional setup if needed
    return {
        Tezos,
        counter,
        // Add other needed properties
    }
}

// create a generic jest describe suit with a simple test in it 2 + 2 = 4
describe('Counter Tests', () => {
    it('should add 2 + 2 = 4', () => {
        expect(2 + 2).toBe(4);
    });
});



describe('Counter Tests', () => {
    
    const TEST_TIME_OUT = 30000;
    let Tezos: TezosToolkit;
    let counter: string;
    let contract: Contract;
        
    beforeAll(async () => {
        // Get config
        const config = await setupTaqueriaTest();
        Tezos = config.Tezos;
        counter = config.counter;
        
        // Initialize contract
        contract = await Tezos.contract.at(counter);
    });

    // Helper with proper typing
    async function counter_count(): Promise<Storage> {
        const storage = await contract.storage<Storage>();
        // console.log("storage", storage)
        return storage;
    }

    test('Contract has all required entrypoints', async () => {
        try {
            const methods = contract.parameterSchema.ExtractSignatures();
            const requiredMethods = ['increment', 'decrement', 'reset'];

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

    test('should read initial count', async () => {
        const count = await counter_count();
        console.log("count", count)
        expect(count).toBeDefined();
        // Add your assertions
    }, TEST_TIME_OUT);

    test('should increment count', async () => {
        // Get initial count
        const initialCount = await counter_count();
        
        // Increment
        const op = await contract.methodsObject.increment(10).send();
        await op.confirmation();
        
        // Get new count
        const newCount = await counter_count();
        expect(Number(newCount)).toBe(Number(initialCount) + 10);
    }, TEST_TIME_OUT);
});
