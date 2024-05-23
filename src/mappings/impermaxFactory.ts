import { BigInt, BigDecimal, log, Address } from "@graphprotocol/graph-ts"
import {
  LendingPoolInitialized,
} from "../types/ImpermaxFactory/ImpermaxFactory"
import {
  FAST_SYNC,
  IMPERMAX_FACTORY_ADDRESS, IS_STABLE,
} from './constants'
import {ImpermaxFactory, Pair, Bundle, Token, LendingPool, Collateral, Borrowable, FastSync} from "../types/schema"
import { Borrowable as BorrowableTemplate, Collateral as CollateralTemplate } from '../types/templates'
import { Collateral as CollateralContract } from '../types/ImpermaxFactory/Collateral'
import { CollateralStable as CollateralStableContract } from '../types/ImpermaxFactory/CollateralStable'
import { Borrowable as BorrowableContract } from '../types/ImpermaxFactory/Borrowable'

import {
  ONE_BD,
  ZERO_BD,
  loadOrCreatePair, convertTokenToDecimal, BI_18,
} from './helpers'
import {fastSync} from "./fastSync";

function createCollateral(address: Address, pair: Address): Collateral | null {
  let contract = CollateralContract.bind(address);

  // Safety Margin
  let safetyMargin = ONE_BD;
  if (IS_STABLE) {
    let stableContract = CollateralStableContract.bind(address);
    let safetyMarginCall = stableContract.try_safetyMargin();
    if (safetyMarginCall.reverted) return null;
    safetyMargin = convertTokenToDecimal(safetyMarginCall.value, BI_18);
  }
  else {
    let safetyMarginSqrtCall = contract.try_safetyMarginSqrt();
    if (safetyMarginSqrtCall.reverted) return null;
    let safetyMarginSqrt = convertTokenToDecimal(safetyMarginSqrtCall.value, BI_18);
    safetyMargin = safetyMarginSqrt.times(safetyMarginSqrt);
  }

  // Liquidation parameters
  let liquidationIncentiveCall = contract.try_liquidationIncentive();
  if (liquidationIncentiveCall.reverted) return null;
  let liquidationIncentive = convertTokenToDecimal(liquidationIncentiveCall.value, BI_18);
  let liquidationFeeCall = contract.try_liquidationFee();
  let liquidationFee = liquidationFeeCall.reverted ? ZERO_BD : convertTokenToDecimal(liquidationFeeCall.value, BI_18);

  let collateral = new Collateral(address.toHexString());
  collateral.underlying = pair.toHexString();
  collateral.totalBalance = ZERO_BD;
  collateral.safetyMargin = safetyMargin;
  collateral.liquidationIncentive = liquidationIncentive;
  collateral.liquidationFee = liquidationFee;
  collateral.exchangeRate = ONE_BD;
  collateral.totalBalanceUSD = ZERO_BD;
  collateral.lendingPool = pair.toHexString();
  collateral.save();
  return collateral;
}

function createBorrowable(address: Address, pair: Address, underlying: string, timestamp: BigInt): Borrowable | null {
  let contract = BorrowableContract.bind(address);
  let reserveFactorCall = contract.try_reserveFactor();
  if (reserveFactorCall.reverted) return null;
  let reserveFactor = convertTokenToDecimal(reserveFactorCall.value, BI_18);
  let kinkBorrowRateCall = contract.try_kinkBorrowRate();
  if (kinkBorrowRateCall.reverted) return null;
  let kinkBorrowRate = convertTokenToDecimal(kinkBorrowRateCall.value, BI_18);
  let kinkUtilizationRateCall = contract.try_kinkUtilizationRate();
  if (kinkUtilizationRateCall.reverted) return null;
  let kinkUtilizationRate = convertTokenToDecimal(kinkUtilizationRateCall.value, BI_18);
  let adjustSpeedCall = contract.try_adjustSpeed();
  if (adjustSpeedCall.reverted) return null;
  let adjustSpeed = convertTokenToDecimal(adjustSpeedCall.value, BI_18);

  let borrowable = new Borrowable(address.toHexString());
  borrowable.underlying = underlying;
  borrowable.totalBalance = ZERO_BD;
  borrowable.totalBorrows = ZERO_BD;
  borrowable.borrowRate = ZERO_BD;
  borrowable.reserveFactor = reserveFactor;
  borrowable.kinkBorrowRate = kinkBorrowRate;
  borrowable.kinkUtilizationRate = kinkUtilizationRate;
  borrowable.adjustSpeed = adjustSpeed;
  borrowable.borrowIndex = ONE_BD;
  borrowable.accrualTimestamp = timestamp;
  borrowable.exchangeRate = ONE_BD;
  borrowable.totalBalanceUSD = ZERO_BD;
  borrowable.totalSupplyUSD = ZERO_BD;
  borrowable.totalBorrowsUSD = ZERO_BD;
  borrowable.lendingPool = pair.toHexString();
  borrowable.save();
  return borrowable;
}

export function handleLendingPoolInitialized(event: LendingPoolInitialized): void {
  let impermaxFactory = ImpermaxFactory.load(IMPERMAX_FACTORY_ADDRESS);
  if (impermaxFactory === null) {
	  impermaxFactory = new ImpermaxFactory(IMPERMAX_FACTORY_ADDRESS);
    impermaxFactory.totalBalanceUSD = ZERO_BD;
    impermaxFactory.totalSupplyUSD = ZERO_BD;
    impermaxFactory.totalBorrowsUSD = ZERO_BD;
    impermaxFactory.save();

    // create new bundle
    let bundle = new Bundle('1');
    bundle.ethPrice = ZERO_BD;
    bundle.save();

    // initialize fast sync
    let fastSyncData = new FastSync('1');
    fastSyncData.syncState = FAST_SYNC ? 'pairs' : 'done';
    fastSyncData.syncStep = BigInt.fromI32(0);
    fastSyncData.save();

    for (let i = 0; i < 10; i++) {
      fastSync();
    }
  }

  let pair = loadOrCreatePair(event.params.uniswapV2Pair);
  if (pair === null) return;

  let collateral = createCollateral(event.params.collateral, event.params.uniswapV2Pair);
  if (collateral === null) return;

  let borrowable0 = createBorrowable(event.params.borrowable0, event.params.uniswapV2Pair, pair.token0, event.block.timestamp);
  if (borrowable0 === null) return;

  let borrowable1 = createBorrowable(event.params.borrowable1, event.params.uniswapV2Pair, pair.token1, event.block.timestamp);
  if (borrowable1 === null) return;

  // lendingPool
  let lendingPool = new LendingPool(event.params.uniswapV2Pair.toHexString());
  lendingPool.pair = pair.id;
  lendingPool.collateral = collateral.id;
  lendingPool.borrowable0 = borrowable0.id;
  lendingPool.borrowable1 = borrowable1.id;
  lendingPool.totalBalanceUSD = ZERO_BD;
  lendingPool.totalSupplyUSD = ZERO_BD;
  lendingPool.totalBorrowsUSD = ZERO_BD;
  lendingPool.save();

  // create the tracked contract based on the template
  CollateralTemplate.create(event.params.collateral);
  BorrowableTemplate.create(event.params.borrowable0);
  BorrowableTemplate.create(event.params.borrowable1);
}