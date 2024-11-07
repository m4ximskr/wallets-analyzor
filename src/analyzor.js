const fs = require('fs');
const axios = require('axios');

async function getWalletAnalysis(wallet) {
  try {
    const response = await axios.get(`${process.env.WALLET_TRACKING_URL}/analyze-wallet`, {
      params: {
        wallet: wallet
      }
    })
    
    if (!response.data) {
      return {}
    }

    return response.data.result;
  } catch (e) {
    return {}
  }
}

function appendToAnalysis(wallet, analysis) {
  delete analysis.tokenStats;
  const csvData = `${wallet},${Object.values(analysis).toString()}\n`
  // const csvData = `Wallet,${Object.keys(analysis).toString()}\n`

  fs.appendFile('analysis.csv', csvData, {flag: 'a'}, err => {
    if (err) {
      console.error(`Error appending to analysis.csv:`, err);
    } else {
      console.log(`Wallet ${wallet} analysis added to analysis.csv`);
    }
  })
}

async function handleWalletAnalysis(wallet) {
  console.log(`Analyzing ${wallet} wallet...`)

  try {
    const analysis = await getWalletAnalysis(wallet);

    if (Object.keys(analysis).length > 0) {
      const {avgLiquidityCurrent: avgLiquidity, winRate, unrealizedWinRate} = analysis

      if (isNaN(winRate)) {
        if (unrealizedWinRate > 80) {
          appendToAnalysis(wallet, analysis)
          return;
        }
      } else if (avgLiquidity > 50000 && winRate > 70) {
        appendToAnalysis(wallet, analysis)
        return;
      } else if (avgLiquidity < 50000 && winRate > 85) {
        appendToAnalysis(wallet, analysis)
        return;
      }
    }

    console.log(`Skip wallet ${wallet}`)
  } catch (e) {
    console.log(e)
    console.error(`Failed to handle ${wallet}`)
  }
}

module.exports = {
  handleWalletAnalysis
}