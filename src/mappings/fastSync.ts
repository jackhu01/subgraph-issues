import {Address, BigInt} from "@graphprotocol/graph-ts/index";
import {Borrowable, Collateral, FastSync, LendingPool, Pair, Token} from "../types/schema";
import {
  BORROWABLES_BORROW,
  BORROWABLES_BORROW_POSITIONS,
  BORROWABLES_SUPPLY, BORROWABLES_SUPPLY_POSITIONS,
  COLLATERAL_POSITIONS,
  COLLATERALS, IMPERMAX_FACTORY_ADDRESS, IS_STABLE
} from "./constants";
import {ImpermaxFactory as ImpermaxFactoryContract} from "../types/ImpermaxFactory/ImpermaxFactory";
import {
  BI_18,
  convertTokenToDecimal,
  loadOrCreatePair,
  loadOrCreateToken, ONE_BD,
  updateLendingPoolUSD,
  ZERO_BD
} from "./helpers";
import {Collateral as CollateralContract} from "../types/ImpermaxFactory/Collateral";
import {Borrowable as BorrowableContract} from "../types/ImpermaxFactory/Borrowable";
import {syncFarmingPool} from "./farmingPool";
import {Borrowable as BorrowableTemplate, Collateral as CollateralTemplate} from "../types/templates";
import {syncPair} from "./uniswapPair";
import {initializeBorrowPosition, initializeCollateralPosition, initializeSupplyPosition} from "./positions";
import {CollateralStable as CCollateralStableContract} from "../types/ImpermaxFactory/CollateralStable";
import { CollateralStable as CollateralStableContract } from '../types/ImpermaxFactory/CollateralStable'


export function fastSync(): void {
  let fastSyncData = FastSync.load('1');
  if (fastSyncData === null) return;
  if (fastSyncData.syncState == 'done') return;

  let syncStep = fastSyncData.syncStep.toI32();

  if (fastSyncData.syncState == 'pairs') {
    let factoryContract = ImpermaxFactoryContract.bind(Address.fromString(IMPERMAX_FACTORY_ADDRESS));
    let lendingPoolLength = factoryContract.allLendingPoolsLength().toI32();
    if (syncStep < lendingPoolLength) {
      let uniswapV2PairAddress = factoryContract.allLendingPools(BigInt.fromI32(syncStep));
      let lendingPool = LendingPool.load(uniswapV2PairAddress.toHexString());
      if (lendingPool === null) {
        let lendingPoolData = factoryContract.getLendingPool(uniswapV2PairAddress);
        initializeLendingPool(
          uniswapV2PairAddress,
          lendingPoolData.value2,
          lendingPoolData.value3,
          lendingPoolData.value4
        );
        fastSyncData.syncStep = BigInt.fromI32(syncStep + 1);
        fastSyncData.save();
        return;
      }
    }
    fastSyncData.syncState = 'collaterals';
    fastSyncData.syncStep = BigInt.fromI32(0);
    fastSyncData.save();
    return;
  }

  if (fastSyncData.syncState == 'collaterals') {
    if (syncStep >= COLLATERALS.length) {
      fastSyncData.syncState = 'borrowableBorrow';
      fastSyncData.syncStep = BigInt.fromI32(0);
      fastSyncData.save();
      return;
    }

    let collateral = COLLATERALS[syncStep];
    let users = COLLATERAL_POSITIONS[syncStep];
    for (let j = 0; j < users.length; j++) {
      initializeCollateralPosition(
        Address.fromString(collateral),
        Address.fromString(users[j]),
      );
    }
    fastSyncData.syncStep = BigInt.fromI32(syncStep + 1);
    fastSyncData.save();
    return;
  }

  if (fastSyncData.syncState == 'borrowableBorrow') {
    if (syncStep >= BORROWABLES_BORROW.length) {
      fastSyncData.syncState = 'borrowableSupply';
      fastSyncData.syncStep = BigInt.fromI32(0);
      fastSyncData.save();
      return;
    }

    let borrowable = BORROWABLES_BORROW[syncStep];
    let users = BORROWABLES_BORROW_POSITIONS[syncStep];
    for (let j = 0; j < users.length; j++) {
      initializeBorrowPosition(
        Address.fromString(borrowable),
        Address.fromString(users[j]),
      );
    }
    fastSyncData.syncStep = BigInt.fromI32(syncStep + 1);
    fastSyncData.save();
    return;
  }

  if (fastSyncData.syncState == 'borrowableSupply') {
    if (syncStep >= BORROWABLES_SUPPLY.length) {
      fastSyncData.syncState = 'done';
      fastSyncData.syncStep = BigInt.fromI32(0);
      fastSyncData.save();
      return;
    }

    let borrowable = BORROWABLES_SUPPLY[syncStep];
    let users = BORROWABLES_SUPPLY_POSITIONS[syncStep];
    for (let j = 0; j < users.length; j++) {
      initializeSupplyPosition(
        Address.fromString(borrowable),
        Address.fromString(users[j]),
      );
    }
    fastSyncData.syncStep = BigInt.fromI32(syncStep + 1);
    fastSyncData.save();
    return;
  }
}

