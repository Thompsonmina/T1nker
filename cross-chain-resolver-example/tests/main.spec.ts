import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {createServer, CreateServerReturnType} from 'prool'
import {anvil} from 'prool/instances'

import Sdk from '@1inch/cross-chain-sdk'
import { HashLock, TimeLocks } from '@1inch/cross-chain-sdk'


import {
    computeAddress,
    ContractFactory,
    JsonRpcProvider,
    MaxUint256,
    parseEther,
    parseUnits,
    randomBytes,
    Wallet as SignerWallet
} from 'ethers'



import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import assert from 'node:assert'
import {ChainConfig, config} from './config'
import {Wallet} from './wallet'
import {Resolver} from './resolver'
import {EscrowFactory} from './escrow-factory'
import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'

import taquito from '@taquito/taquito';
import taquitoSigner from '@taquito/signer';
import { config as tezosConfig } from './tezos_config';

import { tzktPayloadToImmutables, hasSrcCreatedEvent, escrowExists, getBalance as getTezosBalance, fa2Balance, getLatestEventPayload } from './tezos-escrow-factory';



const {Address} = Sdk

jest.setTimeout(1000 * 60)

const userPkETH = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const resolverPkETH = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'


const userPkTezos = tezosConfig.accounts.alice.sk
const resolverPkTezos = tezosConfig.accounts.bob.sk

