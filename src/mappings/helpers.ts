/* eslint-disable prefer-const */
import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { ERC20 } from '../types/ImpermaxFactory/ERC20'
import { ERC20SymbolBytes } from '../types/ImpermaxFactory/ERC20SymbolBytes'
import { ERC20NameBytes } from '../types/ImpermaxFactory/ERC20NameBytes'
import {
  CREATE_UNDERLYING_PAIR,
  IMPERMAX_FACTORY_ADDRESS,
  TVL_PAIRS_BLACK_LIST,
  UNISWAP_FACTORY_ADDRESS
} from './constants'
import { ImpermaxFactory, Borrowable, Collateral, LendingPool, Token, Pair, Distributor, User } from "../types/schema"
import { UniswapFactory as UniswapFactoryContract } from '../types/ImpermaxFactory/UniswapFactory'
import { Pair as PairContract } from '../types/ImpermaxFactory/Pair'
import { IBaseV1Pair as IBaseV1PairContract } from '../types/ImpermaxFactory/IBaseV1Pair'
import { IBaseV1Factory as IBaseV1FactoryContract } from '../types/ImpermaxFactory/IBaseV1Factory'
import { FarmingPool as FarmingPoolContract } from '../types/ImpermaxFactory/FarmingPool'
import { Distributor as DistributorContract } from '../types/ImpermaxFactory/Distributor'
import { Collateral as CollateralContract } from '../types/ImpermaxFactory/Collateral'
import { Borrowable as BorrowableContract } from '../types/ImpermaxFactory/Borrowable'
import { StakedLPToken as StakedLPTokenContract } from '../types/ImpermaxFactory/StakedLPToken'
import { Pair as PairTemplate } from '../types/templates'
import { StakedLPToken as StakedLPTokenTemplate } from '../types/templates'
import {updateStaking} from "./lpStaking";

export let ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');
export let BI_18 = BigInt.fromI32(18);

export let uniswapFactoryContract = UniswapFactoryContract.bind(Address.fromString(UNISWAP_FACTORY_ADDRESS));
export let solidlyFactoryContract = IBaseV1FactoryContract.bind(Address.fromString(UNISWAP_FACTORY_ADDRESS));

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1');
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function bigIntExp18(): BigInt {
  return BigInt.fromString('1000000000000000000')
}

export function bigIntExp27(): BigInt {
  return BigInt.fromString('1000000000000000000000000000')
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString('1000000000000000000')
}

export function convertEthToDecimal(eth: BigInt): BigDecimal {
  return eth.toBigDecimal().div(exponentToBigDecimal(BI_18))
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

export function equalToZero(value: BigDecimal): boolean {
  let formattedVal = parseFloat(value.toString());
  let zero = parseFloat(ZERO_BD.toString());
  return zero == formattedVal;
}

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001'
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress);

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown';
  let symbolResult = contract.try_symbol();
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol();
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
        symbolValue = symbolResultBytes.value.toString()
      }
    }
  } else {
    symbolValue = symbolResult.value
  }

  return symbolValue
}

export function fetchTokenName(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress);
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress);

  // try types string and bytes32 for name
  let nameValue = 'unknown';
  let nameResult = contract.try_name();
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name();
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        nameValue = nameResultBytes.value.toString()
      }
    }
  } else {
    nameValue = nameResult.value
  }

  return nameValue
}

export function fetchTokenTotalSupply(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  let totalSupplyValue = null;
  let totalSupplyResult = contract.try_totalSupply();
  if (!totalSupplyResult.reverted) {
    totalSupplyValue = totalSupplyResult as i32
  }
  return BigInt.fromI32(totalSupplyValue as i32)
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress);
  // try types uint8 for decimals
  let decimalValue = null;
  let decimalResult = contract.try_decimals();
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  }
  return BigInt.fromI32(decimalValue as i32)
}

export function getReserves(uniswapV2PairAddress: Address): Array<BigInt> | null {
  let solidlyContract = IBaseV1PairContract.bind(uniswapV2PairAddress);
  let v2Contract = PairContract.bind(uniswapV2PairAddress);
  let stableCall = solidlyContract.try_stable();
  if (stableCall.reverted) {
    let getReservesCall = v2Contract.try_getReserves();
    if (getReservesCall.reverted) return null;
    return [getReservesCall.value.value0, getReservesCall.value.value1];
  } else {
    let getReservesCall = solidlyContract.try_getReserves();
    if (getReservesCall.reverted) return null;
    return [getReservesCall.value.value0, getReservesCall.value.value1];
  }
}

export function fetchCollateralExchangeRate(collateralAddress: Address): BigDecimal {
  let contract = CollateralContract.bind(collateralAddress);
  return convertTokenToDecimal(contract.exchangeRate(), BI_18)
}

