export const IMPERMAX_FACTORY_ADDRESS = '0x3047523D5ed0df1545B1C440BdAaB095f1f3cf5C'.toLowerCase();
export const WETH_ADDRESS = '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8'.toLowerCase();
export const STABLE_WETH_PAIR = '0x4E7685Df06201521F35A182467FeEFe02C53d847'.toLowerCase();
export const UNISWAP_FACTORY_ADDRESS = '0x5bef015ca9424a7c07b68490616a4c1f094bedec'.toLowerCase();
export const BLOCKS_PER_SECOND = '0.5';
export const IS_STABLE = false;
export const CREATE_UNDERLYING_PAIR = false;
export const UPDATE_FARM_ON_SYNC = true;
export const FAST_SYNC = false;
export let COLLATERALS: Array<string> = [];
export let COLLATERAL_POSITIONS: Array<Array<string>> = [];
export let BORROWABLES_BORROW: Array<string> = [];
export let BORROWABLES_BORROW_POSITIONS: Array<Array<string>> = [];
export let BORROWABLES_SUPPLY: Array<string> = [];
export let BORROWABLES_SUPPLY_POSITIONS: Array<Array<string>> = [];

export const TVL_PAIRS_BLACK_LIST = [
  // Ethereum
  "0xa00d47b4b304792eb07b09233467b690db847c91".toLowerCase(), // IMX-WETH
  "0x46af8ac1b82f73db6aacc1645d40c56191ab787b".toLowerCase(), // NDX-ETH
  "0x8dcba0b75c1038c4babbdc0ff3bd9a8f6979dd13".toLowerCase(), // DEFI5-ETH
  "0x08650bb9dc722c9c8c62e79c2bafa2d3fc5b3293".toLowerCase(), // AMP-ETH
  // Polygon
  "0x76483d4ba1177f69fa1448db58d2f1dbe0fb65fa".toLowerCase(), // IMX-WETH
  "0x8ce3bf56767dd87e87487f3fae63e557b821ea32".toLowerCase(), // IMX-WETH
  "0xd4f5f9643a4368324ac920414781b1c5655baed1".toLowerCase(), // IMX-WETH
  "0x5f819f510ca9b1469e6a3ffe4ecd7f0c1126f8f5".toLowerCase(), // IMX-WETH
  "0x23312fceadb118381c33b34343a61c7812f7a6a3".toLowerCase(), // IMX-WETH
  "0x5ed3147f07708a269f744b43c489e6cf3b60aec4".toLowerCase(), // USDT-DAI
  "0xb957d5a232eebd7c4c4b0a1af9f2043430304e65".toLowerCase(), // USDC-rUSD
  "0x87B94444d0f2c1e4610A2De8504D5d7b81898221".toLowerCase(), // QUICK-POLYDOGE
  // Arbitrum
  "0xb7e5e74b52b9ada1042594cfd8abbdee506cc6c5".toLowerCase(), // IMX-WETH
  "0xcc5c1540683aff992201d8922df44898e1cc9806".toLowerCase(), // IMX-WETH
  "0x8884cc766b43ca10ea41b30192324c77efdd04cd".toLowerCase(), // NYAN-ETH
  "0x4062f4775bc001595838fbaae38908b250ee07cf".toLowerCase(), // SWPR-ETH
  // Moonriver
  "0x6ed3bc66dfcc5ac05daec840a75836da935fac97".toLowerCase(), // IMX-WETH
  // Avalanche
  "0xde0037afbe805c00d3cec67093a40882880779b7".toLowerCase(), // IMX-WETH
  "0xe9439f67201894c30f1c1c6b362f0e9195fb8e2c".toLowerCase(), // IMX-WETH
  "0xa34862a7de51a0e1aee6d3912c3767594390586d".toLowerCase(), // IMX-WETH
  "0x69c1c44e8742b66d892294a7eeb9aac51891b0eb".toLowerCase(), // USDC-UST
  // Fantom
  "0x877a330af63094d88792b9ca28ac36c71673eb1c".toLowerCase(), // IMX-FTM
  "0xb97b6ed451480fe6466a558e9c54eaac32e6c696".toLowerCase(), // OXD-FTM
];