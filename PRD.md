# BountySwipe — Social-Fi Bounty Platform on Monad

## 1. Executive Summary

BountySwipe is a Social-Fi hackathon application built on the Monad blockchain where companies post bounties with MON token rewards, creators submit content and compete for those rewards, and audiences use a swipe-based UI (right = upvote, left = downvote) to vote by staking MON. The final scoring formula combines 60% company judgment with 40% community votes. Reward distribution splits the bounty pool: 70% to the winner, 20% shared proportionally among voters who backed the winner, and 10% retained by the platform. The target is the Monad Blitz Hackathon with a 3-hour build timeline, aiming for a working MVP deployed on Monad Testnet with a live demo showcasing the swipe-to-vote mechanic as the primary differentiator.

---

## 2. Core Use Cases

### UC-1: Company Creates Bounty

**Actor:** Company (any wallet holder acting as a bounty sponsor)

**Flow:**
1. Company connects wallet via RainbowKit.
2. Company navigates to `/create` and fills the form:
   - **Bounty Name** (required, max 100 characters)
   - **Description** (required, max 500 characters)
   - **Deadline** (datetime picker, must be in the future)
   - **Reward Amount** (number input, minimum 0.1 MON)
3. Company clicks "Create & Deposit {amount} MON".
4. Transaction sends MON to the contract and creates the bounty on-chain.
5. Bounty appears in the active bounties list on the home page.

**Constraints:**
- Minimum reward: 0.1 MON (enforced in contract as `MIN_REWARD`).
- Deadline must be strictly greater than `block.timestamp` at time of transaction.
- The company wallet address becomes the `bounty.company` (bounty owner).
- The full `msg.value` becomes the `rewardPool`.

---

### UC-2: Creator Joins Bounty

**Actor:** Creator (any wallet holder who is not the bounty company)

**Flow:**
1. Creator browses active bounties on the home page.
2. Creator clicks a bounty card to view `/bounty/[id]`.
3. Creator clicks "Join & Submit Content" button.
4. A modal appears with a single input field for **Content URI** (URL or IPFS link).
5. Creator submits. Transaction registers the creator on-chain.
6. Creator appears in the bounty's leaderboard.

**Constraints:**
- One entry per creator per bounty (`hasJoined` mapping enforced).
- Submission must be before the bounty deadline.
- The bounty company cannot join their own bounty (`msg.sender != bounty.company`).
- Content URI is stored as-is on-chain (no validation beyond non-empty string).

---

### UC-3: Audience Votes via Swipe

**Actor:** Voter (any wallet holder)

**Flow:**
1. Voter opens a bounty detail page (`/bounty/[id]`).
2. Voter clicks "Start Voting" which navigates to `/bounty/[id]/swipe`.
3. Voter sees a full-screen Instagram-style card feed showing creator submissions stacked as swipeable cards.
4. Voter swipes:
   - **Right** = Upvote (green "UPVOTE" overlay appears)
   - **Left** = Downvote (red "DOWNVOTE" overlay appears)
5. On the first swipe, the contract `vote()` function is called with 0.01 MON stake.
6. After the vote transaction confirms, the voter sees a confirmation and is redirected to the leaderboard.

**Constraints:**
- One vote per wallet per bounty (the voter votes on exactly ONE creator).
- Must stake at least 0.01 MON (`MIN_STAKE`) per vote.
- Must be before the bounty deadline.
- Voters cannot vote for themselves (`msg.sender != creator`).
- After the first successful vote, the swipe deck is disabled and a "You've voted!" message is shown.

---

### UC-4: Company Judges

**Actor:** Bounty Company (the wallet that created the bounty)

**Flow:**
1. After the bounty deadline passes, the company navigates to `/bounty/[id]`.
2. The company sees a "Judge Creators" button (only visible to the bounty company wallet).
3. Clicking it navigates to `/bounty/[id]/judge`.
4. The judge page shows all creators with their content links and current vote counts.
5. The company assigns a score (0-100) to each creator using a slider or number input.
6. The company clicks "Submit All Scores" which calls `companyJudge()` in a single transaction.

**Constraints:**
- Only the bounty company wallet (`bounty.company`) can judge.
- Can only judge once (`bounty.companyJudged` flag).
- Must be after the bounty deadline.
- All creators in the bounty must receive a score (arrays must match length).
- Each score must be in the range 0-100.

---

### UC-5: Finalization & Reward Distribution

**Actor:** Anyone (any wallet can call finalize)

**Flow:**
1. After the deadline has passed AND the company has judged, anyone can call `finalizeBounty()`.
2. The smart contract calculates final scores for each creator:
   - `communityScore = (upvotes * 100) / (upvotes + downvotes)`, or 0 if no votes.
   - `totalScore = (companyScore * 60 / 100) + (communityScore * 40 / 100)`
3. The creator with the highest `totalScore` is declared the winner.
4. 10% of the `rewardPool` is sent to the platform owner immediately.
5. The bounty is marked as finalized with the winner recorded.

**Score Calculation Details:**
- `companyScore` is the raw score (0-100) assigned by the company.
- `communityScore` is a percentage: `(upvotes * 100) / (upvotes + downvotes)`.
- If a creator has zero total votes, their `communityScore` is 0.
- The weighted total: `totalScore = (companyScore * 60 / 100) + (communityScore * 40 / 100)`.
- In case of a tie, the first creator found with the max score wins (deterministic by array order).

**Distribution Breakdown (from original rewardPool):**
| Recipient | Share | Calculation |
|-----------|-------|-------------|
| Winner (creator) | 70% | `rewardPool * 70 / 100` |
| Winner's voters | 20% | `rewardPool * 20 / 100`, split proportional to stake |
| Platform | 10% | `rewardPool * 10 / 100`, sent on finalization |

---

### UC-6: Claim Rewards

**Actor:** Winner (creator) or Voter

**Winner Claim Flow:**
1. Winner navigates to the finalized bounty page.
2. Winner clicks "Claim Reward" button.
3. `claimCreatorReward()` sends 70% of the reward pool to the winner.

**Voter Claim Flow:**
1. Voter navigates to the finalized bounty page.
2. Voter clicks "Claim Voter Reward" button.
3. If the voter upvoted the winner: they receive their original stake back PLUS a proportional share of the 20% voter pool.
   - Proportional share = `(voterStake / totalWinnerStake) * voterPool`
4. If the voter did NOT vote for the winner (or downvoted): they receive only their original stake back.

**Constraints:**
- Bounty must be finalized.
- Creator reward can only be claimed once (`rewardClaimed` flag).
- Voter reward can only be claimed once (delete the VoteStake after claim or use a claimed flag).
- Only the actual winner can claim the creator reward.

---

## 3. Tech Stack

| Layer | Technology | Version / Config | Why |
|-------|-----------|-----------------|-----|
| **Blockchain** | Monad Testnet | Chain ID: 10143, RPC: `https://testnet-rpc.monad.xyz` | Hackathon target chain, EVM-compatible, sub-second finality |
| **Smart Contracts** | Solidity | 0.8.28, evmVersion: `"prague"` | Monad requires prague EVM version for compatibility |
| **Contract Framework** | Hardhat | via scaffold-eth-monad | Pre-configured for Monad in scaffold template |
| **Frontend** | Next.js | 14+ (App Router) | Comes with scaffold-eth-monad, SSR support |
| **Wallet Connection** | RainbowKit + wagmi + viem | Latest scaffold versions | Comes with scaffold-eth-monad, full Monad support |
| **Swipe UI** | react-tinder-card | npm package | Lightweight swipe gesture library, perfect for card-based voting |
| **Styling** | TailwindCSS + DaisyUI | Scaffold defaults | Comes with scaffold-eth-monad, rapid UI development |
| **Deployment (Frontend)** | Vercel | Free tier | Free, fast, Next.js native deployment |
| **Deployment (Contract)** | Hardhat deploy | Monad Testnet | Direct from scaffold-eth project via deploy scripts |

**Base Project Repository:**
```
https://github.com/monad-developers/scaffold-monad-hardhat
```

Clone this as the starting point. All scaffold-eth-2 conventions, hooks, and components are available out of the box.

---

## 4. Smart Contract Architecture

### Contract: `BountyPlatform.sol`

**File Location:** `packages/hardhat/contracts/BountyPlatform.sol`

**Solidity Version:** `pragma solidity ^0.8.28;`

---

### 4.1 State Variables

```solidity
address public owner;                    // Platform admin, receives 10% fee
uint256 public bountyCount;              // Auto-incrementing bounty ID (starts at 0)
uint256 public constant MIN_STAKE = 0.01 ether;   // Minimum voting stake
uint256 public constant MIN_REWARD = 0.1 ether;   // Minimum bounty reward
bool private locked;                     // Reentrancy guard flag
```

---

### 4.2 Structs

```solidity
struct Bounty {
    uint256 id;
    address company;
    string name;
    string description;
    uint256 deadline;
    uint256 rewardPool;
    bool isFinalized;
    bool companyJudged;
    address winner;
}

struct CreatorEntry {
    address creator;
    string contentURI;
    uint256 upvotes;
    uint256 downvotes;
    uint256 companyScore;
    uint256 totalScore;
    bool rewardClaimed;
}

struct VoteStake {
    uint256 amount;
    address votedFor;
    bool isUpvote;
    bool exists;
}
```

---

### 4.3 Mappings

```solidity
mapping(uint256 => Bounty) public bounties;
// bountyId => Bounty struct

mapping(uint256 => address[]) public bountyCreators;
// bountyId => array of creator addresses

mapping(uint256 => mapping(address => CreatorEntry)) public creatorEntries;
// bountyId => creatorAddress => CreatorEntry

mapping(uint256 => mapping(address => bool)) public hasJoined;
// bountyId => creatorAddress => bool (prevents duplicate joins)

mapping(uint256 => mapping(address => VoteStake)) public voteStakes;
// bountyId => voterAddress => VoteStake

mapping(uint256 => address[]) public bountyVoters;
// bountyId => array of all voter addresses

mapping(uint256 => uint256) public winnerTotalStake;
// bountyId => total MON staked on winner (cached during finalization for voter reward calc)
```

---

### 4.4 Events

```solidity
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
    uint256 amount
);

event CompanyJudged(uint256 indexed bountyId);

event BountyFinalized(
    uint256 indexed bountyId,
    address indexed winner,
    uint256 totalScore
);

event RewardClaimed(
    uint256 indexed bountyId,
    address indexed winner,
    uint256 amount
);

event VoterRewardClaimed(
    uint256 indexed bountyId,
    address indexed voter,
    uint256 amount
);
```

---

### 4.5 Modifiers

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not platform owner");
    _;
}

modifier onlyCompany(uint256 bountyId) {
    require(msg.sender == bounties[bountyId].company, "Not bounty company");
    _;
}

modifier beforeDeadline(uint256 bountyId) {
    require(block.timestamp < bounties[bountyId].deadline, "Deadline passed");
    _;
}

modifier afterDeadline(uint256 bountyId) {
    require(block.timestamp >= bounties[bountyId].deadline, "Deadline not passed");
    _;
}

modifier notFinalized(uint256 bountyId) {
    require(!bounties[bountyId].isFinalized, "Already finalized");
    _;
}

