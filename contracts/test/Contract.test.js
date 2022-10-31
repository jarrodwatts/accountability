const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Contract.sol", function () {
  async function deployContractsFixture() {
    const AccountabilityFactory = await ethers.getContractFactory(
      "Accountability"
    );
    const AccountabilityNFTsFactory = await ethers.getContractFactory(
      "AccountabilityNFTs"
    );

    const [owner, addr1, addr2] = await ethers.getSigners();

    const accountabilityNfts = await AccountabilityNFTsFactory.deploy(
      "Accountability NFTs",
      "ACCT",
      owner.address,
      0,
      owner.address
    );
    await accountabilityNfts.deployed();

    console.log("AccountabilityNFTs deployed to:", accountabilityNfts.address);

    const accountability = await AccountabilityFactory.deploy(
      accountabilityNfts.address
    );
    await accountability.deployed();

    console.log("Accountability deployed to:", accountability.address);

    // Fixtures can return anything you consider useful for your tests
    return { accountability, accountabilityNfts, owner, addr1, addr2 };
  }

  // Should be able to deposit funds into the contract using the lockFunds function
  it("Should be able to deposit funds into the contract using the lockFunds function", async function () {
    const { accountability, owner, addr1 } = await loadFixture(
      deployContractsFixture
    );

    await accountability.connect(owner).lockFunds(time.duration.minutes(1), {
      value: ethers.BigNumber.from(1000),
    });

    // Now, let's check the mapping called "lockedFunds" to see if the funds were deposited
    const lockedFunds = await accountability.lockedFunds(owner.address);

    // The lockedFunds should be equal to the amount of funds deposited
    expect(lockedFunds.amount).to.equal(ethers.BigNumber.from(1000));
    expect(lockedFunds.time).to.equal(60); // 60 seconds because we set the time to 1 minute
    expect(lockedFunds.lockedAt).to.equal(await time.latest());
  });

  it("Should reject a withdrawal if the time hasn't passed yet", async function () {
    const { accountability, owner, addr1 } = await loadFixture(
      deployContractsFixture
    );

    await accountability.connect(owner).lockFunds(time.duration.minutes(1), {
      value: ethers.BigNumber.from(1000),
    });

    // Now, let's check the mapping called "lockedFunds" to see if the funds were deposited
    await accountability.lockedFunds(owner.address);

    // Try and withdraw funds
    await expect(accountability.connect(owner).withdraw()).to.be.revertedWith(
      "You cannot withdraw yet."
    );
  });

  // Should reject a withdrawal if the user doesn't have an NFT from the contract
  it("Should reject a withdrawal if the time hasn't passed yet", async function () {
    const { accountability, owner, addr1 } = await loadFixture(
      deployContractsFixture
    );

    await accountability.connect(owner).lockFunds(time.duration.minutes(1), {
      value: ethers.BigNumber.from(1000),
    });

    // Now, let's check the mapping called "lockedFunds" to see if the funds were deposited
    await accountability.lockedFunds(owner.address);

    // Wait 1 minute
    await time.increase(time.duration.minutes(1));

    // Fail because we don't have an NFT
    await expect(accountability.connect(owner).withdraw()).to.be.revertedWith(
      "You do not own an NFT from the other smart contract."
    );
  });

  // Should reject a withdrawal if the user has 0 funds
  it("Should reject a withdrawal if the time hasn't passed yet", async function () {
    const { accountability, owner, addr1 } = await loadFixture(
      deployContractsFixture
    );

    // Try and withdraw funds
    await expect(accountability.connect(owner).withdraw()).to.be.revertedWith(
      "You have no locked funds."
    );
  });

  // Successfully withdraw funds if the time has passed and the user has an NFT
  it("Should reject a withdrawal if the time hasn't passed yet", async function () {
    const { accountability, accountabilityNfts, owner, addr1 } =
      await loadFixture(deployContractsFixture);

    // Grab wallet balance
    const walletBalance = await ethers.provider.getBalance(owner.address);

    await accountability.connect(owner).lockFunds(time.duration.minutes(1), {
      value: ethers.BigNumber.from(1000),
    });

    // First we need to mint an NFT to the owner
    await accountabilityNfts.connect(owner).mintTo(owner.address, "URI");

    // Pass time
    await time.increase(time.duration.minutes(1));

    // Now, we should successfully withdraw funds
    await accountability.connect(owner).withdraw();

    // Expect the lockedFunds mapping to have 0 funds
    const lockedFunds = await accountability.lockedFunds(owner.address);
    expect(lockedFunds.amount).to.equal(ethers.BigNumber.from(0));
  });
});
