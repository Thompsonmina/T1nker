import { RpcClient } from '@taquito/rpc';
import { InMemorySigner } from '@taquito/signer';
import { TezosToolkit, Contract } from '@taquito/taquito';
// import {getConfigV2, V2} from "@taqueria/toolkit"
// import {getEnv} from "@taqueria/toolkit/lib/env"
import { err, log, stringify, warn } from './test-helpers';
import {path} from 'rambda'
import fetch from 'node-fetch'
import { exec } from 'child_process'
// import { describe, test, expect, beforeAll } from '@jest/globals';



const getTaqueriaConfig = async (envname: 'development' | 'testing') => {
    // const config = await getConfigV2(process.env)


    let flextesa_uri = "http://localhost:20001"
    let alice_sk = "edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq"


    if (envname == "development") {
        // const devEnv = V2.getEnv("development", config)
        // const alice_sk = String(path('accounts.alice.secretKey', devEnv)).replace('unencrypted:', '')
        // const flextesa_uri = devEnv['rpcUrl'] as string
        const Tezos = new TezosToolkit(flextesa_uri)
        const admin_signer = new InMemorySigner(alice_sk);
        Tezos.setSignerProvider(admin_signer);

        return {
            flextesa_uri,
            alice: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
            alice_sk: alice_sk,
            joe: "tz1MVGjgD1YtAPwohsSfk8i3ZiT1yEGM2YXB",
            counter: "KT1FnUuHzgH4crt2FgtVcEfjz5QSBgfuUgYV",
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

interface CounterStorage {
    count: number;
    // Add other storage fields if any
}

describe('Counter Tests', () => {
    
    const TEST_TIME_OUT = 10000;
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
    async function counter_count(): Promise<number> {
        const storage = await contract.storage<CounterStorage>();
        return storage.count;
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

    // test('should read initial count', async () => {
    //     const count = await counter_count();
    //     expect(count).toBeDefined();
    //     // Add your assertions
    // }, TEST_TIME_OUT);

    // test('should increment count', async () => {
    //     // Get initial count
    //     const initialCount = await counter_count();
        
    //     // Increment
    //     const op = await contract.methodsObject.increment(1).send();
    //     await op.confirmation();
        
    //     // Get new count
    //     const newCount = await counter_count();
    //     expect(newCount).toBe(initialCount + 1);
    // }, TEST_TIME_OUT);
});