modifier nonReentrant() {
    require(!locked, "Reentrant call");
    locked = true;
    _;
    locked = false;
}
```

---

### 4.6 Constructor

```solidity
constructor() {
    owner = msg.sender;
}
```

---

### 4.7 Core Functions (10)

#### Function 1: `createBounty`

```solidity
function createBounty(
    string calldata name,
    string calldata description,
    uint256 deadline
) external payable {
    require(msg.value >= MIN_REWARD, "Reward too low");
    require(deadline > block.timestamp, "Deadline must be future");

    uint256 bountyId = bountyCount;
    bounties[bountyId] = Bounty({
        id: bountyId,
        company: msg.sender,
        name: name,
        description: description,
        deadline: deadline,
        rewardPool: msg.value,
        isFinalized: false,
        companyJudged: false,
        winner: address(0)
    });

    bountyCount++;

    emit BountyCreated(bountyId, msg.sender, name, msg.value, deadline);
}
```

#### Function 2: `joinBounty`

```solidity
function joinBounty(
    uint256 bountyId,
    string calldata contentURI
) external beforeDeadline(bountyId) {
    require(bountyId < bountyCount, "Bounty does not exist");
    require(!hasJoined[bountyId][msg.sender], "Already joined");
    require(msg.sender != bounties[bountyId].company, "Company cannot join own bounty");

    creatorEntries[bountyId][msg.sender] = CreatorEntry({
        creator: msg.sender,
        contentURI: contentURI,
        upvotes: 0,
        downvotes: 0,
        companyScore: 0,
        totalScore: 0,
        rewardClaimed: false
    });

    hasJoined[bountyId][msg.sender] = true;
    bountyCreators[bountyId].push(msg.sender);

    emit CreatorJoined(bountyId, msg.sender, contentURI);
}
```

#### Function 3: `vote`

```solidity
function vote(
    uint256 bountyId,
    address creator,
    bool isUpvote
) external payable beforeDeadline(bountyId) {
    require(msg.value >= MIN_STAKE, "Stake too low");
    require(!voteStakes[bountyId][msg.sender].exists, "Already voted");
    require(hasJoined[bountyId][creator], "Creator not in bounty");
    require(msg.sender != creator, "Cannot vote for yourself");

    voteStakes[bountyId][msg.sender] = VoteStake({
        amount: msg.value,
        votedFor: creator,
        isUpvote: isUpvote,
        exists: true
    });

    if (isUpvote) {
        creatorEntries[bountyId][creator].upvotes++;
    } else {
        creatorEntries[bountyId][creator].downvotes++;
    }

    bountyVoters[bountyId].push(msg.sender);

    emit VoteCast(bountyId, msg.sender, creator, isUpvote, msg.value);
}
```

#### Function 4: `companyJudge`

```solidity
function companyJudge(
    uint256 bountyId,
    address[] calldata creators,
    uint256[] calldata scores
) external onlyCompany(bountyId) afterDeadline(bountyId) {
    require(!bounties[bountyId].companyJudged, "Already judged");
    require(creators.length == scores.length, "Array length mismatch");
    require(creators.length == bountyCreators[bountyId].length, "Must score all creators");

    for (uint256 i = 0; i < creators.length; i++) {
        require(scores[i] <= 100, "Score must be 0-100");
        require(hasJoined[bountyId][creators[i]], "Creator not in bounty");
        creatorEntries[bountyId][creators[i]].companyScore = scores[i];
    }

    bounties[bountyId].companyJudged = true;

    emit CompanyJudged(bountyId);
}
```

#### Function 5: `finalizeBounty`

```solidity
function finalizeBounty(
    uint256 bountyId
) external afterDeadline(bountyId) notFinalized(bountyId) nonReentrant {
    require(bounties[bountyId].companyJudged, "Company has not judged");

    address[] memory creators = bountyCreators[bountyId];
    require(creators.length > 0, "No creators");

    address bestCreator = creators[0];
    uint256 bestScore = 0;

    for (uint256 i = 0; i < creators.length; i++) {
        CreatorEntry storage entry = creatorEntries[bountyId][creators[i]];
        uint256 totalVotes = entry.upvotes + entry.downvotes;
        uint256 communityScore = 0;

        if (totalVotes > 0) {
            communityScore = (entry.upvotes * 100) / totalVotes;
        }

        entry.totalScore = (entry.companyScore * 60 / 100) + (communityScore * 40 / 100);

        if (entry.totalScore > bestScore) {
            bestScore = entry.totalScore;
            bestCreator = creators[i];
        }
    }

    bounties[bountyId].winner = bestCreator;
    bounties[bountyId].isFinalized = true;

    // Cache total stake on winner for voter reward calculation
    address[] memory voters = bountyVoters[bountyId];
    uint256 totalWinnerStake = 0;
    for (uint256 i = 0; i < voters.length; i++) {
        VoteStake memory vs = voteStakes[bountyId][voters[i]];
        if (vs.votedFor == bestCreator && vs.isUpvote) {
            totalWinnerStake += vs.amount;
        }
    }
    winnerTotalStake[bountyId] = totalWinnerStake;

    // Send 10% platform fee
    uint256 platformFee = bounties[bountyId].rewardPool * 10 / 100;
    (bool sent, ) = owner.call{value: platformFee}("");
    require(sent, "Platform fee transfer failed");

    emit BountyFinalized(bountyId, bestCreator, bestScore);
}
```

#### Function 6: `claimCreatorReward`

```solidity
function claimCreatorReward(
    uint256 bountyId
) external nonReentrant {
    require(bounties[bountyId].isFinalized, "Not finalized");
    require(msg.sender == bounties[bountyId].winner, "Not the winner");
    require(!creatorEntries[bountyId][msg.sender].rewardClaimed, "Already claimed");

    creatorEntries[bountyId][msg.sender].rewardClaimed = true;

    uint256 reward = bounties[bountyId].rewardPool * 70 / 100;
    (bool sent, ) = msg.sender.call{value: reward}("");
    require(sent, "Reward transfer failed");

    emit RewardClaimed(bountyId, msg.sender, reward);
}
```

#### Function 7: `claimVoterReward`

```solidity
function claimVoterReward(
    uint256 bountyId
) external nonReentrant {
    require(bounties[bountyId].isFinalized, "Not finalized");
    VoteStake storage vs = voteStakes[bountyId][msg.sender];
    require(vs.exists, "No vote found");

    uint256 payout = vs.amount; // At minimum, return stake

    if (vs.votedFor == bounties[bountyId].winner && vs.isUpvote) {
        // Proportional share of 20% voter pool
        uint256 voterPool = bounties[bountyId].rewardPool * 20 / 100;
        uint256 totalStake = winnerTotalStake[bountyId];
        if (totalStake > 0) {
            payout += (vs.amount * voterPool) / totalStake;
        }
    }

    // Mark as claimed by resetting exists
    vs.exists = false;

    (bool sent, ) = msg.sender.call{value: payout}("");
    require(sent, "Voter payout failed");

    emit VoterRewardClaimed(bountyId, msg.sender, payout);
}
```

#### Function 8: `getActiveBounties` (view)

```solidity
function getActiveBounties() external view returns (uint256[] memory) {
    uint256 count = 0;
    for (uint256 i = 0; i < bountyCount; i++) {
        if (!bounties[i].isFinalized && block.timestamp < bounties[i].deadline) {
            count++;
        }
    }

    uint256[] memory activeIds = new uint256[](count);
    uint256 idx = 0;
    for (uint256 i = 0; i < bountyCount; i++) {
        if (!bounties[i].isFinalized && block.timestamp < bounties[i].deadline) {
            activeIds[idx] = i;
            idx++;
        }
    }

    return activeIds;
}
```

#### Function 9: `getBountyCreators` (view)

```solidity
function getBountyCreators(
    uint256 bountyId
) external view returns (address[] memory) {
    return bountyCreators[bountyId];
}
```

#### Function 10: `getLeaderboard` (view)

```solidity
function getLeaderboard(
    uint256 bountyId
) external view returns (
    address[] memory addresses,
    string[] memory contentURIs,
    uint256[] memory upvotes,
    uint256[] memory downvotes,
    uint256[] memory companyScores,
    uint256[] memory totalScores
) {
    address[] memory creators = bountyCreators[bountyId];
    uint256 len = creators.length;

    addresses = new address[](len);
    contentURIs = new string[](len);
    upvotes = new uint256[](len);
    downvotes = new uint256[](len);
    companyScores = new uint256[](len);
    totalScores = new uint256[](len);

    for (uint256 i = 0; i < len; i++) {
        CreatorEntry memory entry = creatorEntries[bountyId][creators[i]];
        addresses[i] = entry.creator;
        contentURIs[i] = entry.contentURI;
        upvotes[i] = entry.upvotes;
        downvotes[i] = entry.downvotes;
        companyScores[i] = entry.companyScore;
        totalScores[i] = entry.totalScore;
    }
}
```

---

### 4.8 Additional View Functions

#### Function 11: `getBounty`

```solidity
function getBounty(
    uint256 bountyId
) external view returns (Bounty memory) {
    return bounties[bountyId];
}
```

#### Function 12: `getVoteInfo`

```solidity
function getVoteInfo(
    uint256 bountyId,
    address voter
) external view returns (VoteStake memory) {
    return voteStakes[bountyId][voter];
}
```

#### Function 13: `getCreatorEntry`

```solidity
function getCreatorEntry(
    uint256 bountyId,
    address creator
) external view returns (CreatorEntry memory) {
    return creatorEntries[bountyId][creator];
}
```

#### Function 14: `getAllBounties` (convenience view for frontend)

```solidity
function getAllBounties() external view returns (Bounty[] memory) {
    Bounty[] memory allBounties = new Bounty[](bountyCount);
    for (uint256 i = 0; i < bountyCount; i++) {
        allBounties[i] = bounties[i];
    }
    return allBounties;
}
```

---

## 5. UI/UX Design

### 5.1 Page Structure (Next.js App Router)

```
app/
├── page.tsx                    # Home -- Browse active bounties
├── create/
│   └── page.tsx               # Create Bounty form (company)
├── bounty/
│   └── [id]/
│       ├── page.tsx           # Bounty detail -- leaderboard + info
│       ├── swipe/
│       │   └── page.tsx       # Swipe voting interface
│       └── judge/
│           └── page.tsx       # Company judging interface
├── layout.tsx                 # App layout with nav + wallet
└── my-bounties/
    └── page.tsx               # Dashboard -- created & joined bounties
```

---

### 5.2 Page Designs

#### P1: Home Page (`/`)

**Layout:**
- **Header:** BountySwipe logo (text-based: "BountySwipe" in bold purple gradient) + Connect Wallet button (RainbowKit default button, top-right).
- **Hero Section:** Centered text block:
  - Headline: "Create. Compete. Vote. Earn."
  - Subtext: "The Social-Fi bounty platform on Monad. Companies post bounties, creators compete, audiences vote by staking MON."
  - Two CTA buttons: "Create Bounty" (primary, purple) and "Browse Bounties" (secondary, outlined).
- **Bounty Grid:** 3-column responsive grid (3 cols on desktop, 2 on tablet, 1 on mobile).
  - Each card is a `BountyCard` component.
  - **Card contents:**
    - Bounty name (bold, truncated to 1 line)
    - Reward pool displayed as "{amount} MON" with a coin icon
    - Deadline countdown (e.g., "2h 34m left" or "Ended")
    - Creator count (e.g., "5 creators")
    - Total votes cast (e.g., "23 votes")
    - Status badge in top-right corner
  - Click card navigates to `/bounty/[id]`.
- **Empty State:** If no active bounties, show "No active bounties yet. Be the first to create one!" with CTA.
- **Footer:** "Built on Monad" with Monad logo.

**Data Source:** Call `getActiveBounties()` to get IDs, then `getBounty(id)` for each, plus `getBountyCreators(id).length` for creator count.

---

#### P2: Create Bounty (`/create`)

**Layout:**
- **Page Title:** "Create a Bounty"
- **Form (centered, max-width 600px):**
  - **Bounty Name:** Text input, placeholder "e.g., Best Monad Meme", required, maxLength 100.
  - **Description:** Textarea, placeholder "Describe what you're looking for...", required, maxLength 500, 4 rows.
  - **Deadline:** `<input type="datetime-local">`, must be set to a future time. Show validation error if past.
  - **Reward Amount:** Number input with step 0.01, minimum 0.1, placeholder "0.1". Show current wallet balance below the input as "Balance: {x} MON".
  - **Submit Button:** Full-width, purple, text "Create & Deposit {amount} MON". Disabled if form invalid or wallet not connected.
- **Wallet Check:** If wallet not connected, show a prominent "Connect Wallet to Create Bounty" message with RainbowKit connect button instead of the form.
- **Success State:** After transaction confirms, show success toast and redirect to the new bounty page `/bounty/[newId]`.

**Data Flow:** On submit, call `createBounty(name, description, deadlineTimestamp)` with `value: parseEther(amount)`.

---

#### P3: Bounty Detail (`/bounty/[id]`)

**Layout:**
- **Top Section (bounty info card):**
  - Bounty name (large heading)
  - Description (paragraph text)
  - Company address (truncated: `0x1234...5678`)
  - Reward pool: "{amount} MON" (large, highlighted)
  - Deadline: Countdown timer component OR "Ended {time ago}" if past
  - Status badge: Active / Voting Closed / Judging / Finalized

- **Action Buttons Section (contextual based on state and connected wallet):**

  | Condition | Button Shown |
  |-----------|-------------|
  | Active + wallet connected + not joined + not company | "Join & Submit Content" (opens modal) |
  | Active + wallet connected + not voted | "Start Voting" (links to `/bounty/[id]/swipe`) |
  | Active + already voted | "You voted for {address}" (disabled, informational) |
  | After deadline + is company + not judged | "Judge Creators" (links to `/bounty/[id]/judge`) |
  | After deadline + is company + judged + not finalized | "Finalize Bounty" (calls `finalizeBounty`) |
  | Finalized + is winner + not claimed | "Claim Reward ({amount} MON)" |
  | Finalized + is voter + not claimed | "Claim Voter Reward" |
  | Not connected | "Connect Wallet to Participate" |

- **Join Modal:** Simple modal overlay with:
  - Text input for Content URI (placeholder "https://... or ipfs://...")
  - "Submit Entry" button
  - Cancel button

- **Leaderboard Table:**
  - Columns: Rank (#), Creator (truncated address), Content (clickable link), Upvotes (green number), Downvotes (red number), Company Score (shown only after judging), Total Score (shown only after finalization)
  - Sorted by total score descending (after finalization) or by upvotes descending (before)
  - Winner row highlighted with gold/yellow background after finalization
  - If no creators yet: "No submissions yet. Be the first!"

**Data Source:** `getBounty(id)`, `getLeaderboard(id)`, `getVoteInfo(id, address)`, `getCreatorEntry(id, address)`.

---

#### P4: Swipe Voting (`/bounty/[id]/swipe`) -- KEY DIFFERENTIATOR

**Layout:**
- **Full-screen card stack** using `react-tinder-card` library.
- **No header/footer** (immersive experience). Only a small "X" close button in top-left to exit back to bounty detail.
- **Stake info banner:** Fixed at top, reads "Staking 0.01 MON to vote" in a subtle bar.

**Card Design (each `SwipeCard`):**
- Card fills ~80% of viewport height, centered horizontally.
- **Card contents:**
  - Creator address at top (truncated, small text)
  - Large content area:
    - If contentURI ends in `.jpg`, `.png`, `.gif`, `.webp`: Show as `<img>` (cover fit)
    - If contentURI ends in `.mp4`, `.webm`: Show as `<video>` (autoplay muted)
    - Otherwise: Show URI as a large clickable link with an external link icon
  - Bottom bar: Current vote counts ("12 upvotes / 3 downvotes")
- **Card background:** Dark card (`#1A1A2E`) with rounded corners and subtle shadow.

