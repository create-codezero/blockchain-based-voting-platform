// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OnlineVoting {
    address public admin;
    uint public electionEndTime;

    struct Candidate {
        uint id;
        string name;
        string photoFileName;
        uint age;
        uint256 dob;
        string region;
        uint experience;
        string manifestoFileName;
        uint voteCount;
    }

    struct Voter {
        bool hasVoted;
        uint votedCandidateId;
    }

    struct User {
        string name;
        string mobile;
        string aadhar;
        address userAddress;
        bool isRegistered;
    }

    mapping(uint => Candidate) public candidates;
    mapping(address => Voter) public voters;
    mapping(address => User) public users;
    mapping(string => address) private registeredAadhars;

    uint public candidatesCount;
    uint public usersCount;

    event VoteCasted(address indexed voter, uint candidateId);
    event CandidateRegistered(uint candidateId, string name);
    event CandidateAdded(uint id, string name);
    event Voted(uint candidateId, address voter);
    event UserRegistered(
        address indexed userAddress,
        string name,
        string mobile,
        string aadhar
    );
    event UserLoggedIn(address indexed userAddress);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier electionOngoing() {
        require(block.timestamp < electionEndTime, "Election has ended");
        _;
    }

    constructor(uint _durationMinutes) {
        admin = msg.sender;
        electionEndTime = block.timestamp + (_durationMinutes * 1 minutes);
    }

    function addCandidate(
        string memory _name,
        string memory _photoFileName,
        uint _age,
        uint256 _dob,
        string memory _region,
        uint _experience,
        string memory _manifestoFileName
    ) public onlyAdmin {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(
            candidatesCount,
            _name,
            _photoFileName,
            _age,
            _dob,
            _region,
            _experience,
            _manifestoFileName,
            0
        );

        emit CandidateAdded(candidatesCount, _name);
    }

    function vote(uint _candidateId) public electionOngoing {
        require(!voters[msg.sender].hasVoted, "You have already voted");
        require(
            _candidateId > 0 && _candidateId <= candidatesCount,
            "Invalid candidate ID"
        );

        voters[msg.sender] = Voter(true, _candidateId);
        candidates[_candidateId].voteCount++;

        emit VoteCasted(msg.sender, _candidateId);
    }

    function getWinner()
        public
        view
        returns (string memory winnerName, uint winnerVotes)
    {
        // require(block.timestamp > electionEndTime, "Election is still ongoing");

        uint maxVotes = 0;
        string memory leadingCandidate = "";

        for (uint i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > maxVotes) {
                maxVotes = candidates[i].voteCount;
                leadingCandidate = candidates[i].name;
            }
        }

        return (leadingCandidate, maxVotes);
    }

    function getCandidate(
        uint _candidateId
    )
        public
        view
        returns (
            string memory,
            string memory,
            uint,
            uint,
            string memory,
            uint,
            string memory,
            uint
        )
    {
        require(
            _candidateId > 0 && _candidateId <= candidatesCount,
            "Invalid candidate ID"
        );
        Candidate memory candidate = candidates[_candidateId];

        return (
            candidate.name,
            candidate.photoFileName,
            candidate.age,
            candidate.dob,
            candidate.region,
            candidate.experience,
            candidate.manifestoFileName,
            candidate.voteCount
        );
    }

    function registerUser(
        string memory _name,
        string memory _mobile,
        string memory _aadhar
    ) public returns (bool) {
        require(
            !users[msg.sender].isRegistered,
            "User already registered with this address"
        );
        require(
            registeredAadhars[_aadhar] == address(0),
            "Aadhar number already registered"
        );

        usersCount++;
        users[msg.sender] = User(_name, _mobile, _aadhar, msg.sender, true);
        // registeredAadhars[_aadhar] = true; // Mark Aadhar as registered
        registeredAadhars[_aadhar] = msg.sender;

        emit UserRegistered(msg.sender, _name, _mobile, _aadhar);

        return true;
    }

    function getUser(
        address _userAddress
    )
        public
        view
        returns (string memory, string memory, string memory, address)
    {
        require(users[_userAddress].isRegistered, "User not found");
        User memory user = users[_userAddress];
        return (user.name, user.mobile, user.aadhar, user.userAddress);
    }

    function loginUser(
        string memory _aadhar,
        address _userAddress
    ) public view returns (bool) {

        require(
            registeredAadhars[_aadhar] != address(0),
            "Aadhar not registered"
        );

        address registeredAddress = registeredAadhars[_aadhar];
        require(
            registeredAddress == _userAddress,
            "Invalid Aadhar or Ethereum address"
        ); // Match both

        return true; // Successful login
    }
}