// eslint-disable-next-line max-lines-per-function
describe('Resolving example', () => {
    const srcChainId = config.chain.source.chainId
    const dstChainId = config.chain.destination.chainId

    type Chain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    let src: Chain
    let dst: Chain

    let srcChainETHUser: Wallet
    let dstChainETHUser: Wallet

    let srcChainTezosUser: taquito.TezosToolkit
    let dstChainTezosUser: taquito.TezosToolkit

    let srcChainResolverETH: Wallet
    let dstChainResolverETH: Wallet

    let srcChainResolverTezos: taquito.TezosToolkit
    let dstChainResolverTezos: taquito.TezosToolkit

    let srcFactoryETH: EscrowFactory
    let dstFactoryETH: EscrowFactory
    let srcResolverContractETH: Wallet
    let dstResolverContractETH: Wallet

    let srcTimestamp: bigint

    let AliceTezos: taquito.TezosToolkit
    let BobTezos: taquito.TezosToolkit

    let Alice_invocation_of_escrow_manager_contract: taquito.Contract
    let Alice_invocation_of_fa2__contract: taquito.Contract

    let Bob_invocation_of_escrow_manager_contract: taquito.Contract
    let Bob_invocation_of_fa2__contract: taquito.Contract

    async function increaseTime(t: number): Promise<void> {
        await Promise.all([src, dst].map((chain) => chain.provider.send('evm_increaseTime', [t])))
    }

    const getTaqueriaConfig = async () => {
 
        const AliceTezos = new taquito.TezosToolkit(tezosConfig.rpc_url)
        // Tezos.setStreamProvider(tezosConfig.rpc_url);
        const alice_signer = new taquitoSigner.InMemorySigner(tezosConfig.accounts.alice.sk);
        AliceTezos.setSignerProvider(alice_signer);
    
        const BobTezos = new taquito.TezosToolkit(tezosConfig.rpc_url)
        const bob_signer = new taquitoSigner.InMemorySigner(tezosConfig.accounts.bob.sk);
        BobTezos.setSignerProvider(bob_signer);
    
    
        return {
            AliceTezos,
            BobTezos,
        }
        
    }

    beforeAll(async () => {
        ;[src, dst] = await Promise.all([initChain(config.chain.source), initChain(config.chain.destination)])

        srcChainETHUser = new Wallet(userPkETH, src.provider)
        dstChainETHUser = new Wallet(userPkETH, dst.provider)



        srcChainResolverETH = new Wallet(resolverPkETH, src.provider)
        dstChainResolverETH = new Wallet(resolverPkETH, dst.provider)

        srcChainResolverTezos = BobTezos
        dstChainResolverTezos = BobTezos

        srcFactoryETH = new EscrowFactory(src.provider, src.escrowFactory)
        dstFactoryETH = new EscrowFactory(dst.provider, dst.escrowFactory)
        // get 1000 USDC for user in SRC chain and approve to LOP
        
        await srcChainETHUser.topUpFromDonor(
            config.chain.source.tokens.USDC.address,
            config.chain.source.tokens.USDC.donor,
            parseUnits('1000', 6)
        )
        await srcChainETHUser.approveToken(
            config.chain.source.tokens.USDC.address,
            config.chain.source.limitOrderProtocol,
            MaxUint256
        )

        // get 2000 USDC for resolver in DST chain
        srcResolverContractETH = await Wallet.fromAddress(src.resolver, src.provider)
        dstResolverContractETH = await Wallet.fromAddress(dst.resolver, dst.provider)

        await dstResolverContractETH.topUpFromDonor(
            config.chain.destination.tokens.USDC.address,
            config.chain.destination.tokens.USDC.donor,
            parseUnits('2000', 6)
        )
        // top up contract for approve
        await dstChainResolverETH.transfer(dst.resolver, parseEther('1'))
        await dstResolverContractETH.unlimitedApprove(config.chain.destination.tokens.USDC.address, dst.escrowFactory)

        
        // tezos initialisations

        const tezosWallets = await getTaqueriaConfig()

        AliceTezos = tezosWallets.AliceTezos
        BobTezos = tezosWallets.BobTezos
            
        Alice_invocation_of_escrow_manager_contract = await AliceTezos.contract.at(tezosConfig.escrow_factory.address);
        Alice_invocation_of_fa2__contract = await AliceTezos.contract.at(tezosConfig.fa2_token.address);

        Bob_invocation_of_escrow_manager_contract = await BobTezos.contract.at(tezosConfig.escrow_factory.address);
        Bob_invocation_of_fa2__contract = await BobTezos.contract.at(tezosConfig.fa2_token.address);

        srcTimestamp = BigInt((await src.provider.getBlock('latest'))!.timestamp)
    }, 180000); // 3 minutes

    async function getBalancesEth(
        srcToken: string,
        dstToken: string
    ): Promise<{ src: { user: bigint; resolver: bigint }; dst: { user: bigint; resolver: bigint } }> {
        return {
            src: {
                user: await srcChainETHUser.tokenBalance(srcToken),
                resolver: await srcResolverContractETH.tokenBalance(srcToken)
            },
            dst: {
                user: await dstChainETHUser.tokenBalance(dstToken),
                resolver: await dstResolverContractETH.tokenBalance(dstToken)
            }
        }
    }

    function ethImmutablesToTezos(
        ethImmutables: Sdk.Immutables,
        tezosMakerAddress: string,
        tezosTakerAddress: string,
        tezosTokenAddress: string | null,
        tezosAmount: number,
        tezosSafetyDeposit: number
    ): any {
        // Extract and clean the hex values by removing the '0x' prefix.
        const orderHash = ethImmutables.orderHash.substring(2);
        const hashlock = ethImmutables.hashLock.toString().substring(2);

        console.log(ethImmutables.timeLocks.toDstTimeLocks(), "timelocks")
    
        // Convert the TimeLocks object from the SDK (which uses BigInt and has private `_`
        // properties) to a plain object with numbers, as Taquito expects for timestamps.
        const timelocks = {
            srcWithdrawal: Number(ethImmutables.timeLocks.srcWithdrawal),
            srcPublicWithdrawal: Number(ethImmutables.timeLocks.srcPublicWithdrawal),
            srcCancellation: Number(ethImmutables.timeLocks.srcCancellation),
            srcPublicCancellation: Number(ethImmutables.timeLocks.srcPublicCancellation),
            dstWithdrawal: Number(ethImmutables.timeLocks.dstWithdrawal),
            dstPublicWithdrawal: Number(ethImmutables.timeLocks.dstPublicWithdrawal),
            dstCancellation: Number(ethImmutables.timeLocks.dstCancellation),
            deployedAt: Number(ethImmutables.timeLocks.deployedAt),
        };
    
        return {
            orderHash,
            hashlock,
            maker: tezosMakerAddress,
            taker: tezosTakerAddress,
            token: tezosTokenAddress,
            amount: new BigNumber(tezosAmount),
            safetyDeposit: new BigNumber(tezosSafetyDeposit),
            timelocks,
        };
    }

    afterAll(async () => {
        src.provider.destroy()
        dst.provider.destroy()
        await Promise.all([src.node?.stop(), dst.node?.stop()])
    }, 180000); // 3 minutes

    
    // eslint-disable-next-line max-lines-per-function
    describe('Fill', () => {
        it('should swap ETH USDC for custom FA2 token on tezos (T1k)', async () => {


            // The maker has both a tezos and an eth wallet

            const initialETHBalances = await getBalancesEth(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            const aliceBalBefore = await getTezosBalance(AliceTezos, tezosConfig.accounts.alice.address)
            const bobBalBefore = await getTezosBalance(BobTezos, tezosConfig.accounts.bob.address)
            



            // User Alice  creates order

            const secret = uint8ArrayToHex(randomBytes(32)) // note: use crypto secure random number in real world
            console.log('ze secret', secret)
            const hashLock = Sdk.HashLock.forSingleFill(secret)
            console.log('ze hashLock', hashLock)
            
            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainETHUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('5', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.destination.tokens.USDC.address) // it should be fa2 token address on tezos
                },

                {
                    hashLock: Sdk.HashLock.forSingleFill(secret),
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10sec finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10sec finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId, // it should be tezos chain id but leave mock for now
                    srcSafetyDeposit: parseEther('0.00001'),
                    dstSafetyDeposit: parseEther('0.00001')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            const signature = await srcChainETHUser.signOrder(srcChainId, order)
            console.log('signature', signature)

            const orderHash = order.getOrderHash(srcChainId)
            console.log('orderHash', orderHash)
            
            // Resolver fills order
            const resolverContract = new Resolver(src.resolver, dst.resolver)

            console.log(`[${srcChainId}]`, `Filling order ${orderHash}`)

            const fillAmount = order.makingAmount
            const { txHash: orderFillHash, blockHash: srcDeployBlock } = await srcChainResolverETH.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )

            console.log(`[${srcChainId}]`, `Order ${orderHash} filled for ${fillAmount} in tx ${orderFillHash}`)

            const srcEscrowEvent = await srcFactoryETH.getSrcDeployEvent(srcDeployBlock)
            
            const dstImmutables = srcEscrowEvent[0]
                .withComplement(srcEscrowEvent[1])
                .withTaker(new Address(resolverContract.dstAddress))

            console.log('dstImmutables', dstImmutables)
            
            
            
            const tezosImmutables = ethImmutablesToTezos(
                dstImmutables,
                tezosConfig.accounts.alice.address, // The maker's Tezos address
                tezosConfig.accounts.bob.address,   // The taker's (resolver's) Tezos address
                tezosConfig.fa2_token.address,      // The T1K token address on Tezos
                100000,                                 // takingAmount on Tezos side
                2000                                // safetyDeposit on Tezos side (example)
            );
            console.log('tezosImmutables', tezosImmutables)
            process.exit(0)
            console.log(`[${dstChainId}]`, `Depositing ${dstImmutables.amount} for order ${orderHash}`)
           
            // const { txHash: dstDepositHash, blockTimestamp: dstDeployedAt } = await dstChainResolver.send(
            //     resolverContract.deployDst(dstImmutables)
            // )

            const txRequest = resolverContract.deployDst(dstImmutables)
            console.log('Transaction request:', txRequest)

            // Send the transaction with explicit parameters
            const { txHash: dstDepositHash, blockTimestamp: dstDeployedAt } = await dstChainResolver.send({
                to: txRequest.to,
                data: txRequest.data,
                value: txRequest.value
            })

            console.log(`[${dstChainId}]`, `Created dst deposit for order ${orderHash} in tx ${dstDepositHash}`)

            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const ESCROW_DST_IMPLEMENTATION = await dstFactory.getDestinationImpl()

            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )

            const dstEscrowAddress = new Sdk.EscrowFactory(new Address(dst.escrowFactory)).getDstEscrowAddress(
                srcEscrowEvent[0],
                srcEscrowEvent[1],
                dstDeployedAt,
                new Address(resolverContract.dstAddress),
                ESCROW_DST_IMPLEMENTATION
            )

            await increaseTime(11)
            // User shares key after validation of dst escrow deployment
            console.log(`[${dstChainId}]`, `Withdrawing funds for user from ${dstEscrowAddress}`)
            await dstChainResolver.send(
                resolverContract.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
            )

            console.log(`[${srcChainId}]`, `Withdrawing funds for resolver from ${srcEscrowAddress}`)
            const { txHash: resolverWithdrawHash } = await srcChainResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
            )
            console.log(
                `[${srcChainId}]`,
                `Withdrew funds for resolver from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
            )
            

            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address,
                config.chain.destination.tokens.USDC.address
            )

            // user transferred funds to resolver on source chain
            expect(initialBalances.src.user - resultBalances.src.user).toBe(order.makingAmount)
            expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(order.makingAmount)
            // resolver transferred funds to user on destination chain
            expect(resultBalances.dst.user - initialBalances.dst.user).toBe(order.takingAmount)
            expect(initialBalances.dst.resolver - resultBalances.dst.resolver).toBe(order.takingAmount)
        })

    

        
    })
})


async function initChain(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {node, provider} = await getProvider(cnf)
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider)

    // deploy EscrowFactory
    const escrowFactory = await deploy(
        factoryContract,
        [
            cnf.limitOrderProtocol,
            cnf.wrappedNative, // feeToken,
            Address.fromBigInt(0n).toString(), // accessToken,
            deployer.address, // owner
            60 * 30, // src rescue delay
            60 * 30 // dst rescue delay
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)

    // deploy Resolver contract
    const resolver = await deploy(
        resolverContract,
        [
            escrowFactory,
            cnf.limitOrderProtocol,
            computeAddress(resolverPkETH) // resolver as owner of contract
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver)

    return {node: node, provider, resolver, escrowFactory}
}

async function getProvider(cnf: ChainConfig): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider}> {
    if (!cnf.createFork) {
        return {
            provider: new JsonRpcProvider(cnf.url, cnf.chainId, {
                cacheTimeout: -1,
                staticNetwork: true
            })
        }
    }

    const node = createServer({
        instance: anvil({forkUrl: cnf.url, chainId: cnf.chainId}),
        limit: 1
    })
    await node.start()

    const address = node.address()
    assert(address)

    const provider = new JsonRpcProvider(`http://[${address.address}]:${address.port}/1`, cnf.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
    })

    return {
        provider,
        node
    }
}

/**
 * Deploy contract and return its address
 */
async function deploy(
    json: {abi: any; bytecode: any},
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string>{
    const deployed = await new ContractFactory(json.abi, json.bytecode, deployer).deploy(...params)
    await deployed.waitForDeployment()
    return await deployed.getAddress()
}