export function initializePositions(uniswapV2PairAddress: Address): void {
  let lendingPool = LendingPool.load(uniswapV2PairAddress.toHexString());
  if (lendingPool === null) return;
  let borrowables: Array<string> = [
    lendingPool.borrowable0,
    lendingPool.borrowable1
  ];

  for (let i = 0; i < COLLATERALS.length; i++) {
    if (COLLATERALS[i] != lendingPool.collateral) continue;
    let users = COLLATERAL_POSITIONS[i];
    for (let j = 0; j < users.length; j++) {
      initializeCollateralPosition(
        Address.fromString(lendingPool.collateral),
        Address.fromString(users[j]),
      );
    }
    break;
  }
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < BORROWABLES_BORROW.length; i++) {
      if (BORROWABLES_BORROW[i] != borrowables[k]) continue;
      let users = BORROWABLES_BORROW_POSITIONS[i];
      for (let j = 0; j < users.length; j++) {
        initializeBorrowPosition(
          Address.fromString(borrowables[k]),
          Address.fromString(users[j]),
        );
      }
      break;
    }
    for (let i = 0; i < BORROWABLES_SUPPLY.length; i++) {
      if (BORROWABLES_SUPPLY[i] != borrowables[k]) continue;
      let users = BORROWABLES_SUPPLY_POSITIONS[i];
      for (let j = 0; j < users.length; j++) {
        initializeSupplyPosition(
          Address.fromString(borrowables[k]),
          Address.fromString(users[j]),
        );
      }
      break;
    }
  }
}

