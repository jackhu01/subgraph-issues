import {Pair, Reward, Token} from "../types/schema";
import {StakingRewards as StakingRewardsContract} from "../types/ImpermaxFactory/StakingRewards";
import {StakingRewards03 as StakingRewardsContract03} from "../types/ImpermaxFactory/StakingRewards03";
import {StakingDualRewards as StakingDualRewardsContract} from "../types/ImpermaxFactory/StakingDualRewards";
import { StakedLPToken as StakedLPTokenContract } from '../types/ImpermaxFactory/StakedLPToken'
import { Pair as PairContract } from '../types/ImpermaxFactory/Pair'
import { IMasterChef0212 } from '../types/ImpermaxFactory/IMasterChef0212'
import { IMasterChef0222 } from '../types/ImpermaxFactory/IMasterChef0222'
import { IMasterChef0223 } from '../types/ImpermaxFactory/IMasterChef0223'
import { IMasterChef023 } from '../types/ImpermaxFactory/IMasterChef023'
import { IMasterChef024 } from '../types/ImpermaxFactory/IMasterChef024'
import { IMasterChef025 } from '../types/ImpermaxFactory/IMasterChef025'
import { ILpDepositor as LpDepositorContract } from '../types/ImpermaxFactory/ILpDepositor'
import { IGauge as GaugeContract } from '../types/ImpermaxFactory/IGauge'
import { ISolidlyMAGauge as MaGaugeContract } from '../types/ImpermaxFactory/ISolidlyMAGauge'
import { IMasterChefRewardRate } from '../types/ImpermaxFactory/IMasterChefRewardRate'
import { IRewarder } from '../types/ImpermaxFactory/IRewarder'
import { ISimpleRewarder } from '../types/ImpermaxFactory/ISimpleRewarder'
import {Address, BigDecimal, BigInt} from "@graphprotocol/graph-ts/index";
import {
  ADDRESS_ZERO,
  BI_18, bigIntExp18, bigIntExp27,
  convertTokenToDecimal,
  equalToZero,
  exponentToBigDecimal,
  loadOrCreateToken, ONE_BD,
  ZERO_BD,
  ZERO_BI
} from "./helpers";
import {BLOCKS_PER_SECOND} from "./constants";

interface RewardI {
  rewardsTokenAddress: Address,
  rewardRate: BigDecimal
}

function createOrUpdateReward(
  pair: Pair,
  rewardsToken: Address,
  rewardRate: BigDecimal,
  periodFinish: BigInt,
): void {
  let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));
  let bountyCall = stakedLPTokenContract.try_REINVEST_BOUNTY();
  if (bountyCall.reverted) return;
  let bountyMultiplier = ONE_BD.minus(convertTokenToDecimal(bountyCall.value, BI_18));

  let id = pair.id.concat('-').concat(rewardsToken.toHexString());
  let reward = Reward.load(id);
  if (reward === null) {
    reward = new Reward(id);
    reward.pair = pair.id;
    reward.rewardsToken = rewardsToken.toHexString();
    loadOrCreateToken(rewardsToken);
  }
  reward.rewardRate = rewardRate.times(bountyMultiplier);
  reward.periodFinish = periodFinish;

  reward.save();
}

/*
 * STAKING REWARDS
 */

function getStakingRewardsRewardsToken(stakedLPToken: Address): Array<Token> | null {
  let stakedLPTokenContract = StakedLPTokenContract.bind(stakedLPToken);

  let rewardsTokenCall = stakedLPTokenContract.try_rewardsToken();
  if (rewardsTokenCall.reverted) return null;
  let rewardsTokenAddress = rewardsTokenCall.value;
  let rewardsToken = loadOrCreateToken(rewardsTokenAddress);

  return [rewardsToken];
}

function getStakingRewardsRewardsToken07(stakingRewards: Address): Array<Token> | null {
  let stakingDualRewardsContract = StakingDualRewardsContract.bind(stakingRewards);

  let rewardsTokenACall = stakingDualRewardsContract.try_rewardsTokenA();
  if (rewardsTokenACall.reverted) return null;
  let rewardsTokenA = loadOrCreateToken(rewardsTokenACall.value);

  let rewardsTokenBCall = stakingDualRewardsContract.try_rewardsTokenB();
  if (rewardsTokenBCall.reverted) return null;
  let rewardsTokenB = loadOrCreateToken(rewardsTokenBCall.value);

  return [rewardsTokenA, rewardsTokenB];
}

