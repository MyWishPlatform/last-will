pragma solidity ^0.4.23;

import "./LastWill.sol";


contract LastWillNotify is LastWill {
    /**
     * Period of time (in seconds) without activity.
     */
    uint32 public noActivityPeriod;

    /**
     * Last active timestamp.
     */
    uint64 public lastActiveTs;

    /**
     * MyWish service can call kill or iAmAlive.
     */
    bool public serviceControl;

    /**
     * Occurs when user notify that he is available.
     */
    event Notified();

    // ------------ CONSTRUCT -------------
    constructor(
        address _targetUser,
        address[] _recipients,
        uint[] _percents,
        uint32 _noActivityPeriod,
        bool _serviceControl
    ) public LastWill(_targetUser, _recipients, _percents) {
        noActivityPeriod = _noActivityPeriod;
        lastActiveTs = uint64(block.timestamp);
        serviceControl = _serviceControl;
    }

    // ------------ FALLBACK -------------
    function() public payable onlyAlive notTriggered {
        emit FundsAdded(msg.sender, msg.value);
        // we have to accept funds, but do not mark available if it is not right user
        if (!(isTarget() || isService())) {
            return;
        }
        markAvailable();
    }

    function imAvailable() public {
        require(isTarget() || isService());
        markAvailable();
    }

    // ------------ INTERNAL --------------
    function internalCheck() internal returns (bool) {
        require(block.timestamp >= lastActiveTs);
        // we do not need payable
        require(msg.value == 0);
        bool result = block.timestamp - lastActiveTs >= noActivityPeriod;
        emit Checked(result);
        return result;
    }

    function markAvailable() internal {
        lastActiveTs = uint64(block.timestamp);
        emit Notified();
    }

    function isService() internal view returns (bool) {
        return serviceControl && isServiceAccount();
    }

    /**
     * @dev Override to make possibility to kill contract by service account.
     */
    modifier onlyTarget() {
        require(isTarget() || isService());
        _;
    }
}
