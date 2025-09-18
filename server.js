import express from "express";
import cors from "cors";
import Web3 from "web3";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import ejs from "ejs";
import multer from "multer";
import moment from "moment";

import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const uploadDir = path.join(process.cwd(), "uploads");
const imageDir = path.join(uploadDir, "images");
const docsDir = path.join(uploadDir, "docs");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir);
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);


app.use(session({
  secret: "secret_key",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, imageDir);
    } else {
      cb(null, docsDir);
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const web3 = new Web3("http://127.0.0.1:8545");

const contractPath = "./build/contracts/OnlineVoting.json";
const contractJson = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const contractABI = contractJson.abi;
const contractAddress = contractJson.networks[1337].address;
const votingContract = new web3.eth.Contract(contractABI, contractAddress);

let accounts = [];

async function getAccounts() {
  accounts = await web3.eth.getAccounts();
}
getAccounts();

let userIndex = 1;

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
      next();
  } else {
      res.redirect("/user/auth")
  }
};


app.get("/", async (req, res) => {
  try {
    res.render("index");
  } catch (error) {
    res.status(500).send("Error");
  }
});

app.get("/dashboard", isAuthenticated, async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/user/auth");
  }
  try {
    const candidatesCount = Number(
      await votingContract.methods.candidatesCount().call()
    );
    let candidates = [];
    for (let i = 1; i <= candidatesCount; i++) {
      const candidate = await votingContract.methods.candidates(i).call();
      candidates.push({
        id: Number(candidate.id),
        name: candidate.name,
        age: Number(candidate.age),
        dob: new Date(Number(candidate.dob) * 1000).toISOString().split("T")[0],
        region: candidate.region,
        experience: Number(candidate.experience),
        photoFileName: candidate.photoFileName,
        manifestoFileName: candidate.manifestoFileName,
        voteCount: Number(candidate.voteCount),
      });
    }
    res.render("dashboard", { candidates, user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching candidates");
  }
});

app.get("/admin", async (req, res) => {
  try {
    const candidatesCount = Number(
      await votingContract.methods.candidatesCount().call()
    );
    let candidates = [];
    for (let i = 1; i <= candidatesCount; i++) {
      const candidate = await votingContract.methods.candidates(i).call();
      candidates.push({
        id: Number(candidate.id),
        name: candidate.name,
        age: Number(candidate.age),
        dob: new Date(Number(candidate.dob) * 1000).toISOString().split("T")[0],
        region: candidate.region,
        experience: Number(candidate.experience),
        photoFileName: candidate.photoFileName,
        manifestoFileName: candidate.manifestoFileName,
        voteCount: Number(candidate.voteCount),
      });
    }
    res.render("admin", { candidates });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching candidates");
  }
});

app.get("/user/auth", async (req, res) => {
  try {
    if (req.session.user) {
      res.redirect("/dashboard");
    } else {
      res.render("userAuth");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error");
  }
});

app.post("/register", async (req, res) => {
  try {
    const { name, mobile, aadhar } = req.body;

    if (!name || !mobile || !aadhar) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (userIndex >= accounts.length) {
      return res
        .status(500)
        .json({ message: "No more Ethereum accounts available" });
    }

    const userAddress = accounts[userIndex];
    userIndex++;

    console.log(
      `Registering user: ${name}, Mobile: ${mobile}, Aadhar: ${aadhar}, Address: ${userAddress}`
    );

    const receipt = await votingContract.methods
      .registerUser(name, mobile, aadhar)
      .send({ from: userAddress, gas: 30000000 });

    if (receipt && receipt.status) {
      console.log(
        `Registered Successfully! username: ${name}, Mobile: ${mobile}, Aadhar: ${aadhar}, Address: ${userAddress}`
      );

      const userExists = await votingContract.methods.getUser(userAddress).call();
      

      if (userExists[3] !== userAddress) {
        return res.status(401).json({ message: "Invalid Aadhar or Ethereum Address" });
      }

      req.session.user = {
        name: userExists[0],
        mobile: userExists[1],
        aadhar: userExists[2],
        userAddress: userExists[3]
      };

      res.json({
        success: true,
        message: "User registered successfully!",
        ethereumAddress: userAddress,
        transaction: receipt.transactionHash,
      });

    } else {
      res.status(500).json({ success: false, message: "User registration failed!" });
    }


  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { aadhar, ethAddress } = req.body;

    if (!aadhar || !ethAddress) {
      return res
        .status(400)
        .json({ message: "Aadhar and Ethereum address are required" });
    }

    const isValid = await votingContract.methods
      .loginUser(aadhar, ethAddress)
      .call();

    if (isValid) {
      const userExists = await votingContract.methods.getUser(ethAddress).call();
      

      if (userExists[3] !== ethAddress) {
        return res.status(401).json({ message: "Invalid Aadhar or Ethereum Address" });
      }

      req.session.user = {
        name: userExists[0],
        mobile: userExists[1],
        aadhar: userExists[2],
        userAddress: userExists[3]
      };

      res.json({ message: "Login successful!", ethereumAddress: ethAddress });



    } else {
      res.status(401).json({ message: "Invalid Aadhar or Ethereum address" });
    }



  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ message: "Error logging in" });
  }
});

