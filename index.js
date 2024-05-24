const express = require("express");
const cors = require("cors");
const app = express();
const request = require("request");
const dotenv = require("dotenv");
const axios = require("axios");
const { connectMongoDB } = require("./config/index");

const UserModel = require("./models/UserModel");
const BonusModel = require("./models/BonusModel");

dotenv.config();

const whitelist = [
  "http://localhost:5173",
  "https://swamps-airdrop-new.netlify.app",
  "https://swamps-fi-fe.vercel.app",
  "https://airdrop.swamps.fi",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(express.json());
// { extended: false }
app.use(cors(corsOptions));

connectMongoDB();

app.get("/", (req, res, next) => {
  res.send("Hello world!");
});

app.post("/get-challenge-by-id", (req, res, next) => {
  console.log(123, req.body);
  res.send("Hello world!");
});

app.post("/start-match", (req, res, next) => {
  console.log(234, req.body);
  res.send("Hello world!");
});

app.post("/submit-match-result", (req, res, next) => {
  const match_id = req.body.match_id;
  const result = req.body.result;
  console.log(345, req.body);
  res.send("Hello world!");
});


app.post("/api/v1/auth/twitter/reverse", (req, res, next) => {
  console.log("consumer key => ", process.env.consumerKey);
  console.log("consumer secret => ", process.env.consumerSecret);
  request.post(
    {
      url: "https://api.twitter.com/oauth/request_token",
      oauth: {
        // oauth_callback: `${process.env.CLIENT_URI}/callback`,
        consumer_key: process.env.consumerKey,
        consumer_secret: process.env.consumerSecret,
      },
    },
    function (err, r, body) {
      if (err) {
        console.log("twitter app access denied", err);
        return res.send(500, { message: err.message });
      }

      try {
        var jsonStr =
          '{ "' + body.replace(/&/g, '", "').replace(/=/g, '": "') + '"}';

        console.log("jsonStr => ", jsonStr);
        res.send(JSON.parse(jsonStr));
      } catch (error) {
        console.log("jsonstr err => ", error);
      }
    }
  );
});

// verify
app.post("/api/v1/auth/twitter", async (req, res, next) => {
  request.post(
    {
      url: "https://api.twitter.com/oauth/access_token",
      oauth: {
        consumer_key: process.env.consumerKey,
        consumer_secret: process.env.consumerSecret,
        token: req.query.oauth_token,
        verifier: req.query.oauth_verifier
      },
      // form: { oauth_verifier: req.query.oauth_verifier },
    },
    async function (err, r, body) {
      if (err) {
        console.log("oauth verify err", err);
        return res.send(500, { message: err.message });
      }

      const queryString = body;

      // Function to parse the query string
      function getParams(queryString) {
        return queryString.split("&").reduce((acc, param) => {
          const [key, value] = param.split("=");
          acc[key] = decodeURIComponent(value);
          return acc;
        }, {});
      }

      // Parse the query string
      const params = getParams(queryString);

      // Extract user_id and screen_name
      const user_id = params.user_id;
      const screen_name = params.screen_name;

      const user = await UserModel.findOne({ user_id: user_id });

      if (user) {
        if (user.state.follow && user.state.tweeted) {
          res.json({verify: true, screen_name, user_id, total_score: user.total_score, role: user.role });
        } else {
          res.json({verify: false, screen_name, user_id, total_score: user.total_score, role: user.role})
        }
      } else {
        const newUserSchema = new UserModel({
          user_id: user_id,
          screen_name: screen_name
        })
        const newUser = await newUserSchema.save();
        if (newUser) {
          res.json({verify: false, screen_name, user_id, score: newUser.total_score, role: newUser.role});
        }
      }
    }
  );
});

app.post("/api/v1/auth/follow", async ( req, res, next) => {
  const { user_id } = req.body;
  if( !user_id || user_id === "" ) return res.status(500).json({msg: "Please provide user id!"});
  const user = await UserModel.findOne({user_id: user_id});
  if(!user) return res.status(500).json({msg: "This user does not exist!"});
  try {    
    const followPool = await UserModel.findOneAndUpdate({user_id: user_id}, {'state.follow': true}, {new: true})
    if (followPool.state.follow && followPool.state.tweeted) {
      res.json({success: true});
    } else {
      res.json({succes: false})
    }
  } catch (error) {
    console.log("Follow error => ", error);
    res.status(500).json({err: error})
  }
})


app.post("/api/v1/auth/tweet", async ( req, res, next) => {
  const { user_id } = req.body;
  if( !user_id || user_id === "" ) return res.status(500).json({msg: "Please provide user id!"});
  const user = await UserModel.findOne({user_id: user_id});
  if(!user) return res.status(500).json({msg: "This user does not exist!"});
  try {    
    const tweetPool = await UserModel.findOneAndUpdate({user_id: user_id}, {'state.tweeted': true}, {new: true})
    if (tweetPool.state.follow && tweetPool.state.tweeted) {
      res.json({success: true});
    } else {
      res.json({succes: false})
    }
  } catch (error) {
    console.log("Follow error => ", error);
    res.status(500).json({err: error})
  }
})

app.post("/api/v1/score/update-user-score", async ( req, res, next) => {
  const { user_id, score } = req.body;
  try {
    const updatedUser = await UserModel.findOneAndUpdate(
      { user_id: user_id },
      { $inc: { total_score: score } },
      {
        returnDocument: "after",
      }
    );
    res.json({ success: true, updatedUser });
  } catch (error) {
    res.status(500).json({ err: error });
  }
})

app.get("/api/v1/score/get-bonus-points", async (req, res) => {

  try {
    const existingRecord = await BonusModel.findOne();

    if (existingRecord) {
      res.json({ success: true, bonus: existingRecord });
    } else {
      // Create a new record
      const newRecord = new ScoreModel({ winning_bonus, retweet_bonus });
      const savedRecord = await newRecord.save();
      res.json({ success: true, bonus: savedRecord });
    }
  } catch (error) {
    res.status(500).json({ err: error });
  }
});

app.post("/api/v1/score/update-bonus-points", async (req, res) => {
  const { winning_bonus, retweet_bonus } = req.body;

  if (typeof winning_bonus !== 'number' || typeof retweet_bonus !== 'number') {
    return res.status(400).json({ msg: "Please provide valid numbers for bonuses!" });
  }

  try {
    const existingRecord = await BonusModel.findOne();

    if (existingRecord) {
      // Update the existing record
      existingRecord.winning_bonus = winning_bonus;
      existingRecord.retweet_bonus = retweet_bonus;
      const updatedRecord = await existingRecord.save();
      res.json({ success: true, bonus: updatedRecord });
    } else {
      // Create a new record
      const newRecord = new BonusModel({ winning_bonus, retweet_bonus });
      const savedRecord = await newRecord.save();
      res.json({ success: true, bonus: savedRecord });
    }
  } catch (error) {
    res.status(500).json({ err: error });
  }
});

app.get("/api/v1/get-users", async (req, res) => {
  try {
    const users = await UserModel.find({}, 'screen_name total_score');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ err: error });
  }
});

const port = 2088;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
