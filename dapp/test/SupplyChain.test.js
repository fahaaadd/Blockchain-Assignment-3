// test/SupplyChain.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FahadSaleem_SupplyChain", function () {
  let supplyChain;
  let owner, distributor, retailer, customer, stranger;

  // Role enum values
  const Role = { None: 0, Manufacturer: 1, Distributor: 2, Retailer: 3, Customer: 4 };
  const Status = {
    Manufactured: 0,
    SentToDistributor: 1,
    ReceivedByDistributor: 2,
    SentToRetailer: 3,
    ReceivedByRetailer: 4,
    SoldToCustomer: 5,
    Delivered: 6,
  };

  beforeEach(async () => {
    [owner, distributor, retailer, customer, stranger] = await ethers.getSigners();

    const SC = await ethers.getContractFactory("FahadSaleem_SupplyChain");
    supplyChain = await SC.deploy();
    await supplyChain.waitForDeployment();

    // Register participants
    await supplyChain.registerParticipant(distributor.address, Role.Distributor, "Test Distributor");
    await supplyChain.registerParticipant(retailer.address, Role.Retailer, "Test Retailer");
    await supplyChain.registerParticipant(customer.address, Role.Customer, "Test Customer");
  });

  // ── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", () => {
    it("Should set deployer as owner and Manufacturer", async () => {
      expect(await supplyChain.owner()).to.equal(owner.address);
      const p = await supplyChain.getParticipant(owner.address);
      expect(p.role).to.equal(Role.Manufacturer);
    });
  });

  // ── Participant Registration ───────────────────────────────────────────────
  describe("Participant Registration", () => {
    it("Owner can register participants", async () => {
      const p = await supplyChain.getParticipant(distributor.address);
      expect(p.role).to.equal(Role.Distributor);
      expect(p.name).to.equal("Test Distributor");
    });

    it("Non-owner cannot register participants", async () => {
      await expect(
        supplyChain.connect(stranger).registerParticipant(stranger.address, Role.Customer, "Hacker")
      ).to.be.revertedWith("SC: Not contract owner");
    });

    it("Cannot register same address twice", async () => {
      await expect(
        supplyChain.registerParticipant(distributor.address, Role.Retailer, "Dup")
      ).to.be.revertedWith("SC: Already registered");
    });
  });

  // ── Product Registration ───────────────────────────────────────────────────
  describe("Product Registration", () => {
    it("Manufacturer can register a product", async () => {
      await supplyChain.connect(owner).registerProduct("Laptop", "High-end laptop");
      const product = await supplyChain.getProduct(1);
      expect(product.name).to.equal("Laptop");
      expect(product.status).to.equal(Status.Manufactured);
      expect(product.currentOwner).to.equal(owner.address);
    });

    it("Non-manufacturer cannot register products", async () => {
      await expect(
        supplyChain.connect(distributor).registerProduct("Laptop", "Test")
      ).to.be.revertedWith("SC: Unauthorized role");
    });

    it("Should increment product counter", async () => {
      await supplyChain.registerProduct("P1", "D1");
      await supplyChain.registerProduct("P2", "D2");
      expect(await supplyChain.totalProducts()).to.equal(2);
    });
  });

  // ── Full Supply Chain Flow ─────────────────────────────────────────────────
  describe("Full Supply Chain Flow", () => {
    let productId;

    beforeEach(async () => {
      await supplyChain.connect(owner).registerProduct("Test Product", "A test product");
      productId = 1;
    });

    it("Should complete full lifecycle", async () => {
      // 1. Manufacturer → Distributor
      await supplyChain.connect(owner).shipToDistributor(productId, distributor.address);
      let p = await supplyChain.getProduct(productId);
      expect(p.status).to.equal(Status.SentToDistributor);
      expect(p.currentOwner).to.equal(distributor.address);

      // 2. Distributor confirms receipt
      await supplyChain.connect(distributor).receiveFromManufacturer(productId);
      p = await supplyChain.getProduct(productId);
      expect(p.status).to.equal(Status.ReceivedByDistributor);

      // 3. Distributor → Retailer
      await supplyChain.connect(distributor).shipToRetailer(productId, retailer.address);
      p = await supplyChain.getProduct(productId);
      expect(p.status).to.equal(Status.SentToRetailer);
      expect(p.currentOwner).to.equal(retailer.address);

      // 4. Retailer confirms receipt
      await supplyChain.connect(retailer).receiveFromDistributor(productId);
      p = await supplyChain.getProduct(productId);
      expect(p.status).to.equal(Status.ReceivedByRetailer);

      // 5. Retailer → Customer
      await supplyChain.connect(retailer).sellToCustomer(productId, customer.address);
      p = await supplyChain.getProduct(productId);
      expect(p.status).to.equal(Status.SoldToCustomer);
      expect(p.currentOwner).to.equal(customer.address);

      // 6. Customer confirms delivery
      await supplyChain.connect(customer).confirmDelivery(productId);
      p = await supplyChain.getProduct(productId);
      expect(p.status).to.equal(Status.Delivered);
    });

    it("Should record full audit trail", async () => {
      await supplyChain.connect(owner).shipToDistributor(productId, distributor.address);
      await supplyChain.connect(distributor).receiveFromManufacturer(productId);

      const history = await supplyChain.getProductHistory(productId);
      expect(history.length).to.equal(3); // Created + Shipped + Received
    });

    it("Should prevent skipping steps", async () => {
      // Can't ship to retailer before receiving from manufacturer
      await supplyChain.connect(owner).shipToDistributor(productId, distributor.address);
      await expect(
        supplyChain.connect(distributor).shipToRetailer(productId, retailer.address)
      ).to.be.revertedWith("SC: Product not received by distributor yet");
    });
  });
});
