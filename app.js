const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");

const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let db = null;

const initilaizeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
  }
};

initilaizeDBAndServer();

// Register API-1

app.post("/register/", async (Request, Response) => {
  const { username, password, name, gender } = Request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO user(
          username,password,name,gender)
      VALUES(
          '${username}',
          '${hashedPassword}',
          '${name}',
          '${gender}');`;
    if (password.length < 6) {
      Response.status(400);
      Response.send("Password is too short");
    } else {
      await db.run(createUserQuery);
      Response.status(200);
      Response.send("User created successfully");
    }
  } else {
    Response.status(400);
    Response.send("User already exists");
  }
});

// Lgin API-2

app.post("/login/", async (Request, Response) => {
  const { username, password } = Request.body;
  const selectUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    Response.status(400);
    Response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      //Response.status(200);
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "JWT_TOKEN");
      Response.send({ jwtToken });
    } else {
      Response.status(400);
      Response.send("Invalid password");
    }
  }
});

//middleWare FUnction

const authenticateToken = (Request, Response, next) => {
  let jwtToken;
  const authHeaders = Request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    Response.status(401);
    Response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "JWT_TOKEN", async (error, payload) => {
      if (error) {
        Response.status(401);
        Response.send("Invalid JWT Token");
      } else {
        Request.username = payload.username;
        console.log(payload);
        //Request.tweetId = tweetId;
        //Request.tweet = tweet;
        next();
      }
    });
  }
};

// User Tweets Feed API-3

app.get("/user/tweets/feed/", authenticateToken, async (Request, Response) => {
  //const { payload } = Request.body;
  //const { user_id, name, username, gender } = payload;
  //console.log(name);
  const { username } = Request;
  const getUserIdsQuery = `
    SELECT user_id from user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdsQuery);

  const getFollowerIdsquery = `
    SELECT following_user_id FROM follower
    WHERE follower_user_id = '${getUserId.user_id}';`;
  const getFollowerIds = await db.all(getFollowerIdsquery);

  const getFollowerIdsSimple = getFollowerIds.map((each) => {
    return each.following_user_id;
  });
  const getTweetQuery = `
    SELECT user.username,tweet.tweet,tweet.date_time AS dateTime
    FROM user 
    INNER JOIN tweet ON user.user_id = tweet.user_id WHERE user.user_id in (${getFollowerIdsSimple})
    ORDER BY tweet.date_time DESC LIMIT 4;`;
  const responseResult = await db.all(getTweetQuery);
  Response.send(responseResult);
});

// API-4

app.get("/user/following/", authenticateToken, async (Request, Response) => {
  const { username } = Request;
  const getUserIdsQuery = `
    SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdsQuery);

  const getFollowerIdsQuery = `
    SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  const getFollowerIds = getFollowerIdsArray.map((each) => {
    return each.following_user_id;
  });

  const getFollowerResultQuery = `
    SELECT name FROM user WHERE user_id IN (${getFollowerIds});`;
  const responseResult = await db.all(getFollowerResultQuery);
  Response.send(responseResult);
});

//API-5

