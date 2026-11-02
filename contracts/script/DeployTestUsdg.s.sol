// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {TestUSDG} from "../test/mocks/TestUSDG.sol";

/// SOLO TESTNET (46630). Men-deploy USDG tiruan untuk menguji pembayaran Pro dan Ask NEXA. TestUSDG.faucet() terbuka untuk siapa pun.
/// Jangan dijalankan ke mainnet: di sana USDG resmi dipakai (chains.ts) dan API menolak token lain.
/// forge script script/DeployTestUsdg.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --sender <DEPLOYER> --broadcast
contract DeployTestUsdg is Script {
    function run() external {
        require(block.chainid == 46630, "hanya testnet 46630");
        vm.startBroadcast();
        TestUSDG usdg = new TestUSDG();
        vm.stopBroadcast();
        console2.log("TestUSDG", address(usdg));
    }
}
