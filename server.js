// -------------------- IMPORTS --------------------
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const { auth, requiresAuth } = require("express-openid-connect");
const Handlebars = require("handlebars");
const expressHandlebars = require("express-handlebars");
const {
  allowInsecurePrototypeAccess,
} = require("@handlebars/allow-prototype-access");
const Mailer = require('./mailer')

if(process.env.NODE_ENV !== 'production') {
  require('dotenv').config(".env")
}

// ----------------- MONGO DB CONNECT ---------------
async function dbConnect() {
  const db = await mongoose.connect(
    process.env.MONGO_URI,
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  console.log("Connected to DB");
}

dbConnect();

// ----------- APP / AUTH0 / OIDC CONFIG  -------------
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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
  secret: process.env.CLIENT_SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID, 
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
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
app.get("/users", requiresAuth(), async (req, res) => {
  const users = await User.find({});
  res.send(users);
});

//------------------ Transactions -------------------

app.get("/transactions", requiresAuth(), async (req, res) => {
  const transactions = await Transaction.find({});
  res.send(transactions);
});

app.get("/transactions/:id", requiresAuth(), async (req, res) => {
  const user = await User.findById(req.params.id)
  const transactions = await Transaction.find({});
  const filtered = transactions.filter(transaction => transaction.sender == user.email || transaction.recipient == user.email)
  res.send(filtered);
});

app.get("/transactions/sent/:id", requiresAuth(), async (req, res) => {
  const user = await User.findById(req.params.id)
  const transactions = await Transaction.find({})
  const filtered = transactions.filter(transaction => transaction.sender == user.email)
  res.send(filtered);
});

app.get("/transactions/recieved/:id", requiresAuth(), async (req, res) => {
  const user = await User.findById(req.params.id)
  const transactions = await Transaction.find({})
  const filtered = transactions.filter(transaction => transaction.recipient == user.email)
  res.send(filtered);
});

//------------------ Account -------------------
app.get("/account", requiresAuth(), async (req, res) => {
  const users = await User.find({});
  let user = await User.findOne({ email: req.oidc.user.email });



  if (!user) {
    let user = await User.create({
      email: req.oidc.user.email,
      balance: 0,
      friends: [],
      name: req.oidc.user.nickname,
    });
    const addFriendsUsers = users.filter((u) => {
      if (
        !user.friends.some((friend) => friend.email == u.email) &&
        u.email != req.oidc.user.email
      )
        return true
    });
    res.render("account", {
      loggedIn: req.oidc.isAuthenticated(),
      name: user.name,
      email: user.email,
      balance: Number.parseFloat(user.balance).toFixed(2),
      id: user._id,
      users: addFriendsUsers,
      anyUsers: addFriendsUsers.length > 0,
      friends: user.friends,
      anyFriends: user.friends.length > 0,
      transactions: false
    });
  } else {
    const addFriendsUsers = users.filter((u) => {
      if (
        !user.friends.some((friend) => friend.email == u.email) &&
        u.email != req.oidc.user.email
      )
        return true
    });

    const transactions = await Transaction.find({})
    const filtered = transactions.filter(transaction => transaction.recipient == user.email || transaction.sender == user.email)


    filtered.forEach(transaction => {
      transaction.sent = transaction.sender == user.email
    })

    res.render("account", {
      loggedIn: req.oidc.isAuthenticated(),
      name: user.name,
      email: user.email,
      balance: Number.parseFloat(user.balance).toFixed(2),
      id: user._id,
      users: addFriendsUsers,
      anyUsers: addFriendsUsers.length > 0,
      friends: user.friends,
      anyFriends: user.friends.length > 0,
      transactions: filtered.reverse()
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
app.post("/users/:id/transfer", requiresAuth(), async (req, res) => {
  const user = await User.findById(req.params.id)
  const recipient = await User.findOne({email: req.body.recipient})

  const amount = Number.parseFloat(req.body.amount).toFixed(2)

  await Transaction.create({sender: user.email, recipient:req.body.recipient, timeSent: new Date(), amount: amount})

  user.balance -= Number(amount)
  recipient.balance += Number(amount)

  await User.findByIdAndUpdate(req.params.id, {balance: user.balance})
  await User.findOneAndUpdate({email: req.body.recipient}, {balance: recipient.balance})
  
  res.redirect("/account");
});

app.post("/friends/invite", requiresAuth(), async (req, res) => {
  const email = req.body.email //to
  const mailer = new Mailer(req.oidc.user.email) //from
  mailer.sendMail(email)
  res.redirect("/account");
});


//other built in routes: /login, /logout, /callback
// ---------------------------------------------
module.exports = app;

