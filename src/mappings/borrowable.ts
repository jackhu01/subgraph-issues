import { BigInt } from "@graphprotocol/graph-ts"
import {
  Sync,
  AccrueInterest,
  Borrow,
  Liquidate,
  CalculateKinkBorrowRate,
  CalculateBorrowRate,
  NewReserveFactor,
  NewKinkUtilizationRate,
  NewBorrowTracker,
  Transfer, NewAdjustSpeed,
} from "../types/templates/Borrowable/Borrowable"
import { Borrowable, Token } from "../types/schema"
import {
  convertTokenToDecimal,
  BI_18,
  updateLendingPoolUSD,
  fetchBorrowableExchangeRate,
} from './helpers'
import {syncFarmingPool} from "./farmingPool";
import {loadOrCreateBorrowPosition, loadOrCreateSupplyPosition} from "./positions";

function getDecimals(borrowable: Borrowable): BigInt {
  return (Token.load(borrowable.underlying) as Token).decimals
}

export function handleSync(event: Sync): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.totalBalance = convertTokenToDecimal(event.params.totalBalance, getDecimals(borrowable));
  borrowable.exchangeRate = fetchBorrowableExchangeRate(event.address);
  borrowable.save();
  updateLendingPoolUSD(borrowable.lendingPool)
}

export function handleAccrueInterest(event: AccrueInterest): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.totalBorrows = convertTokenToDecimal(event.params.totalBorrows, getDecimals(borrowable));
  borrowable.borrowIndex = convertTokenToDecimal(event.params.borrowIndex, BI_18);
  borrowable.accrualTimestamp = event.block.timestamp;
  borrowable.save()
}

export function handleBorrow(event: Borrow): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.totalBorrows = convertTokenToDecimal(event.params.totalBorrows, getDecimals(borrowable));
  borrowable.save();
  
  let borrowPosition = loadOrCreateBorrowPosition(event.address, event.params.borrower);
  borrowPosition.borrowBalance = convertTokenToDecimal(event.params.accountBorrows, getDecimals(borrowable));
  borrowPosition.borrowIndex = borrowable.borrowIndex;
  borrowPosition.save()  
}

export function handleLiquidate(event: Liquidate): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.totalBorrows = convertTokenToDecimal(event.params.totalBorrows, getDecimals(borrowable));
  borrowable.save();
  
  let borrowPosition = loadOrCreateBorrowPosition(event.address, event.params.borrower);
  borrowPosition.borrowBalance = convertTokenToDecimal(event.params.accountBorrows, getDecimals(borrowable));
  borrowPosition.borrowIndex = borrowable.borrowIndex;
  borrowPosition.save()
}

export function handleCalculateKinkBorrowRate(event: CalculateKinkBorrowRate): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.kinkBorrowRate = convertTokenToDecimal(event.params.kinkBorrowRate, BI_18);
  borrowable.save()
}

export function handleCalculateBorrowRate(event: CalculateBorrowRate): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.borrowRate = convertTokenToDecimal(event.params.borrowRate, BI_18);
  borrowable.save()
}

export function handleNewReserveFactor(event: NewReserveFactor): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.reserveFactor = convertTokenToDecimal(event.params.newReserveFactor, BI_18);
  borrowable.save()
}

export function handleNewKinkUtilizationRate(event: NewKinkUtilizationRate): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.kinkUtilizationRate = convertTokenToDecimal(event.params.newKinkUtilizationRate, BI_18);
  borrowable.save()
}

export function handleNewAdjustSpeed(event: NewAdjustSpeed): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.adjustSpeed = convertTokenToDecimal(event.params.newAdjustSpeed, BI_18);
  borrowable.save()
}

export function handleNewBorrowTracker(event: NewBorrowTracker): void {
  let farmingPoolAddress = event.params.newBorrowTracker;
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  borrowable.borrowTracker = farmingPoolAddress.toHexString();
  borrowable.farmingPool = farmingPoolAddress.toHexString();
  borrowable.save();
  syncFarmingPool(farmingPoolAddress);
}

export function handleTransfer(event: Transfer): void {
  let borrowable = Borrowable.load(event.address.toHexString()) as Borrowable;
  let fromSupplyPosition = loadOrCreateSupplyPosition(event.address, event.params.from);
  let toSupplyPosition = loadOrCreateSupplyPosition(event.address, event.params.to);
  let value = convertTokenToDecimal(event.params.value, getDecimals(borrowable));
  fromSupplyPosition.balance = fromSupplyPosition.balance.minus(value);
  toSupplyPosition.balance = toSupplyPosition.balance.plus(value);
  fromSupplyPosition.save();
  toSupplyPosition.save();
}
