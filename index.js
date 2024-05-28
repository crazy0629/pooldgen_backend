const express = require("express");
const cors = require("cors");
const app = express();
const request = require("request");
const dotenv = require("dotenv");
const axios = require("axios");
const { connectMongoDB } = require("./config/index");

const UserModel = require("./models/UserModel");
const BonusModel = require("./models/BonusModel");
const TweetModel = require("./models/TweetModel");

dotenv.config();

const whitelist = ["http://localhost:5173"];

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
        verifier: req.query.oauth_verifier,
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
      const default_tweets = await TweetModel.find({});
      let default_tweet;

      for (let i = 0; i < default_tweets.length; i++) {
        const user_tweeted = await UserModel.findOne({
          user_id: user_id,
          "tweets.tweet_id": default_tweets[i].tweet_id,
        });
        if (user_tweeted) {
          default_tweet = "tweet";
          continue;
        } else {
          default_tweet = default_tweets[i];
          break;
        }
      }

      if (!default_tweet || default_tweet === "tweet") {
        default_tweet = default_tweets[0];
      }

      if (user) {
        if (user.state.follow && user.state.tweeted) {
          res.json({
            verify: true,
            screen_name,
            user_id,
            total_score: user.total_score,
            role: user.role,
            follow: user.state.follow,
            default_tweet,
          });
        } else {
          res.json({
            verify: false,
            screen_name,
            user_id,
            total_score: user.total_score,
            role: user.role,
            follow: user.state.follow,
            default_tweet,
          });
        }
      } else {
        const newUserSchema = new UserModel({
          user_id: user_id,
          screen_name: screen_name,
        });
        const newUser = await newUserSchema.save();
        if (newUser) {
          res.json({
            verify: false,
            screen_name,
            user_id,
            score: newUser.total_score,
            role: newUser.role,
            follow: newUser.state.follow,
            default_tweet,
          });
        }
      }
    }
  );
});

app.post("/api/v1/auth/follow", async (req, res, next) => {
  const { user_id } = req.body;
  if (!user_id || user_id === "")
    return res.status(500).json({ err: "Please provide user id!" });
  const user = await UserModel.findOne({ user_id: user_id });
  if (!user) return res.status(500).json({ err: "This user does not exist!" });
  try {
    const followPool = await UserModel.findOneAndUpdate(
      { user_id: user_id },
      { "state.follow": true },
      { new: true }
    );
    if (followPool.state.follow && followPool.state.tweeted) {
      res.json({ success: true });
    } else {
      res.json({ succes: false });
    }
  } catch (error) {
    console.log("Follow error => ", error);
    res.status(500).json({ err: error });
  }
});

// app.post("/api/v1/auth/tweet", async ( req, res, next) => {
//   const { user_id } = req.body;
//   if( !user_id || user_id === "" ) return res.status(500).json({err: "Please provide user id!"});
//   const user = await UserModel.findOne({user_id: user_id});
//   if(!user) return res.status(500).json({err: "This user does not exist!"});
//   try {
//     const tweetPool = await UserModel.findOneAndUpdate({user_id: user_id}, {'state.tweeted': true}, {new: true})
//     if (tweetPool.state.follow && tweetPool.state.tweeted) {
//       res.json({success: true});
//     } else {
//       res.json({succes: false})
//     }
//   } catch (error) {
//     console.log("Follow error => ", error);
//     res.status(500).json({err: error})
//   }
// })

app.post("/api/v1/score/update-user-score", async (req, res, next) => {
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
});

app.get("/api/v1/score/get-bonus-points", async (req, res) => {
  try {
    const existingRecord = await BonusModel.findOne();

    if (existingRecord) {
      res.json({ success: true, bonus: existingRecord });
    } else {
      // Create a new record
      const newRecord = new BonusModel({ winning_bonus: 0, retweet_bonus: 0 });
      const savedRecord = await newRecord.save();
      res.json({ success: true, bonus: savedRecord });
    }
  } catch (error) {
    res.status(500).json({ err: error });
  }
});

app.post("/api/v1/score/update-bonus-points", async (req, res) => {
  const { winning_bonus, retweet_bonus } = req.body;

  if (typeof winning_bonus !== "number" || typeof retweet_bonus !== "number") {
    return res
      .status(400)
      .json({ err: "Please provide valid numbers for bonuses!" });
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
    const users = await UserModel.find({}, "screen_name total_score");
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ err: error });
  }
});

