# Accountability Smart Contract

This project builds a smart contract that allows users to commit to a goal by locking funds into the contract.

The user can request to withdraw their funds after the lock period has passed.

Using a combination of the [Discord API](https://discord.com/developers/docs/intro) and [thirdweb](https://thirdweb.com)'s [signature based minting](https://portal.thirdweb.com/sdk/advanced-features/on-demand-minting), we check if the user has sent a message to a specific channel each day.

If they have, they are minted an NFT that allows them to withdraw their funds from the smart contract.

On the server-side, we combine [thirdweb Auth](https://portal.thirdweb.com/auth) and [Next Auth](https://next-auth.js.org/) to authenticate users and allow them to connect their Discord account and their web3 wallet.
