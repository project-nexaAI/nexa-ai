// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {NexaLedger} from "../src/NexaLedger.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract NexaLedgerTest is Test {
    using stdJson for string;

    NexaLedger ledger;
    MockAggregator feed;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address asset = makeAddr("nvda");

    string constant TEXT = "NVDA akan ditutup lebih tinggi dalam 7 hari";
    bytes32 constant SALT = bytes32(uint256(0xabc));
    uint32 constant HORIZON = 7 days;

    function setUp() public {
        vm.warp(1_800_000_000);
        ledger = new NexaLedger(owner, agent);
        feed = new MockAggregator();
        vm.prank(owner);
        ledger.setFeed(asset, AggregatorV3Interface(address(feed)));
    }

    /// Dihitung lokal (bukan call ke ledger) supaya tidak menghabiskan vm.prank / vm.expectRevert.
    function _hash(uint8 dir) internal view returns (bytes32) {
        return keccak256(abi.encode(TEXT, asset, dir, HORIZON, SALT));
    }

    /// Siapkan siklus penuh: round awal sebelum commit, commit, round akhir setelah jatuh tempo.
    function _cycle(uint8 dir, int256 startPx, int256 endPx)
        internal
        returns (uint256 id, uint80 startRound, uint80 endRound)
    {
        startRound = feed.push(startPx, block.timestamp - 10);
        vm.prank(agent);
        id = ledger.commit(_hash(dir));
        feed.push(startPx, block.timestamp + 1 days); // round tengah
        vm.warp(block.timestamp + HORIZON + 1);
        endRound = feed.push(endPx, block.timestamp - 1);
    }

    function _reveal(uint256 id, uint8 dir, uint80 s, uint80 e) internal {
        vm.prank(agent);
        ledger.reveal(id, TEXT, asset, dir, HORIZON, SALT, s, e);
    }

    // ---------------------------------------------------------------- vektor

    function test_hashMatchesSharedVectors() public view {
        string memory json = vm.readFile("../packages/shared/test-vectors/commit-reveal.json");
        for (uint256 i = 0; i < 3; i++) {
            string memory k = string.concat(".vectors[", vm.toString(i), "]");
            bytes32 expected = json.readBytes32(string.concat(k, ".hash"));
            bytes32 got = keccak256(
                abi.encode(
                    json.readString(string.concat(k, ".text")),
                    json.readAddress(string.concat(k, ".asset")),
                    uint8(json.readUint(string.concat(k, ".direction"))),
                    uint32(json.readUint(string.concat(k, ".horizon"))),
                    json.readBytes32(string.concat(k, ".salt"))
                )
            );
            assertEq(got, expected);
        }
    }

    // ---------------------------------------------------------------- commit

    function test_commit_onlyAgent() public {
        vm.expectRevert(NexaLedger.NotAgent.selector);
        ledger.commit(_hash(1));
    }

    function test_commit_storesAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit NexaLedger.Committed(0, _hash(1), uint64(block.timestamp));
        vm.prank(agent);
        uint256 id = ledger.commit(_hash(1));
        assertEq(id, 0);
        assertEq(ledger.commitCount(), 1);
        assertEq(ledger.getPrediction(0).committedAt, block.timestamp);
    }

    function test_commit_rejectsZeroAndDuplicate() public {
        vm.startPrank(agent);
        vm.expectRevert(NexaLedger.ZeroHash.selector);
        ledger.commit(bytes32(0));
        ledger.commit(_hash(1));
        vm.expectRevert(NexaLedger.HashAlreadyCommitted.selector);
        ledger.commit(_hash(1));
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- reveal

    function test_reveal_upWins() public {
        (uint256 id, uint80 s, uint80 e) = _cycle(1, 100e8, 110e8);
        _reveal(id, 1, s, e);
        NexaLedger.Prediction memory p = ledger.getPrediction(id);
        assertTrue(p.revealed);
        assertTrue(p.won);
        assertEq(p.returnBps, 1000);
        assertEq(ledger.winCount(), 1);
        assertEq(ledger.sumReturnBps(), 1000);
    }

    function test_reveal_downWinsPositiveReturn() public {
        (uint256 id, uint80 s, uint80 e) = _cycle(2, 100e8, 90e8);
        _reveal(id, 2, s, e);
        assertTrue(ledger.getPrediction(id).won);
        assertEq(ledger.sumReturnBps(), 1000);
    }

    function test_reveal_wrongDirectionLoses() public {
        (uint256 id, uint80 s, uint80 e) = _cycle(1, 100e8, 90e8);
        _reveal(id, 1, s, e);
        assertFalse(ledger.getPrediction(id).won);
        assertEq(ledger.sumReturnBps(), -1000);
    }

    function test_reveal_flatLoses() public {
        (uint256 id, uint80 s, uint80 e) = _cycle(1, 100e8, 100e8);
        _reveal(id, 1, s, e);
        assertFalse(ledger.getPrediction(id).won);
    }

    function test_reveal_minMoveBpsSnapshot() public {
        vm.prank(owner);
        ledger.setMinMoveBps(500);
        (uint256 id, uint80 s, uint80 e) = _cycle(1, 100e8, 103e8); // +300 bps < 500
        vm.prank(owner);
        ledger.setMinMoveBps(0); // tidak mengubah prediksi lama
        _reveal(id, 1, s, e);
        assertFalse(ledger.getPrediction(id).won);
    }

    function test_reveal_onlyAgent() public {
        (uint256 id, uint80 s, uint80 e) = _cycle(1, 100e8, 110e8);
        vm.expectRevert(NexaLedger.NotAgent.selector);
        ledger.reveal(id, TEXT, asset, 1, HORIZON, SALT, s, e);
    }

    function test_reveal_hashMismatch() public {
        (uint256 id, uint80 s, uint80 e) = _cycle(1, 100e8, 110e8);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.HashMismatch.selector);
        ledger.reveal(id, TEXT, asset, 2, HORIZON, SALT, s, e); // arah diganti
    }

    function test_reveal_notMatured() public {
        feed.push(100e8, block.timestamp - 10);
        vm.prank(agent);
        uint256 id = ledger.commit(_hash(1));
        vm.warp(block.timestamp + HORIZON - 1);
        uint80 e = feed.push(110e8, block.timestamp);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.NotMatured.selector);
        ledger.reveal(id, TEXT, asset, 1, HORIZON, SALT, 1, e);
    }

    function test_reveal_twiceReverts() public {
        (uint256 id, uint80 s, uint80 e) = _cycle(1, 100e8, 110e8);
        _reveal(id, 1, s, e);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.AlreadyRevealed.selector);
        ledger.reveal(id, TEXT, asset, 1, HORIZON, SALT, s, e);
    }

    function test_reveal_unknownPrediction() public {
        vm.prank(agent);
        vm.expectRevert(NexaLedger.UnknownPrediction.selector);
        ledger.reveal(99, TEXT, asset, 1, HORIZON, SALT, 1, 2);
    }

    function test_reveal_noFeed() public {
        address other = makeAddr("other");
        bytes32 h = ledger.computeHash(TEXT, other, 1, HORIZON, SALT);
        vm.prank(agent);
        uint256 id = ledger.commit(h);
        vm.warp(block.timestamp + HORIZON);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.NoFeed.selector);
        ledger.reveal(id, TEXT, other, 1, HORIZON, SALT, 1, 2);
    }

    function test_reveal_rejectsStartRoundNotLatestBeforeCommit() public {
        uint80 early = feed.push(50e8, block.timestamp - 100); // round lama yang menguntungkan
        feed.push(100e8, block.timestamp - 10);
        vm.prank(agent);
        uint256 id = ledger.commit(_hash(1));
        vm.warp(block.timestamp + HORIZON + 1);
        uint80 e = feed.push(110e8, block.timestamp - 5);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.InvalidStartRound.selector);
        ledger.reveal(id, TEXT, asset, 1, HORIZON, SALT, early, e);
    }

    function test_reveal_rejectsStartRoundAfterCommit() public {
        feed.push(100e8, block.timestamp - 10);
        vm.prank(agent);
        uint256 id = ledger.commit(_hash(1));
        uint80 later = feed.push(10e8, block.timestamp + 1);
        vm.warp(block.timestamp + HORIZON + 1);
        uint80 e = feed.push(110e8, block.timestamp - 5);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.InvalidStartRound.selector);
        ledger.reveal(id, TEXT, asset, 1, HORIZON, SALT, later, e);
    }

    function test_reveal_rejectsEndRoundNotFirstAfterMaturity() public {
        uint80 s = feed.push(100e8, block.timestamp - 10);
        vm.prank(agent);
        uint256 id = ledger.commit(_hash(1));
        vm.warp(block.timestamp + HORIZON + 1);
        feed.push(105e8, block.timestamp - 1); // round pertama setelah jatuh tempo
        uint80 e2 = feed.push(200e8, block.timestamp); // cherry-pick
        vm.prank(agent);
        vm.expectRevert(NexaLedger.InvalidEndRound.selector);
        ledger.reveal(id, TEXT, asset, 1, HORIZON, SALT, s, e2);
    }

    function test_reveal_rejectsEndRoundBeforeMaturity() public {
        uint80 s = feed.push(100e8, block.timestamp - 10);
        vm.prank(agent);
        uint256 id = ledger.commit(_hash(1));
        uint80 early = feed.push(500e8, block.timestamp + 1 days);
        vm.warp(block.timestamp + HORIZON + 1);
        feed.push(110e8, block.timestamp - 5);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.InvalidEndRound.selector);
        ledger.reveal(id, TEXT, asset, 1, HORIZON, SALT, s, early);
    }

    // ----------------------------------------------------------------- admin

    function test_admin_onlyOwner() public {
        vm.startPrank(agent);
        vm.expectRevert();
        ledger.setAgent(agent);
        vm.expectRevert();
        ledger.setFeed(asset, AggregatorV3Interface(address(0)));
        vm.expectRevert();
        ledger.setMinMoveBps(1);
        vm.stopPrank();
    }

    function test_setAgent_rotatesAccess() public {
        address newAgent = makeAddr("newAgent");
        vm.prank(owner);
        ledger.setAgent(newAgent);
        vm.prank(agent);
        vm.expectRevert(NexaLedger.NotAgent.selector);
        ledger.commit(_hash(1));
        vm.prank(newAgent);
        ledger.commit(_hash(1));
    }

    function test_renounceOwnership_disabled() public {
        vm.prank(owner);
        vm.expectRevert(NexaLedger.RenounceDisabled.selector);
        ledger.renounceOwnership();
        assertEq(ledger.owner(), owner);
    }

    function test_constructor_zeroAgentReverts() public {
        vm.expectRevert(NexaLedger.ZeroAddress.selector);
        new NexaLedger(owner, address(0));
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_hashBindsEveryField(string calldata text, address a, uint8 dir, uint32 h, bytes32 salt) public view {
        bytes32 base = ledger.computeHash(text, a, dir, h, salt);
        assertEq(base, keccak256(abi.encode(text, a, dir, h, salt)));
        assertTrue(base != ledger.computeHash(text, a, dir, h, ~salt));
        unchecked {
            assertTrue(base != ledger.computeHash(text, a, dir, h + 1, salt));
            assertTrue(base != ledger.computeHash(text, a, dir + 1, h, salt));
        }
    }

    function testFuzz_scoring(uint96 startPx, uint96 endPx, uint8 dirSeed, uint16 minMove) public {
        startPx = uint96(bound(startPx, 1e6, type(uint96).max));
        endPx = uint96(bound(endPx, 1, type(uint96).max));
        uint8 dir = dirSeed % 2 == 0 ? 1 : 2;
        vm.prank(owner);
        ledger.setMinMoveBps(minMove);

        (uint256 id, uint80 s, uint80 e) = _cycle(dir, int256(uint256(startPx)), int256(uint256(endPx)));
        _reveal(id, dir, s, e);

        NexaLedger.Prediction memory p = ledger.getPrediction(id);
        int256 ret = ((int256(uint256(endPx)) - int256(uint256(startPx))) * 10_000) / int256(uint256(startPx));
        assertEq(p.returnBps, ret);
        bool expected = dir == 1 ? (ret > 0 && ret >= int256(uint256(minMove))) : (ret < 0 && -ret >= int256(uint256(minMove)));
        assertEq(p.won, expected);
        assertEq(ledger.winCount(), expected ? 1 : 0);
    }
}
