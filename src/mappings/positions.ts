import {Address} from "@graphprotocol/graph-ts/index";
import {
  Borrowable,
  BorrowPosition,
  Collateral,
  CollateralPosition,
  SupplyPosition,
  Token
} from "../types/schema";
import {
  BI_18,
  convertTokenToDecimal, loadOrCreateToken,
  loadOrCreateUser, ONE_BD, ZERO_BD
} from "./helpers";
import {Collateral as CollateralContract} from "../types/ImpermaxFactory/Collateral";
import {Borrowable as BorrowableContract} from "../types/ImpermaxFactory/Borrowable";


export function loadOrCreateCollateralPosition(collateral: Address, user: Address): CollateralPosition {
  let id = collateral.toHexString().concat('-').concat(user.toHexString());
  let collateralPosition = CollateralPosition.load(id);
  if (collateralPosition === null) {
    loadOrCreateUser(user);
    collateralPosition = new CollateralPosition(id);
    collateralPosition.collateral = collateral.toHexString();
    collateralPosition.user = user.toHexString();
    collateralPosition.balance = ZERO_BD;
    collateralPosition.save()
  }
  return collateralPosition as CollateralPosition
}

export function loadOrCreateSupplyPosition(borrowable: Address, user: Address): SupplyPosition {
  let id = borrowable.toHexString().concat('-').concat(user.toHexString());
  let supplyPosition = SupplyPosition.load(id);
  if (supplyPosition === null) {
    loadOrCreateUser(user);
    supplyPosition = new SupplyPosition(id);
    supplyPosition.borrowable = borrowable.toHexString();
    supplyPosition.user = user.toHexString();
    supplyPosition.balance = ZERO_BD;
    supplyPosition.save()
  }
  return supplyPosition as SupplyPosition
}

export function loadOrCreateBorrowPosition(borrowable: Address, user: Address): BorrowPosition {
  let id = borrowable.toHexString().concat('-').concat(user.toHexString());
  let borrowPosition = BorrowPosition.load(id);
  if (borrowPosition === null) {
    loadOrCreateUser(user);
    borrowPosition = new BorrowPosition(id);
    borrowPosition.borrowable = borrowable.toHexString();
    borrowPosition.user = user.toHexString();
    borrowPosition.borrowBalance = ZERO_BD;
    borrowPosition.borrowIndex = ONE_BD;
    borrowPosition.save()
  }
  return borrowPosition as BorrowPosition
}

export function initializeCollateralPosition(
  collateralAddress: Address,
  userAddress: Address
): void {
  let collateral = Collateral.load(collateralAddress.toHexString());
  if (collateral === null) return;

  let collateralPosition = loadOrCreateCollateralPosition(collateralAddress, userAddress);
  let collateralContract = CollateralContract.bind(collateralAddress);
  collateralPosition.balance = convertTokenToDecimal(collateralContract.balanceOf(userAddress), BI_18);
  collateralPosition.save();
}

export function initializeBorrowPosition(
  borrowableAddress: Address,
  userAddress: Address
): void {
  let borrowable = Borrowable.load(borrowableAddress.toHexString());
  if (borrowable === null) return;

  let borrowPosition = loadOrCreateBorrowPosition(borrowableAddress, userAddress);
  let borrowableContract = BorrowableContract.bind(borrowableAddress);
  let decimals = loadOrCreateToken(Address.fromString(borrowable.underlying)).decimals;
  borrowPosition.borrowBalance = convertTokenToDecimal(borrowableContract.borrowBalance(userAddress), decimals);
  borrowPosition.borrowIndex = borrowable.borrowIndex;
  borrowPosition.save();
}

export function initializeSupplyPosition(
  borrowableAddress: Address,
  userAddress: Address
): void {
  let borrowable = Borrowable.load(borrowableAddress.toHexString());
  if (borrowable === null) return;

  let supplyPosition = loadOrCreateSupplyPosition(borrowableAddress, userAddress);
  let borrowableContract = BorrowableContract.bind(borrowableAddress);
  let decimals = loadOrCreateToken(Address.fromString(borrowable.underlying)).decimals;
  supplyPosition.balance = convertTokenToDecimal(borrowableContract.balanceOf(userAddress), decimals);
  supplyPosition.save();
}