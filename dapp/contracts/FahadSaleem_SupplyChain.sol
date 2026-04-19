// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FahadSaleem_SupplyChain
 * @author Fahad Saleem
 * @notice A decentralized supply chain management system on Polygon
 * @dev Tracks products from Manufacturer → Distributor → Retailer → Customer
 */
contract FahadSaleem_SupplyChain {

    // ─── Enums ────────────────────────────────────────────────────────────────

    enum Role { None, Manufacturer, Distributor, Retailer, Customer }

    enum ProductStatus {
        Manufactured,
        SentToDistributor,
        ReceivedByDistributor,
        SentToRetailer,
        ReceivedByRetailer,
        SoldToCustomer,
        Delivered
    }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Product {
        uint256 id;
        string  name;
        string  description;
        address currentOwner;
        ProductStatus status;
        uint256 createdAt;
        bool    exists;
    }

    struct HistoryEntry {
        address actor;
        Role    actorRole;
        ProductStatus status;
        uint256 timestamp;
        string  note;
    }

    struct Participant {
        address wallet;
        Role    role;
        string  name;
        bool    registered;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    uint256 private _productCounter;

    mapping(uint256 => Product)         public products;
    mapping(uint256 => HistoryEntry[])  public productHistory;
    mapping(address => Participant)     public participants;

    uint256[] public allProductIds;

    // ─── Events ───────────────────────────────────────────────────────────────

    event ParticipantRegistered(address indexed wallet, Role role, string name);
    event ProductRegistered(uint256 indexed productId, string name, address manufacturer);
    event OwnershipTransferred(
        uint256 indexed productId,
        address indexed from,
        address indexed to,
        ProductStatus newStatus
    );

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "SC: Not contract owner");
        _;
    }

    modifier onlyRole(Role _role) {
        require(participants[msg.sender].role == _role, "SC: Unauthorized role");
        _;
    }

    modifier productExists(uint256 _id) {
        require(products[_id].exists, "SC: Product does not exist");
        _;
    }

    modifier onlyCurrentOwner(uint256 _id) {
        require(products[_id].currentOwner == msg.sender, "SC: Not product owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        participants[msg.sender] = Participant({
            wallet: msg.sender,
            role: Role.Manufacturer,
            name: "Fahad Saleem",
            registered: true
        });
        emit ParticipantRegistered(msg.sender, Role.Manufacturer, "Fahad Saleem");
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    /**
     * @notice Register a participant with a role
     * @param _wallet Address of the participant
     * @param _role   Role to assign (1=Manufacturer, 2=Distributor, 3=Retailer, 4=Customer)
     * @param _name   Human-readable name
     */
    function registerParticipant(
        address _wallet,
        Role _role,
        string calldata _name
    ) external onlyOwner {
        require(_wallet != address(0), "SC: Zero address");
        require(_role != Role.None, "SC: Invalid role");
        require(!participants[_wallet].registered, "SC: Already registered");

        participants[_wallet] = Participant({
            wallet: _wallet,
            role: _role,
            name: _name,
            registered: true
        });

        emit ParticipantRegistered(_wallet, _role, _name);
    }

    // ─── Manufacturer Functions ───────────────────────────────────────────────

    /**
     * @notice Register a new product (Manufacturer only)
     * @param _name        Product name
     * @param _description Product description
     */
    function registerProduct(
        string calldata _name,
        string calldata _description
    ) external onlyRole(Role.Manufacturer) returns (uint256) {
        require(bytes(_name).length > 0, "SC: Name required");

        _productCounter++;
        uint256 newId = _productCounter;

        products[newId] = Product({
            id: newId,
            name: _name,
            description: _description,
            currentOwner: msg.sender,
            status: ProductStatus.Manufactured,
            createdAt: block.timestamp,
            exists: true
        });

        allProductIds.push(newId);

        productHistory[newId].push(HistoryEntry({
            actor: msg.sender,
            actorRole: Role.Manufacturer,
            status: ProductStatus.Manufactured,
            timestamp: block.timestamp,
            note: "Product manufactured and registered"
        }));

        emit ProductRegistered(newId, _name, msg.sender);
        return newId;
    }

    /**
     * @notice Manufacturer ships product to a distributor
     */
    function shipToDistributor(
        uint256 _productId,
        address _distributor
    )
        external
        onlyRole(Role.Manufacturer)
        productExists(_productId)
        onlyCurrentOwner(_productId)
    {
        require(
            participants[_distributor].role == Role.Distributor,
            "SC: Target is not a Distributor"
        );
        require(
            products[_productId].status == ProductStatus.Manufactured,
            "SC: Product not in Manufactured state"
        );

        _transferProduct(_productId, _distributor, ProductStatus.SentToDistributor,
            "Shipped from Manufacturer to Distributor");
    }

    // ─── Distributor Functions ────────────────────────────────────────────────

    /**
     * @notice Distributor confirms receipt of product
     */
    function receiveFromManufacturer(uint256 _productId)
        external
        onlyRole(Role.Distributor)
        productExists(_productId)
        onlyCurrentOwner(_productId)
    {
        require(
            products[_productId].status == ProductStatus.SentToDistributor,
            "SC: Product not sent to distributor"
        );

        products[_productId].status = ProductStatus.ReceivedByDistributor;

        productHistory[_productId].push(HistoryEntry({
            actor: msg.sender,
            actorRole: Role.Distributor,
            status: ProductStatus.ReceivedByDistributor,
            timestamp: block.timestamp,
            note: "Received by Distributor"
        }));
    }

    /**
     * @notice Distributor ships product to a retailer
     */
    function shipToRetailer(
        uint256 _productId,
        address _retailer
    )
        external
        onlyRole(Role.Distributor)
        productExists(_productId)
        onlyCurrentOwner(_productId)
    {
        require(
            participants[_retailer].role == Role.Retailer,
            "SC: Target is not a Retailer"
        );
        require(
            products[_productId].status == ProductStatus.ReceivedByDistributor,
            "SC: Product not received by distributor yet"
        );

        _transferProduct(_productId, _retailer, ProductStatus.SentToRetailer,
            "Shipped from Distributor to Retailer");
    }

    // ─── Retailer Functions ───────────────────────────────────────────────────

    /**
     * @notice Retailer confirms receipt of product
     */
    function receiveFromDistributor(uint256 _productId)
        external
        onlyRole(Role.Retailer)
        productExists(_productId)
        onlyCurrentOwner(_productId)
    {
        require(
            products[_productId].status == ProductStatus.SentToRetailer,
            "SC: Product not sent to retailer"
        );

        products[_productId].status = ProductStatus.ReceivedByRetailer;

        productHistory[_productId].push(HistoryEntry({
            actor: msg.sender,
            actorRole: Role.Retailer,
            status: ProductStatus.ReceivedByRetailer,
            timestamp: block.timestamp,
            note: "Received by Retailer"
        }));
    }

    /**
     * @notice Retailer sells product to a customer
     */
    function sellToCustomer(
        uint256 _productId,
        address _customer
    )
        external
        onlyRole(Role.Retailer)
        productExists(_productId)
        onlyCurrentOwner(_productId)
    {
        require(
            participants[_customer].role == Role.Customer,
            "SC: Target is not a Customer"
        );
        require(
            products[_productId].status == ProductStatus.ReceivedByRetailer,
            "SC: Product not received by retailer yet"
        );

        _transferProduct(_productId, _customer, ProductStatus.SoldToCustomer,
            "Sold to Customer by Retailer");
    }

    // ─── Customer Functions ───────────────────────────────────────────────────

    /**
     * @notice Customer confirms delivery of product
     */
    function confirmDelivery(uint256 _productId)
        external
        onlyRole(Role.Customer)
        productExists(_productId)
        onlyCurrentOwner(_productId)
    {
        require(
            products[_productId].status == ProductStatus.SoldToCustomer,
            "SC: Product not sold to customer yet"
        );

        products[_productId].status = ProductStatus.Delivered;

        productHistory[_productId].push(HistoryEntry({
            actor: msg.sender,
            actorRole: Role.Customer,
            status: ProductStatus.Delivered,
            timestamp: block.timestamp,
            note: "Delivered and confirmed by Customer"
        }));
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Get full product details
     */
    function getProduct(uint256 _productId)
        external view
        productExists(_productId)
        returns (Product memory)
    {
        return products[_productId];
    }

    /**
     * @notice Get full audit trail for a product
     */
    function getProductHistory(uint256 _productId)
        external view
        productExists(_productId)
        returns (HistoryEntry[] memory)
    {
        return productHistory[_productId];
    }

    /**
     * @notice Get all product IDs
     */
    function getAllProductIds() external view returns (uint256[] memory) {
        return allProductIds;
    }

    /**
     * @notice Get participant info
     */
    function getParticipant(address _wallet)
        external view
        returns (Participant memory)
    {
        return participants[_wallet];
    }

    /**
     * @notice Get total number of products
     */
    function totalProducts() external view returns (uint256) {
        return _productCounter;
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    function _transferProduct(
        uint256 _productId,
        address _to,
        ProductStatus _newStatus,
        string memory _note
    ) internal {
        address from = products[_productId].currentOwner;

        products[_productId].currentOwner = _to;
        products[_productId].status = _newStatus;

        productHistory[_productId].push(HistoryEntry({
            actor: msg.sender,
            actorRole: participants[msg.sender].role,
            status: _newStatus,
            timestamp: block.timestamp,
            note: _note
        }));

        emit OwnershipTransferred(_productId, from, _to, _newStatus);
    }
}