function getStakingRewardsRewardsRateRaw(stakingRewards: Address): Array<BigInt> | null {
  let stakingRewardsContract01 = StakingRewardsContract.bind(stakingRewards);
  let stakingRewardsContract03 = StakingRewardsContract03.bind(stakingRewards);

  let rewardRateRaw = ZERO_BI;
  let rewardRateCall = stakingRewardsContract01.try_rewardRate();
  if (rewardRateCall.reverted) {
    let rewardsCall = stakingRewardsContract03.try_rewards(ZERO_BI);
    if (rewardsCall.reverted) return null;
    let rewardAmount = rewardsCall.value.value1;
    let startingTimestampCall = stakingRewardsContract03.try_startingTimestamp();
    if (startingTimestampCall.reverted) return null;
    let endingTimestampCall = stakingRewardsContract03.try_endingTimestamp();
    if (endingTimestampCall.reverted) return null;
    let periodLength = endingTimestampCall.value.minus(startingTimestampCall.value);
    rewardRateRaw = rewardAmount.div(periodLength);
  } else {
    rewardRateRaw = rewardRateCall.value;
  }

  return [rewardRateRaw];
}

function getStakingRewardsRewardsRateRaw07(stakingRewards: Address): Array<BigInt> | null {
  let stakingDualRewardsContract = StakingDualRewardsContract.bind(stakingRewards);

  let rewardRateACall = stakingDualRewardsContract.try_rewardRateA();
  if (rewardRateACall.reverted) return null;

  let rewardRateBCall = stakingDualRewardsContract.try_rewardRateB();
  if (rewardRateBCall.reverted) return null;

  return [rewardRateACall.value, rewardRateBCall.value];
}

function updateStakingRewards(pair: Pair): void {
  let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));

  let stakingRewards = stakedLPTokenContract.try_stakingRewards();
  if (stakingRewards.reverted) return;

  let stakingRewardsContract01 = StakingRewardsContract.bind(stakingRewards.value);
  let stakingRewardsContract03 = StakingRewardsContract03.bind(stakingRewards.value);

  let rewardsToken: Array<Token> | null;
  let rewardsRateRaw: Array<BigInt> | null;
  if (pair.stakedLPTokenType == '07') {
    rewardsToken = getStakingRewardsRewardsToken07(stakingRewards.value);
    rewardsRateRaw = getStakingRewardsRewardsRateRaw07(stakingRewards.value);
  } else {
    rewardsToken = getStakingRewardsRewardsToken(Address.fromString(pair.id));
    rewardsRateRaw = getStakingRewardsRewardsRateRaw(stakingRewards.value);
  }
  if (!rewardsToken || !rewardsRateRaw) return;

  let totalSupplyCall = stakingRewardsContract01.try_totalSupply();
  if (totalSupplyCall.reverted) {
    totalSupplyCall = stakingRewardsContract03.try_totalStakedTokensAmount();
    if (totalSupplyCall.reverted) return;
  }

  let periodFinishCall = stakingRewardsContract01.try_periodFinish();
  if (periodFinishCall.reverted) {
    periodFinishCall = stakingRewardsContract03.try_endingTimestamp();
    if (periodFinishCall.reverted) return;
  }

  let totalSupply = convertTokenToDecimal(totalSupplyCall.value, BI_18);
  let periodFinish = periodFinishCall.value;

  pair.stakingRewards = stakingRewards.value.toHexString();
  pair.stakedTotalSupply = totalSupply;
  pair.save();

  for (let i = 0; i < rewardsToken.length; i++) {
    createOrUpdateReward(
      pair,
      Address.fromString(rewardsToken[i].id),
      convertTokenToDecimal(rewardsRateRaw[i], rewardsToken[i].decimals),
      periodFinish
    );
  }
}

/*
 * MASTER CHEF
 */

function getMasterChefTotalRewardRateRaw(masterChefAddress: Address): BigDecimal {
  let masterChef = IMasterChefRewardRate.bind(masterChefAddress);
  let blocksPerSecond = BigDecimal.fromString(BLOCKS_PER_SECOND);
  let rewardRate = masterChef.try_rewardPerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_rewardsPerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_rewardPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_rewardsPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_sushiPerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_cakePerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_zyberPerSec();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_cakePerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_dinoPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_tribalChiefTribePerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_snowballPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_bananaPerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_booPerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_joePerSec();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_plsPerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_thorusPerSecond();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  rewardRate = masterChef.try_spiritPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_crystalPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_cntPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_hairPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_solarPerBlock();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal().times(blocksPerSecond);
  rewardRate = masterChef.try_solarPerSec();
  if (!rewardRate.reverted) return rewardRate.value.toBigDecimal();
  return ZERO_BD;
}

