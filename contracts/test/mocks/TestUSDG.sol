// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// SOLO TESTNET. USDG tiruan (6 desimal) untuk menguji pembayaran Pro dan Ask NEXA tanpa uang asli.
/// faucet() terbuka untuk siapa pun dengan batas per panggilan: JANGAN dipakai di mainnet.
contract TestUSDG is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1_000 * 1e6;

    constructor() ERC20("Test USDG", "tUSDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
