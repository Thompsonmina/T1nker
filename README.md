# T1nker: A 1inch Fusion-Style Escrow System for Tezos

**Submission for the ETHGlobal 1inch Fusion Hackathon (Tezos Track)**

## Overview

T1nker is a proof-of-concept implementation of the 1inch Fusion protocol's HTLC-based escrow system, built specifically for the Tezos blockchain. It enables cross-chain swaps between Ethereum and Tezos, supporting both native tokens (ETH <> XTZ) and their respective token standards (ERC-20 <> FA2).


I chose tezos because i belive it made some underrated novel blockchain design dicisions. Its stack based execution environment and functional approach to blockchain state nerd sniped me a bit.

## Design Decision 

The primary goal was to adhere as closely as possible to the battle-tested design of the 1inch Network's EVM-based escrow system. This approach aims to maximize interoperability and inherit some of the security assurances of the original implementation.

However, due to fundamental differences between the EVM and the Tezos execution environment, several key adaptations were necessary.

### 1. Singleton "Fat" Escrow Manager

The original 1inch model uses a slim escrow manager that deploys lightweight, single-use escrow contracts. The beauty of this design lies in the `CREATE2` opcode, which allows for deterministic contract addresses that encode the escrow's immutable state.

Tezos does not natively support deterministic contract addresses. To overcome this, T1nker employs a **singleton "fat" escrow manager**. This single, persistent contract is responsible for creating and maintaining the state of all source and destination escrows.

To maintain storage efficiency and emulate the `CREATE2` pattern, this manager leverages Tezos' **BigMaps**. Escrow states are stored in a `BigMap`, where the key is the hash of the escrow's immutable parameters. This design provides significant storage optimization, as data is loaded lazily, and it cleverly mirrors the EVM's ability to locate an escrow based on its defining characteristics.

### 2. Maker-Initiated Source Escrows

The 1inch Fusion protocol often relies on EIP-712 signed messages to allow third parties (resolvers) to create escrows on behalf of the maker, streamlining the user experience. The Tezos FA2 token standard does not currently have a widely adopted equivalent for such permit-style approvals.

As a result, in T1nker's current implementation, **the maker must create the source escrow directly**. This has a direct implication on the handling of the safety deposit:

-   The maker, being the initiator of the transaction, provides the safety deposit.
-   Upon a successful withdrawal by the taker, the safety deposit is returned to the maker.
-   In the case of a public withdrawal (after the timeout), the deposit is awarded to the public caller who executes the transaction.


The key components of this project are organized as follows:

-   **Tezos Smart Contracts:** The jsligo source code for the escrow manager can be found in `cross-chain-resolver-example/cross-chain-swap-tezos/`.
-   **Tests:** The integration and unit tests for the Tezos contracts are located in `cross-chain-resolver-example/tests/`.



## Setup and Testing

This project uses [Taqueria](https://taqueria.io/) to compile, deploy, and test the Tezos smart contracts.

### 1. Installation

First, ensure you have Taqueria installed and then install the project dependencies:

```bash
# Install project dependencies
npm install
```

### 2. Compiling and Deploying

You can compile the Ligo smart contracts and deploy them to a Tezos network (e.g., Ghostnet) using Taqueria's commands.

```bash
# Compile the contracts
taq compile EscrowManager.jsligo --plugin ligo 

# Deploy (originate) the contracts
taq deploy EscrowManager --env testing --sender alice
```

*Note: The environment (`-e testing`) should be configured in your Taqueria settings to point to the desired Tezos network.*

### 3. Running Tests

The tests are written in TypeScript using Jest and Taquito. You can run them with:

```bash
npm test
```

### Test Configuration

The tests rely on a configuration file that provides the RPC endpoint and account details for the test environment. The following accounts and contract addresses are used:

```typescript
// cross-chain-resolver-example/tests/tezos_config.ts

export const config = {
    rpc_url: "https://ghostnet.ecadinfra.com",
    accounts: {
        alice: {
            sk: "edskS1SivTJESudRQgn9KidKWtZjm8RnL2nyF5QFU8GSxi22u9PVpmHU5BHiF29BwwsJk6mdCV2XqeQ3JpVw9khzhvrUMXYpAm",
            address: "tz1Ys4iNA8odKJVBysTaZyQidvcHMKLTxvud"
        },
        bob: {
            sk: "edskS3HnwZyg8parekZBktxYEBxYN7c52etbkwxQh7sC7GCeXZxZKFvmTeBB4e7buDuhDekUUT2CkxMtKgzpJeLi7NQEKLtHxh",
            address: "tz1cPwxzsVciajsGHdbUYKqsCVVCKx3yK2sG"
        },
        
    },
    escrow_factory: {
        address: "KT1J1wVdVwpXXTLjebVpuQi6SedS8nrhvVR5"
    },
    fa2_token: {
        address: "KT1KHtMYqCuBTMHmSjDb3JYRXvKY4c8yb4TY"
    }
}