export function fetchBorrowableExchangeRate(borrowableAddress: Address): BigDecimal {
  let contract = BorrowableContract.bind(borrowableAddress);
  return convertTokenToDecimal(contract.exchangeRate(), BI_18)
}

export function fetchFarmingPoolClaimable(farmingPoolAddress: Address): Address {
  let contract = FarmingPoolContract.bind(farmingPoolAddress);
  return contract.claimable()
}

export function fetchFarmingPoolEpochAmount(farmingPoolAddress: Address): BigDecimal {
  let contract = FarmingPoolContract.bind(farmingPoolAddress);
  return convertTokenToDecimal(contract.epochAmount(), BI_18)
}

export function fetchFarmingPoolEpochBegin(farmingPoolAddress: Address): BigInt {
  let contract = FarmingPoolContract.bind(farmingPoolAddress);
  return contract.epochBegin()
}

export function fetchFarmingPoolSegmentLength(farmingPoolAddress: Address): BigInt {
  let contract = FarmingPoolContract.bind(farmingPoolAddress);
  return contract.segmentLength()
}

export function fetchFarmingPoolVestingBegin(farmingPoolAddress: Address): BigInt {
  let contract = FarmingPoolContract.bind(farmingPoolAddress);
  return contract.vestingBegin()
}

export function fetchDistributorSharePercentage(distributorAddress: Address, farmingPoolAddress: Address): BigDecimal {
  let distributorContract = DistributorContract.bind(distributorAddress);
  let totalSharesCall = distributorContract.try_totalShares();
  let recipientsCall = distributorContract.try_recipients(farmingPoolAddress);
  if (totalSharesCall.reverted) return ZERO_BD;
  if (recipientsCall.reverted) return ZERO_BD;
  let totalShares = totalSharesCall.value.toBigDecimal();
  let recipients = recipientsCall.value;
  if (equalToZero(totalShares)) return ZERO_BD;
  let shares = recipients.value0.toBigDecimal();
  return shares.div(totalShares);
}


export function loadOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toHexString());
  // fetch info if null
  if (token === null) {
    token = new Token(tokenAddress.toHexString());
    token.symbol = fetchTokenSymbol(tokenAddress);
    token.name = fetchTokenName(tokenAddress);
    token.decimals = fetchTokenDecimals(tokenAddress);
    token.derivedETH = ZERO_BD;
    token.derivedUSD = ZERO_BD
  }
  token.save();
  return token as Token
}

export function loadOrCreatePair(pairAddress: Address): Pair | null {
  let pair = Pair.load(pairAddress.toHexString());
  // fetch info if null
  if (pair === null) {
    let contract = PairContract.bind(pairAddress);
    let token0 = contract.try_token0();
    let token1 = contract.try_token1();
    let factory = contract.try_factory();
    if (token0.reverted) return null;
    if (token1.reverted) return null;
    if (factory.reverted) return null;

    loadOrCreateToken(token0.value);
    loadOrCreateToken(token1.value);

    pair = new Pair(pairAddress.toHexString());
    pair.token0 = token0.value.toHexString();
    pair.token1 = token1.value.toHexString();
    pair.reserve0 = ZERO_BD;
    pair.reserve1 = ZERO_BD;
    pair.totalSupply = ZERO_BD;
    pair.reserveETH = ZERO_BD;
    pair.reserveUSD = ZERO_BD;
    pair.token0Price = ZERO_BD;
    pair.token1Price = ZERO_BD;
    pair.derivedETH = ZERO_BD;
    pair.derivedUSD = ZERO_BD;
    pair.syncCount = ZERO_BI;
    pair.isStakedLPToken = false;
    pair.uniswapV2PairAddress = pairAddress.toHexString();
    pair.uniswapV2Factory = factory.value.toHexString();
    pair.factory = factory.value.toHexString();
    pair.exchangeRate = ONE_BD;

    PairTemplate.create(pairAddress);

    // stakedLpToken
    let stakedLPTokenContract = StakedLPTokenContract.bind(pairAddress);

    let underlying = stakedLPTokenContract.try_underlying();
    if (!underlying.reverted) {
      pair.uniswapV2PairAddress = underlying.value.toHexString();
      let underlyingContract = PairContract.bind(underlying.value);
      let uniswapFactory = underlyingContract.try_factory();
      if (!uniswapFactory.reverted) {
        pair.uniswapV2Factory = uniswapFactory.value.toHexString();
        if (CREATE_UNDERLYING_PAIR) loadOrCreatePair(underlying.value);
      }
    }

    let isStakedLPToken = stakedLPTokenContract.try_isStakedLPToken();
    if (!isStakedLPToken.reverted) pair.isStakedLPToken = isStakedLPToken.value;
    if (pair.isStakedLPToken) {
      StakedLPTokenTemplate.create(pairAddress);
    }

    let stakedLPTokenType = stakedLPTokenContract.try_stakedLPTokenType();
    if (!stakedLPTokenType.reverted) pair.stakedLPTokenType = stakedLPTokenType.value;

    let stakingRewards = stakedLPTokenContract.try_stakingRewards();
    if (!stakingRewards.reverted) pair.stakingRewards = stakingRewards.value.toHexString();

    let masterChef = stakedLPTokenContract.try_masterChef();
    if (!masterChef.reverted) pair.masterChef = masterChef.value.toHexString();

    let pid = stakedLPTokenContract.try_pid();
    if (!pid.reverted) pair.pid = pid.value;

    let lpDepositor = stakedLPTokenContract.try_lpDepositor();
    if (!lpDepositor.reverted) pair.lpDepositor = lpDepositor.value.toHexString();

    let gauge = stakedLPTokenContract.try_gauge();
    if (!gauge.reverted) pair.gauge = gauge.value.toHexString();

    pair.save();

    updateStaking(pair as Pair);
  }

  return pair as Pair;
}