**Swipe Mechanics:**
- **Swipe RIGHT:** Green overlay fades in with "UPVOTE" text (large, centered, rotated slightly). On release past threshold, triggers `vote(bountyId, creator, true)` with `value: 0.01 ether`.
- **Swipe LEFT:** Red overlay fades in with "DOWNVOTE" text. On release past threshold, triggers `vote(bountyId, creator, false)` with `value: 0.01 ether`.
- **IMPORTANT:** The user can only vote for ONE creator. After the first successful vote transaction:
  1. Show a full-screen "Vote Cast!" confirmation with confetti or checkmark animation.
  2. After 2 seconds, redirect to `/bounty/[id]` (leaderboard page).
  3. If user returns to swipe page, show "You've already voted in this bounty" with a link back.

**Alternative Controls (for accessibility):**
- Bottom bar with two large buttons: Green "Upvote" button (left) and Red "Downvote" button (right).
- Tapping either button acts the same as swiping in that direction.
- "Skip" button (small, centered below cards) to move to next card without voting.

**Loading State:** Show skeleton card while loading creators from contract.

**Empty State:** If no creators submitted, show "No submissions to vote on yet."

**Already Voted State:** If `getVoteInfo(bountyId, address).exists` is true, show "You've already voted!" with info about who they voted for.

**Data Source:** `getBountyCreators(id)` to get creator list, then `getCreatorEntry(id, creator)` for each.

---

#### P5: Company Judge (`/bounty/[id]/judge`)

**Layout:**
- **Page Title:** "Judge Submissions for: {bountyName}"
- **Access Control:** If connected wallet is NOT `bounty.company`, show "Only the bounty creator can judge" and a back link. Do NOT render the judge form.
- **Creator List:** Vertical list of all creators, each row contains:
  - Creator address (truncated)
  - Content URI (clickable link, opens in new tab)
  - Current vote stats: "{upvotes} up / {downvotes} down"
  - **Score Input:** Range slider (0-100) with number input next to it showing the current value. Default value: 50.
- **Submit Button:** "Submit All Scores" (full-width, purple). Disabled until all creators have been scored.
- **Confirmation Modal:** Before submitting, show "Are you sure? Scores cannot be changed after submission." with Confirm/Cancel.

**Data Flow:** Collect all `[creatorAddress, score]` pairs. Call `companyJudge(bountyId, addressArray, scoreArray)`.

---

#### P6: My Bounties (`/my-bounties`)

**Layout:**
- **Two Tabs:** "Created" and "Joined" (DaisyUI tab component).

**Created Tab:**
- List of bounties where `bounty.company == connectedAddress`.
- Each row: Bounty name, reward pool, deadline, status, creator count.
- Action links: View, Judge (if applicable), Finalize (if applicable).

**Joined Tab:**
- List of bounties where `hasJoined[bountyId][connectedAddress]` is true.
- Each row: Bounty name, reward pool, my content URI, my votes, my score (if judged), claim button (if won).

**Data Source:** Iterate through `getAllBounties()` and filter client-side based on connected address. For joined bounties, check `creatorEntries` for each.

---

### 5.3 Component Library

**File Location:** `packages/nextjs/components/bountyswipe/`

| Component | Props | Description |
|-----------|-------|-------------|
| `BountyCard.tsx` | `bountyId: number` | Card for bounty grid on home page. Reads bounty data from contract. Shows name, reward, deadline, creator count, vote count. Clickable, navigates to detail page. |
| `SwipeCard.tsx` | `creator: address, contentURI: string, upvotes: number, downvotes: number` | Individual card shown in the swipe deck. Renders content preview based on URI type. |
| `SwipeDeck.tsx` | `bountyId: number, creators: CreatorEntry[]` | Container component that uses `react-tinder-card` to render a stack of `SwipeCard` components. Handles swipe events and triggers vote transactions. |
| `Leaderboard.tsx` | `bountyId: number` | Table showing all creators sorted by score. Highlights winner after finalization. |
| `BountyStatusBadge.tsx` | `bounty: Bounty` | Colored badge: green "Active", yellow "Voting Closed", orange "Judging", blue "Finalized". Logic: if not finalized and before deadline = Active; after deadline and not judged = Voting Closed; after deadline and judged but not finalized = Judging; finalized = Finalized. |
| `CountdownTimer.tsx` | `deadline: number` | Shows live countdown "Xd Xh Xm Xs" or "Ended" if past. Uses `useEffect` with 1-second interval. |
| `CreateBountyForm.tsx` | `onSuccess?: (id: number) => void` | Self-contained form component with validation. Calls `createBounty` on submit. |
| `JudgePanel.tsx` | `bountyId: number` | Full judging interface. Loads creators, shows score inputs, submits all at once. |
| `ClaimButton.tsx` | `bountyId: number, type: "creator" \| "voter"` | Contextual claim button. Shows amount claimable, handles transaction, disables after claim. |
| `Header.tsx` | none | App header with BountySwipe logo, nav links (Home, Create, My Bounties), and RainbowKit ConnectButton. Modify the default scaffold Header. |

---

### 5.4 Color & Theme Configuration

**DaisyUI Theme (add to `tailwind.config.js`):**

```javascript
daisyui: {
  themes: [
    {
      bountyswipe: {
        "primary": "#7C3AED",          // Purple (Monad vibe)
        "primary-content": "#FFFFFF",
        "secondary": "#A855F7",        // Light purple
        "secondary-content": "#FFFFFF",
        "accent": "#22D3EE",           // Cyan for highlights
        "accent-content": "#0F0F1A",
        "neutral": "#1A1A2E",          // Card backgrounds
        "neutral-content": "#E2E8F0",
        "base-100": "#0F0F1A",         // Page background (dark)
        "base-200": "#141428",         // Slightly lighter dark
        "base-300": "#1A1A2E",         // Card/section backgrounds
        "base-content": "#E2E8F0",     // Default text (light gray)
        "info": "#3B82F6",
        "success": "#22C55E",          // Upvote green
        "warning": "#F59E0B",
        "error": "#EF4444",            // Downvote red
      },
    },
  ],
},
```

**Update `scaffold.config.ts`** to use the `bountyswipe` theme:
```typescript
const scaffoldConfig = {
  targetNetworks: [chains.monadTestnet], // or define custom chain
  // ... other config
} as const satisfies ScaffoldConfig;
```

---

## 6. Scaffolding & Project Setup

### Step 0: Prerequisites

```bash
# Verify Node.js 18+ is installed
node --version  # Must be >= 18.0.0

# Verify yarn is installed
yarn --version
```

---

### Step 1: Clone & Install

```bash
cd /mnt/d/Monad_II
git clone https://github.com/monad-developers/scaffold-monad-hardhat.git BountySwipe
cd BountySwipe
yarn install
```

**Expected Result:** All dependencies installed for both `packages/hardhat` and `packages/nextjs`.

---

### Step 2: Environment Setup

**Create `packages/hardhat/.env`:**
```env
DEPLOYER_PRIVATE_KEY=your_private_key_here
```
Replace `your_private_key_here` with the private key of a wallet funded with Monad Testnet MON.

**Create/Update `packages/nextjs/.env.local`:**
```env
NEXT_PUBLIC_ALCHEMY_API_KEY=not_needed_for_monad
```
This placeholder satisfies any scaffold-eth checks. Monad uses its own RPC.

---

### Step 3: Smart Contract Setup

1. **Delete the default contract:**
   ```bash
   rm packages/hardhat/contracts/YourContract.sol
   ```

2. **Create `packages/hardhat/contracts/BountyPlatform.sol`** with the full contract code from Section 4.

3. **Update the deploy script** at `packages/hardhat/deploy/00_deploy_your_contract.ts`:
   ```typescript
   import { HardhatRuntimeEnvironment } from "hardhat/types";
   import { DeployFunction } from "hardhat-deploy/types";

   const deployBountyPlatform: DeployFunction = async function (
     hre: HardhatRuntimeEnvironment
   ) {
     const { deployer } = await hre.getNamedAccounts();
     const { deploy } = hre.deployments;

     await deploy("BountyPlatform", {
       from: deployer,
       args: [],
       log: true,
       autoMine: true,
     });
   };

   export default deployBountyPlatform;
   deployBountyPlatform.tags = ["BountyPlatform"];
   ```

4. **Verify `hardhat.config.ts`** includes:
   ```typescript
   solidity: {
     version: "0.8.28",
     settings: {
       evmVersion: "prague",
       optimizer: {
         enabled: true,
         runs: 200,
       },
     },
   },
   ```
   The `evmVersion: "prague"` setting is MANDATORY for Monad compatibility.

---

### Step 4: Install Frontend Dependencies

```bash
cd packages/nextjs
yarn add react-tinder-card
```

---

### Step 5: Configure `scaffold.config.ts`

Locate `packages/nextjs/scaffold.config.ts` and update:
- Set `targetNetworks` to include Monad Testnet (chain ID 10143).
- If Monad Testnet is not predefined in scaffold, define a custom chain:

```typescript
import { defineChain } from "viem";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "MON",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
});
```

---

## 7. Dev Sprint Steps (3-Hour Implementation Plan)

### Sprint 1: Smart Contract (0:00 -- 0:45)

#### Step 1.1: Project Setup (10 minutes)

**Goal:** Clone the scaffold, install dependencies, set up environment files.

**Claude Code Prompt:**
> "Set up the BountySwipe project. Clone scaffold-monad-hardhat from https://github.com/monad-developers/scaffold-monad-hardhat into /mnt/d/Monad_II/BountySwipe. Run yarn install. Create the .env file at packages/hardhat/.env with a placeholder for DEPLOYER_PRIVATE_KEY. Create packages/nextjs/.env.local with NEXT_PUBLIC_ALCHEMY_API_KEY=not_needed_for_monad."

**Verification:** `ls packages/hardhat/contracts/` shows default `YourContract.sol`.

---

#### Step 1.2: Write Smart Contract (25 minutes)

**Goal:** Create the complete `BountyPlatform.sol` contract.

