const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-bignumber')(BigNumber))
    .use(require('chai-as-promised'))
    .should();

const { increaseTime, snapshot, revert } = require('sc-library/scripts/evmMethods');
const { web3async } = require('sc-library/scripts/web3Utils');
const getBalance = (address) => web3async(web3.eth, web3.eth.getBalance, address);

const Test = artifacts.require('./Test.sol');
const LastWill = artifacts.require('./LastWillNotify.sol');
const SimpleToken = artifacts.require('./SimpleToken.sol');

const SECOND = 1;
const MINUTE = 60 * SECOND;

contract('LastWill', function (accounts) {
    const SERVICE_ACCOUNT = accounts[0];
    const TARGET = accounts[1];
    const RECIPIENT_1 = accounts[2];
    const RECIPIENT_2 = accounts[3];
    const RECIPIENT_3 = accounts[4];

    let snapshotId;

    beforeEach(async () => {
        snapshotId = (await snapshot()).result;
    });

    afterEach(async () => {
        await revert(snapshotId);
    });

    it('#1 construct', async () => {
        const lastWill = await LastWill.new(TARGET, [TARGET], [100], 2 * MINUTE, true);
        lastWill.address.should.have.length(42);
    });

    it('#2 add contract addresses by one', async () => {
        const lastWill = await LastWill.new(TARGET, [TARGET], [100], 2 * MINUTE, true);
        const LIMIT = Number(await lastWill.TOKEN_ADDRESSES_LIMIT());

        for (let i = 0; i < LIMIT; i++) {
            await lastWill.addTokenAddress((await SimpleToken.new()).address);
        }
        await lastWill.addTokenAddress((await SimpleToken.new()).address).should.eventually.be.rejected;

        increaseTime(3 * MINUTE);
        await lastWill.check();
    });

    it('#3 add contract addresses batch', async () => {
        const lastWill = await LastWill.new(TARGET, [TARGET], [100], 2 * MINUTE, true);
        const LIMIT = Number(await lastWill.TOKEN_ADDRESSES_LIMIT());
        const tokenContracts = await Promise
            .all(Array(...Array(LIMIT)).map(_ => SimpleToken.new().then(t => t.address)));
        await lastWill.addTokenAddresses(tokenContracts);
        await lastWill.addTokenAddresses([(await SimpleToken.new()).address]).should.eventually.be.rejected;
        increaseTime(3 * MINUTE);
        await lastWill.check();
    });

    it('#4 token distribution on check', async () => {
        const tokens = await Promise.all(Array(...Array(2)).map(_ => SimpleToken.new()));
        const lastWill = await LastWill.new(TARGET, [RECIPIENT_1], [100], 2 * MINUTE, true);
        await lastWill.addTokenAddresses(tokens.map(t => t.address));

        await lastWill.sendTransaction({ value: web3.toWei(1, 'ether') });
        await Promise.all(tokens.map(t => t.mint(lastWill.address, 1000)));

        increaseTime(3 * MINUTE);
        const tx = await lastWill.check();
        tx.logs.length.should.be.equals(5);

        tx.logs[2].event.should.be.equals('FundsSent');
        tx.logs[2].args.recipient.should.be.equals(RECIPIENT_1);
        tx.logs[2].args.amount.should.be.bignumber.equal(web3.toWei(1, 'ether'));
        tx.logs[2].args.percent.should.be.bignumber.equal(100);

        tx.logs[3].event.should.be.equals('TokensSent');
        tx.logs[3].args.token.should.be.equals(tokens[0].address);
        tx.logs[3].args.recipient.should.be.equals(RECIPIENT_1);
        tx.logs[3].args.amount.should.be.bignumber.equal(1000);
        tx.logs[3].args.percent.should.be.bignumber.equal(100);

        tx.logs[4].event.should.be.equals('TokensSent');
        tx.logs[4].args.token.should.be.equals(tokens[1].address);
        tx.logs[4].args.recipient.should.be.equals(RECIPIENT_1);
        tx.logs[4].args.amount.should.be.bignumber.equal(1000);
        tx.logs[4].args.percent.should.be.bignumber.equal(100);

        (await tokens[0].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(1000);
        (await tokens[1].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(1000);
    });

    it('#5 token distribution to multiple addresses', async () => {
        const tokens = await Promise.all(Array(...Array(2)).map(_ => SimpleToken.new()));
        const lastWill = await LastWill.new(TARGET, [RECIPIENT_1, RECIPIENT_2], [50, 50], 2 * MINUTE, true);
        await lastWill.addTokenAddresses(tokens.map(t => t.address));

        await lastWill.sendTransaction({ value: web3.toWei(1, 'ether') });
        await Promise.all(tokens.map(t => t.mint(lastWill.address, 1000)));

        increaseTime(3 * MINUTE);
        const tx = await lastWill.check();

        tx.logs.length.should.be.equals(8);

        tx.logs[2].event.should.be.equals('FundsSent');
        tx.logs[2].args.recipient.should.be.equals(RECIPIENT_1);
        tx.logs[2].args.amount.should.be.bignumber.equal(web3.toWei(0.5, 'ether'));
        tx.logs[2].args.percent.should.be.bignumber.equal(50);

        tx.logs[3].event.should.be.equals('FundsSent');
        tx.logs[3].args.recipient.should.be.equals(RECIPIENT_2);
        tx.logs[3].args.amount.should.be.bignumber.equal(web3.toWei(0.5, 'ether'));
        tx.logs[3].args.percent.should.be.bignumber.equal(50);

        tx.logs[4].event.should.be.equals('TokensSent');
        tx.logs[4].args.token.should.be.equals(tokens[0].address);
        tx.logs[4].args.recipient.should.be.equals(RECIPIENT_1);
        tx.logs[4].args.amount.should.be.bignumber.equal(500);
        tx.logs[4].args.percent.should.be.bignumber.equal(50);

        tx.logs[5].event.should.be.equals('TokensSent');
        tx.logs[5].args.token.should.be.equals(tokens[0].address);
        tx.logs[5].args.recipient.should.be.equals(RECIPIENT_2);
        tx.logs[5].args.amount.should.be.bignumber.equal(500);
        tx.logs[5].args.percent.should.be.bignumber.equal(50);

        tx.logs[6].event.should.be.equals('TokensSent');
        tx.logs[6].args.token.should.be.equals(tokens[1].address);
        tx.logs[6].args.recipient.should.be.equals(RECIPIENT_1);
        tx.logs[6].args.amount.should.be.bignumber.equal(500);
        tx.logs[6].args.percent.should.be.bignumber.equal(50);

        tx.logs[7].event.should.be.equals('TokensSent');
        tx.logs[7].args.token.should.be.equals(tokens[1].address);
        tx.logs[7].args.recipient.should.be.equals(RECIPIENT_2);
        tx.logs[7].args.amount.should.be.bignumber.equal(500);
        tx.logs[7].args.percent.should.be.bignumber.equal(50);

        (await tokens[0].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(500);
        (await tokens[0].balanceOf(RECIPIENT_2)).should.be.bignumber.equal(500);
        (await tokens[1].balanceOf(RECIPIENT_1)).should.be.bignumber.equal(500);
        (await tokens[1].balanceOf(RECIPIENT_2)).should.be.bignumber.equal(500);
    });
});
