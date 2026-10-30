// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BurnVault} from "../src/BurnVault.sol";
import {ISwapper} from "../src/interfaces/ISwapper.sol";
import {MockERC20, MockSwapper, DustSwapper, ReentrantSwapper, FreeSwapper, RefundSwapper} from "./mocks/MockTokens.sol";

contract BurnVaultTest is Test {
    MockERC20 nvda;
    MockERC20 nexa;
    BurnVault vault;
    MockSwapper swapper;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address stranger = makeAddr("stranger");
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        vm.warp(1_800_000_000);
        nvda = new MockERC20("NVDA", "NVDA");
        nexa = new MockERC20("NEXA", "NEXA");
        vault = new BurnVault(IERC20(address(nvda)), owner, keeper);
        swapper = new MockSwapper(1000, 1); // 1 NVDA = 1000 NEXA
        nexa.mint(address(swapper), 1e30);
        _activate(ISwapper(address(swapper)));
    }

    function _activate(ISwapper s) internal {
        vm.startPrank(owner);
        if (address(vault.nexa()) == address(0)) vault.setNexa(IERC20(address(nexa)));
        vault.proposeSwapper(s);
        vm.warp(block.timestamp + vault.SWAPPER_DELAY());
        vault.executeSwapper();
        vm.stopPrank();
    }

    // ----------------------------------------------------------- burn: jalur utama

    function test_burn_swapsAndBurnsAll() public {
        nvda.mint(address(vault), 100 ether);
        vm.prank(keeper);
        uint256 burned = vault.burn(1);
        assertEq(burned, 100_000 ether);
        assertEq(nexa.balanceOf(DEAD), 100_000 ether);
        assertEq(nexa.balanceOf(address(vault)), 0);
        assertEq(nvda.balanceOf(address(vault)), 0);
        assertEq(vault.totalNexaBurned(), 100_000 ether);
        assertEq(vault.totalPairSpent(), 100 ether);
        assertEq(nvda.allowance(address(vault), address(swapper)), 0); // allowance direset
    }

    function test_burn_emitsEvent() public {
        nvda.mint(address(vault), 10 ether);
        vm.expectEmit(true, false, false, true);
        emit BurnVault.Burned(keeper, 10 ether, 10_000 ether);
        vm.prank(keeper);
        vault.burn(1);
    }

    function test_burn_alsoBurnsNexaAlreadyHeld() public {
        nexa.mint(address(vault), 5 ether);
        nvda.mint(address(vault), 1 ether);
        vm.prank(keeper);
        uint256 burned = vault.burn(1);
        assertEq(burned, 1_000 ether + 5 ether);
        assertEq(nexa.balanceOf(address(vault)), 0);
    }

    // ------------------------------------------------------------- burn: penjaga

    function test_burn_onlyKeeper() public {
        nvda.mint(address(vault), 1 ether);
        vm.prank(stranger);
        vm.expectRevert(BurnVault.NotKeeper.selector);
        vault.burn(1);
        vm.prank(owner);
        vm.expectRevert(BurnVault.NotKeeper.selector);
        vault.burn(1);
    }

    function test_burn_requiresPositiveMinOut() public {
        nvda.mint(address(vault), 1 ether);
        vm.prank(keeper);
        vm.expectRevert(BurnVault.ZeroMinOut.selector);
        vault.burn(0);
    }

    function test_burn_revertsWhenNothingToBurn() public {
        vm.prank(keeper);
        vm.expectRevert(BurnVault.NothingToBurn.selector);
        vault.burn(1);
    }

    function test_burn_revertsBeforeNexaAndSwapperSet() public {
        BurnVault fresh = new BurnVault(IERC20(address(nvda)), owner, keeper);
        nvda.mint(address(fresh), 1 ether);
        vm.prank(keeper);
        vm.expectRevert(BurnVault.NexaNotSet.selector);
        fresh.burn(1);

        vm.prank(owner);
        fresh.setNexa(IERC20(address(nexa)));
        vm.prank(keeper);
        vm.expectRevert(BurnVault.SwapperNotSet.selector);
        fresh.burn(1);
    }

    function test_burn_revertsIfOutputBelowMin() public {
        nvda.mint(address(vault), 1 ether);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(BurnVault.InsufficientOutput.selector, 1_000 ether, 1_001 ether));
        vault.burn(1_001 ether);
        assertEq(nvda.balanceOf(address(vault)), 1 ether); // dana utuh karena seluruh transaksi dibatalkan
    }

    function test_burn_dustSwapperCannotDrainWhenMinOutIsSane() public {
        DustSwapper dust = new DustSwapper();
        nexa.mint(address(dust), 10);
        _activate(ISwapper(address(dust)));
        nvda.mint(address(vault), 100 ether);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(BurnVault.InsufficientOutput.selector, 1, 1_000 ether));
        vault.burn(1_000 ether);
        assertEq(nvda.balanceOf(address(vault)), 100 ether);
    }

    function test_burn_reentrancyBlocked() public {
        ReentrantSwapper re = new ReentrantSwapper(vault);
        nexa.mint(address(re), 1e30);
        _activate(ISwapper(address(re)));
        nvda.mint(address(vault), 1 ether);
        vm.prank(keeper);
        vault.burn(1);
        // burn() dari dalam swapper ditolak (nonReentrant + bukan keeper); penukaran luar tetap selesai normal.
        assertTrue(re.reentryBlocked());
        assertEq(vault.totalNexaBurned(), 1 ether);
    }

    function test_burn_freeSwapperDoesNotLetVaultLose() public {
        FreeSwapper free = new FreeSwapper();
        nexa.mint(address(free), 1e24);
        _activate(ISwapper(address(free)));
        nvda.mint(address(vault), 3 ether);
        vm.prank(keeper);
        vault.burn(1);
        assertEq(vault.totalPairSpent(), 0); // tidak ada aset pasangan yang keluar
        assertEq(nvda.balanceOf(address(vault)), 3 ether);
    }

    // ----------------------------------------------------------------- burnHeld

    function test_burnHeld_permissionless() public {
        nexa.mint(address(vault), 42 ether);
        vm.prank(stranger);
        vault.burnHeld();
        assertEq(nexa.balanceOf(DEAD), 42 ether);
        assertEq(vault.totalNexaBurned(), 42 ether);
    }

    function test_burnHeld_revertsWhenEmptyOrNexaNotSet() public {
        vm.expectRevert(BurnVault.NothingToBurn.selector);
        vault.burnHeld();
        BurnVault fresh = new BurnVault(IERC20(address(nvda)), owner, keeper);
        vm.expectRevert(BurnVault.NexaNotSet.selector);
        fresh.burnHeld();
    }

    function test_burnHeld_neverTouchesPairAsset() public {
        nvda.mint(address(vault), 9 ether);
        nexa.mint(address(vault), 1 ether);
        vault.burnHeld();
        assertEq(nvda.balanceOf(address(vault)), 9 ether);
    }

    // ---------------------------------------------------------------- admin

    function test_setNexa_onlyOnce_onlyOwner() public {
        BurnVault fresh = new BurnVault(IERC20(address(nvda)), owner, keeper);
        vm.prank(stranger);
        vm.expectRevert();
        fresh.setNexa(IERC20(address(nexa)));

        vm.startPrank(owner);
        vm.expectRevert(BurnVault.InvalidNexa.selector);
        fresh.setNexa(IERC20(address(0)));
        vm.expectRevert(BurnVault.InvalidNexa.selector);
        fresh.setNexa(IERC20(address(nvda))); // tidak boleh sama dengan aset pasangan
        fresh.setNexa(IERC20(address(nexa)));
        vm.expectRevert(BurnVault.NexaAlreadySet.selector);
        fresh.setNexa(IERC20(address(nexa)));
        vm.stopPrank();
    }

    function test_setNexa_mustBeContract() public {
        BurnVault fresh = new BurnVault(IERC20(address(nvda)), owner, keeper);
        vm.prank(owner);
        vm.expectRevert(BurnVault.InvalidNexa.selector);
        fresh.setNexa(IERC20(makeAddr("eoa")));
    }

    function test_renounceOwnership_disabled() public {
        vm.prank(owner);
        vm.expectRevert(BurnVault.RenounceDisabled.selector);
        vault.renounceOwnership();
        assertEq(vault.owner(), owner);
    }

    function test_burn_swapperRefundingPairAssetDoesNotBrick() public {
        RefundSwapper refund = new RefundSwapper();
        nexa.mint(address(refund), 1e24);
        nvda.mint(address(refund), 1 ether);
        _activate(ISwapper(address(refund)));
        nvda.mint(address(vault), 2 ether);
        vm.prank(keeper);
        vault.burn(1); // tidak underflow meski aset pasangan dikembalikan lebih banyak dari yang ditarik
        assertEq(vault.totalPairSpent(), 0);
    }

    function test_swapper_timelock() public {
        MockSwapper s2 = new MockSwapper(2000, 1);
        vm.prank(owner);
        vault.proposeSwapper(ISwapper(address(s2)));
        uint256 eta = vault.pendingSwapperEta(); // dihitung dulu: panggilan view akan memakai vm.prank
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BurnVault.SwapperTimelock.selector, eta));
        vault.executeSwapper();

        vm.warp(block.timestamp + vault.SWAPPER_DELAY() - 1);
        vm.prank(owner);
        vm.expectRevert();
        vault.executeSwapper();

        vm.warp(block.timestamp + 1);
        vm.prank(owner);
        vault.executeSwapper();
        assertEq(address(vault.swapper()), address(s2));
        assertEq(address(vault.pendingSwapper()), address(0));
    }

    function test_swapper_cancel() public {
        MockSwapper s2 = new MockSwapper(2000, 1);
        vm.startPrank(owner);
        vault.proposeSwapper(ISwapper(address(s2)));
        vault.cancelSwapper();
        vm.expectRevert(BurnVault.NoPendingSwapper.selector);
        vault.executeSwapper();
        vm.expectRevert(BurnVault.NoPendingSwapper.selector);
        vault.cancelSwapper();
        vm.stopPrank();
        assertEq(address(vault.swapper()), address(swapper)); // tidak berubah
    }

    function test_swapper_onlyOwner() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        vault.proposeSwapper(ISwapper(address(1)));
        vm.expectRevert();
        vault.executeSwapper();
        vm.expectRevert();
        vault.cancelSwapper();
        vm.stopPrank();
    }

    function test_setKeeper() public {
        vm.prank(owner);
        vault.setKeeper(stranger);
        nvda.mint(address(vault), 1 ether);
        vm.prank(keeper);
        vm.expectRevert(BurnVault.NotKeeper.selector);
        vault.burn(1);
        vm.prank(stranger);
        vault.burn(1);

        vm.prank(owner);
        vm.expectRevert(BurnVault.ZeroAddress.selector);
        vault.setKeeper(address(0));
    }

    function test_constructor_rejectsZero() public {
        vm.expectRevert(BurnVault.ZeroAddress.selector);
        new BurnVault(IERC20(address(0)), owner, keeper);
        vm.expectRevert(BurnVault.ZeroAddress.selector);
        new BurnVault(IERC20(address(nvda)), owner, address(0));
    }

    // ------------------------------------------------ tidak ada jalan menarik dana

    /// Vault tidak menerima ETH (tanpa receive/fallback).
    function test_rejectsEth() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertFalse(ok);
    }

    /// Selector umum penarikan tidak ada. (Daftar fungsi publik lengkap ditinjau di docs/audit.)
    function test_noWithdrawSelectors() public {
        nvda.mint(address(vault), 10 ether);
        bytes[6] memory calls = [
            abi.encodeWithSignature("withdraw(address,uint256)", stranger, 10 ether),
            abi.encodeWithSignature("withdraw(uint256)", 10 ether),
            abi.encodeWithSignature("rescue(address,address,uint256)", address(nvda), stranger, 10 ether),
            abi.encodeWithSignature("sweep(address)", address(nvda)),
            abi.encodeWithSignature("transfer(address,uint256)", stranger, 10 ether),
            abi.encodeWithSignature("execute(address,bytes)", address(nvda), abi.encodeWithSignature("transfer(address,uint256)", stranger, 10 ether))
        ];
        for (uint256 i = 0; i < calls.length; i++) {
            vm.prank(owner);
            (bool ok,) = address(vault).call(calls[i]);
            assertFalse(ok);
            vm.prank(keeper);
            (ok,) = address(vault).call(calls[i]);
            assertFalse(ok);
        }
        assertEq(nvda.balanceOf(address(vault)), 10 ether);
        assertEq(nvda.balanceOf(stranger), 0);
    }

    // ------------------------------------------------------------------- fuzz

    /// Aset pasangan hanya berkurang bila $NEXA >= minNexaOut dibakar; tidak ada sisa $NEXA/allowance.
    function testFuzz_burnConservation(uint96 amountIn, uint32 rateNum, uint96 minOut) public {
        amountIn = uint96(bound(amountIn, 1, type(uint96).max));
        rateNum = uint32(bound(rateNum, 1, type(uint32).max));
        minOut = uint96(bound(minOut, 1, type(uint96).max));
        swapper.setRate(rateNum, 1);
        nexa.mint(address(swapper), uint256(amountIn) * rateNum);
        nvda.mint(address(vault), amountIn);

        uint256 expectedOut = uint256(amountIn) * rateNum;
        vm.prank(keeper);
        if (expectedOut < minOut) {
            vm.expectRevert(abi.encodeWithSelector(BurnVault.InsufficientOutput.selector, expectedOut, uint256(minOut)));
            vault.burn(minOut);
            assertEq(nvda.balanceOf(address(vault)), amountIn);
            assertEq(nexa.balanceOf(DEAD), 0);
        } else {
            vault.burn(minOut);
            assertEq(nvda.balanceOf(address(vault)), 0);
            assertEq(nexa.balanceOf(DEAD), expectedOut);
            assertGe(nexa.balanceOf(DEAD), minOut);
            assertEq(nexa.balanceOf(address(vault)), 0);
            assertEq(nvda.allowance(address(vault), address(swapper)), 0);
            assertEq(vault.totalPairSpent(), amountIn);
        }
    }
}