**Claude Code Prompt:**
> "Delete packages/hardhat/contracts/YourContract.sol. Create packages/hardhat/contracts/BountyPlatform.sol with the complete smart contract following PRD Section 4 exactly. Include all structs (Bounty, CreatorEntry, VoteStake), all mappings, all 14 functions (createBounty, joinBounty, vote, companyJudge, finalizeBounty, claimCreatorReward, claimVoterReward, getLeaderboard, getBountyCreators, getActiveBounties, getBounty, getVoteInfo, getCreatorEntry, getAllBounties), all 7 events, and all 6 modifiers. Use Solidity 0.8.28."

**Verification:** `yarn compile` in packages/hardhat succeeds with no errors.

---

#### Step 1.3: Deploy Script & Local Test (10 minutes)

**Goal:** Update deploy script, compile, and test on local Hardhat node.

**Claude Code Prompt:**
> "Update packages/hardhat/deploy/00_deploy_your_contract.ts to deploy BountyPlatform instead of YourContract. Make sure hardhat.config.ts has evmVersion set to 'prague' for Solidity 0.8.28. Compile the contract with yarn compile. Start a local hardhat node and deploy locally to verify it works."

**Verification:** Contract compiles and deploys to local node. ABI is generated.

---

### Sprint 2: Contract Deployment (0:45 -- 1:00)

#### Step 2.1: Deploy to Monad Testnet (10 minutes)

**Goal:** Deploy the contract to Monad Testnet.

**Claude Code Prompt:**
> "Deploy BountyPlatform to Monad Testnet. Verify the hardhat config has the monadTestnet network configured with RPC https://testnet-rpc.monad.xyz and chain ID 10143. Use evmVersion 'prague'. Run the deploy command targeting monadTestnet. Record the deployed contract address."

**Verification:** Deployment transaction confirmed on Monad Testnet. Contract address printed to console.

---

#### Step 2.2: Verify ABI Generation (5 minutes)

**Goal:** Ensure the frontend can access the contract ABI.

**Claude Code Prompt:**
> "Verify the contract ABI was generated and is available at packages/nextjs/contracts/deployedContracts.ts (or wherever scaffold-eth-monad puts generated contract info). If the ABI wasn't auto-generated, run the appropriate scaffold generate command (usually 'yarn generate' from root)."

**Verification:** `packages/nextjs/contracts/deployedContracts.ts` contains BountyPlatform ABI and address.

---

### Sprint 3: Frontend Core (1:00 -- 2:00)

#### Step 3.1: Layout, Navigation, Theme (15 minutes)

**Goal:** Set up app shell with BountySwipe branding and navigation.

**Claude Code Prompt:**
> "Update the BountySwipe frontend. In packages/nextjs:
> 1. Add a custom DaisyUI theme called 'bountyswipe' to tailwind.config.js with these colors: primary #7C3AED, secondary #A855F7, accent #22D3EE, base-100 #0F0F1A, base-200 #141428, base-300 #1A1A2E, success #22C55E, error #EF4444.
> 2. Update the Header component to show 'BountySwipe' as the logo, with nav links to Home (/), Create Bounty (/create), and My Bounties (/my-bounties). Keep the RainbowKit ConnectButton.
> 3. Update app/layout.tsx to use the bountyswipe theme.
> 4. Update scaffold.config.ts to target Monad Testnet (chain ID 10143)."

**Verification:** `yarn dev` (in packages/nextjs) shows the dark-themed app with purple accents and working navigation.

---

#### Step 3.2: Home Page -- Bounty Browser (15 minutes)

**Goal:** Build the home page with a grid of bounty cards.

**Claude Code Prompt:**
> "Build the home page at packages/nextjs/app/page.tsx for BountySwipe:
> 1. Create a BountyCard component at packages/nextjs/components/bountyswipe/BountyCard.tsx that accepts a bountyId prop, reads bounty data using useScaffoldContractRead for 'getBounty' and 'getBountyCreators', and displays: bounty name, reward pool in MON, deadline countdown, number of creators, and a status badge (BountyStatusBadge component). The card should be clickable and link to /bounty/[id].
> 2. Create CountdownTimer component at packages/nextjs/components/bountyswipe/CountdownTimer.tsx that takes a deadline timestamp and shows a live countdown.
> 3. Create BountyStatusBadge component at packages/nextjs/components/bountyswipe/BountyStatusBadge.tsx.
> 4. The home page should have a hero section with 'Create. Compete. Vote. Earn.' headline and CTA buttons, then a grid of BountyCards. Use useScaffoldContractRead to call 'getAllBounties' and display all non-finalized bounties."

**Verification:** Home page renders with hero section and bounty grid (empty if no bounties created yet).

---

#### Step 3.3: Create Bounty Page (15 minutes)

**Goal:** Build the bounty creation form.

**Claude Code Prompt:**
> "Build the Create Bounty page at packages/nextjs/app/create/page.tsx:
> 1. Create a CreateBountyForm component at packages/nextjs/components/bountyswipe/CreateBountyForm.tsx.
> 2. Form fields: Bounty Name (text, required, max 100 chars), Description (textarea, required, max 500 chars), Deadline (datetime-local input, must be future), Reward Amount (number input, min 0.1, step 0.01).
> 3. Show connected wallet balance.
> 4. Submit button says 'Create & Deposit {amount} MON'.
> 5. On submit, call createBounty using useScaffoldContractWrite with the form values and msg.value = parseEther(amount).
> 6. Show loading state during transaction. On success, show toast notification and redirect to /bounty/[newId].
> 7. If wallet not connected, show 'Connect Wallet to Create Bounty' with RainbowKit button."

**Verification:** Form renders, validates inputs, and can submit a transaction (test on local or testnet).

---

#### Step 3.4: Bounty Detail Page + Leaderboard (15 minutes)

**Goal:** Build the bounty detail page with leaderboard and contextual actions.

**Claude Code Prompt:**
> "Build the Bounty Detail page at packages/nextjs/app/bounty/[id]/page.tsx:
> 1. Read bounty data using useScaffoldContractRead for 'getBounty' with the id from URL params.
> 2. Show bounty info: name, description, company address (truncated), reward pool, countdown timer, status badge.
> 3. Create a Leaderboard component at packages/nextjs/components/bountyswipe/Leaderboard.tsx. It calls 'getLeaderboard' and displays a table with columns: Rank, Creator, Content Link, Upvotes, Downvotes, Company Score (if judged), Total Score (if finalized). Sort by totalScore or upvotes. Highlight winner row in gold.
> 4. Show contextual action buttons based on bounty state and connected wallet:
>    - 'Join & Submit Content' button that opens a modal with contentURI input (calls joinBounty)
>    - 'Start Voting' link to /bounty/[id]/swipe
>    - 'Judge Creators' link to /bounty/[id]/judge (only for company)
>    - 'Finalize Bounty' button (calls finalizeBounty, after deadline + judged)
>    - ClaimButton component for creator and voter rewards
> 5. Create ClaimButton component at packages/nextjs/components/bountyswipe/ClaimButton.tsx."

**Verification:** Bounty detail page shows all info, leaderboard table, and appropriate action buttons.

---

### Sprint 4: Swipe Voting UI (2:00 -- 2:30)

#### Step 4.1: Swipe Deck with react-tinder-card (20 minutes)

**Goal:** Build the signature swipe-to-vote interface.

**Claude Code Prompt:**
> "Build the Swipe Voting page at packages/nextjs/app/bounty/[id]/swipe/page.tsx. This is the key differentiator of BountySwipe:
> 1. Install react-tinder-card if not already installed.
> 2. Create SwipeCard component at packages/nextjs/components/bountyswipe/SwipeCard.tsx. Each card shows: creator address (truncated), content preview (if URI is image show it, otherwise show clickable link), and current vote counts.
> 3. Create SwipeDeck component at packages/nextjs/components/bountyswipe/SwipeDeck.tsx. Uses react-tinder-card to create a stack of SwipeCards. Load creators from getBountyCreators and getCreatorEntry.
> 4. Swipe RIGHT triggers vote(bountyId, creator, true) with value 0.01 ether. Show green 'UPVOTE' overlay during swipe.
> 5. Swipe LEFT triggers vote(bountyId, creator, false) with value 0.01 ether. Show red 'DOWNVOTE' overlay during swipe.
> 6. After first successful vote, show 'Vote Cast!' confirmation and redirect to /bounty/[id] after 2 seconds.
> 7. If user already voted (check getVoteInfo), show 'You already voted!' message instead of cards.
> 8. Add bottom buttons as alternative: green 'Upvote' and red 'Downvote' buttons, plus a 'Skip' button.
> 9. Full-screen immersive layout with dark background. Show 'Staking 0.01 MON' info banner at top.
> 10. Add a close button (X) in top-left to go back to bounty detail."

**Verification:** Swipe deck renders with cards, swipe gestures work, vote transaction is triggered on swipe.

---

#### Step 4.2: Judge Page (10 minutes)

**Goal:** Build the company judging interface.

**Claude Code Prompt:**
> "Build the Judge page at packages/nextjs/app/bounty/[id]/judge/page.tsx:
> 1. Create JudgePanel component at packages/nextjs/components/bountyswipe/JudgePanel.tsx.
> 2. Check if connected wallet is bounty.company. If not, show 'Only the bounty creator can judge' with a back link.
> 3. Check if already judged. If yes, show 'Already judged' message.
> 4. List all creators with: address, content URI link, vote stats (upvotes/downvotes).
> 5. Each creator has a range slider (0-100, default 50) with a number input showing the current value.
> 6. 'Submit All Scores' button collects all [address, score] pairs and calls companyJudge.
> 7. Show confirmation dialog before submitting: 'Scores cannot be changed. Are you sure?'"

**Verification:** Judge page renders with score sliders for each creator and submits scores correctly.

---

### Sprint 5: Polish & Deploy (2:30 -- 3:00)

#### Step 5.1: Claim Rewards + My Bounties (10 minutes)

**Goal:** Complete the reward claiming flow and user dashboard.

**Claude Code Prompt:**
> "Complete the reward and dashboard features:
> 1. Ensure ClaimButton component handles both claimCreatorReward and claimVoterReward based on type prop. Show the claimable amount. Disable after claiming.
> 2. Build My Bounties page at packages/nextjs/app/my-bounties/page.tsx:
>    - Two tabs: 'Created' and 'Joined' (use DaisyUI tabs).
>    - 'Created' tab: List bounties where company matches connected wallet. Show name, reward, status, action links.
>    - 'Joined' tab: List bounties where connected wallet has joined. Show name, my content, votes received, score, claim button if won.
>    - Use getAllBounties and filter client-side."

**Verification:** My Bounties page shows correct data for connected wallet. Claim buttons work.

---

#### Step 5.2: UI Polish (10 minutes)

**Goal:** Add loading states, error handling, and visual polish.

