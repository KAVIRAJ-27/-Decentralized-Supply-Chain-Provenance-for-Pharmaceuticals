const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("==================================================");
  console.log("Deploying MediTraceProvenance contract with account:", deployer.address);
  console.log("==================================================");

  const MediTraceProvenance = await hre.ethers.getContractFactory("MediTraceProvenance");
  const contract = await MediTraceProvenance.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ MediTraceProvenance deployed at:", contractAddress);

  // Write deployment info to a JSON file for backend and frontend consumption
  const deploymentData = {
    contractAddress,
    network: hre.network.name,
    chainId: hre.network.config.chainId || 31337,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const outputPath = path.join(__dirname, "..", "deployedAddress.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log("📄 Saved deployment summary to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
