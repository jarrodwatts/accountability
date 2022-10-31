import {
  ConnectWallet,
  useAddress,
  useContract,
  useContractRead,
  useSDK,
  Web3Button,
} from "@thirdweb-dev/react";
import type { NextPage } from "next";
import styles from "../styles/Home.module.css";
import { useSession, signIn } from "next-auth/react";
import {
  ACCOUNTABILITY_CONTRACT_ADDRESS,
  NFT_CONTRACT_ADDRESS,
} from "../const/consts";
import { BigNumber, ethers } from "ethers";
import { useState } from "react";

const Home: NextPage = () => {
  const address = useAddress();
  const sdk = useSDK();
  const { data: discordAuthData, status: discordAuthStatus } = useSession();
  const { contract } = useContract(ACCOUNTABILITY_CONTRACT_ADDRESS);
  const { contract: nftCollection } = useContract(NFT_CONTRACT_ADDRESS);
  const {
    data: lockedFundsData,
    isLoading: loadingLockedFunds,
    error,
  } = useContractRead(contract, "lockedFunds", address);

  const [form, setForm] = useState({
    amount: "",
    days: 0,
  });

  async function attemptWithdraw() {
    // Sign in With Ethereum
    const domain = "example.com";
    const loginPayload = await sdk?.auth.login(domain);

    // Send an API request to the backend to check our eligibility to withdraw
    // Then make a request to our API endpoint.
    try {
      const response = await fetch("/api/withdraw", {
        method: "POST",
        body: JSON.stringify({
          loginPayload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error);
        return;
      }

      // If we're eligible, we can mint the NFT
      const tx = await nftCollection?.erc721.signature.mint(data.signature);

      console.log(tx);

      alert("Minted NFT succesfully!");

      // Now we can call the withdraw function.
      const withdrawTx = await contract?.call("withdraw");
      console.log(withdrawTx);

      alert("Withdrew succesfully!");
    } catch (e) {
      console.error(e);
    }

    // And IF we are, then we'll receieve a signature
    // we can use the signature to mint the NFT.
    // If we're not, we'll receive an error.
  }

  // 0: Hasn't connected wallet yet.
  if (!address) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Accountability Project</h1>
          <div className={styles.connect}>
            <ConnectWallet />
          </div>
        </main>
      </div>
    );
  }

  // 1: Error - something went wrong.
  if (error) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1>Something went wrong</h1>
          {/* @ts-ignore */}
          <p>{error.reason}</p>
          <ConnectWallet />
        </main>
      </div>
    );
  }

  // 2: Loading - waiting for data.
  if (loadingLockedFunds) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Accountability Project</h1>
          <p>Loading...</p>
        </main>
      </div>
    );
  }

  // 3: Data has loaded. There is no locked funds.
  // - Here we show the user the option to commit X funds for Y time.
  if (lockedFundsData.amount.eq(0)) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Accountability Project</h1>

          {/* Form that allows users to lock funds for X amount of time */}

          <div className={styles.form}>
            <input
              type="text"
              placeholder="Amount to commit"
              onChange={(e) =>
                setForm({
                  ...form,
                  amount: e.target.value,
                })
              }
              className={styles.input}
            />

            <input
              type="number"
              placeholder="Days to commit"
              onChange={(e) =>
                setForm({
                  ...form,
                  days: Number(e.target.value),
                })
              }
              className={styles.input}
            />

            <Web3Button
              contractAddress={ACCOUNTABILITY_CONTRACT_ADDRESS}
              action={(contract) =>
                contract.call("lockFunds", form.days * 86400, {
                  value: ethers.utils.parseEther(form.amount),
                })
              }
              onSuccess={() => alert("Success")}
              onError={() => alert("Error")}
            >
              Lock Funds
            </Web3Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Accountability Project</h1>

        <p className={styles.description}>
          Commit to a goal and lock up your funds to ensure you follow through.
        </p>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h2>Amount Locked</h2>
            <p>
              {ethers.utils.formatEther(lockedFundsData.amount.toNumber())} ETH
            </p>
          </div>

          <div className={styles.card}>
            <h2>You Locked At</h2>
            <p>
              {BigNumber.from(lockedFundsData.lockedAt).eq(0)
                ? "N/A"
                : new Date(
                    BigNumber.from(lockedFundsData.lockedAt).toNumber() * 1000
                  ).toLocaleString()}
            </p>
          </div>

          <div className={styles.card}>
            <h2>Time You Can Unlock</h2>
            <p>
              {BigNumber.from(lockedFundsData.lockedAt).eq(0)
                ? "N/A"
                : new Date(
                    BigNumber.from(lockedFundsData.lockedAt)
                      .add(lockedFundsData.time)
                      .toNumber() * 1000
                  ).toLocaleString()}
            </p>
          </div>

          {
            // The user needs to sign in with Discord, before this button appears.
            discordAuthStatus !== "authenticated" ? (
              <button
                className={styles.mainButton}
                onClick={() => signIn("discord")}
              >
                Sign in with Discord
              </button>
            ) : // If the time is available, show the withdraw button.
            BigNumber.from(lockedFundsData.lockedAt)
                .add(lockedFundsData.time)
                .mul(1000)
                .lt(BigNumber.from(Date.now())) ? (
              <Web3Button
                contractAddress={ACCOUNTABILITY_CONTRACT_ADDRESS}
                action={() => attemptWithdraw()}
              >
                Mint NFT & Withdraw Funds
              </Web3Button>
            ) : (
              <p>You&apos;re not ready to withdraw yet.</p>
            )
          }
        </div>
      </main>
    </div>
  );
};

export default Home;