**Claude Code Prompt:**
> "Polish the BountySwipe UI:
> 1. Add loading spinners (DaisyUI loading component) to all pages while contract data loads.
> 2. Add toast notifications (use a simple notification system or scaffold's built-in) for: transaction submitted, transaction confirmed, transaction failed.
> 3. Add 'wallet not connected' states on all pages that require a wallet.
> 4. Ensure the swipe cards have smooth animations (react-tinder-card handles this, but add CSS transitions for overlays).
> 5. Add hover effects on bounty cards (scale up slightly, shadow increase).
> 6. Make sure all pages are responsive (mobile-friendly)."

**Verification:** App looks polished with no blank/broken states. Transactions show proper feedback.

---

#### Step 5.3: Deploy Frontend to Vercel (10 minutes)

**Goal:** Deploy the frontend for public access.

**Claude Code Prompt:**
> "Deploy the BountySwipe frontend:
> 1. Make sure packages/nextjs builds successfully with 'yarn build'.
> 2. Fix any build errors.
> 3. Deploy to Vercel using 'vercel --prod' or by connecting the GitHub repo to Vercel.
> 4. Note the deployment URL."

**Verification:** Frontend is live at a Vercel URL and connects to Monad Testnet.

---

## 8. Integration Details

### 8.1 Wallet Connection

RainbowKit is pre-configured in scaffold-eth-monad. Ensure the following:

- Monad Testnet chain is included in the wagmi config.
- Chain configuration:
  ```typescript
  {
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: {
      decimals: 18,
      name: "MON",
      symbol: "MON",
    },
    rpcUrls: {
      default: {
        http: ["https://testnet-rpc.monad.xyz"],
      },
    },
  }
  ```

---

### 8.2 Contract Interaction (scaffold-eth hooks)

Use scaffold-eth-2 custom hooks throughout the frontend. These hooks automatically handle ABI resolution, contract address lookup, and network switching.

**Reading Data (view functions):**
```typescript
import { useScaffoldContractRead } from "~~/hooks/scaffold-eth";

// Read active bounties
const { data: activeBounties } = useScaffoldContractRead({
  contractName: "BountyPlatform",
  functionName: "getActiveBounties",
});

// Read a specific bounty
const { data: bounty } = useScaffoldContractRead({
  contractName: "BountyPlatform",
  functionName: "getBounty",
  args: [BigInt(bountyId)],
});

// Read leaderboard
const { data: leaderboard } = useScaffoldContractRead({
  contractName: "BountyPlatform",
  functionName: "getLeaderboard",
  args: [BigInt(bountyId)],
});

// Check if user voted
const { data: voteInfo } = useScaffoldContractRead({
  contractName: "BountyPlatform",
  functionName: "getVoteInfo",
  args: [BigInt(bountyId), connectedAddress],
});
```

**Writing Data (state-changing functions):**
```typescript
import { useScaffoldContractWrite } from "~~/hooks/scaffold-eth";
import { parseEther } from "viem";

// Create a bounty
const { writeAsync: createBounty } = useScaffoldContractWrite({
  contractName: "BountyPlatform",
  functionName: "createBounty",
  args: [name, description, BigInt(deadlineTimestamp)],
  value: parseEther(rewardAmount),
});

// Join a bounty
const { writeAsync: joinBounty } = useScaffoldContractWrite({
  contractName: "BountyPlatform",
  functionName: "joinBounty",
  args: [BigInt(bountyId), contentURI],
});

// Vote with stake
const { writeAsync: vote } = useScaffoldContractWrite({
  contractName: "BountyPlatform",
  functionName: "vote",
  args: [BigInt(bountyId), creatorAddress, isUpvote],
  value: parseEther("0.01"),
});

// Judge (company only)
const { writeAsync: companyJudge } = useScaffoldContractWrite({
  contractName: "BountyPlatform",
  functionName: "companyJudge",
  args: [BigInt(bountyId), creatorAddresses, scores.map(s => BigInt(s))],
});

// Finalize
const { writeAsync: finalizeBounty } = useScaffoldContractWrite({
  contractName: "BountyPlatform",
  functionName: "finalizeBounty",
  args: [BigInt(bountyId)],
});

// Claim creator reward
const { writeAsync: claimCreator } = useScaffoldContractWrite({
  contractName: "BountyPlatform",
  functionName: "claimCreatorReward",
  args: [BigInt(bountyId)],
});

// Claim voter reward
const { writeAsync: claimVoter } = useScaffoldContractWrite({
  contractName: "BountyPlatform",
  functionName: "claimVoterReward",
  args: [BigInt(bountyId)],
});
```

---

### 8.3 Event Listening for Real-Time Updates

```typescript
import { useScaffoldEventSubscriber } from "~~/hooks/scaffold-eth";

// Listen for new votes to update leaderboard in real-time
useScaffoldEventSubscriber({
  contractName: "BountyPlatform",
  eventName: "VoteCast",
  listener: (logs) => {
    logs.forEach((log) => {
      const { bountyId, voter, creator, isUpvote, amount } = log.args;
      // Trigger data refetch or update local state
    });
  },
});

// Listen for new bounties on home page
useScaffoldEventSubscriber({
  contractName: "BountyPlatform",
  eventName: "BountyCreated",
  listener: (logs) => {
    // Refresh bounty list
  },
});
```

---

### 8.4 Custom Hook: `useBountyData`

**File Location:** `packages/nextjs/hooks/useBountyData.ts`

Create a convenience hook that bundles common bounty reads:

```typescript
import { useScaffoldContractRead } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";

export function useBountyData(bountyId: number) {
  const { address } = useAccount();

  const { data: bounty } = useScaffoldContractRead({
    contractName: "BountyPlatform",
    functionName: "getBounty",
    args: [BigInt(bountyId)],
  });

  const { data: creators } = useScaffoldContractRead({
    contractName: "BountyPlatform",
    functionName: "getBountyCreators",
    args: [BigInt(bountyId)],
  });

  const { data: leaderboard } = useScaffoldContractRead({
    contractName: "BountyPlatform",
    functionName: "getLeaderboard",
    args: [BigInt(bountyId)],
  });

  const { data: voteInfo } = useScaffoldContractRead({
    contractName: "BountyPlatform",
    functionName: "getVoteInfo",
    args: [BigInt(bountyId), address],
    enabled: !!address,
  });

  const isCompany = bounty?.company === address;
  const hasVoted = voteInfo?.exists ?? false;
  const isActive = bounty && !bounty.isFinalized &&
    Date.now() / 1000 < Number(bounty.deadline);

  return {
    bounty,
    creators,
    leaderboard,
    voteInfo,
    isCompany,
    hasVoted,
    isActive,
  };
}
```

---

## 9. Testing Plan

### 9.1 Smart Contract Tests

**File Location:** `packages/hardhat/test/BountyPlatform.test.ts`

#### Priority 1 Tests (MUST have for hackathon):

**Test 1: createBounty**
- Verify bounty is stored correctly (name, description, deadline, rewardPool, company).
- Verify `BountyCreated` event is emitted with correct args.
- Verify reverts if `msg.value < MIN_REWARD`.
- Verify reverts if `deadline <= block.timestamp`.

**Test 2: joinBounty**
- Verify creator is registered in `creatorEntries` and `bountyCreators`.
- Verify `CreatorJoined` event is emitted.
- Verify reverts if already joined (duplicate prevention).
- Verify reverts if company tries to join own bounty.
- Verify reverts if after deadline.

**Test 3: vote**
- Verify vote is recorded in `voteStakes`.
- Verify upvotes/downvotes counters update on `creatorEntries`.
- Verify `VoteCast` event is emitted.
- Verify reverts if `msg.value < MIN_STAKE`.
- Verify reverts if already voted (one vote per wallet per bounty).
- Verify reverts if voting for self.

**Test 4: Full End-to-End Flow**
- Create bounty (Wallet A) with 1 MON.
- Join with Wallet B (creator 1) and Wallet C (creator 2).
- Vote: Wallet D upvotes creator 1 (0.01 MON), Wallet E upvotes creator 2 (0.01 MON).
- Fast-forward time past deadline.
- Company (Wallet A) judges: creator 1 = 80, creator 2 = 60.
- Anyone finalizes.
- Verify winner is creator 1 (score: 80*60/100 + 100*40/100 = 48+40 = 88, vs 60*60/100 + 100*40/100 = 36+40 = 76).
- Creator 1 claims reward: verify receives 70% of 1 MON = 0.7 MON.
- Voter D claims: verify receives 0.01 MON stake + share of 0.2 MON voter pool.
- Verify platform received 0.1 MON.

#### Priority 2 Tests (nice to have):

**Test 5: Edge Cases**
- Vote after deadline should revert.
- Double claiming should revert.
- Finalize before judging should revert.
- Finalize before deadline should revert.

**Test 6: Reward Math Verification**
- Verify 70/20/10 split is mathematically correct.
- Verify proportional voter rewards when multiple voters back winner.
- Verify voters who backed loser get only stake back.

**Test 7: Score Calculation**
- Verify 60/40 weighting is correct.
- Verify communityScore with 0 votes = 0.
- Verify communityScore with only upvotes = 100.
- Verify communityScore with only downvotes = 0.

#### Test Commands:

```bash
cd packages/hardhat
yarn test                    # Run all tests
yarn test --grep "create"   # Run specific test
```

---

### 9.2 Frontend Testing (Manual for Hackathon)

| Test Case | Steps | Expected Result |
|-----------|-------|----------------|
| Wallet connect | Click "Connect Wallet" | RainbowKit modal opens, can connect |
| Wallet disconnect | Click connected wallet | Can disconnect |
| Create bounty | Fill form, submit | Transaction sent, bounty appears on home |
| Create with low reward | Set reward to 0.01 | Transaction reverts with "Reward too low" |
| Join bounty | Click Join, enter URI | Transaction sent, creator appears in leaderboard |
| Swipe right | Open swipe, swipe right | Green overlay, vote transaction sent |
| Swipe left | Open swipe, swipe left | Red overlay, vote transaction sent |
| Double vote | Try to swipe again | "Already voted" message shown |
| Judge | Open judge page, score all | Transaction sent, scores stored |
| Finalize | Click finalize button | Winner determined, status changes |
| Claim creator | Winner clicks claim | MON received |
| Claim voter | Voter clicks claim | MON received |

---

### 9.3 Quick Smoke Test Script (Demo Prep)

Execute this sequence with 4 different wallets before the demo:

1. **Wallet A (Company):** Connect wallet. Navigate to `/create`. Create bounty: name "Best Monad Meme", description "Create the dankest Monad meme", deadline 10 minutes from now, reward 1 MON. Submit.
2. **Wallet B (Creator 1):** Connect wallet. Navigate to bounty detail. Click "Join & Submit". Enter `https://example.com/meme1.png`. Submit.
3. **Wallet C (Creator 2):** Connect wallet. Navigate to bounty detail. Click "Join & Submit". Enter `https://example.com/meme2.png`. Submit.
4. **Wallet D (Voter):** Connect wallet. Navigate to bounty detail. Click "Start Voting". See card stack. Swipe right on Creator 1. Confirm vote. See "Vote Cast!". Redirected to leaderboard. Verify Creator 1 has 1 upvote.
5. **Wait for deadline to pass** (or use a very short deadline for testing).
6. **Wallet A (Company):** Navigate to bounty detail. Click "Judge Creators". Score Creator 1: 80, Creator 2: 60. Submit scores.
7. **Any wallet:** Click "Finalize Bounty". Verify winner is Creator 1. Leaderboard shows final scores and winner highlighted.
8. **Wallet B (Creator 1 = Winner):** Click "Claim Reward". Verify MON received.
9. **Wallet D (Voter):** Click "Claim Voter Reward". Verify MON received (stake + share of voter pool).

---

## 10. Deployment Checklist

### Smart Contract Deployment:

- [ ] Compile with no errors: `cd packages/hardhat && yarn compile`
- [ ] All priority 1 tests pass: `yarn test`
- [ ] `hardhat.config.ts` has `evmVersion: "prague"`
- [ ] `packages/hardhat/.env` has valid `DEPLOYER_PRIVATE_KEY`
- [ ] Deployer wallet has Monad Testnet MON (use faucet)
- [ ] Deploy to Monad Testnet: `yarn deploy --network monadTestnet`
- [ ] Record deployed contract address: `________________`
- [ ] Generate frontend contract artifacts: `yarn generate` (from root)
- [ ] Verify on Monad explorer (optional): `yarn verify --network monadTestnet`

### Frontend Deployment:

- [ ] `scaffold.config.ts` has `targetNetworks` set to Monad Testnet
- [ ] Contract ABI and address present in `packages/nextjs/contracts/deployedContracts.ts`
- [ ] DaisyUI `bountyswipe` theme is active
- [ ] All pages render correctly: `/`, `/create`, `/bounty/[id]`, `/bounty/[id]/swipe`, `/bounty/[id]/judge`, `/my-bounties`
- [ ] Local dev works: `cd packages/nextjs && yarn dev`
- [ ] Build succeeds: `cd packages/nextjs && yarn build`
- [ ] Deploy to Vercel: `vercel --prod` or GitHub integration
- [ ] Record Vercel URL: `________________`

### Demo Environment:

- [ ] Monad Testnet MON in deployer wallet (from faucet: https://faucet.monad.xyz/)
- [ ] 4 test wallets funded with at least 2 MON each
- [ ] At least one bounty created and ready for demo
- [ ] Browser with MetaMask/Rabby configured for Monad Testnet
- [ ] Backup: screenshots/recording of working demo in case of network issues

---

## 11. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|-----------|--------|---------------------|
| Smart contract compilation/deployment fails | Medium | High | Test compile early. Have the full contract code ready. Use `evmVersion: "prague"`. |
| `react-tinder-card` doesn't work well | Low | Medium | **Fallback:** Replace swipe cards with simple "Upvote"/"Downvote" button UI next to each creator in a list. The voting logic stays the same. |
| Monad Testnet RPC is down | Low | High | **Fallback:** Demo on local Hardhat node. Change `targetNetworks` to `hardhat`. All functionality works the same. |
| Gas issues on Monad | Very Low | Low | Monad gas is near-zero. Keep functions gas-efficient anyway (no unbounded loops in state-changing functions). |
| Time pressure: won't finish all pages | High | Medium | **Priority cut order:** (1) Cut My Bounties page (demo with direct URLs), (2) Cut Judge page (judge via Monad explorer/etherscan), (3) Simplify swipe to button-only UI. Core path: Create -> Join -> Vote -> Finalize must work. |
| Contract security vulnerability | Medium | Medium | Use reentrancy guard on all payout functions. Use checks-effects-interactions pattern. This is a hackathon MVP, not mainnet production code. |
| Frontend build fails on Vercel | Low | Medium | Test `yarn build` locally first. Fix all TypeScript errors. If Vercel fails, demo locally with `yarn dev`. |

---

## 12. Demo Script (2-Minute Pitch)

### Slide 0: Setup (before presentation)
- Have the app open at the home page
- Have 4 browser profiles/wallets ready (Company, Creator1, Creator2, Voter)
- Have one bounty already created with 2 creators joined (to save time)

### Slide 1: Problem (15 seconds)
> "The creator economy is broken. Companies spend billions on marketing but can't find authentic creators. Creators compete in a system rigged by follower counts. And audiences? They scroll past branded content with zero engagement incentives."

### Slide 2: Solution (15 seconds)
> "BountySwipe fixes this with crypto-economic incentives. Companies post bounties with MON rewards. Creators compete on merit. Audiences stake MON to vote -- and earn returns when they back the winner. Everyone has skin in the game."

### Slide 3: Live Demo (60 seconds)
1. **Show home page** with active bounties (5s)
2. **Create a new bounty** quickly -- "Best Monad Meme, 1 MON reward" (10s)
3. **Switch to Creator wallet** -- join and submit content (10s)
4. **Switch to Voter wallet** -- open swipe interface (10s)
5. **SWIPE RIGHT** -- this is the WOW moment. Show the smooth swipe animation, the green upvote overlay, the 0.01 MON stake (15s)
6. **Show leaderboard** updating with the vote (5s)
7. **Show finalization** -- winner determined, rewards distributed (5s)

### Slide 4: Why Monad (15 seconds)
> "We built on Monad because sub-second finality makes swipe-to-vote feel instant -- no waiting for confirmations. Near-zero gas means voting costs nothing. And 10,000 TPS means this scales to millions of simultaneous voters."

### Slide 5: Business Model & Vision (15 seconds)
> "10% platform fee on every bounty pool. Phase 2: multi-round tournaments, creator reputation NFTs, DAO governance. We're building the Tinder for the creator economy -- swipe right on talent, stake on potential."

---

## 13. File Structure (Final)

```
BountySwipe/
├── packages/
│   ├── hardhat/
│   │   ├── contracts/
│   │   │   └── BountyPlatform.sol              # Main smart contract (Section 4)
│   │   ├── deploy/
│   │   │   └── 00_deploy_your_contract.ts      # Deploy script for BountyPlatform
│   │   ├── test/
│   │   │   └── BountyPlatform.test.ts          # Contract unit tests (Section 9)
│   │   ├── hardhat.config.ts                   # Monad testnet + evmVersion prague
│   │   └── .env                                # DEPLOYER_PRIVATE_KEY
│   └── nextjs/
│       ├── app/
│       │   ├── page.tsx                        # Home -- bounty browser with hero + grid
│       │   ├── layout.tsx                      # App layout with bountyswipe theme
│       │   ├── create/
│       │   │   └── page.tsx                   # Create Bounty form page
│       │   ├── bounty/
│       │   │   └── [id]/
│       │   │       ├── page.tsx               # Bounty detail + leaderboard + actions
│       │   │       ├── swipe/
│       │   │       │   └── page.tsx           # Swipe-to-vote interface (KEY FEATURE)
│       │   │       └── judge/
│       │   │           └── page.tsx           # Company scoring interface
│       │   └── my-bounties/
│       │       └── page.tsx                   # User dashboard (created + joined)
│       ├── components/
│       │   └── bountyswipe/
│       │       ├── BountyCard.tsx              # Bounty grid card component
│       │       ├── SwipeCard.tsx               # Individual swipe card
│       │       ├── SwipeDeck.tsx               # Card stack with react-tinder-card
│       │       ├── Leaderboard.tsx             # Sortable leaderboard table
│       │       ├── BountyStatusBadge.tsx       # Active/Closed/Judging/Finalized badge
│       │       ├── CountdownTimer.tsx          # Live deadline countdown
│       │       ├── CreateBountyForm.tsx        # Bounty creation form
│       │       ├── JudgePanel.tsx              # Company scoring panel
│       │       └── ClaimButton.tsx             # Contextual reward claim button
│       ├── hooks/
│       │   └── useBountyData.ts               # Custom hook bundling bounty reads
│       ├── contracts/
│       │   └── deployedContracts.ts           # Auto-generated ABI + addresses
│       ├── scaffold.config.ts                 # Target: Monad Testnet
│       ├── tailwind.config.js                 # bountyswipe DaisyUI theme
│       └── .env.local                         # Environment variables
├── PRD.md                                      # This document
├── README.md                                   # Project readme (from scaffold)
├── package.json                                # Root workspace config
└── yarn.lock                                   # Dependency lock file
```

---

## Appendix A: Key Constants

| Constant | Value | Location |
|----------|-------|----------|
| MIN_STAKE | 0.01 ether (10^16 wei) | BountyPlatform.sol |
| MIN_REWARD | 0.1 ether (10^17 wei) | BountyPlatform.sol |
| Winner Share | 70% | BountyPlatform.sol finalizeBounty / claimCreatorReward |
| Voter Pool Share | 20% | BountyPlatform.sol claimVoterReward |
| Platform Fee | 10% | BountyPlatform.sol finalizeBounty |
| Company Weight | 60% | BountyPlatform.sol finalizeBounty |
| Community Weight | 40% | BountyPlatform.sol finalizeBounty |
| Monad Testnet Chain ID | 10143 | scaffold.config.ts / hardhat.config.ts |
| Monad Testnet RPC | https://testnet-rpc.monad.xyz | scaffold.config.ts / hardhat.config.ts |

---

## Appendix B: Error Messages Reference

| Function | Error Message | Trigger |
|----------|--------------|---------|
| createBounty | "Reward too low" | msg.value < 0.1 ether |
| createBounty | "Deadline must be future" | deadline <= block.timestamp |
| joinBounty | "Bounty does not exist" | bountyId >= bountyCount |
| joinBounty | "Already joined" | hasJoined is true |
| joinBounty | "Company cannot join own bounty" | msg.sender == bounty.company |
| joinBounty | "Deadline passed" | block.timestamp >= deadline |
| vote | "Stake too low" | msg.value < 0.01 ether |
| vote | "Already voted" | voteStakes[].exists is true |
| vote | "Creator not in bounty" | hasJoined[creator] is false |
| vote | "Cannot vote for yourself" | msg.sender == creator |
| vote | "Deadline passed" | block.timestamp >= deadline |
| companyJudge | "Not bounty company" | msg.sender != bounty.company |
| companyJudge | "Already judged" | companyJudged is true |
| companyJudge | "Deadline not passed" | block.timestamp < deadline |
| companyJudge | "Array length mismatch" | creators.length != scores.length |
| companyJudge | "Must score all creators" | creators.length != bountyCreators.length |
| companyJudge | "Score must be 0-100" | score > 100 |
| finalizeBounty | "Company has not judged" | companyJudged is false |
| finalizeBounty | "Already finalized" | isFinalized is true |
| finalizeBounty | "No creators" | bountyCreators.length == 0 |
| claimCreatorReward | "Not finalized" | isFinalized is false |
| claimCreatorReward | "Not the winner" | msg.sender != winner |
| claimCreatorReward | "Already claimed" | rewardClaimed is true |
| claimVoterReward | "Not finalized" | isFinalized is false |
| claimVoterReward | "No vote found" | exists is false |

---

## Appendix C: Gas Optimization Notes

For hackathon MVP, gas is not a primary concern on Monad (near-zero gas costs). However, these patterns are used for correctness:

1. **Reentrancy Guard:** All payout functions (`finalizeBounty`, `claimCreatorReward`, `claimVoterReward`) use `nonReentrant` modifier.
2. **Checks-Effects-Interactions:** State changes happen before external calls (ETH transfers).
3. **Calldata over Memory:** Function parameters use `calldata` for string and array params to save gas.
4. **No Unbounded Loops in User-Facing Functions:** `getActiveBounties` and `getAllBounties` are view functions (no gas cost for read). `finalizeBounty` loops through creators (bounded by practical bounty size).

---

*This PRD was designed to be a complete, self-contained implementation guide. A developer using Claude Code should be able to build the entire BountySwipe application by following Sections 6-7 sequentially, referencing Sections 4-5 for specifications, and using Sections 8-10 for integration and deployment.*

---

## 14. x402 Integration — AI Agent Micropayments

### Overview
x402 is the HTTP 402 "Payment Required" protocol for internet-native micropayments. On Monad, it enables AI agents to autonomously pay for API access with USDC — zero friction, zero accounts, instant settlement.

**Reference Starter Kit:** https://github.com/rk-rishikesh/x402-starter
This starter uses a middleware-based approach where `paymentProxy()` gates all premium API routes. The API routes themselves contain ZERO payment logic — all verification is handled by the middleware.

### x402 on Monad Configuration
```
Network: eip155:10143 (Monad Testnet)
USDC Contract: 0x534b2f3A21130d7a60830c2Df862319e593943A3
Facilitator URL: https://x402-facilitator.molandak.org
Price per analysis: $0.001 USDC
Pay-To Address: Set via PAY_TO_ADDRESS env var
```

### Architecture: Middleware-Based Payment Gating (from x402-starter)

The x402-starter kit uses Next.js middleware to gate API routes. This is **simpler and cleaner** than per-route wrapping — payment logic lives in ONE file (`middleware.ts`), not scattered across routes.

**Step 1: Server-side middleware (`packages/nextjs/middleware.ts`):**
```typescript
import { paymentProxy } from "@x402/next";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";

const MONAD_NETWORK: Network = "eip155:10143";
const PAY_TO = process.env.PAY_TO_ADDRESS as `0x${string}`;

// Register Monad network with x402
const server = new x402ResourceServer()
  .register(MONAD_NETWORK, new ExactEvmScheme());

// Define payable routes
const routes = {
  "/api/premium/analyze-content": {
    accepts: [{
      scheme: "exact" as const,
      payTo: PAY_TO,
      price: "$0.001",
      network: MONAD_NETWORK,
    }],
    description: "AI Content Analysis for BountySwipe",
    mimeType: "application/json",
  },
};

export const middleware = paymentProxy(routes, server);
export const config = {
  matcher: ["/api/premium/:path*"],
};
```

**Step 2: API route with ZERO payment logic (`packages/nextjs/app/api/premium/analyze-content/route.ts`):**
```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { contentURI, bountyId } = await request.json();

  // Call Claude API to analyze the content
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `You are a content quality judge for a creator bounty platform.
        Analyze this content submission and provide:
        1. A quality score from 0-100
        2. A recommendation: "upvote" or "downvote"
        3. A brief reason (1 sentence)

        Content URI: ${contentURI}
        Bounty ID: ${bountyId}

        Respond in JSON format: { "score": number, "recommendation": "upvote" | "downvote", "reason": string }`
      }]
    }),
  });

  const claudeResponse = await response.json();
  const analysis = JSON.parse(claudeResponse.content[0].text);

  return NextResponse.json({
    bountyId,
    contentURI,
    analysis,
    analyzedAt: new Date().toISOString(),
  });
}
```

**Step 3: Client-side payment fetch (for agent or frontend):**
```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

// Create x402 client for Monad
const client = new x402Client();
registerExactEvmScheme(client, walletClient); // walletClient from viem/wagmi

// Wrap fetch — automatically handles 402 → pay → retry
const paymentFetch = wrapFetchWithPayment(fetch, client);

// This auto-pays $0.001 USDC when the server returns 402
const response = await paymentFetch("/api/premium/analyze-content", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contentURI, bountyId }),
});
```

### Required npm packages:
```bash
cd packages/nextjs
npm install @x402/core @x402/evm @x402/fetch @x402/next
```

### Environment variables (packages/nextjs/.env.local):
```
PAY_TO_ADDRESS=0xYourWalletAddress
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Key Differences from Original PRD Approach:
| Aspect | Before (withX402 per route) | Now (middleware pattern from starter) |
|--------|---------------------------|--------------------------------------|
| Payment logic | In each route file | ONE middleware.ts file |
| Route code | Mixed with x402 setup | Pure business logic only |
| Adding new paid routes | Copy x402 boilerplate | Add one entry to routes object |
| Facilitator setup | Manual in each route | Automatic via middleware |

---

## 15. Claude AI Agent Auto-Voter

### Overview
An autonomous AI agent script that:
1. Reads active bounties from the BountyPlatform contract
2. For each creator in a bounty, pays via x402 to analyze their content
3. Based on Claude's analysis, votes on-chain (upvote/downvote) with MON stake
4. Runs as a standalone Node.js script or cron job

### Agent Script (`packages/nextjs/scripts/agent-voter.ts`)

```typescript
import { createWalletClient, http, parseEther, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { x402Client } from "@x402/core/client";

// Monad Testnet chain config
const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
};

// Agent wallet (funded with MON for voting + USDC for x402 payments)
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(AGENT_PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

// x402 setup for paying the analysis API
const evmSigner = {
  address: account.address,
  signTypedData: async (message: any) => {
    return account.signTypedData({
      domain: message.domain,
      types: message.types,
      primaryType: message.primaryType,
      message: message.message,
    });
  },
};

const exactScheme = new ExactEvmScheme(evmSigner);
const client = new x402Client().register("eip155:10143", exactScheme);
const paymentFetch = wrapFetchWithPayment(fetch, client);

// BountyPlatform contract ABI (key functions only)
const BOUNTY_ABI = [
  // Include getActiveBounties, getBountyCreators, getCreatorEntry, vote functions
  // These will be auto-generated by scaffold-eth after deployment
] as const;

const CONTRACT_ADDRESS = process.env.BOUNTY_CONTRACT_ADDRESS as `0x${string}`;
const ANALYSIS_API_URL = process.env.ANALYSIS_API_URL || "http://localhost:3000/api/analyze-content";

async function runAgentVoter() {
  console.log(`🤖 Agent Voter starting... Wallet: ${account.address}`);

  // Step 1: Get active bounties
  const activeBounties = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BOUNTY_ABI,
    functionName: "getActiveBounties",
  });

  console.log(`Found ${activeBounties.length} active bounties`);

  for (const bountyId of activeBounties) {
    // Step 2: Get creators in this bounty
    const creators = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: BOUNTY_ABI,
      functionName: "getBountyCreators",
      args: [bountyId],
    });

    let bestCreator = { address: "" as `0x${string}`, score: 0, shouldUpvote: false };

    for (const creatorAddr of creators) {
      // Step 3: Get creator's content URI
      const entry = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: BOUNTY_ABI,
        functionName: "getCreatorEntry",
        args: [bountyId, creatorAddr],
      });

      // Step 4: Pay via x402 to analyze content with Claude
      try {
        const response = await paymentFetch(ANALYSIS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentURI: entry.contentURI,
            bountyId: bountyId.toString(),
          }),
        });

        const { analysis } = await response.json();
        console.log(`Creator ${creatorAddr}: Score ${analysis.score} - ${analysis.recommendation}`);

        if (analysis.score > bestCreator.score) {
          bestCreator = {
            address: creatorAddr,
            score: analysis.score,
            shouldUpvote: analysis.recommendation === "upvote",
          };
        }
      } catch (err) {
        console.error(`Failed to analyze ${creatorAddr}:`, err);
      }
    }

    // Step 5: Vote for the best creator on-chain
    if (bestCreator.address && bestCreator.shouldUpvote) {
      console.log(`Voting for ${bestCreator.address} on bounty ${bountyId}`);

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: BOUNTY_ABI,
        functionName: "vote",
        args: [bountyId, bestCreator.address, true], // upvote
        value: parseEther("0.01"), // minimum stake
      });

      console.log(`Vote TX: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Vote confirmed for bounty ${bountyId}`);
    }
  }

  console.log("🤖 Agent Voter complete!");
}