app.get("/user/followers/", authenticateToken, async (Request, Response) => {
  const { username } = Request;
  const getUserIdsQuery = `
    SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdsQuery);

  const getFollowerIdsQuery = `SELECT follower_user_id FROM follower WHERE following_user_id = ${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  console.log(getFollowerIdsArray);
  const getFollowerIds = getFollowerIdsArray.map((each) => {
    return each.follower_user_id;
  });
  console.log(`${getFollowerIds}`);

  const getFollowersNameQuery = `SELECT name FROM user WHERE user_id IN (${getFollowerIds});`;
  const getFollowersName = await db.all(getFollowersNameQuery);
  Response.send(getFollowersName);
});

// API-6

const api6Output = (tweetDate, linksCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetDate.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (Request, Response) => {
  const { tweetId } = Request.params;
  const { username, userId } = Request;
  const getUserIdsQuery = `
    SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdsQuery);
  //console.log(getUserId);
  const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);

  const getFollowingIds = getFollowingIdsArray.map((each) => {
    return each.following_user_id;
  });

  const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN(${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((each) => {
    return each.tweet_id;
  });

  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `SELECT count(user_id) AS likes FROM like WHERE tweet_id=${tweetId}`;
    const likes_count = await db.get(likes_count_query);

    const reply_count_query = `SELECT count(user_id) AS replies FROM reply WHERE tweet_id=${tweetId}`;
    const reply_count = await db.get(reply_count_query);

    const tweet_tweetDateQuery = `SELECT tweet,date_time FROM tweet WHERE tweet_id=${tweetId}`;
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);

    Response.send(api6Output(tweet_tweetDate, links_count, reply_count));
  } else {
    Response.status(401);
    Response.send("Invalid Request");
  }
});

//API-7
const convertLikeUserNameDBObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (Request, Response) => {
    const { tweetId } = Request.params;
    let { username } = Request;
    const getUserIdsQuery = `
    SELECT user_id FROM user WHERE username = '${username}';`;
    const getUserId = await db.get(getUserIdsQuery);

    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);

    const getFollowingIds = getFollowingIdsArray.map((each) => {
      return each.following_user_id;
    });
    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((each) => {
      return each.tweet_id;
    });
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUserNameQuery = `SELECT user.username AS like FROM user INNER JOIN like ON
        user.user_id = like.user_id WHERE like.Tweet_id = ${tweetId};`;
      const getLikedUserNameArray = await db.all(getLikedUserNameQuery);
      const getLikedUserNames = getLikedUserNameArray.map((each) => {
        return each.likes;
      });
      Response.send(
        convertLikeUserNameDBObjectToResponseObject(getLikedUserNames)
      );
    } else {
      Response.status(401);
      Response.send("Invalid Request");
    }
  }
);

//API-8

const convertUserNameReplyedDBObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (Request, Response) => {
    const { tweetId } = Request.params;
    let { username } = Request;
    const getUserIdsQuery = `
    SELECT user_id FROM user WHERE username = '${username}';`;
    const getUserId = await db.get(getUserIdsQuery);

    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);

    const getFollowingIds = getFollowingIdsArray.map((each) => {
      return each.following_user_id;
    });

    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((each) => {
      return each.tweet_id;
    });
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getUsernameReplyTweetsQuery = `
            SELECT user.name,reply.reply FROM user INNER JOIN reply ON
            user.user_id =reply.user_id
            WHERE reply.tweet_id = ${tweetId};`;
      const getUsernameReplyTweets = await db.all(getUsernameReplyTweetsQuery);
      Response.send(
        convertUserNameReplyedDBObjectToResponseObject(getUsernameReplyTweets)
      );
    } else {
      Response.status(401);
      Response.send("Invalid Request");
    }
  }
);

//API-9
app.get("/user/tweets/", authenticateToken, async (Request, Response) => {
  const { userId } = Request;
  const getTweetsQuery = `
    SELECT tweet,
        COUNT(DISTINCT like_id) AS likes,
        COUNT(DISTINCT reply_id) AS replies,
        date_time AS dateTime
    FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
    LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id = ${userId}
    GROUP BY tweet.tweet_id;`;
  const tweets = await db.all(getTweetsQuery);
  Response.send(tweets);
});

//API-10

app.post("/user/tweets/", authenticateToken, async (Request, Response) => {
  let { username } = Request;
  const getUserIdsQuery = `
    SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdsQuery);
  const { tweet } = Request.body;
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `INSERT INTO tweet(tweet,user_id,date_time)
  VALUES('${tweet}','${getUserId.user_id}','${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  Response.send("Created a Tweet");
});

//API-11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (Request, Response) => {
    let { username } = Request;
    const getUserIdsQuery = `
    SELECT user_id FROM user WHERE username = '${username}';`;
    const getUserId = await db.get(getUserIdsQuery);
    console.log(getUserId);
    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((each) => {
      return each.tweet_id;
    });
    console.log(getTweetIds);
    if (getTweetIds.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      Response.send("Tweet Removed");
    } else {
      Response.status(401);
      Response.send("Invalid Request");
    }
  }
);

module.exports = app;
