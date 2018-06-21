require('chai')
    .use(require('chai-bignumber')(web3.BigNumber))
    .use(require('chai-as-promised'))
    .should();

const { increaseTime } = require('sc-library/scripts/evmMethods');
const { web3async } = require('sc-library/scripts/web3Utils');
const getTime = () => web3async(web3.eth, web3.eth.getBlock, 'latest').then(block => block.timestamp);
const getBalance = (address) => web3async(web3.eth, web3.eth.getBalance, address);

const LastWillNotify = artifacts.require('./LastWillNotify.sol');

const MINUTE = 60;
const HOUR = 60 * MINUTE;

contract('LastWillNotify', async accounts => {
    const OWNER = accounts[0];
    const TARGET = accounts[1];
    const SOMEDUDE = accounts[2];
    let contract;

    it('test fallback', async () => {
        contract = await LastWillNotify.new(accounts[1], [accounts[3], accounts[4]], [25, 75], 120, false);
        let time = await contract.lastActiveTs();
        await increaseTime(HOUR);
        await contract.sendTransaction({ value: '50', from: OWNER });
        assert.equal((await contract.lastActiveTs()).toString(), time.toString());
        await increaseTime(HOUR);
        await contract.sendTransaction({ value: '50', from: TARGET });
        time = await getTime();
        assert.equal((await contract.lastActiveTs()).toString(), time.toString());
    });

    it('test check', async () => {
        let balances = [await getBalance(accounts[3]), await getBalance(accounts[4])];
        await increaseTime(MINUTE);
        await contract.check();
        assert.equal((await getBalance(accounts[3])).toString(), balances[0].toString());
        assert.equal((await getBalance(accounts[4])).toString(), balances[1].toString());
        await increaseTime(MINUTE);
        await contract.check();
        assert.equal((await getBalance(accounts[3])).toString(), balances[0].add(25).toString());
        assert.equal((await getBalance(accounts[4])).toString(), balances[1].add(75).toString());
    });

    it('test kill', async () => {
        let balance = await getBalance(TARGET);
        let gas = (await contract.kill.estimateGas({ from: TARGET })) * 10 ** 11;
        await contract.kill({ from: TARGET });
        assert.equal(balance.toString(), (await getBalance(TARGET)).add(gas).toString());
        let canSend = true;
        try {
            await contract.sendTransaction({ value: '50', from: OWNER });
        } catch (e) {
            canSend = false;
        }
        assert.equal(canSend, false);
    });

    it('test fallback with service', async () => {
        contract = await LastWillNotify.new(accounts[1], [accounts[3], accounts[4]], [25, 75], 120, true);
        let time = await contract.lastActiveTs();
        await increaseTime(HOUR);
        await contract.sendTransaction({ value: '20', from: SOMEDUDE });
        assert.equal((await contract.lastActiveTs()).toString(), time.toString());
        await increaseTime(HOUR);
        await contract.sendTransaction({ value: '40', from: OWNER });
        time = await getTime();
        assert.equal((await contract.lastActiveTs()).toString(), time.toString());
        await increaseTime(HOUR);
        await contract.sendTransaction({ value: '40', from: TARGET });
        time = await getTime();
        assert.equal((await contract.lastActiveTs()).toString(), time.toString());
    });

    it('test check with service', async () => {
        let balances = [await getBalance(accounts[3]), await getBalance(accounts[4])];
        await increaseTime(MINUTE);
        let checkFail = false;
        try {
            await contract.check({ from: SOMEDUDE });
        } catch (e) {
            checkFail = true;
        }
        assert.equal(checkFail, true);
        checkFail = false;
        try {
            await contract.check({ from: TARGET });
        } catch (e) {
            checkFail = true;
        }
        assert.equal(checkFail, true);
        await contract.check({ from: OWNER });
        assert.equal((await getBalance(accounts[3])).toString(), balances[0].toString());
        assert.equal((await getBalance(accounts[4])).toString(), balances[1].toString());
        await increaseTime(HOUR / 2);
        await contract.check({ from: OWNER });
        assert.equal((await getBalance(accounts[3])).toString(), balances[0].add(25).toString());
        assert.equal((await getBalance(accounts[4])).toString(), balances[1].add(75).toString());
    });
});