// Run the agent
runAgentVoter().catch(console.error);
```

### Running the Agent
```bash
# Set environment variables
export AGENT_PRIVATE_KEY=0xyour_agent_wallet_key
export BOUNTY_CONTRACT_ADDRESS=0xdeployed_contract_address
export ANALYSIS_API_URL=https://your-app.vercel.app/api/analyze-content

# Run the agent
npx tsx packages/nextjs/scripts/agent-voter.ts
```

### Agent Requirements:
- Agent wallet needs: MON (for gas + voting stake) + USDC (for x402 analysis payments)
- Get testnet MON from: https://faucet.monad.xyz
- Get testnet USDC from: https://faucet.circle.com (select Monad Testnet)
- Claude API key for content analysis

---

## 16. Updated Dev Sprint (Revised for x402 + AI Agent)

### Revised 3-Hour Sprint Plan:

| Time | Sprint | Task |
|------|--------|------|
| 0:00–0:10 | **Setup** | Clone scaffold-monad, install deps, env files |
| 0:10–0:40 | **Contract** | Write BountyPlatform.sol, deploy script |
| 0:40–0:50 | **Deploy** | Compile, deploy to Monad Testnet |
| 0:50–1:15 | **Frontend Core** | Layout, theme, home page with bounty grid |
| 1:15–1:35 | **Create + Detail** | Create bounty form, bounty detail + leaderboard |
| 1:35–2:05 | **Swipe UI** | react-tinder-card voting interface |
| 2:05–2:25 | **x402 API** | Content analysis endpoint with x402 + Claude |
| 2:25–2:40 | **AI Agent** | Agent voter script, test with live bounty |
| 2:40–2:50 | **Judge + Claims** | Company judge page, claim buttons |
| 2:50–3:00 | **Deploy + Demo** | Vercel deploy, prepare demo flow |

### Updated Claude Code Prompts:

**For x402 Integration (Sprint at 2:05):**
```
"Read PRD.md Section 14 (x402 Integration). Install @x402/core @x402/evm @x402/fetch @x402/next.
Create the /api/analyze-content route with x402 payment gating using Monad facilitator.
Use Claude API for content analysis. Add PAY_TO_ADDRESS and ANTHROPIC_API_KEY to .env.local."
```

**For AI Agent (Sprint at 2:25):**
```
"Read PRD.md Section 15 (Claude AI Agent Auto-Voter). Create packages/nextjs/scripts/agent-voter.ts.
The script should: read active bounties, analyze each creator's content via the x402-gated API,
and vote on-chain for the best creator. Use viem for contract interaction."
```

---

## 17. Updated Use Cases (x402 + AI Agent)

### UC-7: AI Agent Auto-Votes via x402
**Actor:** Autonomous Claude-powered AI agent
**Flow:**
1. Agent script runs (manually or on cron)
2. Reads active bounties from BountyPlatform contract
3. For each bounty, fetches all creators and their content URIs
4. Pays $0.001 USDC via x402 to analyze each creator's content through Claude
5. Claude evaluates content quality and returns score + recommendation
6. Agent votes on-chain for the highest-scored creator (stakes 0.01 MON)
7. Vote is recorded same as human votes — counts toward 40% community score

**Constraints:**
- Agent wallet must hold MON (gas + stake) and USDC (x402 payments)
- One vote per wallet per bounty (same as humans)
- Agent votes have equal weight to human votes
- Multiple agent wallets can be deployed for more voting coverage

### UC-8: x402-Gated Content Analysis
**Actor:** Any client (human or AI agent)
**Flow:**
1. Client sends POST to /api/analyze-content with contentURI and bountyId
2. Server responds with HTTP 402 + x402 payment requirement ($0.001 USDC)
3. Client signs USDC transfer via x402 protocol
4. Facilitator verifies and settles payment on Monad
5. Server fetches content, sends to Claude for analysis
6. Returns JSON: { score, recommendation, reason }

**Value:** Monetizes AI analysis. Platform earns $0.001 per analysis. Enables autonomous agent participation.

---

## 18. Updated Tech Stack Additions

Add to the existing tech stack table:

| Layer | Technology | Why |
|-------|-----------|-----|
| **x402 Protocol** | @x402/core, @x402/evm, @x402/fetch, @x402/next (v2.2.0+) | HTTP-native micropayments for agent-to-agent commerce |
| **x402 Facilitator** | Monad Facilitator (https://x402-facilitator.molandak.org) | Batches transactions, covers gas for USDC payments |
| **USDC (Testnet)** | 0x534b2f3A21130d7a60830c2Df862319e593943A3 | Payment token for x402 micropayments |
| **AI Analysis** | Claude API (claude-sonnet-4-5-20250929) | Content quality evaluation for agent voting |
| **Agent Runtime** | tsx (TypeScript executor) | Run agent scripts directly |

---

## 19. Updated File Structure (x402 + Agent additions)

Add these to the existing file structure:

```
packages/nextjs/
├── app/api/
│   └── analyze-content/
│       └── route.ts                 # x402-gated Claude content analysis endpoint
├── scripts/
│   └── agent-voter.ts              # Autonomous AI agent voter script
├── lib/
│   └── x402-config.ts              # Shared x402 configuration
└── .env.local                       # PAY_TO_ADDRESS, ANTHROPIC_API_KEY, AGENT_PRIVATE_KEY
```

---

## 20. Demo Script Update (for x402 + AI Agent)

### Updated 2-Minute Pitch:

1. **Problem** (10s): "Creator economy is broken. Companies waste budgets, creators lack fair evaluation, audiences have no stake."

2. **BountySwipe** (10s): "Companies post bounties. Creators compete. Humans AND AI agents vote by staking tokens."

3. **Live Demo — Human Flow** (40s):
   - Create a bounty (deposit MON)
   - Creator joins with content
   - SWIPE TO VOTE (the wow moment)
   - Show leaderboard

4. **Live Demo — AI Agent** (30s): THIS IS YOUR DIFFERENTIATOR
   - "Now watch an AI agent vote autonomously"
   - Run the agent script
   - Show it paying USDC via x402 to analyze content
   - Show it voting on-chain
   - "The agent just paid, analyzed, and voted — zero human input"

5. **Why Monad** (15s): "Sub-second finality for instant swipes. Near-zero gas for agent voting. x402 for autonomous micropayments. This is the future of Social-Fi."

6. **Business Model** (15s): "10% platform fee on bounties PLUS $0.001 per AI analysis. Two revenue streams from one protocol."

---

---

## 14. x402 Integration — AI Agent Micropayments

### Overview
x402 is the HTTP 402 "Payment Required" protocol for internet-native micropayments. On Monad, it enables AI agents to autonomously pay for API access with USDC — zero friction, zero accounts, instant settlement.

**Reference Starter Kit:** https://github.com/rk-rishikesh/x402-starter
This starter uses a middleware-based approach where `paymentProxy()` gates all premium API routes. The API routes themselves contain ZERO payment logic — all verification is handled by the middleware.

### x402 on Monad Configuration
```
Network: eip155:10143 (Monad Testnet)
USDC Contract: 0x534b2f3A21130d7a60830c2Df862319e593943A3
Facilitator URL: https://x402-facilitator.molandak.org
Price per analysis: $0.001 USDC
Pay-To Address: Set via PAY_TO_ADDRESS env var
```

### Architecture: Middleware-Based Payment Gating (from x402-starter)

The x402-starter kit uses Next.js middleware to gate API routes. This is **simpler and cleaner** than per-route wrapping — payment logic lives in ONE file (`middleware.ts`), not scattered across routes.

**Step 1: Server-side middleware (`packages/nextjs/middleware.ts`):**
```typescript
import { paymentProxy } from "@x402/next";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";