function getMasterChefPoolShare(masterChefAddress: Address, pid: BigInt): BigDecimal | null {
  let masterChefContract1 = IMasterChef0212.bind(masterChefAddress);
  let masterChefContract2 = IMasterChef0222.bind(masterChefAddress);

  let totalAllocPointCall = masterChefContract1.try_totalAllocPoint();
  if (totalAllocPointCall.reverted) return null;
  let totalAllocPoint = totalAllocPointCall.value.toBigDecimal();
  if (equalToZero(totalAllocPoint)) return null;

  // poolInfo() on masterChefContract2 has more return arguments than on
  // masterChefContract1, so it will revert if called on the wrong contract
  let poolInfoCall2 = masterChefContract2.try_poolInfo(pid);
  if (!poolInfoCall2.reverted) {
    return poolInfoCall2.value.value1.toBigDecimal().div(totalAllocPoint);
  } else {
    let poolInfoCall1 = masterChefContract1.try_poolInfo(pid);
    if (poolInfoCall1.reverted) return null;
    return poolInfoCall1.value.value2.toBigDecimal().div(totalAllocPoint);
  }
}

function updateMasterChefReward(
  pair: Pair,
  masterChefAddress: Address,
  rewardsTokenAddress: Address,
  poolShare: BigDecimal,
): void {
  let rewardsToken = loadOrCreateToken(rewardsTokenAddress);

  let totalRewardRateRaw = getMasterChefTotalRewardRateRaw(masterChefAddress);
  let totalRewardRate = totalRewardRateRaw.div(exponentToBigDecimal(rewardsToken.decimals));

  let rewardRate = totalRewardRate.times(poolShare as BigDecimal);

  createOrUpdateReward(pair, rewardsTokenAddress, rewardRate, ZERO_BI);
}

function updateMasterChef(pair: Pair): void {
  if (pair.pid === null) return;
  if (pair.masterChef === null) return;
  let pid = pair.pid as BigInt;
  let masterChef = pair.masterChef as string;

  let pairContract = PairContract.bind(Address.fromString(pair.uniswapV2PairAddress));
  let totalSupplyCall = pairContract.try_balanceOf(Address.fromString(masterChef));
  if (totalSupplyCall.reverted) return;
  pair.stakedTotalSupply = convertTokenToDecimal(totalSupplyCall.value, BI_18);
  pair.save();

  if (pair.stakedLPTokenType == '0223') {
    updateMasterChef0223(pair);
    return;
  }

  if (pair.stakedLPTokenType == '023') {
    updateMasterChef023(pair);
    return;
  }

  if (pair.stakedLPTokenType == '024') {
    updateMasterChef024(pair);
    return;
  }

  if (pair.stakedLPTokenType == '025') {
    updateMasterChef025(pair);
    return;
  }

  // TODO deposit fee

  // First reward

  let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));

  let rewardsTokenCall = stakedLPTokenContract.try_rewardsToken();
  if (rewardsTokenCall.reverted) return;

  let poolShare = getMasterChefPoolShare(Address.fromString(masterChef), pid);
  if (poolShare === null) return;

  updateMasterChefReward(
    pair,
    Address.fromString(masterChef),
    rewardsTokenCall.value,
    poolShare as BigDecimal
  );

  // Eventual second reward

  let masterChefContract1 = IMasterChef0212.bind(Address.fromString(masterChef));
  let rewarderCall = masterChefContract1.try_rewarder(pid);
  if (rewarderCall.reverted) return;
  let rewarderAddress = rewarderCall.value;

  let rewarderContract = IRewarder.bind(rewarderAddress);
  let pendingTokensCall = rewarderContract.try_pendingTokens(pid, Address.fromString(ADDRESS_ZERO), ZERO_BI);
  if (pendingTokensCall.reverted) return;
  let rewardsTokenAddress = pendingTokensCall.value.value0[0];

  let rewarderPoolShare = getMasterChefPoolShare(rewarderAddress, pid);
  // On SushiSwap assume same pool share as parent
  if (rewarderPoolShare === null) rewarderPoolShare = poolShare;

  updateMasterChefReward(
    pair,
    rewarderAddress,
    rewardsTokenAddress,
    rewarderPoolShare as BigDecimal
  );

  // TODO I should remove old reward if the rewarder doesn't exist anymore (or maybe follow rewarder events)
}

