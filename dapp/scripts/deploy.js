// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   Supply Chain DApp — Deployment Script");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n📋 Deploying with account: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(balance)} MATIC\n`);

  // Deploy the contract
  console.log("⏳ FahadSaleem_SupplyChain...");
  const SupplyChain = await hre.ethers.getContractFactory("FahadSaleem_SupplyChain");
  const supplyChain = await SupplyChain.deploy();
  await supplyChain.waitForDeployment();

  const contractAddress = await supplyChain.getAddress();
  const deployTx = supplyChain.deploymentTransaction();

  console.log("\n✅ Contract deployed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Contract Address : ${contractAddress}`);
  console.log(`🔗 Transaction Hash : ${deployTx.hash}`);
  console.log(`🌐 Network          : ${hre.network.name}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Optional: Register some demo participants
  console.log("\n⏳ Registering demo participants...");

  // These are example addresses — replace with real test wallet addresses
  // The deployer is already registered as Manufacturer
  // If you have more test accounts, register them:
  // await supplyChain.registerParticipant("0xDistributorAddress", 2, "Demo Distributor");
  // await supplyChain.registerParticipant("0xRetailerAddress",    3, "Demo Retailer");
  // await supplyChain.registerParticipant("0xCustomerAddress",    4, "Demo Customer");

  console.log("ℹ️  Deployer registered as Manufacturer automatically.");
  console.log("ℹ️  Use registerParticipant() from the frontend to add more roles.\n");

  // Save deployment info to a file
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    transactionHash: deployTx.hash,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    "../frontend/src/deploymentInfo.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("📁 Deployment info saved to frontend/src/deploymentInfo.json");

  // Copy ABI to frontend
  const artifact = await hre.artifacts.readArtifact("FahadSaleem_SupplyChain");
  fs.writeFileSync(
    "../frontend/src/SupplyChainABI.json",
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log("📁 ABI saved to frontend/src/SupplyChainABI.json");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
