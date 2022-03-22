import { BigNumber, ethers } from "ethers";
import axios from "axios";

const OWNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const LIBRARY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ORACLE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

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

async function main() {
  const provider = ethers.getDefaultProvider("http://localhost:8545");
  const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, provider);
  const library = new ethers.Contract(LIBRARY_ADDRESS, libraryAbi, provider);
  const decimals: number = await library.decimals();
  const unit: BigNumber = await library.UNIT();
  const signer = new ethers.Wallet(OWNER_PRIVATE_KEY).connect(provider);

  const slugs: Array<string> = Array.from(SlugNameMap.keys());

  while (true) {
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
      continue;
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
    await oracle
      .connect(signer)
      .updatePrices(
        assets,
        prices,
        BigNumber.from(Math.round(Date.now() / 1000))
      );
    console.log(SlugNameMap.values());
    for (const asset of SlugNameMap.values()) {
      console.log(
        asset,
        ethers.utils.formatUnits(
          (await oracle.getAssetPrice(asset)) as BigNumber,
          decimals
        )
      );
    }

    await sleep(60 * 60);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