/*
 * MasterChef023
 */

function updateMasterChef0223(pair: Pair): void {
  let pid = pair.pid as BigInt;
  let masterChef = pair.masterChef as string;

  let masterChefAddress = Address.fromString(masterChef);
  let masterChefContract = IMasterChef0223.bind(masterChefAddress);
  let poolInfoCall = masterChefContract.try_poolInfo(pid);
  if (poolInfoCall.reverted) return;

  // ARX reward

  let arxCall = masterChefContract.try_arx();
  if (arxCall.reverted) return;

  let arxTotalAllocPointCall = masterChefContract.try_arxTotalAllocPoint();
  if (arxTotalAllocPointCall.reverted) return;
  let arxTotalAllocPoint = arxTotalAllocPointCall.value.toBigDecimal();
  if (equalToZero(arxTotalAllocPoint)) return;

  let arxPoolShare = poolInfoCall.value.value1.toBigDecimal().div(arxTotalAllocPoint);

  let arxToken = loadOrCreateToken(arxCall.value);

  let arxTotalRewardRateRawCall = masterChefContract.try_arxPerSec();
  if (arxTotalRewardRateRawCall.reverted) return;
  let arxTotalRewardRateRaw = arxTotalRewardRateRawCall.value.toBigDecimal();
  let arxTotalRewardRate = arxTotalRewardRateRaw.div(exponentToBigDecimal(arxToken.decimals));

  let arxRewardRate = arxTotalRewardRate.times(arxPoolShare as BigDecimal);

  createOrUpdateReward(pair, arxCall.value, arxRewardRate, ZERO_BI);

  // WETH reward

  let wethCall = masterChefContract.try_WETH();
  if (wethCall.reverted) return;

  let wethTotalAllocPointCall = masterChefContract.try_WETHTotalAllocPoint();
  if (wethTotalAllocPointCall.reverted) return;
  let wethTotalAllocPoint = wethTotalAllocPointCall.value.toBigDecimal();
  if (equalToZero(wethTotalAllocPoint)) return;

  let wethPoolShare = poolInfoCall.value.value1.toBigDecimal().div(wethTotalAllocPoint);

  let wethToken = loadOrCreateToken(wethCall.value);

  let wethTotalRewardRateRawCall = masterChefContract.try_WETHPerSec();
  if (wethTotalRewardRateRawCall.reverted) return;
  let wethTotalRewardRateRaw = wethTotalRewardRateRawCall.value.toBigDecimal();
  let wethTotalRewardRate = wethTotalRewardRateRaw.div(exponentToBigDecimal(wethToken.decimals));

  let wethRewardRate = wethTotalRewardRate.times(wethPoolShare as BigDecimal);

  createOrUpdateReward(pair, wethCall.value, wethRewardRate, ZERO_BI);
}

/*
 * MasterChef023
 */

function updateMasterChef023(pair: Pair): void {
  let pid = pair.pid as BigInt;
  let masterChef = pair.masterChef as string;

  // TODO deposit fee

  let masterChefContract = IMasterChef023.bind(Address.fromString(masterChef));
  let poolInfoCall = masterChefContract.try_poolInfo(pid);
  if (poolInfoCall.reverted) return;

  // First reward

  let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));

  let rewardsTokenCall = stakedLPTokenContract.try_rewardsToken();
  if (rewardsTokenCall.reverted) return;

  let totalAllocPointCall = masterChefContract.try_totalAllocPoint();
  if (totalAllocPointCall.reverted) return;
  let totalAllocPoint = totalAllocPointCall.value.toBigDecimal();
  if (equalToZero(totalAllocPoint)) return;

  let poolShare = poolInfoCall.value.value3.toBigDecimal().div(totalAllocPoint);

  updateMasterChefReward(
    pair,
    Address.fromString(masterChef),
    rewardsTokenCall.value,
    poolShare as BigDecimal
  );

  // Eventual second reward

  let rewarderAddress = poolInfoCall.value.value4;
  let rewarderContract = ISimpleRewarder.bind(rewarderAddress);

  let rewardsTokenCall2 = rewarderContract.try_rewardToken();
  if (rewardsTokenCall2.reverted) return;

  let rewardRateCall = rewarderContract.try_tokenPerSec();
  if (rewardRateCall.reverted) return;

  let rewardsToken2 = loadOrCreateToken(rewardsTokenCall2.value);
  let rewardRate = rewardRateCall.value.toBigDecimal().div(exponentToBigDecimal(rewardsToken2.decimals));

  createOrUpdateReward(
    pair,
    rewardsTokenCall2.value,
    rewardRate,
    ZERO_BI
  );
}

