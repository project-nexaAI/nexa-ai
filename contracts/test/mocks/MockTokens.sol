// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapper} from "../../src/interfaces/ISwapper.sol";
import {BurnVault} from "../../src/BurnVault.sol";

contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Swapper jujur: menarik tokenIn dari vault, membayar tokenOut dari persediaannya dengan kurs tetap.
contract MockSwapper is ISwapper {
    uint256 public rateNum; // tokenOut per tokenIn = rateNum / rateDen
    uint256 public rateDen;

    constructor(uint256 num, uint256 den) {
        rateNum = num;
        rateDen = den;
    }

    function setRate(uint256 num, uint256 den) external {
        rateNum = num;
        rateDen = den;
    }

    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256, address recipient)
        external
        virtual
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = (amountIn * rateNum) / rateDen;
        IERC20(tokenOut).transfer(recipient, amountOut);
    }
}

/// Swapper jahat: mengambil tokenIn tetapi hanya mengembalikan debu.
contract DustSwapper is ISwapper {
    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256, address recipient)
        external
        returns (uint256)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(recipient, 1);
        return 1;
    }
}

/// Swapper yang mencoba memanggil balik vault saat penukaran.
contract ReentrantSwapper is MockSwapper {
    BurnVault public immutable vault;
    bool public reentryBlocked;

    constructor(BurnVault v) MockSwapper(1, 1) {
        vault = v;
    }

    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, address recipient)
        external
        override
        returns (uint256 amountOut)
    {
        try vault.burn(1) {} catch {
            reentryBlocked = true;
        }
        try vault.burnHeld() {} catch {}
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = amountIn;
        IERC20(tokenOut).transfer(recipient, amountOut);
        minOut;
    }
}

/// Swapper yang menarik tokenIn lalu mengembalikan LEBIH banyak tokenIn ke vault (uji akun spent).
contract RefundSwapper is ISwapper {
    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256, address recipient) external returns (uint256) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).transfer(recipient, amountIn + 1 ether);
        IERC20(tokenOut).transfer(recipient, amountIn);
        return amountIn;
    }
}

/// Swapper yang tidak menarik tokenIn sama sekali dan membayar penuh (vault tidak boleh rugi).
contract FreeSwapper is ISwapper {
    function swapExactInput(address, address tokenOut, uint256 amountIn, uint256, address recipient) external returns (uint256) {
        IERC20(tokenOut).transfer(recipient, amountIn);
        return amountIn;
    }
}
