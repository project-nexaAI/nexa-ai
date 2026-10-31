// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPairAssetHolder {
    function pairAsset() external view returns (IERC20);
}

/// @title FeeSplitter
/// @notice Membagi seluruh saldo aset pasangan: sebagian ke BurnVault, sisanya ke treasury.
/// @dev Tanpa owner, tanpa setter, tanpa upgrade. Rasio adalah `constant` di kontrak turunan.
///      Semua alamat immutable: untuk mengganti treasury, deploy ulang lalu alihkan penerima fee Pons.
///      `distribute()` tanpa izin: siapa pun boleh memicu, hasilnya selalu sama.
abstract contract FeeSplitter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;

    IERC20 public immutable pairAsset;
    address public immutable burnVault;
    address public immutable treasury;

    event Distributed(address indexed caller, uint256 total, uint256 toBurnVault, uint256 toTreasury);

    error ZeroAddress();
    error InvalidBurnVault();
    error PairAssetMismatch();
    error InvalidTreasury();
    error NothingToDistribute();

    constructor(IERC20 pairAsset_, address burnVault_, address treasury_) {
        if (address(pairAsset_) == address(0) || burnVault_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        // Bagian burn tidak boleh mendarat di vault yang tidak bisa memakainya (vault tidak punya jalan keluar).
        if (burnVault_.code.length == 0) revert InvalidBurnVault();
        if (address(IPairAssetHolder(burnVault_).pairAsset()) != address(pairAsset_)) revert PairAssetMismatch();
        if (treasury_ == burnVault_ || treasury_ == address(this)) revert InvalidTreasury();
        pairAsset = pairAsset_;
        burnVault = burnVault_;
        treasury = treasury_;
    }

    /// @notice Bagian yang dibakar dalam basis poin; di-hardcode di kontrak turunan.
    function burnBps() public pure virtual returns (uint256);

    function distribute() external nonReentrant returns (uint256 toBurnVault, uint256 toTreasury) {
        uint256 total = pairAsset.balanceOf(address(this));
        if (total == 0) revert NothingToDistribute();

        toBurnVault = (total * burnBps()) / BPS;
        toTreasury = total - toBurnVault; // sisa pembulatan masuk treasury; tidak ada debu tertinggal

        if (toBurnVault > 0) pairAsset.safeTransfer(burnVault, toBurnVault);
        if (toTreasury > 0) pairAsset.safeTransfer(treasury, toTreasury);
        emit Distributed(msg.sender, total, toBurnVault, toTreasury);
    }
}

/// @notice Creator fee dari trading $NEXA di Pons: 30% BurnVault, 70% treasury (biaya AI, X API, marketing).
contract CreatorFeeSplitter is FeeSplitter {
    uint256 public constant CREATOR_FEE_BURN_BPS = 3_000;

    constructor(IERC20 pairAsset_, address burnVault_, address treasury_) FeeSplitter(pairAsset_, burnVault_, treasury_) {}

    function burnBps() public pure override returns (uint256) {
        return CREATOR_FEE_BURN_BPS;
    }
}

/// @notice Protocol fee (Pro, API, kredit Ask NEXA, laporan sponsor): 20% BurnVault, 80% operasional.
contract ProtocolFeeSplitter is FeeSplitter {
    uint256 public constant PROTOCOL_FEE_BURN_BPS = 2_000;

    constructor(IERC20 pairAsset_, address burnVault_, address treasury_) FeeSplitter(pairAsset_, burnVault_, treasury_) {}

    function burnBps() public pure override returns (uint256) {
        return PROTOCOL_FEE_BURN_BPS;
    }
}