function initializeLendingPool(
  uniswapV2PairAddress: Address,
  collateralAddress: Address,
  borrowable0Address: Address,
  borrowable1Address: Address
): void {
  let pair = loadOrCreatePair(uniswapV2PairAddress);
  if (pair === null) return;

  let collateralContract = CollateralContract.bind(collateralAddress);
  let borrowable0Contract = BorrowableContract.bind(borrowable0Address);
  let borrowable1Contract = BorrowableContract.bind(borrowable1Address);

  let decimal0 = loadOrCreateToken(Address.fromString(pair.token0)).decimals;
  let decimal1 = loadOrCreateToken(Address.fromString(pair.token1)).decimals;

  // collateral
  let safetyMargin = ONE_BD;
  if (IS_STABLE) {
    let stableContract = CollateralStableContract.bind(collateralAddress);
    let safetyMarginCall = stableContract.try_safetyMargin();
    if (safetyMarginCall.reverted) return null;
    safetyMargin = convertTokenToDecimal(safetyMarginCall.value, BI_18);
  }
  else {
    let safetyMarginSqrtCall = collateralContract.try_safetyMarginSqrt();
    if (safetyMarginSqrtCall.reverted) return null;
    let safetyMarginSqrt = convertTokenToDecimal(safetyMarginSqrtCall.value, BI_18);
    safetyMargin = safetyMarginSqrt.times(safetyMarginSqrt);
  }

  let liquidationIncentiveCall = collateralContract.try_liquidationIncentive();
  if (liquidationIncentiveCall.reverted) return null;
  let liquidationIncentive = convertTokenToDecimal(liquidationIncentiveCall.value, BI_18);
  let liquidationFeeCall = collateralContract.try_liquidationFee();
  let liquidationFee = liquidationFeeCall.reverted ? ZERO_BD : convertTokenToDecimal(liquidationFeeCall.value, BI_18);

  let collateral = new Collateral(collateralAddress.toHexString());
  collateral.underlying = pair.id;
  collateral.totalBalance = ZERO_BD;
  collateral.safetyMargin = safetyMargin;
  collateral.liquidationIncentive = liquidationIncentive;
  collateral.liquidationFee = liquidationFee;
  collateral.exchangeRate = ONE_BD;
  collateral.totalBalanceUSD = ZERO_BD;

  // borrowable
  let borrowable0 = new Borrowable(borrowable0Address.toHexString());
  let borrowable1 = new Borrowable(borrowable1Address.toHexString());

  borrowable0.underlying = pair.token0;
  borrowable0.totalBalance = convertTokenToDecimal(borrowable0Contract.totalBalance(), decimal0);
  borrowable0.totalBorrows = convertTokenToDecimal(borrowable0Contract.totalBorrows(), decimal0);
  borrowable0.borrowRate = convertTokenToDecimal(borrowable0Contract.borrowRate(), BI_18);
  borrowable0.reserveFactor = convertTokenToDecimal(borrowable0Contract.reserveFactor(), BI_18);
  borrowable0.kinkBorrowRate = convertTokenToDecimal(borrowable0Contract.kinkBorrowRate(), BI_18);
  borrowable0.kinkUtilizationRate = convertTokenToDecimal(borrowable0Contract.kinkUtilizationRate(), BI_18);
  borrowable0.adjustSpeed = convertTokenToDecimal(borrowable0Contract.adjustSpeed(), BI_18);
  borrowable0.borrowIndex = convertTokenToDecimal(borrowable0Contract.borrowIndex(), BI_18);
  borrowable0.accrualTimestamp = borrowable0Contract.accrualTimestamp();
  borrowable0.exchangeRate = convertTokenToDecimal(borrowable0Contract.exchangeRate(), BI_18);
  let farmingPool0Address = borrowable0Contract.borrowTracker();
  borrowable0.farmingPool = farmingPool0Address.toHexString();
  borrowable0.totalBalanceUSD = ZERO_BD;
  borrowable0.totalSupplyUSD = ZERO_BD;
  borrowable0.totalBorrowsUSD = ZERO_BD;

  borrowable1.underlying = pair.token1;
  borrowable1.totalBalance = convertTokenToDecimal(borrowable1Contract.totalBalance(), decimal1);
  borrowable1.totalBorrows = convertTokenToDecimal(borrowable1Contract.totalBorrows(), decimal1);
  borrowable1.borrowRate = convertTokenToDecimal(borrowable1Contract.borrowRate(), BI_18);
  borrowable1.reserveFactor = convertTokenToDecimal(borrowable1Contract.reserveFactor(), BI_18);
  borrowable1.kinkBorrowRate = convertTokenToDecimal(borrowable1Contract.kinkBorrowRate(), BI_18);
  borrowable1.kinkUtilizationRate = convertTokenToDecimal(borrowable1Contract.kinkUtilizationRate(), BI_18);
  borrowable1.adjustSpeed = convertTokenToDecimal(borrowable1Contract.adjustSpeed(), BI_18);
  borrowable1.borrowIndex = convertTokenToDecimal(borrowable1Contract.borrowIndex(), BI_18);
  borrowable1.accrualTimestamp = borrowable1Contract.accrualTimestamp();
  borrowable1.exchangeRate = convertTokenToDecimal(borrowable1Contract.exchangeRate(), BI_18);
  let farmingPool1Address = borrowable1Contract.borrowTracker();
  borrowable1.farmingPool = farmingPool1Address.toHexString();
  borrowable1.totalBalanceUSD = ZERO_BD;
  borrowable1.totalSupplyUSD = ZERO_BD;
  borrowable1.totalBorrowsUSD = ZERO_BD;

  syncFarmingPool(farmingPool0Address);
  syncFarmingPool(farmingPool1Address);

  // lendingPool
  let lendingPool = new LendingPool(uniswapV2PairAddress.toHexString());
  lendingPool.pair = pair.id;
  lendingPool.collateral = collateral.id;
  lendingPool.borrowable0 = borrowable0.id;
  lendingPool.borrowable1 = borrowable1.id;
  lendingPool.totalBalanceUSD = ZERO_BD;
  lendingPool.totalSupplyUSD = ZERO_BD;
  lendingPool.totalBorrowsUSD = ZERO_BD;

  collateral.lendingPool = lendingPool.id;
  borrowable0.lendingPool = lendingPool.id;
  borrowable1.lendingPool = lendingPool.id;

  // save
  collateral.save();
  borrowable0.save();
  borrowable1.save();
  lendingPool.save();

  // create the tracked contract based on the template
  CollateralTemplate.create(collateralAddress);
  BorrowableTemplate.create(borrowable0Address);
  BorrowableTemplate.create(borrowable1Address);

  syncPair(uniswapV2PairAddress);
  updateLendingPoolUSD(uniswapV2PairAddress.toHexString());
}