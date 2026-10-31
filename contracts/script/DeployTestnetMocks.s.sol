// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {NexaLedger} from "../src/NexaLedger.sol";
import {MockAggregator} from "../test/mocks/MockAggregator.sol";

/// SOLO TESTNET. Robinhood Chain Testnet tidak punya feed Chainlink, jadi aset dan feed tiruan didaftarkan di NexaLedger
/// supaya siklus commit -> reveal -> skor bisa diuji. MockAggregator.push() terbuka untuk siapa pun: JANGAN dipakai di mainnet.
/// Dijalankan oleh owner NexaLedger (deployer), karena setFeed hanya untuk owner.
///
/// Env: NEXA_LEDGER (wajib). Opsional: MOCK_NVDA_E8 (default 205,28 USD), MOCK_ETH_E8 (default 2236,56 USD), harga 8 desimal.
/// forge script script/DeployTestnetMocks.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --sender <DEPLOYER> --broadcast
contract DeployTestnetMocks is Script {
    /// Alamat aset tiruan = kunci pengenal di NexaLedger (tidak perlu kontrak token); deterministik supaya mudah diisi di config.
    function mockAsset(string memory symbol) public pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked("nexa.mock.", symbol)))));
    }

    function run() external {
        NexaLedger ledger = NexaLedger(vm.envAddress("NEXA_LEDGER"));
        int256 nvdaPrice = int256(vm.envOr("MOCK_NVDA_E8", uint256(20_528_000_000)));
        int256 ethPrice = int256(vm.envOr("MOCK_ETH_E8", uint256(223_656_000_000)));

        vm.startBroadcast();
        MockAggregator nvdaFeed = new MockAggregator();
        MockAggregator ethFeed = new MockAggregator();
        nvdaFeed.push(nvdaPrice, block.timestamp);
        ethFeed.push(ethPrice, block.timestamp);
        ledger.setFeed(mockAsset("NVDA"), nvdaFeed);
        ledger.setFeed(mockAsset("ETH"), ethFeed);
        vm.stopBroadcast();

        console2.log("NVDA asset", mockAsset("NVDA"));
        console2.log("NVDA feed", address(nvdaFeed));
        console2.log("ETH asset", mockAsset("ETH"));
        console2.log("ETH feed", address(ethFeed));
    }
}
