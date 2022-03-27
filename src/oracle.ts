import { BigNumber, ethers } from "ethers";
import axios from "axios";
import StatsD from "hot-shots";

const OWNER_PRIVATE_KEY =
  "0xe06640cb1cf178c39e4d8d9edf8e3f966eba2118d0c3815ed95c40925183ac0e";
const LIBRARY_ADDRESS = "0x721899fcd67F9cCF6764b9CeF41fD39764c76C00";
const ORACLE_ADDRESS = "0xBC44Ad3A66ed13c5fA2357f0Dc976c1BB99EDe65";

const libraryAbi = require("./abi/libraries/SafeDecimalMath.sol/SafeDecimalMath.json");
const oracleAbi = require("./abi/Oracle.sol/Oracle.json");

const SlugNameMap = new Map<string, string>([
  ["boredapeyachtclub", "BoredApeYachtClub"],
  ["cryptopunks", "CryptoPunks"],
]);

const sleep = (s: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, s * 1000);
  });
};

const processing = async (
  oracle: ethers.Contract,
  library: ethers.Contract,
  decimals: number,
  slugs: string[],
  signer: ethers.Wallet
) => {
  let responses: Array<any> = [];
  try {
    responses = await axios.all(
      slugs.map((slug) => {
        return axios.get(
          `https://api.opensea.io/api/v1/collection/${slug}/stats`
        );
      })
    );
  } catch (error) {
    console.log(error);
    if (error instanceof Error) {
      console.log(error.message);
    }
    return;
  }

  const assets: Array<string> = [];
  const prices: Array<BigNumber> = [];
  for (let i = 0; i < slugs.length; i++) {
    // @ts-ignore
    assets.push(SlugNameMap.get(slugs[i]));
    prices.push(
      ethers.utils.parseUnits(
        String(responses[i].data.stats.one_day_average_price),
        decimals
      )
    );
  }
  const updateTx = await oracle
    .connect(signer)
    .updatePrices(
      assets,
      prices,
      BigNumber.from(Math.round(Date.now() / 1000))
    );
  await updateTx.wait();
  for (const asset of SlugNameMap.values()) {
    console.log(
      asset,
      ethers.utils.formatUnits(
        (await oracle.getAssetPrice(asset)) as BigNumber,
        decimals
      )
    );
  }
};

async function main() {
  const statsd = new StatsD({ port: 8125 });
  const provider = ethers.getDefaultProvider(
    "https://eth-rinkeby.alchemyapi.io/v2/8OdMrjYv_wSVs5OmWiH_CAACPHfJkz0B"
  );
  const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, provider);
  const library = new ethers.Contract(LIBRARY_ADDRESS, libraryAbi, provider);
  const decimals: number = await library.decimals();
  const unit: BigNumber = await library.UNIT();
  const signer = new ethers.Wallet(OWNER_PRIVATE_KEY).connect(provider);

  const setStaleTx = await oracle
    .connect(signer)
    .setPriceStalePeriod(BigNumber.from(60 * 60));
  await setStaleTx.wait();

  const slugs: Array<string> = Array.from(SlugNameMap.keys());
  const processing_timed = statsd.asyncTimer(
    () => processing(oracle, library, decimals, slugs, signer),
    "processing_exec_time"
  );

  while (true) {
    await processing_timed();
    await sleep(60 * 60);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
