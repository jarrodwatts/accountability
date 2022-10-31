import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { BigNumber } from "ethers";
import { NextApiRequest, NextApiResponse } from "next";
import { unstable_getServerSession } from "next-auth/next";
import {
  ACCOUNTABILITY_CONTRACT_ADDRESS,
  DISCORD_CHANNEL_ID,
  DISCORD_SERVER_ID,
  DOMAIN_NAME,
  NFT_CONTRACT_ADDRESS,
} from "../../const/consts";
import { authOptions } from "./auth/[...nextauth]";

export default async function withdraw(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { loginPayload } = JSON.parse(req.body);

  // Get the Next Auth session so we can use the user ID as part of the discord API request
  const session = await unstable_getServerSession(req, res, authOptions);

  // @ts-ignore
  const { userId } = session;

  if (!session) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  // Authenticate login payload
  const sdk = ThirdwebSDK.fromPrivateKey(
    // Learn more about securely accessing your private key:
    // https://portal.thirdweb.com/sdk/set-up-the-sdk/securing-your-private-key
    process.env.PRIVATE_KEY as string,
    "goerli" // configure this to your network
  );

  let verifiedWalletAddress: string | undefined;
  try {
    verifiedWalletAddress = sdk.auth.verify(DOMAIN_NAME, loginPayload);
  } catch (e) {
    return res.status(401).json({ error: "Invalid login payload" });
  }

  if (!verifiedWalletAddress) {
    return res.status(401).json({ error: "Invalid login payload" });
  }

  // Find out how many days the user committed for.
  const accountabilityContract = await sdk.getContract(
    ACCOUNTABILITY_CONTRACT_ADDRESS
  );

  const lockedFundsValueForUser = await accountabilityContract.call(
    "lockedFunds",
    verifiedWalletAddress
  );

  console.log("lockedFundsValueForUser", lockedFundsValueForUser);

  // The amount of days they've committed is the lockedFunds.time / 86400 (seconds in a day)
  const daysCommitted = BigNumber.from(lockedFundsValueForUser.time).div(
    BigNumber.from(86400)
  );

  // Ask the question to the Discord API -
  // Did the user send a message to the server every 24 hours for the amount of days they committed for?

  // 1. Grab the messages the user has sent to the server
  const channels = await fetch(
    // @ts-ignore
    `https://discord.com/api/v9/guilds/${DISCORD_SERVER_ID}/channels`,
    {
      headers: {
        authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    }
  ).then((res) => res.json());

  const correctChannel = channels.find(
    (channel: any) => channel.id === DISCORD_CHANNEL_ID
  );

  const messages = await fetch(
    // @ts-ignore
    `https://discord.com/api/v9/channels/${correctChannel.id}/messages`,
    {
      headers: {
        authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    }
  ).then((res) => res.json());

  const filteredMessages = messages.filter(
    (message: any) => message.author.id === userId
  );

  // Check if the user sent a message every 24 hours for the amount of days they committed for
  // The message.timestmap is in the format: 2022-10-31T06:34:14.130000+00:00
  // We need to convert this to a unix timestamp so we can compare it to the previous message
  const didSendMessageDaily = filteredMessages.every(
    (message: any, index: number) => {
      if (index === 0) {
        return true;
      }

      const previousMessageTimestamp =
        new Date(filteredMessages[index - 1].timestamp).getTime() / 1000;
      const currentMessageTimestamp =
        new Date(message.timestamp).getTime() / 1000;

      return currentMessageTimestamp - previousMessageTimestamp > 86400 / 3;
    }
  );

  // If they did... Then generate a mint signature for them and return it.
  if (didSendMessageDaily && filteredMessages.length >= daysCommitted) {
    // Generate a signature
    const nftCollection = await sdk.getContract(NFT_CONTRACT_ADDRESS);

    const signature = await nftCollection.erc721.signature.generate({
      metadata: {
        name: ` ${session.user?.name}'s NFT`,
        description: `For committing to ${daysCommitted} days of accountability`,
        image: "ipfs://QmYcmckp7GGXN1A2iTc32VPsT1WdFQ4m7tYzKghBAomE81",
      },
      to: verifiedWalletAddress,
    });

    return res.status(200).json({ signature });
  }
  // If they did not... Then return an error, saying you failed
  else {
    return res.status(401).json({ error: "Failed to commit, sorry." });
  }
}