const MONAD_NETWORK: Network = "eip155:10143";
const PAY_TO = process.env.PAY_TO_ADDRESS as `0x${string}`;

// Register Monad network with x402
const server = new x402ResourceServer()
  .register(MONAD_NETWORK, new ExactEvmScheme());

// Define payable routes
const routes = {
  "/api/premium/analyze-content": {
    accepts: [{
      scheme: "exact" as const,
      payTo: PAY_TO,
      price: "$0.001",
      network: MONAD_NETWORK,
    }],
    description: "AI Content Analysis for BountySwipe",
    mimeType: "application/json",
  },
};

export const middleware = paymentProxy(routes, server);
export const config = {
  matcher: ["/api/premium/:path*"],
};
```

**Step 2: API route with ZERO payment logic (`packages/nextjs/app/api/premium/analyze-content/route.ts`):**
```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { contentURI, bountyId } = await request.json();

  // Call Claude API to analyze the content
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `You are a content quality judge for a creator bounty platform.
        Analyze this content submission and provide:
        1. A quality score from 0-100
        2. A recommendation: "upvote" or "downvote"
        3. A brief reason (1 sentence)

        Content URI: ${contentURI}
        Bounty ID: ${bountyId}

        Respond in JSON format: { "score": number, "recommendation": "upvote" | "downvote", "reason": string }`
      }]
    }),
  });

  const claudeResponse = await response.json();
  const analysis = JSON.parse(claudeResponse.content[0].text);

  return NextResponse.json({
    bountyId,
    contentURI,
    analysis,
    analyzedAt: new Date().toISOString(),
  });
}
```

**Step 3: Client-side payment fetch (for agent or frontend):**
```typescript
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

