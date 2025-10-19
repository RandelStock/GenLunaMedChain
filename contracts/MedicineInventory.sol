// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// Medicine Inventory Hash Storage
/// Stores only cryptographic hashes of medicine, stocks, receipts, and removal records
/// All actual data is stored off-chain (e.g., PostgreSQL database)
contract MedicineInventory is AccessControl {
    bytes32 public constant STAFF_ROLE = keccak256("STAFF_ROLE");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // =========================
    // STRUCTS
    // =========================
    struct MedicineHash {
        bytes32 dataHash;
        address addedBy;
        uint256 timestamp;
        bool exists;
    }

    struct StockHash {
        bytes32 dataHash;
        address addedBy;
        uint256 timestamp;
        bool exists;
    }

    struct ReceiptHash {
        bytes32 dataHash;
        address addedBy;
        uint256 timestamp;
        bool exists;
    }

    struct RemovalHash {
        bytes32 dataHash;
        address removedBy;
        uint256 timestamp;
        bool exists;
    }

    // =========================
    // STORAGE
    // =========================
    mapping(uint256 => MedicineHash) public medicineHashes;
    mapping(uint256 => StockHash) public stockHashes;
    mapping(uint256 => ReceiptHash) public receiptHashes;
    mapping(uint256 => RemovalHash) public removalHashes;

    uint256 public medicineCount;
    uint256 public stockCount;
    uint256 public receiptCount;
    uint256 public removalCount;

    address[] public staffMembers;
    mapping(address => bool) public isStaffMember;

    // =========================
    // EVENTS
    // =========================
    event MedicineHashStored(uint256 indexed medicineId, bytes32 dataHash, address indexed addedBy, uint256 timestamp);
    event MedicineHashUpdated(uint256 indexed medicineId, bytes32 oldHash, bytes32 newHash, address indexed updatedBy, uint256 timestamp);
    event MedicineHashDeleted(uint256 indexed medicineId, address indexed deletedBy, uint256 timestamp);

    event StockHashStored(uint256 indexed stockId, bytes32 dataHash, address indexed addedBy, uint256 timestamp);
    event StockHashUpdated(uint256 indexed stockId, bytes32 oldHash, bytes32 newHash, address indexed updatedBy, uint256 timestamp);
    event StockHashDeleted(uint256 indexed stockId, address indexed deletedBy, uint256 timestamp);

    event ReceiptHashStored(uint256 indexed receiptId, bytes32 dataHash, address indexed addedBy, uint256 timestamp);
    event ReceiptHashUpdated(uint256 indexed receiptId, bytes32 oldHash, bytes32 newHash, address indexed updatedBy, uint256 timestamp);
    event ReceiptHashDeleted(uint256 indexed receiptId, address indexed deletedBy, uint256 timestamp);

    event RemovalHashStored(uint256 indexed removalId, bytes32 dataHash, address indexed removedBy, uint256 timestamp);
    event RemovalHashUpdated(uint256 indexed removalId, bytes32 oldHash, bytes32 newHash, address indexed updatedBy, uint256 timestamp);
    event RemovalHashDeleted(uint256 indexed removalId, address indexed deletedBy, uint256 timestamp);

    event StaffRoleGranted(address indexed staff, address indexed admin, uint256 timestamp);
    event StaffRoleRevoked(address indexed staff, address indexed admin, uint256 timestamp);

    // =========================
    // MODIFIERS
    // =========================
    modifier onlyStaffOrAdmin() {
        require(
            hasRole(STAFF_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "AccessControl: caller must have staff or admin role"
        );
        _;
    }

    // =========================
    // MEDICINE FUNCTIONS (Staff or Admin)
    // =========================
    function storeMedicineHash(uint256 _medicineId, bytes32 _dataHash) public onlyStaffOrAdmin {
        require(_dataHash != bytes32(0), "Invalid hash");
        require(!medicineHashes[_medicineId].exists, "Medicine hash already exists");

        medicineHashes[_medicineId] = MedicineHash({
            dataHash: _dataHash,
            addedBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        medicineCount++;
        emit MedicineHashStored(_medicineId, _dataHash, msg.sender, block.timestamp);
    }

    function updateMedicineHash(uint256 _medicineId, bytes32 _newDataHash) public onlyStaffOrAdmin {
        require(medicineHashes[_medicineId].exists, "Medicine hash does not exist");
        require(_newDataHash != bytes32(0), "Invalid hash");

        bytes32 oldHash = medicineHashes[_medicineId].dataHash;
        medicineHashes[_medicineId].dataHash = _newDataHash;
        medicineHashes[_medicineId].timestamp = block.timestamp;

        emit MedicineHashUpdated(_medicineId, oldHash, _newDataHash, msg.sender, block.timestamp);
    }

    function deleteMedicineHash(uint256 _medicineId) public onlyStaffOrAdmin {
        require(medicineHashes[_medicineId].exists, "Medicine hash does not exist");
        medicineHashes[_medicineId].exists = false;
        medicineCount--;
        emit MedicineHashDeleted(_medicineId, msg.sender, block.timestamp);
    }

    function getMedicineHash(uint256 _medicineId) public view returns (bytes32, address, uint256, bool) {
        MedicineHash memory mh = medicineHashes[_medicineId];
        return (mh.dataHash, mh.addedBy, mh.timestamp, mh.exists);
    }

    function verifyMedicineHash(uint256 _medicineId, bytes32 _dataHash) public view returns (bool) {
        require(medicineHashes[_medicineId].exists, "Medicine hash does not exist");
        return medicineHashes[_medicineId].dataHash == _dataHash;
    }

    // =========================
    // STOCK FUNCTIONS (Staff or Admin) - NEW
    // =========================
    function storeStockHash(uint256 _stockId, bytes32 _dataHash) public onlyStaffOrAdmin {
        require(_dataHash != bytes32(0), "Invalid hash");
        require(!stockHashes[_stockId].exists, "Stock hash already exists");

        stockHashes[_stockId] = StockHash({
            dataHash: _dataHash,
            addedBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        stockCount++;
        emit StockHashStored(_stockId, _dataHash, msg.sender, block.timestamp);
    }

    function updateStockHash(uint256 _stockId, bytes32 _newDataHash) public onlyStaffOrAdmin {
        require(stockHashes[_stockId].exists, "Stock hash does not exist");
        require(_newDataHash != bytes32(0), "Invalid hash");

        bytes32 oldHash = stockHashes[_stockId].dataHash;
        stockHashes[_stockId].dataHash = _newDataHash;
        stockHashes[_stockId].timestamp = block.timestamp;

        emit StockHashUpdated(_stockId, oldHash, _newDataHash, msg.sender, block.timestamp);
    }

    function deleteStockHash(uint256 _stockId) public onlyStaffOrAdmin {
        require(stockHashes[_stockId].exists, "Stock hash does not exist");
        stockHashes[_stockId].exists = false;
        stockCount--;
        emit StockHashDeleted(_stockId, msg.sender, block.timestamp);
    }

    function getStockHash(uint256 _stockId) public view returns (bytes32, address, uint256, bool) {
        StockHash memory sh = stockHashes[_stockId];
        return (sh.dataHash, sh.addedBy, sh.timestamp, sh.exists);
    }

    function verifyStockHash(uint256 _stockId, bytes32 _dataHash) public view returns (bool) {
        require(stockHashes[_stockId].exists, "Stock hash does not exist");
        return stockHashes[_stockId].dataHash == _dataHash;
    }

    // =========================
    // RECEIPT FUNCTIONS (Staff or Admin)
    // =========================
    function storeReceiptHash(uint256 _receiptId, bytes32 _dataHash) public onlyStaffOrAdmin {
        require(_dataHash != bytes32(0), "Invalid hash");
        require(!receiptHashes[_receiptId].exists, "Receipt hash already exists");

        receiptHashes[_receiptId] = ReceiptHash({
            dataHash: _dataHash,
            addedBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        receiptCount++;
        emit ReceiptHashStored(_receiptId, _dataHash, msg.sender, block.timestamp);
    }

    function updateReceiptHash(uint256 _receiptId, bytes32 _newDataHash) public onlyStaffOrAdmin {
        require(receiptHashes[_receiptId].exists, "Receipt hash does not exist");
        require(_newDataHash != bytes32(0), "Invalid hash");

        bytes32 oldHash = receiptHashes[_receiptId].dataHash;
        receiptHashes[_receiptId].dataHash = _newDataHash;
        receiptHashes[_receiptId].timestamp = block.timestamp;

        emit ReceiptHashUpdated(_receiptId, oldHash, _newDataHash, msg.sender, block.timestamp);
    }

    function deleteReceiptHash(uint256 _receiptId) public onlyStaffOrAdmin {
        require(receiptHashes[_receiptId].exists, "Receipt hash does not exist");
        receiptHashes[_receiptId].exists = false;
        receiptCount--;
        emit ReceiptHashDeleted(_receiptId, msg.sender, block.timestamp);
    }

    function getReceiptHash(uint256 _receiptId) public view returns (bytes32, address, uint256, bool) {
        ReceiptHash memory rh = receiptHashes[_receiptId];
        return (rh.dataHash, rh.addedBy, rh.timestamp, rh.exists);
    }

    function verifyReceiptHash(uint256 _receiptId, bytes32 _dataHash) public view returns (bool) {
        require(receiptHashes[_receiptId].exists, "Receipt hash does not exist");
        return receiptHashes[_receiptId].dataHash == _dataHash;
    }

    // =========================
    // REMOVAL FUNCTIONS (Staff or Admin)
    // =========================
    function storeRemovalHash(uint256 _removalId, bytes32 _dataHash) public onlyStaffOrAdmin {
        require(_dataHash != bytes32(0), "Invalid hash");
        require(!removalHashes[_removalId].exists, "Removal hash already exists");

        removalHashes[_removalId] = RemovalHash({
            dataHash: _dataHash,
            removedBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        removalCount++;
        emit RemovalHashStored(_removalId, _dataHash, msg.sender, block.timestamp);
    }

    function updateRemovalHash(uint256 _removalId, bytes32 _newDataHash) public onlyStaffOrAdmin {
        require(removalHashes[_removalId].exists, "Removal hash does not exist");
        require(_newDataHash != bytes32(0), "Invalid hash");

        bytes32 oldHash = removalHashes[_removalId].dataHash;
        removalHashes[_removalId].dataHash = _newDataHash;
        removalHashes[_removalId].timestamp = block.timestamp;

        emit RemovalHashUpdated(_removalId, oldHash, _newDataHash, msg.sender, block.timestamp);
    }

    function deleteRemovalHash(uint256 _removalId) public onlyStaffOrAdmin {
        require(removalHashes[_removalId].exists, "Removal hash does not exist");
        removalHashes[_removalId].exists = false;
        removalCount--;
        emit RemovalHashDeleted(_removalId, msg.sender, block.timestamp);
    }

    function getRemovalHash(uint256 _removalId) public view returns (bytes32, address, uint256, bool) {
        RemovalHash memory rh = removalHashes[_removalId];
        return (rh.dataHash, rh.removedBy, rh.timestamp, rh.exists);
    }

    function verifyRemovalHash(uint256 _removalId, bytes32 _dataHash) public view returns (bool) {
        require(removalHashes[_removalId].exists, "Removal hash does not exist");
        return removalHashes[_removalId].dataHash == _dataHash;
    }

    // =========================
    // STAFF MANAGEMENT (Admin only)
    // =========================
    function grantStaffRole(address staff) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(STAFF_ROLE, staff);

        if (!isStaffMember[staff]) {
            staffMembers.push(staff);
            isStaffMember[staff] = true;
        }

        emit StaffRoleGranted(staff, msg.sender, block.timestamp);
    }

    function revokeStaffRole(address staff) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(STAFF_ROLE, staff);

        if (isStaffMember[staff]) {
            for (uint i = 0; i < staffMembers.length; i++) {
                if (staffMembers[i] == staff) {
                    staffMembers[i] = staffMembers[staffMembers.length - 1];
                    staffMembers.pop();
                    break;
                }
            }
            isStaffMember[staff] = false;
        }

        emit StaffRoleRevoked(staff, msg.sender, block.timestamp);
    }

    // =========================
    // VIEW FUNCTIONS
    // =========================
    function getStaffMembers() public view returns (address[] memory) {
        return staffMembers;
    }

    function getStaffCount() public view returns (uint256) {
        return staffMembers.length;
    }

    function getMedicineCount() public view returns (uint256) {
        return medicineCount;
    }

    function getStockCount() public view returns (uint256) {
        return stockCount;
    }

    function getReceiptCount() public view returns (uint256) {
        return receiptCount;
    }

    function getRemovalCount() public view returns (uint256) {
        return removalCount;
    }
}