// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Adaptor penukaran aset pasangan -> $NEXA (mis. Uniswap v4 setelah graduation Pons).
/// @dev BurnVault memberi allowance tepat `amountIn` lalu memeriksa sendiri saldo $NEXA yang diterima.
interface ISwapper {
    function swapExactInput(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut);
}