export function loadOrCreateDistributor(distributorAddress: Address): Distributor {
  let distributor = Distributor.load(distributorAddress.toHexString());
  if (distributor === null) {
    distributor = new Distributor(distributorAddress.toHexString())
  }
  distributor.save();
  return distributor as Distributor
}

export function loadOrCreateUser(address: Address): void {
  let user = User.load(address.toHexString());
  if (user === null) {
    user = new User(address.toHexString());
    user.save()
  }
}

export function updateLendingPoolUSD(pairAddress: string): void {
  let pair = Pair.load(pairAddress) as Pair;

  let lendingPool = LendingPool.load(pairAddress);
  if (lendingPool === null) return; // lendingPool doesn't exist yet for this pair
  
  let prevTotalBalanceUSD = lendingPool.totalBalanceUSD;
  let prevTotalSupplyUSD = lendingPool.totalSupplyUSD;
  let prevTotalBorrowsUSD = lendingPool.totalBorrowsUSD;
    
  let collateral = Collateral.load(lendingPool.collateral) as Collateral;
  collateral.totalBalanceUSD = collateral.totalBalance.times(pair.derivedUSD);
  collateral.save();
  
  let borrowable0 = Borrowable.load(lendingPool.borrowable0) as Borrowable;
  let borrowable1 = Borrowable.load(lendingPool.borrowable1) as Borrowable;
  let token0 = Token.load(borrowable0.underlying) as Token;
  let token1 = Token.load(borrowable1.underlying) as Token;
  
  borrowable0.totalBalanceUSD = borrowable0.totalBalance.times(token0.derivedUSD);
  borrowable0.totalBorrowsUSD = borrowable0.totalBorrows.times(token0.derivedUSD);
  borrowable0.totalSupplyUSD = borrowable0.totalBalanceUSD.plus(borrowable0.totalBorrowsUSD);
  borrowable1.totalBalanceUSD = borrowable1.totalBalance.times(token1.derivedUSD);
  borrowable1.totalBorrowsUSD = borrowable1.totalBorrows.times(token1.derivedUSD);
  borrowable1.totalSupplyUSD = borrowable1.totalBalanceUSD.plus(borrowable1.totalBorrowsUSD);
  
  borrowable0.save();
  borrowable1.save();
  
  lendingPool.totalBalanceUSD = collateral.totalBalanceUSD.plus(borrowable0.totalBalanceUSD).plus(borrowable1.totalBalanceUSD);
  lendingPool.totalSupplyUSD = borrowable0.totalSupplyUSD.plus(borrowable1.totalSupplyUSD);
  lendingPool.totalBorrowsUSD = borrowable0.totalBorrowsUSD.plus(borrowable1.totalBorrowsUSD);
  lendingPool.save();

  if (TVL_PAIRS_BLACK_LIST.includes(pairAddress)) return;
  
  let impermaxFactory = ImpermaxFactory.load(IMPERMAX_FACTORY_ADDRESS);
  if (impermaxFactory === null) return;
  impermaxFactory.totalBalanceUSD = impermaxFactory.totalBalanceUSD.plus(lendingPool.totalBalanceUSD).minus(prevTotalBalanceUSD);
  impermaxFactory.totalSupplyUSD = impermaxFactory.totalSupplyUSD.plus(lendingPool.totalSupplyUSD).minus(prevTotalSupplyUSD);
  impermaxFactory.totalBorrowsUSD = impermaxFactory.totalBorrowsUSD.plus(lendingPool.totalBorrowsUSD).minus(prevTotalBorrowsUSD);
  impermaxFactory.save()
}