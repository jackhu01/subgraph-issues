/* eslint-disable prefer-const */
import { BigDecimal, Address } from '@graphprotocol/graph-ts'
import {Pair, Token, Bundle} from '../types/schema'
import { Pair as PairContract, Sync as Sync1, Mint as Mint1 } from '../types/templates/Pair/Pair'
import { StakedLPToken as StakedLPTokenContract } from '../types/ImpermaxFactory/StakedLPToken'
import { Sync as Sync2, Mint as Mint2 } from '../types/templates/StakedLPToken/StakedLPToken'
import { getEthPriceInUSD, findEthPerToken } from './pricing'
import { convertTokenToDecimal, ONE_BI, ZERO_BD, BI_18, updateLendingPoolUSD, ONE_BD, getReserves } from './helpers'
import {UPDATE_FARM_ON_SYNC} from "./constants";
import {fastSync} from "./fastSync";
import {updateStaking} from "./lpStaking";


export function handleSync1(event: Mint1): void {
  fastSync();
  syncPair(event.address);
}

export function handleSync2(event: Mint2): void {
  fastSync();
  syncPair(event.address);
}

export function syncPair(uniswapV2PairAddress: Address): void {
  let pair = Pair.load(uniswapV2PairAddress.toHexString()) as Pair;
	
  pair.syncCount = pair.syncCount.plus(ONE_BI);

  let pairContract = PairContract.bind(uniswapV2PairAddress);
  let reserves = getReserves(uniswapV2PairAddress);
  if (reserves === null) return;
  let totalSupplyCall = pairContract.try_totalSupply();
  if (totalSupplyCall.reverted) return;
  let totalSupply = totalSupplyCall.value;
  
  let token0 = Token.load(pair.token0) as Token;
  let token1 = Token.load(pair.token1) as Token;
  
  pair.reserve0 = convertTokenToDecimal(reserves[0], token0.decimals);
  pair.reserve1 = convertTokenToDecimal(reserves[1], token1.decimals);

  if (pair.reserve1.notEqual(ZERO_BD)) pair.token0Price = pair.reserve0.div(pair.reserve1);
  else pair.token0Price = ZERO_BD;
  if (pair.reserve0.notEqual(ZERO_BD)) pair.token1Price = pair.reserve1.div(pair.reserve0);
  else pair.token1Price = ZERO_BD;

  pair.save();

  // update ETH price now that reserves could have changed
  let bundle = Bundle.load('1') as Bundle;
  bundle.ethPrice = getEthPriceInUSD();
  bundle.save();

  token0.derivedETH = findEthPerToken(token0 as Token);
  token1.derivedETH = findEthPerToken(token1 as Token);
  token0.derivedUSD = token0.derivedETH.times(bundle.ethPrice);
  token1.derivedUSD = token1.derivedETH.times(bundle.ethPrice);
  token0.save();
  token1.save();

  // use derived amounts within pair
  pair.reserveETH = pair.reserve0
    .times(token0.derivedETH as BigDecimal)
    .plus(pair.reserve1.times(token1.derivedETH as BigDecimal));
  pair.reserveUSD = pair.reserveETH.times(bundle.ethPrice);
  pair.save();

  // update total supply
  pair.totalSupply = convertTokenToDecimal(totalSupply, BI_18);
  pair.save();

  // update LP price
  if (pair.totalSupply.notEqual(ZERO_BD)) {
    pair.derivedETH = pair.reserveETH.div(pair.totalSupply);
    pair.derivedUSD = pair.reserveUSD.div(pair.totalSupply)
  }
  else {
    pair.derivedETH = ZERO_BD;
    pair.derivedUSD = ZERO_BD
  }

  // for staked LP tokens, update exchange rate
  if (pair.isStakedLPToken) {
    let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));
    let exchangeRate = stakedLPTokenContract.try_exchangeRate();
    if (!exchangeRate.reverted) pair.exchangeRate = convertTokenToDecimal(exchangeRate.value, BI_18);
  }

  // save entities
  pair.save();
  token0.save();
  token1.save();
  
  // update lendingPool usd values
  //updateLendingPoolUSD(pair.id)

  // update staking rewards
  if (UPDATE_FARM_ON_SYNC) {
    updateStaking(pair);
  }
}