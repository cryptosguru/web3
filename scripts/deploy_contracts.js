// These are required to enable ES6 on tets
// and it's dependencies.
require('babel-register')({
  ignore: /node_modules\/(?!zeppelin-solidity)/
});
require('babel-polyfill');

// const Ethernaut = artifacts.require("./Ethernaut.sol");
const prompt = require('prompt')
const Web3 = require("web3")
const colors = require('colors')
const fs = require('fs')
const gamedata = require(`../gamedata/gamedata.json`)
const ethutil = require(`../src/utils/ethutil`)
const constants = require(`../src/constants`)
const EthernautABI = require('../build/contracts/Ethernaut.json')

let web3;
let ethernaut;

const PROMPT_ON_DEVELOP = true

async function exec() {

  console.log(colors.cyan(`<< NETWORK: ${constants.ACTIVE_NETWORK.name} >>`).inverse)

  await initWeb3()

  // Determine which contracts need to be deployed.
  let count = 0;
  const deployedKey = `deployed_${constants.ACTIVE_NETWORK.name}`
  if(needsDeploy(gamedata.ethernaut[deployedKey])) {
    count++
    console.log(colors.red(`(${count}) Will deploy Ethernaut.sol!`))
  }
  gamedata.ethernaut.levels.map((level, key) => {
    if(needsDeploy(level[deployedKey])) {
      count++
      if(level[deployedKey].length === 1)
        console.log(colors.cyan(`(${count}) Will deploy ${level.levelContract} (${level.name})`))
      else
        console.log(colors.yellow(`(${count}) Will UPDATE ${level.levelContract} (${level.name})`))
    }
  })

  // Confirm actions with user
  if(PROMPT_ON_DEVELOP || constants.ACTIVE_NETWORK !== constants.NETWORKS.DEVELOPMENT) {
    prompt.start()
    prompt.get({properties: {
      confirmDeployment: {
        description: `Comfirm deployment? (y/n)`
      }}}, function(err, res) {
      if (err) return console.log(err);
      else if (res.confirmDeployment === 'y') {
        deployContracts()
      }
    })
  }
  else deployContracts()
}
exec()

async function deployContracts() {

  backupGameData()
  // console.log(gamedata);

  const props = {
    gasPrice: web3.eth.gasPrice * 10,
    gas: 4500000
  }
  console.log(`deploy params:`, props);
  const deployedKey = `deployed_${constants.ACTIVE_NETWORK.name}`

  // Deploy/retrieve ethernaut contract
  const Ethernaut = await ethutil.getTruffleContract(EthernautABI, {
    from: constants.ADDRESSES[constants.ACTIVE_NETWORK.name]
  })
  if(needsDeploy(gamedata.ethernaut[deployedKey])) {
    console.log(`Deploying Ethernaut.sol...`);
    ethernaut = await Ethernaut.new(props)
    console.log(colors.yellow(`  Ethernaut: ${ethernaut.address}`));
    storeDeployedAddress(gamedata.ethernaut, ethernaut.address)
  }
  else {
    console.log('Using deployed Ethernaut.sol:', getDeployedAddress(gamedata.ethernaut));
    ethernaut = await Ethernaut.at(getDeployedAddress(gamedata.ethernaut))
    // console.log('ethernaut: ', ethernaut);
  }

  // Sweep levels
  const promises = gamedata.ethernaut.levels.map(async level => {
    // console.log('level: ', level);
    return new Promise(async resolve => {
      if(needsDeploy(level[deployedKey])) {
        console.log(`Deploying ${level.levelContract}...`);

        // Deploy contract
        const LevelABI = require(`../build/contracts/${withoutExtension(level.levelContract)}.json`)
        const Contract = await ethutil.getTruffleContract(LevelABI, {
          from: constants.ADDRESSES[constants.ACTIVE_NETWORK.name]
        })
        const contract = await Contract.new(...level.deployParams, props)
        console.log(colors.yellow(`  ${level.name}: ${contract.address}`));
        storeDeployedAddress(level, contract.address)

        // Register level in Ethernaut contract
        console.log(`  Registering level in Ethernaut.sol...`)
        const tx = await ethernaut.registerLevel(contract.address, props);
        // console.log(tx)
      }
      else {
        console.log(`Using deployed ${level.levelContract}...`);
      }
      resolve(level)
    })
  })
  gamedata.ethernaut.levels = await Promise.all(promises)
  
  // Write new gamedata to disk
  // console.log(colors.gray('OUTPUT:', JSON.stringify(gamedata, null, 2)));
  console.log(colors.green('Writing updated game data: gamedata/gamedata.json'));
  fs.writeFileSync('./gamedata/gamedata.json', JSON.stringify(gamedata, null, 2), 'utf8')
}

// ----------------------------------
// Utils
// ----------------------------------

function withoutExtension(str) {
  return str.split('.')[0]
}

function getDeployedAddress(target) {
  const deployedKey = `deployed_${constants.ACTIVE_NETWORK.name}`
  return target[deployedKey][0]
}

function storeDeployedAddress(target, address) {
  const deployedKey = `deployed_${constants.ACTIVE_NETWORK.name}`
  let arr = target[deployedKey]
  if(constants.ACTIVE_NETWORK === constants.NETWORKS.DEVELOPMENT)
    arr = [address]
  else {
    arr.splice(target, 1)
    arr = [address, ...target[deployedKey]]
  }
  target[deployedKey] = arr
}

function needsDeploy(deployArray) {
  if(constants.ACTIVE_NETWORK === constants.NETWORKS.DEVELOPMENT) return true
  return deployArray.length === 0 || deployArray[0] === 'x'
}

function initWeb3() {
  return new Promise(async (resolve, reject) => {

    const providerUrl = `${constants.ACTIVE_NETWORK.url}:${constants.ACTIVE_NETWORK.port}`
    console.log(colors.gray(`conecting web3 to '${providerUrl}'...`));

    const provider = new Web3.providers.HttpProvider(providerUrl);
    web3 = new Web3(provider)

    web3.net.getListening((err, res) => {
      if(err) {
        console.log('error connecting web3:', err);
        reject()
        return
      }
      console.log(colors.gray(`web3 connected: ${res}\n`));
      ethutil.setWeb3(web3)
      resolve()
    })
  })
}

function backupGameData() {

  // Mkdir if not present (added in .gitignore)
  const dirPath = './gamedata/bkps'
  if(!fs.existsSync(dirPath)) fs.mkdirSync(dirPath)

  // Build new filename
  const bkpName = `gamedata-${new Date().getTime()}.json`
  fs.createReadStream(`./gamedata/gamedata.json`)
    .pipe(fs.createWriteStream(`./gamedata/bkps/${bkpName}`));
}