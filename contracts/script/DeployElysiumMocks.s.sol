// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {NexaLedger} from "../src/NexaLedger.sol";
import {MockAggregator} from "../test/mocks/MockAggregator.sol";

/// SOLO ELYSIUM TESTNET (chain 99801). Tidak ada Chainlink di Elysium, jadi aset dan feed tiruan
/// didaftarkan di NexaLedger supaya siklus commit -> reveal -> skor HYPE bisa diuji.
/// MockAggregator.push() terbuka untuk siapa pun: JANGAN dipakai di mainnet.
/// Dijalankan oleh owner NexaLedger (deployer), karena setFeed hanya untuk owner.
///
/// Alamat aset tiruan deterministik: mockAsset("HYPE") dan mockAsset("ETH")
/// (sama dengan fungsi yang sama di DeployTestnetMocks.s.sol, beda simbol).
///
/// Env: NEXA_LEDGER (wajib). Opsional: MOCK_HYPE_E8 (default 35,00 USD), MOCK_ETH_E8 (default 2236,56 USD).
/// forge script script/DeployElysiumMocks.s.sol \
///   --rpc-url https://testnet-rpc.elysium.kinetiq.xyz \
///   --chain 99801 \
///   --account deployer \
///   --sender 0x1f4cD14B5CDD15436950d626CBCb0e21084F462D \
///   --broadcast
contract DeployElysiumMocks is Script {
    /// Alamat aset tiruan = kunci pengenal di NexaLedger; deterministik supaya mudah diisi di config.
    function mockAsset(string memory symbol) public pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked("nexa.mock.", symbol)))));
    }

    function run() external {
        NexaLedger ledger = NexaLedger(vm.envAddress("NEXA_LEDGER"));
        // Harga awal: HYPE ~$35 (harga referensi Hyperliquid testnet), ETH ~$2236,56.
        // Keeper akan memperbarui harga dari Hyperliquid API (HYPE) dan Chainlink mainnet (ETH).
        int256 hypePrice = int256(vm.envOr("MOCK_HYPE_E8", uint256(3_500_000_000)));  // $35,00 × 1e8
        int256 ethPrice  = int256(vm.envOr("MOCK_ETH_E8",  uint256(223_656_000_000))); // $2236,56 × 1e8

        vm.startBroadcast();
        MockAggregator hypeFeed = new MockAggregator();
        MockAggregator ethFeed  = new MockAggregator();
        hypeFeed.push(hypePrice, block.timestamp);
        ethFeed.push(ethPrice,   block.timestamp);
        ledger.setFeed(mockAsset("HYPE"), hypeFeed);
        ledger.setFeed(mockAsset("ETH"),  ethFeed);
        vm.stopBroadcast();

        console2.log("HYPE asset (mockAsset)", mockAsset("HYPE"));
        console2.log("HYPE feed (MockAggregator)", address(hypeFeed));
        console2.log("ETH asset  (mockAsset)", mockAsset("ETH"));
        console2.log("ETH feed  (MockAggregator)", address(ethFeed));
    }
}