function updateMasterChef024(pair: Pair): void {
  let pid = pair.pid as BigInt;
  let masterChef = pair.masterChef as string;

  // TODO deposit fee

  let masterChefContract = IMasterChef024.bind(Address.fromString(masterChef));

  let poolRewardCall = masterChefContract.try_poolRewardsPerSec(pid);
  if (poolRewardCall.reverted) return;

  let addresses = poolRewardCall.value.value0;
  let rewardsPerSec = poolRewardCall.value.value3;

  rewardsPerSec[0] = rewardsPerSec[0].times(BigInt.fromI32(7)).div(BigInt.fromI32(10));

  for (let i = 0; i < addresses.length; i++) {
    let rewardsToken = loadOrCreateToken(addresses[i]);
    let rewardRate = rewardsPerSec[i].toBigDecimal().div(exponentToBigDecimal(rewardsToken.decimals));
    createOrUpdateReward(
      pair,
      addresses[i],
      rewardRate,
      ZERO_BI
    );
  }
}

function updateMasterChef025(pair: Pair): void {
  let pid = pair.pid as BigInt;
  let pairAddress = Address.fromString(pair.uniswapV2PairAddress);
  let masterChef = pair.masterChef as string;

  // TODO deposit fee

  let masterChefContract = IMasterChef025.bind(Address.fromString(masterChef));
  let poolInfoCall = masterChefContract.try_poolInfo(pairAddress);
  if (poolInfoCall.reverted) return;

  // First reward

  let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));

  let rewardsTokenCall = stakedLPTokenContract.try_rewardsToken();
  if (rewardsTokenCall.reverted) return;

  let totalAllocPointCall = masterChefContract.try_totalAllocPoint();
  if (totalAllocPointCall.reverted) return;
  let totalAllocPoint = totalAllocPointCall.value.toBigDecimal();
  if (equalToZero(totalAllocPoint)) return;

  let poolShare = poolInfoCall.value.value0.toBigDecimal().div(totalAllocPoint);

  updateMasterChefReward(
    pair,
    Address.fromString(masterChef),
    rewardsTokenCall.value,
    poolShare as BigDecimal
  );
}


/*
 * LP DEPOSITOR
 */

function updateLpDepositor(pair: Pair): void {
  if (pair.lpDepositor === null) return;
  if (pair.uniswapV2PairAddress === null) return;
  let lpDepositor = Address.fromString(pair.lpDepositor as string);
  let pool = Address.fromString(pair.uniswapV2PairAddress);

  let lpDepositorContract = LpDepositorContract.bind(lpDepositor);
  let gaugeCall = lpDepositorContract.try_gaugeForPool(pool);
  if (gaugeCall.reverted) return;
  let gaugeAddress = gaugeCall.value;

  let gauge = GaugeContract.bind(gaugeAddress);

  let totalSupplyCall = gauge.try_totalSupply();
  if (totalSupplyCall.reverted) return;
  pair.stakedTotalSupply = convertTokenToDecimal(totalSupplyCall.value, BI_18);
  pair.save();

  let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));

  // SOLID REWARD

  let rewardsTokensAddressCall = stakedLPTokenContract.try_rewardsToken();
  if (rewardsTokensAddressCall.reverted) return;
  let rewardsTokensAddress = rewardsTokensAddressCall.value;
  let rewardsToken = loadOrCreateToken(rewardsTokensAddressCall.value);

  let rewardRateCall = gauge.try_rewardRate(rewardsTokensAddress);
  if (rewardRateCall.reverted) return;
  let rewardRate = rewardRateCall.value.times(BigInt.fromI32(85)).div(BigInt.fromI32(100));

  createOrUpdateReward(
    pair,
    rewardsTokensAddress,
    convertTokenToDecimal(rewardRate, rewardsToken.decimals),
    ZERO_BI
  );

  // SEX REWARD

  let rewardsTokensBAddressCall = stakedLPTokenContract.try_rewardsTokenB();
  if (rewardsTokensBAddressCall.reverted) return;
  let rewardsTokenB = loadOrCreateToken(rewardsTokensBAddressCall.value);

  let rewardRateB = rewardRateCall.value.times(BigInt.fromI32(10000)).div(BigInt.fromI32(42069));

  createOrUpdateReward(
    pair,
    Address.fromString(rewardsTokenB.id),
    convertTokenToDecimal(rewardRateB, rewardsTokenB.decimals),
    ZERO_BI
  );
}


