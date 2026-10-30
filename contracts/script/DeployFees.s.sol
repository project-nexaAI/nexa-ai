// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BurnVault} from "../src/BurnVault.sol";
import {CreatorFeeSplitter, ProtocolFeeSplitter} from "../src/FeeSplitter.sol";

/// Env (semua alamat publik; tidak ada kunci privat di sini):
///   PAIR_ASSET        alamat aset pasangan (NVDA Stock Token); parameter, bukan hardcode
///   TREASURY_ADDRESS  penerima 70% creator fee dan 80% protocol fee (akun MetaMask treasury)
///   KEEPER_ADDRESS    pemanggil burn(); disarankan wallet agent atau wallet keeper terpisah
/// Owner BurnVault = akun yang menjalankan script (deployer). `setNexa` dipanggil SETELAH $NEXA diluncurkan di Pons.
///
/// Testnet : forge script script/DeployFees.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account deployer --broadcast
/// Mainnet : HANYA dry run (tanpa --broadcast): forge script ... --rpc-url <mainnet> --sender <deployer>
contract DeployFees is Script {
    function run() external returns (BurnVault vault, CreatorFeeSplitter creator, ProtocolFeeSplitter protocol) {
        IERC20 pair = IERC20(vm.envAddress("PAIR_ASSET"));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address keeper = vm.envAddress("KEEPER_ADDRESS");

        vm.startBroadcast();
        vault = new BurnVault(pair, msg.sender, keeper);
        creator = new CreatorFeeSplitter(pair, address(vault), treasury);
        protocol = new ProtocolFeeSplitter(pair, address(vault), treasury);
        vm.stopBroadcast();

        console2.log("BurnVault", address(vault));
        console2.log("CreatorFeeSplitter", address(creator));
        console2.log("ProtocolFeeSplitter", address(protocol));
        console2.log("owner", vault.owner());
    }
}
