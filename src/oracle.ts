import { BigNumber, ethers } from "ethers";

const OWNER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OWNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ORACLE_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const oracleAbi = require("./abi/Oracle.sol/Oracle.json");

async function main() {
  const provider = ethers.getDefaultProvider("http://localhost:8545");
  const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, provider);
  const signer = new ethers.Wallet(OWNER_PRIVATE_KEY);
  const oracleWithSinger = oracle
    .connect(signer)
    .updatePrices(["Token0", "Token1"], [BigNumber.from(1).mul()]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
