// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CreatorFeeSplitter, ProtocolFeeSplitter, FeeSplitter} from "../src/FeeSplitter.sol";
import {BurnVault} from "../src/BurnVault.sol";
import {MockERC20} from "./mocks/MockTokens.sol";

contract FeeSplittersTest is Test {
    MockERC20 nvda;
    CreatorFeeSplitter creator;
    ProtocolFeeSplitter protocol;
    address vault;
    address treasury = makeAddr("treasury");

    function setUp() public {
        nvda = new MockERC20("NVDA Stock Token", "NVDA");
        vault = address(new BurnVault(IERC20(address(nvda)), makeAddr("owner"), makeAddr("keeper")));
        creator = new CreatorFeeSplitter(IERC20(address(nvda)), vault, treasury);
        protocol = new ProtocolFeeSplitter(IERC20(address(nvda)), vault, treasury);
    }

    // ---------------------------------------------------------------- rasio hardcode

    function test_ratiosAreHardcodedConstants() public view {
        assertEq(creator.CREATOR_FEE_BURN_BPS(), 3_000); // 30%
        assertEq(creator.burnBps(), 3_000);
        assertEq(protocol.PROTOCOL_FEE_BURN_BPS(), 2_000); // 20%
        assertEq(protocol.burnBps(), 2_000);
        assertEq(creator.BPS(), 10_000);
    }

    function test_immutables() public view {
        assertEq(address(creator.pairAsset()), address(nvda));
        assertEq(creator.burnVault(), vault);
        assertEq(creator.treasury(), treasury);
    }

    // --------------------------------------------------------------------- creator

    function test_creator_splits30_70() public {
        nvda.mint(address(creator), 1_000 ether);
        (uint256 toVault, uint256 toTreasury) = creator.distribute();
        assertEq(toVault, 300 ether);
        assertEq(toTreasury, 700 ether);
        assertEq(nvda.balanceOf(vault), 300 ether);
        assertEq(nvda.balanceOf(treasury), 700 ether);
        assertEq(nvda.balanceOf(address(creator)), 0);
    }

    function test_creator_emitsEvent() public {
        nvda.mint(address(creator), 100);
        vm.expectEmit(true, false, false, true);
        emit FeeSplitter.Distributed(address(this), 100, 30, 70);
        creator.distribute();
    }

    function test_creator_roundingGoesToTreasury() public {
        nvda.mint(address(creator), 7); // 7 * 30% = 2.1 -> 2
        (uint256 toVault, uint256 toTreasury) = creator.distribute();
        assertEq(toVault, 2);
        assertEq(toTreasury, 5);
        assertEq(nvda.balanceOf(address(creator)), 0);
    }

    function test_creator_permissionless() public {
        nvda.mint(address(creator), 1_000);
        vm.prank(makeAddr("stranger"));
        creator.distribute();
        assertEq(nvda.balanceOf(vault), 300);
    }

    function test_creator_revertsWhenEmpty() public {
        vm.expectRevert(FeeSplitter.NothingToDistribute.selector);
        creator.distribute();
    }

    function test_creator_secondDistributeRevertsWhenNothingNew() public {
        nvda.mint(address(creator), 1_000);
        creator.distribute();
        vm.expectRevert(FeeSplitter.NothingToDistribute.selector);
        creator.distribute();
    }

    function test_creator_accumulatesAcrossDeposits() public {
        nvda.mint(address(creator), 400);
        nvda.mint(address(creator), 600);
        creator.distribute();
        assertEq(nvda.balanceOf(vault), 300);
        assertEq(nvda.balanceOf(treasury), 700);
    }

    // -------------------------------------------------------------------- protocol

    function test_protocol_splits20_80() public {
        nvda.mint(address(protocol), 1_000 ether);
        (uint256 toVault, uint256 toTreasury) = protocol.distribute();
        assertEq(toVault, 200 ether);
        assertEq(toTreasury, 800 ether);
    }

    // ------------------------------------------------------------------ constructor

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(FeeSplitter.ZeroAddress.selector);
        new CreatorFeeSplitter(IERC20(address(0)), vault, treasury);
        vm.expectRevert(FeeSplitter.ZeroAddress.selector);
        new CreatorFeeSplitter(IERC20(address(nvda)), address(0), treasury);
        vm.expectRevert(FeeSplitter.ZeroAddress.selector);
        new ProtocolFeeSplitter(IERC20(address(nvda)), vault, address(0));
    }

    function test_constructor_validatesVaultAndTreasury() public {
        vm.expectRevert(FeeSplitter.InvalidBurnVault.selector);
        new CreatorFeeSplitter(IERC20(address(nvda)), makeAddr("eoa"), treasury); // bukan kontrak

        MockERC20 other = new MockERC20("Other", "OTH");
        vm.expectRevert(FeeSplitter.PairAssetMismatch.selector);
        new CreatorFeeSplitter(IERC20(address(other)), vault, treasury); // vault memakai aset pasangan lain

        vm.expectRevert(FeeSplitter.InvalidTreasury.selector);
        new CreatorFeeSplitter(IERC20(address(nvda)), vault, vault); // treasury = vault
    }

    // ------------------------------------------------------------------------ fuzz

    function testFuzz_creator_conservesAndRatio(uint96 amount) public {
        amount = uint96(bound(amount, 1, type(uint96).max));
        nvda.mint(address(creator), amount);
        (uint256 toVault, uint256 toTreasury) = creator.distribute();
        assertEq(toVault + toTreasury, amount); // tidak ada dana hilang atau tertinggal
        assertEq(toVault, (uint256(amount) * 3_000) / 10_000);
        assertLe(toVault, toTreasury + 1); // 30% <= 70% (+1 untuk jumlah sangat kecil)
        assertEq(nvda.balanceOf(address(creator)), 0);
    }

    function testFuzz_protocol_conservesAndRatio(uint96 amount) public {
        amount = uint96(bound(amount, 1, type(uint96).max));
        nvda.mint(address(protocol), amount);
        (uint256 toVault, uint256 toTreasury) = protocol.distribute();
        assertEq(toVault + toTreasury, amount);
        assertEq(toVault, (uint256(amount) * 2_000) / 10_000);
        assertEq(nvda.balanceOf(address(protocol)), 0);
    }

    /// Token lain yang tersangkut di splitter tidak bisa dibagi atau ditarik (hanya aset pasangan yang dikelola).
    function test_otherTokensAreNotTouched() public {
        MockERC20 other = new MockERC20("Other", "OTH");
        other.mint(address(creator), 500);
        nvda.mint(address(creator), 100);
        creator.distribute();
        assertEq(other.balanceOf(address(creator)), 500);
        assertEq(other.balanceOf(treasury), 0);
    }
}