app.post("/vote", isAuthenticated, async (req, res) => {
  try {
    const { candidateId } = req.body;

    let voterAddress = req.session.user.userAddress;

    await votingContract.methods
      .vote(candidateId)
      .send({ from: voterAddress, gas: 30000000 });
    res.json({ message: "Vote casted successfully" });
  } catch (error) {
    let actualError;
    if (error?.cause?.message) {
        actualError = error.cause.message;
        console.error("Smart Contract Error:", error.cause.message);
    } else if (error?.message) {
        actualError = error.message;
        console.error("Smart Contract Error:", error.message);
    } else {
        actualError = "Unknown Smart Contract Error";
        console.error("Unknown Smart Contract Error");
    }
    res
      .status(500)
      .json({ message: actualError, error: error.message });
  }
});

app.post(
  "/addCandidate",
  upload.fields([{ name: "photo" }, { name: "manifesto" }]),
  async (req, res) => {
    try {
      const { name, age, dob, region, experience, adminAddress } = req.body;
      const photoFileName = req.files["photo"][0].filename;
      const manifestoFileName = req.files["manifesto"][0].filename;

      const dobTimestamp = moment(dob, "YYYY-MM-DD").unix();

      console.log(
        `Adding candidate: ${name}, Age: ${age}, Region: ${region}, photo: ${photoFileName}, menifesto: ${manifestoFileName}`
      );

      const accounts = await web3.eth.getAccounts();
      await votingContract.methods
        .addCandidate(
          name,
          photoFileName,
          parseInt(age),
          dobTimestamp,
          region,
          parseInt(experience),
          manifestoFileName
        )
        .send({ from: adminAddress, gas: 3000000 });

      res.json({ message: "Candidate added successfully!" });
    } catch (error) {
      console.error("Error adding candidate:", error);
      res.status(500).json({ message: "Failed to add candidate." });
    }
  }
);

app.use("/uploads", express.static(uploadDir));

app.get("/results", async (req, res) => {
  try {
    const result = await votingContract.methods.getWinner().call();
    const winnerName = result[0];
    const winnerVotes = Number(result[1]);

    res.json({ winner: winnerName, votes: winnerVotes });
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ message: "Error fetching results" });
  }
});

app.get("/check-session", (req, res) => {
  if (req.session.user) {
      res.json({ loggedIn: true, user: req.session.user });
  } else {
      res.json({ loggedIn: false });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          return res.status(500).json({ success: false, message: "Logout failed" });
      }
      res.redirect("/user/auth");
  });
});


app.use("/css", express.static(path.join(__dirname, 'public/css'), { 
  setHeaders: (res) => {
    res.set('Content-Type', 'text/css'); 
  } 
}));

app.use("/js", express.static(path.join(__dirname, 'public/js'), { 
  setHeaders: (res) => {
    res.set('Content-Type', 'text/js'); 
  } 
}));


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

