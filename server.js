// -------------------- IMPORTS --------------------
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const { auth, requiresAuth } = require("express-openid-connect");
const Handlebars = require("handlebars");
const expressHandlebars = require("express-handlebars");
const {
  allowInsecurePrototypeAccess,
} = require("@handlebars/allow-prototype-access");
const e = require("express");

// ----------------- MONGO DB CONNECT ---------------
async function dbConnect() {
  const db = await mongoose.connect(
    "mongodb+srv://dbMe:dbMePassword@apps.ywfb7.mongodb.net/bankapp?retryWrites=true&w=majority",
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  console.log("Connected to DB");
}

dbConnect();

// ----------- APP / AUTH0 / OIDC CONFIG  -------------
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cors());
require("dotenv").config(".env"); // Note: env vars should not be used in production

// set handlebars as view engine for the front end

const handlebars = expressHandlebars({
  handlebars: allowInsecurePrototypeAccess(Handlebars),
});
app.engine("handlebars", handlebars);
app.set("view engine", "handlebars");

//Custom handlebars
const hbs = expressHandlebars.create({
    helpers: {
        removeUser: function() {
            
        }
    },
    handlebars: allowInsecurePrototypeAccess(Handlebars)
})
hbs.handlebars.registerHelper('ifGreaterThan', function(arg1, arg2, options) {
    return (arg1 > arg2) ? options.fn(this) : options.inverse(this);
});

// OIDC config
const openIDConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.CLIENT_SECRET, // ceuhIoxgtrP0NIhTR_q5uMflYjjRK5KgC8u41m_dd2f8ncJuqKd93isAD5S60oOd
  baseURL: "http://localhost:3000",
  clientID: process.env.CLIENT_ID, // jtJUXVPmTJyeguonWQd0tPTgdzAdKSG8
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`, // dev-i7irgy9t
};

// OpenID Connect will attach /login, /logout, and /callback routes to the baseURL
app.use(auth(openIDConfig));

// ------------------ END POINTS -------------------

// req.oidc.isAuthenticated is provided from the auth router and returns true/false

app.get("/", async (req, res) => {
  res.render("home", { loggedIn: req.oidc.isAuthenticated() });
});
// friends list  if (user.friends.some(friend => friend.email == u.email)) return true

//------------------ Users -------------------
app.get("/users", async (req, res) => {
  const users = await User.find({});
  res.send(users);
});

//------------------ Account -------------------
app.get("/account", requiresAuth(), async (req, res) => {
  const users = await User.find({});
  let user = await User.findOne({ email: req.oidc.user.email });
  const addFriendsUsers = users.filter((u) => {
    if (
      !user.friends.some((friend) => friend.email == u.email) &&
      u.email != req.oidc.user.email
    )
      return true
  });

  if (!user) {
    let user = await User.create({
      email: req.oidc.user.email,
      balance: 0,
      friends: [],
      name: req.oidc.users.nickname,
    });
    res.render("account", {
      loggedIn: req.oidc.isAuthenticated(),
      name: user.name,
      email: user.email,
      balance: user.balance,
      id: user._id,
      users: addFriendsUsers,
      anyUsers: addFriendsUsers.length > 0,
      friends: user.friends,
      anyFriends: user.friends.length > 0
    });
  } else {
    res.render("account", {
      loggedIn: req.oidc.isAuthenticated(),
      name: user.name,
      email: user.email,
      balance: user.balance,
      id: user._id,
      users: addFriendsUsers,
      anyUsers: addFriendsUsers.length > 0,
      friends: user.friends,
      anyFriends: user.friends.length > 0
    });
  }
});

//----------------- Balance ------------------
app.post("/users/:id/balance", requiresAuth(), async (req, res) => {
  const user = await User.findById(req.params.id)
  user.balance += Number(req.body.balance)

  await User.findByIdAndUpdate(req.params.id, {
    balance: user.balance
  });
  res.redirect("/account");
});

//----------------- Friends ------------------
app.post("/users/:id/friends", requiresAuth(), async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user.friends.some(friend => friend.email == req.body.friend_email)) {
    user.friends.push({email: req.body.friend_email, _id: req.body.friend_id })
    await User.findByIdAndUpdate(req.params.id, {friends: user.friends})
  }
  res.redirect("/account");
});

//----------------- Transfer ------------------
app.post("/users/:id/transfer", async (req, res) => {
  const user = await User.findById(req.params.id)
  const recipient = await User.findOne({email: req.body.recipient})
  
  user.balance -= req.body.amount
  recipient.balance += Number(req.body.amount)

  await User.findByIdAndUpdate(req.params.id, {balance: user.balance})
  await User.findOneAndUpdate({email: req.body.recipient}, {balance: recipient.balance})
  
  res.redirect("/account");
});

//----------------- Transfer ------------------
app.post("/users/:id/invite", async (req, res) => {
  // TO DO
});


//other built in routes: /login, /logout, /callback
// ---------------------------------------------
module.exports = app;

