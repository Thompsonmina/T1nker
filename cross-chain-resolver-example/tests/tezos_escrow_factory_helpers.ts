


// Creates timelock intervals for escrow operations, all times in seconds from deployment
export const makeTimelocks = (now: number) => ({
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

export const buildImmutables = (
    tokenOpt: string | null,
    amount: number,
    now: number = 1735689600,
    maker: string,
    taker: string,
    orderHash: string = 'b157e8fa0faaed7c0d56196dd78430dfb8b416a7e41d6d89058caa7a4462c617',
    hashlock: string = 'd64b150ee5d350ec6284c7f6c7af8985d0e5dee26640e04befa2584797f40e3e',
    safetyDeposit: number = 2000
  ) => ({
    orderHash:      orderHash,
    hashlock:       hashlock,
    maker:          maker,
    taker:          taker,
    token:          tokenOpt ? tokenOpt : null,
    amount,
    safetyDeposit: safetyDeposit,
    timelocks:      makeTimelocks(now)
});