// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {NexaLedger} from "../src/NexaLedger.sol";

/// Env: AGENT_ADDRESS (wajib). Owner = akun yang menjalankan script (deployer).
/// Testnet:  forge script script/DeployNexaLedger.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --broadcast
/// Mainnet:  HANYA dry run (tanpa --broadcast).
contract DeployNexaLedger is Script {
    function run() external returns (NexaLedger ledger) {
        address agent = vm.envAddress("AGENT_ADDRESS");
        vm.startBroadcast();
        ledger = new NexaLedger(msg.sender, agent);
        vm.stopBroadcast();
        console2.log("NexaLedger", address(ledger));
        console2.log("owner", ledger.owner());
        console2.log("agent", ledger.agent());
    }
}