// Create x402 client for Monad
const client = new x402Client();
registerExactEvmScheme(client, walletClient); // walletClient from viem/wagmi

// Wrap fetch — automatically handles 402 → pay → retry
const paymentFetch = wrapFetchWithPayment(fetch, client);

// This auto-pays $0.001 USDC when the server returns 402
const response = await paymentFetch("/api/premium/analyze-content", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contentURI, bountyId }),
});
```

### Required npm packages:
```bash
cd packages/nextjs
npm install @x402/core @x402/evm @x402/fetch @x402/next
```

### Environment variables (packages/nextjs/.env.local):
```
PAY_TO_ADDRESS=0xYourWalletAddress
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Key Differences from Original PRD Approach:
| Aspect | Before (withX402 per route) | Now (middleware pattern from starter) |
|--------|---------------------------|--------------------------------------|
| Payment logic | In each route file | ONE middleware.ts file |
| Route code | Mixed with x402 setup | Pure business logic only |
| Adding new paid routes | Copy x402 boilerplate | Add one entry to routes object |
| Facilitator setup | Manual in each route | Automatic via middleware |

---

## 15. Claude AI Agent Auto-Voter

### Overview
An autonomous AI agent script that:
1. Reads active bounties from the BountyPlatform contract
2. For each creator in a bounty, pays via x402 to analyze their content
3. Based on Claude's analysis, votes on-chain (upvote/downvote) with MON stake
4. Runs as a standalone Node.js script or cron job

### Agent Script (`packages/nextjs/scripts/agent-voter.ts`)

```typescript
import { createWalletClient, http, parseEther, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { x402Client } from "@x402/core/client";

const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
};

const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const account = privateKeyToAccount(AGENT_PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

// x402 setup
const evmSigner = {
  address: account.address,
  signTypedData: async (message: any) => {
    return account.signTypedData({
      domain: message.domain,
      types: message.types,
      primaryType: message.primaryType,
      message: message.message,
    });
  },
};

const exactScheme = new ExactEvmScheme(evmSigner);
const client = new x402Client().register("eip155:10143", exactScheme);
const paymentFetch = wrapFetchWithPayment(fetch, client);

const CONTRACT_ADDRESS = process.env.BOUNTY_CONTRACT_ADDRESS as `0x${string}`;
const ANALYSIS_API_URL = process.env.ANALYSIS_API_URL || "http://localhost:3000/api/analyze-content";

// BountyPlatform ABI will be imported from generated artifacts
import deployedContracts from "../contracts/deployedContracts";

async function runAgentVoter() {
  console.log(`Agent Voter starting... Wallet: ${account.address}`);

  const abi = deployedContracts[10143].BountyPlatform.abi;

  // Step 1: Get active bounties
  const activeBounties = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "getActiveBounties",
  }) as bigint[];

  console.log(`Found ${activeBounties.length} active bounties`);

  for (const bountyId of activeBounties) {
    // Step 2: Get creators
    const creators = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: "getBountyCreators",
      args: [bountyId],
    }) as `0x${string}`[];

    let bestCreator = { address: "" as `0x${string}`, score: 0, shouldUpvote: false };

    for (const creatorAddr of creators) {
      // Step 3: Get content URI
      const entry = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi,
        functionName: "getCreatorEntry",
        args: [bountyId, creatorAddr],
      }) as any;

      // Step 4: Pay via x402 to analyze with Claude
      try {
        const response = await paymentFetch(ANALYSIS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentURI: entry.contentURI,
            bountyId: bountyId.toString(),
          }),
        });

        const { analysis } = await response.json();
        console.log(`Creator ${creatorAddr}: Score ${analysis.score} - ${analysis.recommendation}`);

        if (analysis.score > bestCreator.score) {
          bestCreator = {
            address: creatorAddr,
            score: analysis.score,
            shouldUpvote: analysis.recommendation === "upvote",
          };
        }
      } catch (err) {
        console.error(`Failed to analyze ${creatorAddr}:`, err);
      }
    }

    // Step 5: Vote for best creator on-chain
    if (bestCreator.address && bestCreator.shouldUpvote) {
      console.log(`Voting for ${bestCreator.address} on bounty ${bountyId}`);

      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi,
        functionName: "vote",
        args: [bountyId, bestCreator.address, true],
        value: parseEther("0.01"),
      });

      console.log(`Vote TX: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Vote confirmed!`);
    }
  }

  console.log("Agent Voter complete!");
}

runAgentVoter().catch(console.error);
```

### Running the Agent
```bash
export AGENT_PRIVATE_KEY=0xyour_agent_wallet_key
export BOUNTY_CONTRACT_ADDRESS=0xdeployed_contract_address
export ANALYSIS_API_URL=https://your-app.vercel.app/api/analyze-content

npx tsx packages/nextjs/scripts/agent-voter.ts
```

### Agent Wallet Requirements:
- MON tokens for gas + voting stake (get from https://faucet.monad.xyz)
- USDC tokens for x402 payments (get from https://faucet.circle.com — select Monad Testnet)
- Claude API key set in the server's environment

---

## 16. Additional Use Cases (x402 + AI Agent)

### UC-7: AI Agent Auto-Votes via x402
**Actor:** Autonomous Claude-powered AI agent
**Flow:**
1. Agent script runs (manually or on cron)
2. Reads active bounties from BountyPlatform contract
3. For each bounty, fetches all creators and their content URIs
4. Pays $0.001 USDC via x402 to analyze each creator's content through Claude
5. Claude evaluates content quality and returns score + recommendation
6. Agent votes on-chain for the highest-scored creator (stakes 0.01 MON)
7. Vote is recorded same as human votes — counts toward 40% community score

**Constraints:**
- Agent wallet must hold MON (gas + stake) and USDC (x402 payments)
- One vote per wallet per bounty (same as humans)
- Agent votes have equal weight to human votes
- Multiple agent wallets can be deployed for more voting coverage

### UC-8: x402-Gated Content Analysis
**Actor:** Any client (human or AI agent)
**Flow:**
1. Client sends POST to /api/analyze-content with contentURI and bountyId
2. Server responds with HTTP 402 + x402 payment requirement ($0.001 USDC)
3. Client signs USDC transfer via x402 protocol
4. Facilitator verifies and settles payment on Monad
5. Server fetches content, sends to Claude for analysis
6. Returns JSON: { score, recommendation, reason }

**Value:** Monetizes AI analysis. Platform earns $0.001 per analysis. Enables autonomous agent participation.

---

## 17. Updated Tech Stack (x402 + AI Additions)

| Layer | Technology | Why |
|-------|-----------|-----|
| **x402 Protocol** | @x402/core, @x402/evm, @x402/fetch, @x402/next (v2.2.0+) | HTTP-native micropayments for agent commerce |
| **x402 Facilitator** | Monad Facilitator (https://x402-facilitator.molandak.org) | Batches txs, covers gas for USDC payments |
| **USDC (Testnet)** | 0x534b2f3A21130d7a60830c2Df862319e593943A3 | Payment token for x402 |
| **AI Analysis** | Claude API (claude-sonnet-4-5-20250929) | Content quality evaluation |
| **Agent Runtime** | tsx (TypeScript executor) | Run agent scripts directly |

---

## 18. Revised Dev Sprint (3-Hour Plan with x402 + AI Agent)

| Time | Sprint | Task |
|------|--------|------|
| 0:00–0:10 | **Setup** | Clone scaffold-monad, install deps, env files |
| 0:10–0:40 | **Contract** | Write BountyPlatform.sol, deploy script |
| 0:40–0:50 | **Deploy** | Compile, deploy to Monad Testnet |
| 0:50–1:15 | **Frontend Core** | Layout, theme, home page with bounty grid |
| 1:15–1:35 | **Create + Detail** | Create bounty form, bounty detail + leaderboard |
| 1:35–2:05 | **Swipe UI** | react-tinder-card voting interface |
| 2:05–2:25 | **x402 API** | Content analysis endpoint with x402 + Claude |
| 2:25–2:40 | **AI Agent** | Agent voter script, test with live bounty |
| 2:40–2:50 | **Judge + Claims** | Company judge page, claim buttons |
| 2:50–3:00 | **Deploy + Demo** | Vercel deploy, prepare demo flow |

### Claude Code Prompts for New Sprints:

**x402 Integration (2:05):**
```
"Read PRD.md Section 14. Install @x402/core @x402/evm @x402/fetch @x402/next in packages/nextjs.
Create /api/analyze-content route with x402 payment gating using Monad facilitator.
Use Claude API for content analysis. Add PAY_TO_ADDRESS and ANTHROPIC_API_KEY to .env.local."
```

**AI Agent (2:25):**
```
"Read PRD.md Section 15. Create packages/nextjs/scripts/agent-voter.ts.
The script reads active bounties, analyzes creator content via x402-gated API,
and votes on-chain for the best creator. Use viem for contract interaction."
```

---

## 19. Updated Demo Script (2-Minute Pitch)

1. **Problem** (10s): "Creator economy is broken. Companies waste budgets, creators lack fair evaluation, audiences have no stake."

2. **BountySwipe** (10s): "Companies post bounties. Creators compete. Humans AND AI agents vote by staking tokens."

3. **Live Demo — Human Flow** (40s):
   - Create a bounty (deposit MON)
   - Creator joins with content
   - SWIPE TO VOTE (the wow moment)
   - Show leaderboard updating in real-time

4. **Live Demo — AI Agent** (30s): **THIS IS YOUR DIFFERENTIATOR**
   - "Now watch an AI agent vote autonomously"
   - Run the agent script live
   - Show it paying USDC via x402 to analyze content
   - Show it voting on-chain
   - "The agent just paid, analyzed, and voted — zero human input"

5. **Why Monad** (15s): "Sub-second finality for instant swipes. Near-zero gas for agent voting. x402 for autonomous micropayments. This is Social-Fi meets Agentic AI."

6. **Business Model** (15s): "10% platform fee on bounties PLUS $0.001 per AI analysis. Two revenue streams."

---

## 20. Updated File Structure (Complete)

```
BountySwipe/
├── packages/
│   ├── hardhat/
│   │   ├── contracts/
│   │   │   └── BountyPlatform.sol
│   │   ├── deploy/
│   │   │   └── 00_deploy_your_contract.ts
│   │   ├── test/
│   │   │   └── BountyPlatform.test.ts
│   │   └── hardhat.config.ts
│   └── nextjs/
│       ├── app/
│       │   ├── page.tsx                         # Home — bounty browser
│       │   ├── layout.tsx                       # App layout + nav
│       │   ├── create/page.tsx                  # Create bounty form
│       │   ├── bounty/[id]/page.tsx             # Bounty detail + leaderboard
│       │   ├── bounty/[id]/swipe/page.tsx       # Swipe voting
│       │   ├── bounty/[id]/judge/page.tsx       # Company judging
│       │   ├── my-bounties/page.tsx             # User dashboard
│       │   └── api/analyze-content/route.ts     # x402-gated Claude analysis
│       ├── components/bountyswipe/
│       │   ├── BountyCard.tsx
│       │   ├── SwipeCard.tsx
│       │   ├── SwipeDeck.tsx
│       │   ├── Leaderboard.tsx
│       │   ├── BountyStatusBadge.tsx
│       │   ├── CountdownTimer.tsx
│       │   ├── CreateBountyForm.tsx
│       │   ├── JudgePanel.tsx
│       │   └── ClaimButton.tsx
│       ├── scripts/
│       │   └── agent-voter.ts                   # AI agent auto-voter
│       ├── lib/
│       │   └── x402-config.ts                   # Shared x402 config
│       ├── hooks/
│       │   └── useBountyData.ts
│       ├── scaffold.config.ts
│       └── .env.local
└── PRD.md
```
