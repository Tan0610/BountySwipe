// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title BountyPlatform
 * @notice A Social-Fi bounty platform for Monad where companies post bounties,
 *         creators submit content, and the community votes with staked MON.
 *         Scoring: 60% company judge + 40% community votes.
 *         Reward split: 70% winner, 20% winning voters, 10% platform.
 */
contract BountyPlatform {
    // =========================================================================
    //                            REENTRANCY GUARD
    // =========================================================================

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // =========================================================================
    //                              DATA STRUCTURES
    // =========================================================================

    struct Bounty {
        uint256 id;
        address company;
        string name;
        string description;
        uint256 deadline;
        uint256 rewardPool;
        bool isFinalized;
        bool companyJudged;
    }

    struct CreatorEntry {
        address creator;
        string contentURI;       // IPFS hash or URL to submitted content
        uint256 upvotes;
        uint256 downvotes;
        uint256 companyScore;    // 0-100, assigned by the bounty company
        uint256 totalScore;      // Weighted final score (set on finalization)
        bool rewardClaimed;
    }

    struct VoteStake {
        uint256 amount;          // MON staked with this vote
        address votedFor;        // Which creator received the vote
        bool isUpvote;           // Was it an upvote or downvote
        bool exists;             // Whether this voter has voted in this bounty
    }

    // =========================================================================
    //                                 STATE
    // =========================================================================

    address public owner;                          // Platform owner (receives 10%)
    uint256 public bountyCount;                    // Auto-incrementing bounty ID
    uint256 public constant MIN_VOTE_STAKE = 0.01 ether; // Minimum stake per vote

    /// @dev bountyId => Bounty
    mapping(uint256 => Bounty) public bounties;

    /// @dev bountyId => creator address => CreatorEntry
    mapping(uint256 => mapping(address => CreatorEntry)) public creatorEntries;

    /// @dev bountyId => ordered list of creator addresses
    mapping(uint256 => address[]) public bountyCreators;

    /// @dev bountyId => creator address => true if already joined
    mapping(uint256 => mapping(address => bool)) public hasJoined;

    /// @dev voter address => bountyId => VoteStake
    mapping(address => mapping(uint256 => VoteStake)) public voteStakes;

    /// @dev bountyId => total MON staked by all voters
    mapping(uint256 => uint256) public totalStakedPerBounty;

    /// @dev bountyId => winner address (set on finalization)
    mapping(uint256 => address) public bountyWinner;

    /// @dev bountyId => total stake placed on the winning creator
    mapping(uint256 => uint256) public winnerTotalStake;

    /// @dev bountyId => list of all voter addresses (for winner-stake computation)
    mapping(uint256 => address[]) internal _bountyVoters;

    /// @dev Track all bounty IDs for enumeration
    uint256[] private allBountyIds;

    // =========================================================================
    //                                 EVENTS
    // =========================================================================

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed company,
        string name,
        uint256 rewardPool,
        uint256 deadline
    );

    event CreatorJoined(
        uint256 indexed bountyId,
        address indexed creator,
        string contentURI
    );

    event VoteCast(
        uint256 indexed bountyId,
        address indexed voter,
        address indexed creator,
        bool isUpvote,
        uint256 stakeAmount
    );

    event CompanyJudged(
        uint256 indexed bountyId,
        address indexed company
    );

    event BountyFinalized(
        uint256 indexed bountyId,
        address indexed winner,
        uint256 winnerScore
    );

    event RewardClaimed(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 amount
    );

    event VoterRewardClaimed(
        uint256 indexed bountyId,
        address indexed voter,
        uint256 amount
    );

    // =========================================================================
    //                               MODIFIERS
    // =========================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only platform owner");
        _;
    }

    modifier onlyCompany(uint256 bountyId) {
        require(msg.sender == bounties[bountyId].company, "Only bounty company");
        _;
    }

    modifier beforeDeadline(uint256 bountyId) {
        require(block.timestamp < bounties[bountyId].deadline, "Deadline has passed");
        _;
    }

    modifier afterDeadline(uint256 bountyId) {
        require(block.timestamp >= bounties[bountyId].deadline, "Deadline not reached");
        _;
    }

    modifier notFinalized(uint256 bountyId) {
        require(!bounties[bountyId].isFinalized, "Bounty already finalized");
        _;
    }

    // =========================================================================
    //                              CONSTRUCTOR
    // =========================================================================

    constructor() {
        owner = msg.sender;
    }

    // =========================================================================
    //                           CORE FUNCTIONS
    // =========================================================================

    /**
     * @notice Create a new bounty. The sent MON becomes the reward pool.
     * @param _name        Short title for the bounty
     * @param _description Detailed description of what creators should produce
     * @param _deadline    Unix timestamp after which submissions and votes close
     */
    function createBounty(
        string calldata _name,
        string calldata _description,
        uint256 _deadline
    ) external payable {
        require(msg.value > 0, "Reward pool must be > 0");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(bytes(_name).length > 0, "Name cannot be empty");

        uint256 bountyId = bountyCount;
        bountyCount++;

        bounties[bountyId] = Bounty({
            id: bountyId,
            company: msg.sender,
            name: _name,
            description: _description,
            deadline: _deadline,
            rewardPool: msg.value,
            isFinalized: false,
            companyJudged: false
        });

        allBountyIds.push(bountyId);

        emit BountyCreated(bountyId, msg.sender, _name, msg.value, _deadline);
    }

    /**
     * @notice Join a bounty by submitting content.
     * @param bountyId   The bounty to join
     * @param contentURI IPFS hash or URL pointing to the creator's submission
     */
    function joinBounty(
        uint256 bountyId,
        string calldata contentURI
    ) external beforeDeadline(bountyId) notFinalized(bountyId) {
        require(bountyId < bountyCount, "Bounty does not exist");
        require(!hasJoined[bountyId][msg.sender], "Already joined this bounty");
        require(bytes(contentURI).length > 0, "Content URI cannot be empty");
        require(msg.sender != bounties[bountyId].company, "Company cannot join own bounty");

        hasJoined[bountyId][msg.sender] = true;

        creatorEntries[bountyId][msg.sender] = CreatorEntry({
            creator: msg.sender,
            contentURI: contentURI,
            upvotes: 0,
            downvotes: 0,
            companyScore: 0,
            totalScore: 0,
            rewardClaimed: false
        });

        bountyCreators[bountyId].push(msg.sender);

        emit CreatorJoined(bountyId, msg.sender, contentURI);
    }

    /**
     * @notice Vote on a creator's submission by staking MON.
     *         Each wallet gets exactly one vote per bounty (up or down on one creator).
     * @param bountyId The bounty context
     * @param creator  The creator to vote on
     * @param isUpvote true = upvote, false = downvote
     */
    function vote(
        uint256 bountyId,
        address creator,
        bool isUpvote
    ) external payable beforeDeadline(bountyId) notFinalized(bountyId) {
        require(bountyId < bountyCount, "Bounty does not exist");
        require(msg.value >= MIN_VOTE_STAKE, "Stake below minimum (0.01 MON)");
        require(hasJoined[bountyId][creator], "Creator not in this bounty");
        require(!voteStakes[msg.sender][bountyId].exists, "Already voted in this bounty");
        require(msg.sender != creator, "Cannot vote for yourself");

        // Record the vote stake
        voteStakes[msg.sender][bountyId] = VoteStake({
            amount: msg.value,
            votedFor: creator,
            isUpvote: isUpvote,
            exists: true
        });

        totalStakedPerBounty[bountyId] += msg.value;

        // Track voter address for winner-stake computation at finalization
        _bountyVoters[bountyId].push(msg.sender);

        // Update creator vote tallies
        if (isUpvote) {
            creatorEntries[bountyId][creator].upvotes++;
        } else {
            creatorEntries[bountyId][creator].downvotes++;
        }

        emit VoteCast(bountyId, msg.sender, creator, isUpvote, msg.value);
    }

    /**
     * @notice Company scores each creator 0-100. Can only be called once per bounty.
     * @param bountyId The bounty to judge
     * @param creators Array of creator addresses to score
     * @param scores   Corresponding scores (0-100) for each creator
     */
    function companyJudge(
        uint256 bountyId,
        address[] calldata creators,
        uint256[] calldata scores
    ) external onlyCompany(bountyId) notFinalized(bountyId) {
        require(bountyId < bountyCount, "Bounty does not exist");
        require(!bounties[bountyId].companyJudged, "Already judged");
        require(creators.length == scores.length, "Arrays length mismatch");
        require(creators.length > 0, "Must score at least one creator");

        for (uint256 i = 0; i < creators.length; i++) {
            require(hasJoined[bountyId][creators[i]], "Creator not in this bounty");
            require(scores[i] <= 100, "Score must be 0-100");
            creatorEntries[bountyId][creators[i]].companyScore = scores[i];
        }

        bounties[bountyId].companyJudged = true;

        emit CompanyJudged(bountyId, msg.sender);
    }

    /**
     * @notice Finalize the bounty: compute final scores, determine winner, pay platform fee.
     *         Anyone can call after deadline + company has judged.
     * @param bountyId The bounty to finalize
     */
    function finalizeBounty(
        uint256 bountyId
    ) external afterDeadline(bountyId) notFinalized(bountyId) nonReentrant {
        require(bountyId < bountyCount, "Bounty does not exist");
        require(bounties[bountyId].companyJudged, "Company has not judged yet");

        address[] storage creators = bountyCreators[bountyId];
        require(creators.length > 0, "No creators in this bounty");

        address winner = address(0);
        uint256 highestScore = 0;

        for (uint256 i = 0; i < creators.length; i++) {
            CreatorEntry storage entry = creatorEntries[bountyId][creators[i]];

            // Calculate community score: upvotes as percentage of total votes
            uint256 communityScore;
            uint256 totalVotes = entry.upvotes + entry.downvotes;
            if (totalVotes == 0) {
                communityScore = 0; // No votes => 0 community score
            } else {
                communityScore = (entry.upvotes * 100) / totalVotes;
            }

            // Weighted total: 60% company + 40% community
            uint256 finalScore = (entry.companyScore * 60) / 100
                               + (communityScore * 40) / 100;

            entry.totalScore = finalScore;

            if (finalScore > highestScore) {
                highestScore = finalScore;
                winner = creators[i];
            }
        }

        require(winner != address(0), "No valid winner");

        bounties[bountyId].isFinalized = true;
        bountyWinner[bountyId] = winner;

        // Winner total stake is computed lazily on first voter claim to save gas here.
        // _computeWinnerTotalStake() is called in claimVoterReward if not yet set.

        // Transfer 10% platform fee to contract owner
        uint256 platformFee = (bounties[bountyId].rewardPool * 10) / 100;
        if (platformFee > 0) {
            (bool success, ) = owner.call{value: platformFee}("");
            require(success, "Platform fee transfer failed");
        }

        emit BountyFinalized(bountyId, winner, highestScore);
    }

    /**
     * @notice Winner claims 70% of the reward pool.
     * @param bountyId The finalized bounty
     */
    function claimCreatorReward(uint256 bountyId) external nonReentrant {
        require(bounties[bountyId].isFinalized, "Bounty not finalized");
        require(bountyWinner[bountyId] == msg.sender, "Only the winner can claim");

        CreatorEntry storage entry = creatorEntries[bountyId][msg.sender];
        require(!entry.rewardClaimed, "Reward already claimed");

        entry.rewardClaimed = true;

        uint256 creatorReward = (bounties[bountyId].rewardPool * 70) / 100;

        (bool success, ) = msg.sender.call{value: creatorReward}("");
        require(success, "Creator reward transfer failed");

        emit RewardClaimed(bountyId, msg.sender, creatorReward);
    }

    /**
     * @notice Voters claim their stake back. If they voted for the winner, they also
     *         receive a proportional share of 20% of the reward pool.
     * @param bountyId The finalized bounty
     */
    function claimVoterReward(uint256 bountyId) external nonReentrant {
        require(bounties[bountyId].isFinalized, "Bounty not finalized");

        VoteStake storage stake = voteStakes[msg.sender][bountyId];
        require(stake.exists, "No vote stake found");
        require(stake.amount > 0, "Already claimed");

        uint256 stakeAmount = stake.amount;
        address votedFor = stake.votedFor;

        // Zero out stake before transfer to prevent reentrancy
        stake.amount = 0;

        uint256 payout = stakeAmount; // At minimum, voters get their stake back

        if (votedFor == bountyWinner[bountyId] && stake.isUpvote) {
            // Voter backed the winner — they share 20% of the reward pool
            // Proportional to their stake among all winner-backing stakes
            uint256 voterRewardPool = (bounties[bountyId].rewardPool * 20) / 100;

            // We need the total stake on the winner. Compute it if not yet set.
            if (winnerTotalStake[bountyId] == 0) {
                _computeWinnerTotalStake(bountyId);
            }

            if (winnerTotalStake[bountyId] > 0) {
                uint256 voterShare = (voterRewardPool * stakeAmount) / winnerTotalStake[bountyId];
                payout += voterShare;
            }
        }

        (bool success, ) = msg.sender.call{value: payout}("");
        require(success, "Voter reward transfer failed");

        emit VoterRewardClaimed(bountyId, msg.sender, payout);
    }

    // =========================================================================
    //                            VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Get the full leaderboard for a bounty.
     * @param bountyId The bounty to query
     * @return creators_    Array of creator addresses
     * @return contentURIs  Array of content URIs
     * @return upvotes_     Array of upvote counts
     * @return downvotes_   Array of downvote counts
     * @return companyScores Array of company-assigned scores
     * @return totalScores  Array of weighted final scores (0 until finalized)
     */
    function getLeaderboard(uint256 bountyId)
        external
        view
        returns (
            address[] memory creators_,
            string[] memory contentURIs,
            uint256[] memory upvotes_,
            uint256[] memory downvotes_,
            uint256[] memory companyScores,
            uint256[] memory totalScores
        )
    {
        address[] storage _creators = bountyCreators[bountyId];
        uint256 len = _creators.length;

        creators_ = new address[](len);
        contentURIs = new string[](len);
        upvotes_ = new uint256[](len);
        downvotes_ = new uint256[](len);
        companyScores = new uint256[](len);
        totalScores = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            CreatorEntry storage entry = creatorEntries[bountyId][_creators[i]];
            creators_[i] = entry.creator;
            contentURIs[i] = entry.contentURI;
            upvotes_[i] = entry.upvotes;
            downvotes_[i] = entry.downvotes;
            companyScores[i] = entry.companyScore;
            totalScores[i] = entry.totalScore;
        }
    }

    /**
     * @notice Get the list of creator addresses for a bounty.
     * @param bountyId The bounty to query
     * @return Array of creator addresses
     */
    function getBountyCreators(uint256 bountyId)
        external
        view
        returns (address[] memory)
    {
        return bountyCreators[bountyId];
    }

    /**
     * @notice Get all active (not finalized, deadline not passed) bounty IDs.
     * @return activeIds Array of active bounty IDs
     */
    function getActiveBounties()
        external
        view
        returns (uint256[] memory activeIds)
    {
        // First pass: count active bounties
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allBountyIds.length; i++) {
            uint256 bid = allBountyIds[i];
            if (!bounties[bid].isFinalized && block.timestamp < bounties[bid].deadline) {
                activeCount++;
            }
        }

        // Second pass: populate array
        activeIds = new uint256[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < allBountyIds.length; i++) {
            uint256 bid = allBountyIds[i];
            if (!bounties[bid].isFinalized && block.timestamp < bounties[bid].deadline) {
                activeIds[idx] = bid;
                idx++;
            }
        }
    }

    /**
     * @notice Get full details of a specific bounty.
     * @param bountyId The bounty to query
     */
    function getBounty(uint256 bountyId)
        external
        view
        returns (
            uint256 id,
            address company,
            string memory name,
            string memory description,
            uint256 deadline,
            uint256 rewardPool,
            bool isFinalized,
            bool companyJudged,
            address winner
        )
    {
        Bounty storage b = bounties[bountyId];
        return (
            b.id,
            b.company,
            b.name,
            b.description,
            b.deadline,
            b.rewardPool,
            b.isFinalized,
            b.companyJudged,
            bountyWinner[bountyId]
        );
    }

    /**
     * @notice Get a voter's stake info for a specific bounty.
     * @param voter   The voter address
     * @param bountyId The bounty to query
     */
    function getVoteInfo(address voter, uint256 bountyId)
        external
        view
        returns (
            uint256 amount,
            address votedFor,
            bool isUpvote,
            bool exists
        )
    {
        VoteStake storage vs = voteStakes[voter][bountyId];
        return (vs.amount, vs.votedFor, vs.isUpvote, vs.exists);
    }

    // =========================================================================
    //                          INTERNAL HELPERS
    // =========================================================================

    /**
     * @dev Compute the total stake placed by upvoters on the winning creator.
     *      This is called lazily on the first voter claim to save gas at finalization.
     *      NOTE: This iterates all creators' upvoters — in a production system with
     *      many voters you would want an off-chain indexer or accumulate during voting.
     *      For hackathon scope with bounded participants, this is acceptable.
     */
    function _computeWinnerTotalStake(uint256 bountyId) internal {
        address[] storage voters = _bountyVoters[bountyId];
        address winner = bountyWinner[bountyId];
        uint256 total = 0;

        for (uint256 i = 0; i < voters.length; i++) {
            VoteStake storage vs = voteStakes[voters[i]][bountyId];
            if (vs.votedFor == winner && vs.isUpvote) {
                total += vs.amount;
            }
        }

        winnerTotalStake[bountyId] = total;
    }

    // =========================================================================
    //                     TRANSFER OWNERSHIP (PLATFORM)
    // =========================================================================

    /**
     * @notice Transfer platform ownership.
     * @param newOwner The new platform owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        owner = newOwner;
    }

    /**
     * @notice Emergency withdrawal for unclaimed funds after a long period.
     *         Only callable by the platform owner.
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /// @notice Allow contract to receive MON directly
    receive() external payable {}
}
