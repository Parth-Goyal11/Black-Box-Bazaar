// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title EvalMarket — a marketplace for AI model evaluation reports
/// @notice Buyers (agents) pay for evaluation reports they cannot inspect before
///         paying. Sellers (evaluators) stake a bond and commit to a hash of their
///         report at listing time, then reveal the actual report only after payment
///         is escrowed. A challenge window lets buyers dispute bad-faith deliveries
///         before funds release to the seller.
contract EvalMarket {
    // ─────────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Address allowed to resolve disputes. For this demo it is a single
    ///         trusted arbiter (the deployer). This is the project's single
    ///         biggest trust assumption — see README for discussion.
    address public arbiter;

    /// @notice How long, in seconds, a buyer has to dispute after the seller
    ///         reveals the report. Kept short for demo purposes.
    uint256 public constant CHALLENGE_WINDOW = 10 minutes;

    /// @notice Minimum bond a seller must stake to create a listing. Bonded
    ///         capital is what a seller loses if they lose a dispute — this is
    ///         what makes their credibility claims costly to fake.
    uint256 public constant MIN_BOND = 0.001 ether;

    /// @notice Bond a disputer must stake to raise a dispute. Required because
    ///         disputes are open to any third party, not just the buyer —
    ///         without a cost, spam/frivolous disputes would be free to grief
    ///         sellers. Forfeited to the seller if the dispute is rejected,
    ///         returned (plus a bounty share) if it succeeds.
    uint256 public constant DISPUTE_BOND = 0.0005 ether;

    // ─────────────────────────────────────────────────────────────────────
    // Data model
    // ─────────────────────────────────────────────────────────────────────

    enum PurchaseState {
        Paid, // buyer has paid, awaiting seller reveal
        Revealed, // seller has revealed the report, challenge window running
        Disputed, // buyer has raised a dispute, awaiting arbiter
        ReleasedToSeller, // funds released to seller (window expired or dispute lost by buyer)
        RefundedToBuyer // funds refunded to buyer (dispute won by buyer)
    }

    enum EvalCategory {
        JailbreakResistance,
        ToolUseAccuracy,
        HallucinationRate,
        PromptInjectionSusceptibility,
        Other
    }

    struct Listing {
        address payable seller;
        string modelName; // e.g. "gpt-x"
        string modelVersionId; // pinned checkpoint/snapshot, e.g. an API version date or model hash —
        // evals go stale silently when the underlying model is updated, so the
        // listing must commit to the exact version that was actually tested
        EvalCategory evalCategory;
        uint256 price; // price of the report, in wei
        bytes32 reportHash; // keccak256 commitment of the report content, set at listing time
        bytes32 methodologyHash; // keccak256 commitment of the testing methodology/dataset/rubric used,
        // set at listing time so the seller can't retroactively change how the eval was run
        uint256 bond; // seller's staked bond backing this listing
        uint256 validUntil; // listing can no longer be purchased after this timestamp, since an
        // un-reattested eval's relevance decays as the underlying model drifts
        bool active; // false once seller has withdrawn the listing
    }

    struct Purchase {
        uint256 listingId;
        address payable buyer;
        uint256 amountPaid;
        string reportURI; // set on reveal — off-chain pointer (e.g. ipfs://...) to the report
        string methodologyURI; // set on reveal — off-chain pointer to the methodology/dataset/rubric
        uint256 revealTimestamp;
        PurchaseState state;
        address disputer; // whoever called dispute() — may be a third party, not just the buyer
        uint256 disputeBond; // DISPUTE_BOND staked by the disputer, refunded or forfeited on resolution
    }

    struct Reputation {
        uint256 successfulSales; // deliveries that were not successfully disputed
        uint256 disputesLost; // deliveries where the buyer won a dispute
    }

    Listing[] public listings;
    Purchase[] public purchases;
    mapping(address => Reputation) public reputationOf;

    // ─────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        string modelName,
        string modelVersionId,
        EvalCategory evalCategory,
        uint256 price,
        bytes32 reportHash,
        bytes32 methodologyHash,
        uint256 validUntil
    );
    event ListingWithdrawn(uint256 indexed listingId);
    event ListingValidityExtended(uint256 indexed listingId, uint256 newValidUntil);
    event Purchased(uint256 indexed purchaseId, uint256 indexed listingId, address indexed buyer, uint256 amountPaid);
    event Revealed(uint256 indexed purchaseId, string reportURI, string methodologyURI);
    event Disputed(uint256 indexed purchaseId, address indexed disputer, bytes32 reproductionHash, uint256 disputeBond);
    event DisputeResolved(
        uint256 indexed purchaseId,
        bool buyerWon,
        address disputeBondRecipient,
        uint256 disputeBondAmount
    );
    event Released(uint256 indexed purchaseId, address indexed to, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────

    constructor() {
        arbiter = msg.sender;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "not arbiter");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Seller: create & manage listings
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Create a new listing. Seller must stake at least MIN_BOND as
    ///         collateral against a lost dispute. `reportHash` and
    ///         `methodologyHash` are keccak256 commitments computed off-chain —
    ///         the seller cannot change the report or methodology after this
    ///         point without the hash mismatching on reveal.
    function createListing(
        string calldata modelName,
        string calldata modelVersionId,
        EvalCategory evalCategory,
        uint256 price,
        bytes32 reportHash,
        bytes32 methodologyHash,
        uint256 validUntil
    ) external payable returns (uint256 listingId) {
        require(msg.value >= MIN_BOND, "bond too low");
        require(price > 0, "price must be > 0");
        require(validUntil > block.timestamp, "validUntil must be in the future");

        listings.push(
            Listing({
                seller: payable(msg.sender),
                modelName: modelName,
                modelVersionId: modelVersionId,
                evalCategory: evalCategory,
                price: price,
                reportHash: reportHash,
                methodologyHash: methodologyHash,
                bond: msg.value,
                validUntil: validUntil,
                active: true
            })
        );
        listingId = listings.length - 1;

        emit ListingCreated(
            listingId,
            msg.sender,
            modelName,
            modelVersionId,
            evalCategory,
            price,
            reportHash,
            methodologyHash,
            validUntil
        );
    }

    /// @notice Seller can withdraw an untouched listing and reclaim their bond.
    function withdrawListing(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(msg.sender == l.seller, "not seller");
        require(l.active, "already withdrawn");

        l.active = false;
        uint256 bond = l.bond;
        l.bond = 0;
        (bool ok, ) = l.seller.call{ value: bond }("");
        require(ok, "bond refund failed");

        emit ListingWithdrawn(listingId);
    }

    /// @notice Seller re-attests that a listing is still accurate without
    ///         recreating it — e.g. after re-running the eval against the same
    ///         pinned model version and confirming the result still holds.
    function extendValidity(uint256 listingId, uint256 newValidUntil) external {
        Listing storage l = listings[listingId];
        require(msg.sender == l.seller, "not seller");
        require(l.active, "not active");
        require(newValidUntil > l.validUntil, "must extend forward");

        l.validUntil = newValidUntil;
        emit ListingValidityExtended(listingId, newValidUntil);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Buyer: purchase & (later) dispute
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Buyer pays the listed price into escrow. The report itself is
    ///         NOT visible yet — only its hash commitment was public at listing
    ///         time. This is the "cannot inspect before paying" step. A listing
    ///         is single-use: it goes inactive immediately on purchase, so it
    ///         can't be resold out from under the buyer nor bought repeatedly.
    ///         Sellers may not buy their own listing: nothing else stops a
    ///         seller from purchasing, revealing, and releasing their own
    ///         listing to farm free successfulSales — they'd never dispute
    ///         themselves, so it would be a risk-free reputation inflation.
    function purchase(uint256 listingId) external payable returns (uint256 purchaseId) {
        Listing storage l = listings[listingId];
        require(l.active, "listing not active");
        require(block.timestamp <= l.validUntil, "listing expired");
        require(msg.value == l.price, "wrong payment amount");
        require(msg.sender != l.seller, "seller cannot buy own listing");

        purchases.push(
            Purchase({
                listingId: listingId,
                buyer: payable(msg.sender),
                amountPaid: msg.value,
                reportURI: "",
                methodologyURI: "",
                revealTimestamp: 0,
                state: PurchaseState.Paid,
                disputer: address(0),
                disputeBond: 0
            })
        );
        purchaseId = purchases.length - 1;
        l.active = false;

        emit Purchased(purchaseId, listingId, msg.sender, msg.value);
    }

    /// @notice Seller reveals where the report and methodology live (e.g. IPFS
    ///         URIs) once payment is escrowed. Anyone can verify
    ///         keccak256(fetchedContent) matches the listing's reportHash /
    ///         methodologyHash — a mismatch is grounds for an automatic dispute win.
    function reveal(uint256 purchaseId, string calldata reportURI, string calldata methodologyURI) external {
        Purchase storage p = purchases[purchaseId];
        Listing storage l = listings[p.listingId];
        require(msg.sender == l.seller, "not seller");
        require(p.state == PurchaseState.Paid, "wrong state");

        p.reportURI = reportURI;
        p.methodologyURI = methodologyURI;
        p.revealTimestamp = block.timestamp;
        p.state = PurchaseState.Revealed;

        emit Revealed(purchaseId, reportURI, methodologyURI);
    }

    /// @notice Anyone can dispute a revealed report within the challenge window,
    ///         staking DISPUTE_BOND and attaching a hash of their own
    ///         reproduction attempt/transcript as evidence that the claimed
    ///         eval result doesn't hold up — a fraud-proof-style challenge open
    ///         to third parties, not just the buyer, so no one has to wait on
    ///         an inattentive buyer to catch a bad report. The bond is required
    ///         because open third-party disputes would otherwise be free to
    ///         spam: it's refunded (plus a bounty share) if the dispute
    ///         succeeds, forfeited to the seller if it doesn't. The
    ///         reproduction itself isn't verified on-chain — the hash is
    ///         evidence attached to the dispute for the arbiter (and any
    ///         off-chain audit trail) to inspect.
    function dispute(uint256 purchaseId, bytes32 reproductionHash) external payable {
        Purchase storage p = purchases[purchaseId];
        require(p.state == PurchaseState.Revealed, "wrong state");
        require(block.timestamp <= p.revealTimestamp + CHALLENGE_WINDOW, "challenge window closed");
        require(reproductionHash != bytes32(0), "reproduction hash required");
        require(msg.value == DISPUTE_BOND, "wrong dispute bond");

        p.state = PurchaseState.Disputed;
        p.disputer = msg.sender;
        p.disputeBond = msg.value;
        emit Disputed(purchaseId, msg.sender, reproductionHash, msg.value);
    }

    /// @notice After the challenge window passes with no dispute, anyone can
    ///         trigger release of escrowed funds to the seller.
    function releaseIfUnchallenged(uint256 purchaseId) external {
        Purchase storage p = purchases[purchaseId];
        require(p.state == PurchaseState.Revealed, "wrong state");
        require(block.timestamp > p.revealTimestamp + CHALLENGE_WINDOW, "still in window");

        p.state = PurchaseState.ReleasedToSeller;
        Listing storage l = listings[p.listingId];
        reputationOf[l.seller].successfulSales += 1;

        uint256 amount = p.amountPaid;
        (bool ok, ) = l.seller.call{ value: amount }("");
        require(ok, "release failed");

        emit Released(purchaseId, l.seller, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Arbitration
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Arbiter resolves a dispute. If the buyer wins, they are refunded
    ///         their payment and their reputation stays intact while the
    ///         seller's takes a hit. The seller's bond is slashed: if the buyer
    ///         themselves raised the dispute, they receive the whole slash as
    ///         before; if a third party raised it, the slash is split 50/50
    ///         between the buyer and the disputer as a fraud-proof-style bounty
    ///         for catching the bad report — and either way the disputer gets
    ///         their DISPUTE_BOND back. If the seller wins (the dispute was
    ///         frivolous), payment releases to them as normal and the
    ///         disputer's bond is forfeited to the seller as compensation for
    ///         the false accusation.
    function resolveDispute(uint256 purchaseId, bool buyerWins) external onlyArbiter {
        Purchase storage p = purchases[purchaseId];
        require(p.state == PurchaseState.Disputed, "not disputed");
        Listing storage l = listings[p.listingId];

        uint256 disputeBond = p.disputeBond;
        p.disputeBond = 0;

        if (buyerWins) {
            p.state = PurchaseState.RefundedToBuyer;
            reputationOf[l.seller].disputesLost += 1;

            uint256 slash = l.bond;
            l.bond = 0;

            uint256 buyerAmount = p.amountPaid;
            uint256 disputerAmount = 0;
            bool thirdParty = p.disputer != p.buyer;
            if (thirdParty) {
                uint256 bountyAmount = slash / 2;
                buyerAmount += slash - bountyAmount;
                disputerAmount = bountyAmount + disputeBond;
            } else {
                buyerAmount += slash + disputeBond;
            }

            (bool ok1, ) = p.buyer.call{ value: buyerAmount }("");
            require(ok1, "refund failed");
            emit Released(purchaseId, p.buyer, buyerAmount);

            if (thirdParty) {
                (bool ok2, ) = payable(p.disputer).call{ value: disputerAmount }("");
                require(ok2, "bounty payout failed");
                emit Released(purchaseId, p.disputer, disputerAmount);
            }

            emit DisputeResolved(purchaseId, true, p.disputer, disputeBond);
        } else {
            p.state = PurchaseState.ReleasedToSeller;
            reputationOf[l.seller].successfulSales += 1;

            uint256 amount = p.amountPaid + disputeBond;
            (bool ok2, ) = l.seller.call{ value: amount }("");
            require(ok2, "release failed");

            emit Released(purchaseId, l.seller, amount);
            emit DisputeResolved(purchaseId, false, l.seller, disputeBond);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────

    function listingsCount() external view returns (uint256) {
        return listings.length;
    }

    function purchasesCount() external view returns (uint256) {
        return purchases.length;
    }

    function getReputation(address seller) external view returns (uint256 successfulSales, uint256 disputesLost) {
        Reputation storage r = reputationOf[seller];
        return (r.successfulSales, r.disputesLost);
    }
}
