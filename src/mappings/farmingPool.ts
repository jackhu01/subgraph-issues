import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts"
import {
  Advance,
} from "../types/templates/FarmingPool/FarmingPool"
import { FarmingPool } from "../types/schema"
import {
  convertTokenToDecimal,
  BI_18,
  ZERO_BD,
  ZERO_BI,
  ADDRESS_ZERO,
  fetchDistributorSharePercentage, loadOrCreateDistributor,
} from './helpers'
import {FarmingPool as FarmingPoolContract} from "../types/ImpermaxFactory/FarmingPool";
import { FarmingPool as FarmingPoolTemplate } from '../types/templates'


export function handleAdvance(event: Advance): void {
  syncFarmingPool(event.address);
}

export function syncFarmingPool(farmingPoolAddress: Address): void {
  if (farmingPoolAddress.toHexString() === ADDRESS_ZERO) return;

  let farmingPool = FarmingPool.load(farmingPoolAddress.toHexString());
  let farmingPoolContract = FarmingPoolContract.bind(farmingPoolAddress);

  if (farmingPool === null) {
    farmingPool = new FarmingPool(farmingPoolAddress.toHexString());
    let borrowableAddressCall = farmingPoolContract.try_borrowable();
    let distributorAddressCall = farmingPoolContract.try_claimable();
    let segmentLengthCall = farmingPoolContract.try_segmentLength();
    let vestingBeginCall = farmingPoolContract.try_vestingBegin();
    if (borrowableAddressCall.reverted) return;
    if (distributorAddressCall.reverted) return;
    if (segmentLengthCall.reverted) return;
    if (vestingBeginCall.reverted) return;
    farmingPool.borrowable = borrowableAddressCall.value.toHexString();
    farmingPool.distributor = distributorAddressCall.value.toHexString();
    farmingPool.segmentLength = segmentLengthCall.value;
    farmingPool.vestingBegin = vestingBeginCall.value;
    FarmingPoolTemplate.create(farmingPoolAddress);
    loadOrCreateDistributor(distributorAddressCall.value);
  }

  let epochAmountCall = farmingPoolContract.try_epochAmount();
  let epochBeginCall = farmingPoolContract.try_epochBegin();
  if (epochAmountCall.reverted) return;
  if (epochBeginCall.reverted) return;
  farmingPool.epochAmount = convertTokenToDecimal(epochAmountCall.value, BI_18);
  farmingPool.epochBegin = epochBeginCall.value;

  let distributorAddress = Address.fromString(farmingPool.distributor);
  farmingPool.sharePercentage = fetchDistributorSharePercentage(distributorAddress, farmingPoolAddress);

  farmingPool.save();
}