pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "sc-library/contracts/Checkable.sol";
import "sc-library/contracts/SoftDestruct.sol";


/**
 * The base LastWill contract. Check method must be overridden.
 */
contract LastWill is SoftDestruct, Checkable {
    struct RecipientPercent {
        address recipient;
        uint8 percent;
    }

    /**
     * Maximum length of token contracts addresses list
     */
    uint public constant TOKEN_ADDRESSES_LIMIT = 10;

    /**
     * Addresses of token contracts
     */
    address[] public tokenAddresses;

    /**
     * Recipient addresses and corresponding % of funds.
     */
    RecipientPercent[] private percents;

    // ------------ EVENTS ----------------
    // Occurs when contract was killed.
    event Killed(bool byUser);
    // Occurs when founds were sent.
    event FundsAdded(address indexed from, uint amount);
    // Occurs when accident leads to sending funds to recipient.
    event FundsSent(address recipient, uint amount, uint percent);

    event TokensAdded(address token, address indexed from, uint amount);
    event TokensSent(address token, address recipient, uint amount, uint percent);

    // ------------ CONSTRUCT -------------
    constructor(
        address _targetUser,
        address[] _recipients,
        uint[] _percents
    ) public SoftDestruct(_targetUser) {
        require(_recipients.length == _percents.length);
        percents.length = _recipients.length;
        // check percents
        uint summaryPercent = 0;
        for (uint i = 0; i < _recipients.length; i++) {
            address recipient = _recipients[i];
            uint percent = _percents[i];

            require(recipient != 0x0);
            summaryPercent += percent;
            percents[i] = RecipientPercent(recipient, uint8(percent));
        }
        require(summaryPercent == 100);
    }

    // ------------ FALLBACK -------------
    // Must be less than 2300 gas
    function () public payable onlyAlive() notTriggered {
        emit FundsAdded(msg.sender, msg.value);
    }

    function addTokenAddresses(address[] _contracts) external onlyTarget notTriggered {
        require(tokenAddresses.length + _contracts.length <= TOKEN_ADDRESSES_LIMIT);
        for (uint i = 0; i < _contracts.length; i++) {
            _addTokenAddress(_contracts[i]);
        }
    }

    function addTokenAddress(address _contract) public onlyTarget notTriggered {
        require(tokenAddresses.length < TOKEN_ADDRESSES_LIMIT);
        _addTokenAddress(_contract);
    }

    function _addTokenAddress(address _contract) public {
        require(_contract != address(0));
        require(!isTokenAddressAlreadyInList(_contract));
        tokenAddresses.push(_contract);
    }

    /**
     * Limit check execution only for alive contract.
     */
    function check() public onlyAlive payable {
        super.check();
    }

    /**
     * Extends super method to add event producing.
     */
    function kill() public {
        super.kill();
        emit Killed(true);
    }

    // ------------ INTERNAL -------------
    /**
     * Calculate amounts to transfer corresponding to the percents.
     */
    function calculateAmounts(uint balance) internal view returns (uint[] amounts) {
        uint remainder = balance;
        amounts = new uint[](percents.length);
        for (uint i = 0; i < percents.length; i++) {
            if (i + 1 == percents.length) {
                amounts[i] = remainder;
                break;
            }
            uint amount = balance * percents[i].percent / 100;
            amounts[i] = amount;
            remainder -= amount;
        }
    }

    /**
     * Distribute funds between recipients in corresponding by percents.
     */
    function distributeFunds() internal {
        uint[] memory amounts = calculateAmounts(address(this).balance);

        for (uint i = 0; i < amounts.length; i++) {
            uint amount = amounts[i];
            address recipient = percents[i].recipient;
            uint percent = percents[i].percent;

            if (amount == 0) {
                continue;
            }

            recipient.transfer(amount);
            emit FundsSent(recipient, amount, percent);
        }
    }

    function distributeTokens() internal {
        for (uint i = 0; i < tokenAddresses.length; i++) {
            ERC20Basic token = ERC20Basic(tokenAddresses[i]);
            uint[] memory amounts = calculateAmounts(token.balanceOf(this));

            for (uint j = 0; j < amounts.length; j++) {
                uint amount = amounts[j];
                address recipient = percents[j].recipient;
                uint percent = percents[j].percent;

                if (amount == 0) {
                    continue;
                }

                token.transfer(recipient, amount);
                emit TokensSent(token, recipient, amount, percent);
            }
        }
    }

    /**
     * @dev Do inner action if check was success.
     */
    function internalAction() internal {
        distributeFunds();
        distributeTokens();
    }

    function isTokenAddressAlreadyInList(address _contract) internal view returns (bool) {
        for (uint i = 0; i < tokenAddresses.length; i++) {
            if (tokenAddresses[i] == _contract) return true;
        }
        return false;
    }
}
