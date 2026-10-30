// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapper} from "./interfaces/ISwapper.sol";

/// @title BurnVault
/// @notice Menampung aset pasangan dari splitter, menukarnya menjadi $NEXA, lalu membakarnya.
/// @dev TIDAK ADA jalan menarik dana. Satu-satunya jalan keluar bagi aset pasangan adalah `burn()`, yang hanya
///      berhasil bila vault menerima >= `minNexaOut` $NEXA (> 0) sebagai gantinya, dan seluruh $NEXA di vault
///      langsung dikirim ke alamat mati. Tidak ada fungsi transfer/rescue/sweep, tidak ada penerima ETH.
///
///      Owner hanya dapat: mengisi alamat $NEXA satu kali, mengganti keeper, dan mengganti swapper lewat timelock
///      `SWAPPER_DELAY`. Risiko yang diketahui (lihat docs/audit): swapper jahat atau keeper dengan `minNexaOut`
///      terlalu rendah dapat membuat aset ditukar pada harga buruk (nilai bocor ke pihak lain), tetapi tidak dapat
///      memindahkan aset ke alamat sembarang.
contract BurnVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant SWAPPER_DELAY = 3 days;

    IERC20 public immutable pairAsset;
    IERC20 public nexa;
    address public keeper;
    ISwapper public swapper;
    ISwapper public pendingSwapper;
    uint256 public pendingSwapperEta;

    uint256 public totalNexaBurned;
    uint256 public totalPairSpent;

    event NexaSet(address indexed nexa);
    event KeeperSet(address indexed keeper);
    event SwapperProposed(address indexed swapper, uint256 eta);
    event SwapperCancelled(address indexed swapper);
    event SwapperSet(address indexed swapper);
    event Burned(address indexed caller, uint256 pairSpent, uint256 nexaBurned);

    error ZeroAddress();
    error RenounceDisabled();
    error NotKeeper();
    error NexaAlreadySet();
    error NexaNotSet();
    error InvalidNexa();
    error SwapperNotSet();
    error NoPendingSwapper();
    error SwapperTimelock(uint256 eta);
    error ZeroMinOut();
    error NothingToBurn();
    error InsufficientOutput(uint256 received, uint256 minOut);

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(IERC20 pairAsset_, address initialOwner, address initialKeeper) Ownable(initialOwner) {
        if (address(pairAsset_) == address(0) || initialKeeper == address(0)) revert ZeroAddress();
        pairAsset = pairAsset_;
        keeper = initialKeeper;
        emit KeeperSet(initialKeeper);
    }

    // ---------------------------------------------------------------- owner

    /// @dev Dinonaktifkan: tanpa owner, $NEXA/swapper tidak bisa diisi atau diganti dan dana bisa terkunci selamanya.
    function renounceOwnership() public pure override {
        revert RenounceDisabled();
    }

    /// @notice Alamat $NEXA baru diketahui setelah launch di Pons; dapat diisi tepat satu kali.
    function setNexa(IERC20 nexa_) external onlyOwner {
        if (address(nexa) != address(0)) revert NexaAlreadySet();
        // Harus kontrak (bukan EOA/salah ketik): pengisian hanya sekali, salah alamat mengunci vault.
        if (address(nexa_).code.length == 0 || address(nexa_) == address(pairAsset)) revert InvalidNexa();
        nexa = nexa_;
        emit NexaSet(address(nexa_));
    }

    function setKeeper(address newKeeper) external onlyOwner {
        if (newKeeper == address(0)) revert ZeroAddress();
        keeper = newKeeper;
        emit KeeperSet(newKeeper);
    }

    function proposeSwapper(ISwapper newSwapper) external onlyOwner {
        if (address(newSwapper) == address(0)) revert ZeroAddress();
        pendingSwapper = newSwapper;
        pendingSwapperEta = block.timestamp + SWAPPER_DELAY;
        emit SwapperProposed(address(newSwapper), pendingSwapperEta);
    }

    function cancelSwapper() external onlyOwner {
        if (address(pendingSwapper) == address(0)) revert NoPendingSwapper();
        emit SwapperCancelled(address(pendingSwapper));
        delete pendingSwapper;
        delete pendingSwapperEta;
    }

    function executeSwapper() external onlyOwner {
        if (address(pendingSwapper) == address(0)) revert NoPendingSwapper();
        if (block.timestamp < pendingSwapperEta) revert SwapperTimelock(pendingSwapperEta);
        swapper = pendingSwapper;
        delete pendingSwapper;
        delete pendingSwapperEta;
        emit SwapperSet(address(swapper));
    }

    // ----------------------------------------------------------------- burn

    /// @notice Tukar seluruh aset pasangan menjadi $NEXA lalu bakar semua $NEXA di vault.
    /// @param minNexaOut batas bawah $NEXA yang harus diterima (dihitung keeper di luar chain; wajib > 0).
    function burn(uint256 minNexaOut) external onlyKeeper nonReentrant returns (uint256 burned) {
        IERC20 token = nexa;
        ISwapper s = swapper;
        if (address(token) == address(0)) revert NexaNotSet();
        if (address(s) == address(0)) revert SwapperNotSet();
        if (minNexaOut == 0) revert ZeroMinOut();

        uint256 amountIn = pairAsset.balanceOf(address(this));
        if (amountIn == 0) revert NothingToBurn();

        uint256 nexaBefore = token.balanceOf(address(this));
        pairAsset.forceApprove(address(s), amountIn);
        s.swapExactInput(address(pairAsset), address(token), amountIn, minNexaOut, address(this));
        pairAsset.forceApprove(address(s), 0);

        // Diperiksa dari saldo nyata, bukan dari nilai kembalian swapper.
        uint256 nexaAfter = token.balanceOf(address(this));
        uint256 received = nexaAfter - nexaBefore;
        if (received < minNexaOut) revert InsufficientOutput(received, minNexaOut);

        uint256 pairLeft = pairAsset.balanceOf(address(this));
        uint256 spent = amountIn > pairLeft ? amountIn - pairLeft : 0; // swapper yang mengembalikan aset tidak boleh menggagalkan burn
        totalPairSpent += spent;
        burned = _burnHeld(token);
        emit Burned(msg.sender, spent, burned);
    }

    /// @notice Bakar $NEXA yang sudah ada di vault (mis. dikirim langsung). Tanpa izin, tanpa penukaran.
    function burnHeld() external nonReentrant returns (uint256 burned) {
        IERC20 token = nexa;
        if (address(token) == address(0)) revert NexaNotSet();
        burned = _burnHeld(token);
        if (burned == 0) revert NothingToBurn();
        emit Burned(msg.sender, 0, burned);
    }

    function _burnHeld(IERC20 token) private returns (uint256 amount) {
        amount = token.balanceOf(address(this));
        if (amount > 0) {
            totalNexaBurned += amount;
            token.safeTransfer(DEAD, amount);
        }
    }
}