/*
 * LP GAUGE
 */

function updateGauge(pair: Pair): void {
  if (pair.gauge === null) return;
  if (pair.uniswapV2PairAddress === null) return;
  let gaugeAddress = Address.fromString(pair.gauge as string);

  if (pair.stakedLPTokenType == 'SolidlyBase2') {
    let gaugeContract = MaGaugeContract.bind(gaugeAddress);

    let totalSupplyCall = gaugeContract.try_totalWeight();
    if (totalSupplyCall.reverted) return;
    pair.stakedTotalSupply = convertTokenToDecimal(totalSupplyCall.value, BI_18);
    pair.save();

    let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));

    let rewardsTokensAddressCall = stakedLPTokenContract.try_rewardsToken();
    if (rewardsTokensAddressCall.reverted) return;
    let rewardsTokensAddress = rewardsTokensAddressCall.value;
    let rewardsToken = loadOrCreateToken(rewardsTokensAddressCall.value);

    let rewardRateCall = gaugeContract.try_rewardRate();
    if (rewardRateCall.reverted) return;
    let rewardRate = rewardRateCall.value;

    createOrUpdateReward(
      pair,
      rewardsTokensAddress,
      convertTokenToDecimal(rewardRate, rewardsToken.decimals),
      ZERO_BI
    );
  }

  else {
    let gaugeContract = GaugeContract.bind(gaugeAddress);

    let totalSupplyCall = gaugeContract.try_totalSupply();
    if (totalSupplyCall.reverted) return;
    pair.stakedTotalSupply = convertTokenToDecimal(totalSupplyCall.value, BI_18);
    pair.save();

    let stakedLPTokenContract = StakedLPTokenContract.bind(Address.fromString(pair.id));

    let rewardsTokensAddressCall = stakedLPTokenContract.try_rewardsToken();
    if (rewardsTokensAddressCall.reverted) return;
    let rewardsTokensAddress = rewardsTokensAddressCall.value;
    let rewardsToken = loadOrCreateToken(rewardsTokensAddressCall.value);


    let rewardRateCall = gaugeContract.try_rewardRate(rewardsTokensAddress);
    if (rewardRateCall.reverted) {
      rewardRateCall = gaugeContract.try_rewardRate1();
    }
    if (rewardRateCall.reverted) return;
    let rewardRate = rewardRateCall.value;

    // NOTICE: SolidLizard rewards are multiplied by 1e18
    if (pair.uniswapV2Factory == "0x734d84631f00dc0d3fcd18b04b6cf42bfd407074") {
      rewardRate = rewardRate.div(bigIntExp18());
    }
    // NOTICE: Flair rewards are multiplied by 1e18
    if (pair.uniswapV2Factory == "0x634e02eb048eb1b5bddc0cfdc20d34503e9b362d") {
      rewardRate = rewardRate.div(bigIntExp18());
    }
    // NOTICE: Solunea rewards are multiplied by 1e18
    if (pair.uniswapV2Factory == "0x6ef065573cd3fff4c375d4d36e6ca93cd6e3d499") {
      rewardRate = rewardRate.div(bigIntExp18());
    }
    // NOTICE: Draculafi rewards are multiplied by 1e18
    if (pair.uniswapV2Factory == "0x68e03d7b8b3f9669750c1282ad6d36988f4fe18e") {
      rewardRate = rewardRate.div(bigIntExp18());
    }
    // NOTICE: Satin rewards are multiplied by 1e27
    if (pair.uniswapV2Factory == "0xcaf3fb1b03f1d71a110167327f5106be82bee209") {
      rewardRate = rewardRate.div(bigIntExp27());
    }

    createOrUpdateReward(
      pair,
      rewardsTokensAddress,
      convertTokenToDecimal(rewardRate, rewardsToken.decimals),
      ZERO_BI
    );
  }

}


export function updateStaking(pair: Pair): void {
  if (pair.stakingRewards !== null) updateStakingRewards(pair);
  if (pair.masterChef !== null) updateMasterChef(pair);
  if (pair.lpDepositor !== null) updateLpDepositor(pair);
  if (pair.gauge !== null) updateGauge(pair);
}