app.get("/api/v1/get-tweets", async (req, res) => {
  try {
    const tweets = await TweetModel.find();
    res.json({ success: true, tweets });
  } catch (error) {
    res.status(500).json({ err: error });
  }
});

app.post("/api/v1/get-tweet", async (req, res) => {
  try {
    const { user_id } = req.body;
    console.log('user id =>', user_id)
    const default_tweets = await TweetModel.find({});
    const user = await UserModel.findOne({ user_id });
    if (!user)
      return res.status(500).json({ err: "This user does not exist!" });
    if (!default_tweets || default_tweets.length === 0)
      return res
        .status(500)
        .json({ err: "There is no default tweet yet! Try again later" });
    let default_tweet;

    for (let i = 0; i < default_tweets.length; i++) {
      const user_tweeted = await UserModel.findOne({
        user_id: user_id,
        "tweets.tweet_id": default_tweets[i].tweet_id,
      });
      if (user_tweeted) {
        default_tweet = "tweet";
        continue;
      } else {
        default_tweet = default_tweets[i];
        break;
      }
    }

    if (!default_tweet || default_tweet === "tweet") {
      default_tweet = default_tweets[0];
    }
    console.log("getting tweet default tweet =>", default_tweet);

    res.json({ default_tweet });
  } catch (error) {
    console.log("default tweet error => ", error);
    res.status(500).json({ err: error });
  }
});

app.post("/api/v1/addtweet", async (req, res) => {
  try {
    const { tweet_id, content } = req.body;
    if (!tweet_id || !content || tweet_id === "" || content === "")
      return res.status(500).json({ err: "Please provide valid content!" });
    const tweet = await TweetModel.findOne({ tweet_id: tweet_id });
    if (tweet) {
      res.status(500).json({ err: "This tweet was already registered!" });
    } else {
      const newTweet = new TweetModel({
        tweet_id,
        content,
      });
      await newTweet.save();
      const tweets = await TweetModel.find({});
      res.json({ tweets });
    }
  } catch (error) {
    console.log("add tweet error => ", error);
    res.status(500).json({ err: error });
  }
});

app.post("/api/v1/settweet", async (req, res) => {
  const { user_id, tweet_id } = req.body;
  console.log("tweet id => ", tweet_id);
  try {
    if (!user_id || !tweet_id)
      return res.status(500).json({ err: "Please provide all params!" });
    const user = await UserModel.findOne({ user_id: user_id });
    const tweet = await TweetModel.findOne({ tweet_id: tweet_id });
    if (!user || !tweet)
      return res.status(500).json({ err: "This user or tweet is not exist!" });

    const isTweet = await UserModel.findOne({
      user_id: user_id,
      "tweets.tweet_id": tweet_id,
    });
    const tweet_score = await BonusModel.findOne();
    if (!tweet_score)
      return res.status(500).json({ err: "There is no default score yet!" });
    if (isTweet) {
      res.status(500).json({ err: "You already tweeted this tweet!" });
    } else {
      console.log("tweet default tweet setting.");

      const axios = require("axios");

      const options = {
        method: "GET",
        url: "https://twitter-api45.p.rapidapi.com/checkretweet.php",
        params: {
          screenname: user.screen_name,
          tweet_id: tweet_id,
        },
        headers: {
          "X-RapidAPI-Key":
            process.env.RAPID_API_KEY,
          "X-RapidAPI-Host": "twitter-api45.p.rapidapi.com",
        },
      };

      try {
        const response = await axios.request(options);
        console.log(response.data);
        if (response.data.is_retweeted) {
          const user_tweeted = await UserModel.findOneAndUpdate(
            { user_id: user_id },
            {
              $push: { tweets: { tweet_id: tweet_id } },
              "state.tweeted": true,
            },
            { new: true }
          );
          res.json({ success: true, user: user_tweeted });
        } else {
          res.json({success: false})
        }
      } catch (error) {
        console.error(error);
      }

      
    }
  } catch (error) {
    console.log("error => ", error);
    res.status(500).json({ err: error });
  }
});

const port = 2088;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
