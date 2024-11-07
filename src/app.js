const express = require('express');
const ethers = require('ethers');
const alchemy = require('alchemy-sdk');
const analyzor = require('./analyzor');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = 3000;

let analyzedWallets = [];

async function checkFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(filePath, '');
  }
}

async function getAnalyzedWallets() {
  await checkFileExists('./analyzed-wallets.csv');

  const data = await fs.promises.readFile('./analyzed-wallets.csv');
  analyzedWallets = new Set(data.toString().split('\n'));
  console.log('analyzedWallets', analyzedWallets)
}

async function appendToAnalyzedWallets(wallet) {
  await checkFileExists('./analyzed-wallets.csv');

  const data = `${wallet}\n`
  await fs.promises.appendFile('./analyzed-wallets.csv', data);
}

function createAnalysisResultFile() {
  const headers = [
    'WALLET',
    'LAST TRANSACTION',
    'TRANSACTION COUNT (pairs of buy&sell)',
    'WIN RATE',
    'UNREALIZED WIN RATE',
    'PL',
    'UNREALIZED PL',
    'AVG % GAIN OR LOSS',
    'LARGEST GAIN in $',
    'LARGEST LOSS in $',
    'LOSS STREAK',
    'AVG BUY VOLUME',
    'LIQUIDITY MATCH',
    'AVG LIQUIDITY ON BUY',
    'AVG LIQUIDITY CURRENT',
    'AVG DAILY VOLUME ON BUY',
    'AVG DAILY VOLUME CURRENT',
    'AVG TIME PASSED FROM CREATION TO FIRST BUY',
    '% OF DESCRIPTION',
    'AMOUNT OF TOKENS',
    '% OF SCAM',
  ];

  const headerString = `${headers.join(',')}\n`;

  fs.appendFile('analysis.csv', headerString, {flag: 'a'}, err => {
    if (err) {
      console.error(`Error appending to analysis.csv:`, err);
    }
  })
}

async function listenToWalletEvents() {
  await getAnalyzedWallets();

  const alchemyProvider = new alchemy.Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: 'eth-mainnet',
  })

  alchemyProvider.ws.on(
    {
      method: alchemy.AlchemySubscription.MINED_TRANSACTIONS,
      addresses: [
        {
          to: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
        },
      ],
    },
    async (event) => {
      const wallet = event.transaction.from

      if (!analyzedWallets.has(wallet)) {
        analyzedWallets.add(wallet);
        await analyzor.handleWalletAnalysis(wallet);
        await appendToAnalyzedWallets(wallet);
      } else {
        console.log(`Wallet ${wallet} has been already analyzed`);
      }
    }
  )
}

async function listenToSwapEvents() {
  await getAnalyzedWallets();
  createAnalysisResultFile();

  const provider = new ethers.providers.AlchemyProvider(
    'mainnet', 
    process.env.ALCHEMY_API_KEY,
  )

  const swapFilterUniswapV3 = {
    topics: [
      ethers.utils.id('Swap(address,address,int256,int256,uint160,uint128,int24)')
    ]
  }

  const swapFilterUniswapV2 = {
    topics: [
      ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)'),
    ]
  }

  while (true) {
    const logs = await Promise.all([provider.getLogs(swapFilterUniswapV3), provider.getLogs(swapFilterUniswapV2)])
    const hashes = [...new Set(logs.flat(1).map(log => log.transactionHash))]

    for (const hash of hashes) {

      console.log(`Tx ${hash} in progress...`);

      try {
        const transaction = await provider.getTransaction(hash);
        const wallet = transaction.from;

        if (!analyzedWallets.has(wallet)) {
          analyzedWallets.add(wallet);
          await analyzor.handleWalletAnalysis(wallet);
          await appendToAnalyzedWallets(wallet);
        } else {
          console.log(`Wallet ${wallet} has been already analyzed`);
        }
      } catch (e) {
        console.error(`${hash} transaction failed`);
      }

    }
  }
}

listenToSwapEvents();
// listenToWalletEvents();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});




