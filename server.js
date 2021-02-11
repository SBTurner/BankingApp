// -------------------- IMPORTS --------------------
const express = require("express");
const bodyparser = require("body-parser")
const cors = require('cors'); 
const mongoose = require("mongoose")
const fs = require('fs')
const airports = require("./airports.json");
const { auth, requiresAuth } = require('express-openid-connect');
const Handlebars = require("handlebars")
const expressHandlebars = require("express-handlebars")
const {allowInsecurePrototypeAccess} = require("@handlebars/allow-prototype-access")

// ----------------- MONGO DB CONNECT ---------------
async function dbConnect() {
  const db = await mongoose.connect("mongodb://127.0.0.1:27017", { useNewUrlParser: true, useUnifiedTopology: true });
}

dbConnect()

// ----------- APP / AUTH0 / OIDC CONFIG  -------------
const app = express();
app.use(bodyparser.json())
app.use(cors())
require('dotenv').config('.env'); // Note: env vars should not be used in production

// set handlebars as view engine for the front end

const handlebars = expressHandlebars({
    handlebars: allowInsecurePrototypeAccess(Handlebars)
})
app.engine('handlebars', handlebars)
app.set("view engine", "handlebars")

// OIDC config
const openIDConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.CLIENT_SECRET,
  baseURL: 'http://localhost:3000',
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`
};

// OpenID Connect will attach /login, /logout, and /callback routes to the baseURL
app.use(auth(openIDConfig));

// ------------------ END POINTS -------------------
// -------------------- AIRPORTS -------------------
app.get("/airports", requiresAuth(), (req, res) => {
  let page = Number(req.query.page)
  let limit = Number(req.query.limit)
  const i1 = (limit*page)-limit
  const i2 = i1+limit
  const displayAirports = airports.slice( i1 , i2 )
  if (page && limit){
    res.status(200).send(displayAirports);
  }
  else {
    res.status(200).send(airports);
  }
});

app.post("/airports", requiresAuth(), (req, res) => {
  const airport = req.body
  if (Object.keys(airport).length > 0){
    airports.push(airport)
    fs.writeFile("airports.json", JSON.stringify(airports), (err) => {
      if (err) throw err;
    })
    res.status(201).send(airport)
  }
  res.status(400).send("Nice try... send in JSON format instead") 
});

// -------------------- AIRPORT -------------------
app.get("/airports/:airportICAO", requiresAuth(), (req, res) => {
  const airport = airports.filter( airport => airport.icao == req.params.airportICAO )
  if (airport && airport.length>0) {
    res.status(200).send(airport[0])
  }
  else {
    res.status(200).send("Couldn't find airport with icao " + req.params.airportICAO)
  }
});

app.put("/airports/:airportICAO", requiresAuth(), (req, res) => {
  const airport = req.body
  const index = airports.findIndex(airport => airport.icao === req.params.airportICAO)
  airports.splice(index, 1, airport);
  fs.writeFile("airports.json", JSON.stringify(airports), (err) => {
    if (err) throw err;
  })
  res.status(200).send(airport)
});

app.delete("/airports/:airportICAO", requiresAuth(), (req, res) => {
  const index = airports.findIndex(airport => airport.icao === req.params.airportICAO)
  const airport = airports.splice(index, 1)
  fs.writeFile("airports.json", JSON.stringify(airports), (err) => {
    if (err) throw err;
  })
  res.status(200).send("The airport has now been deleted")
});

// ------------ HOME PAGE / LOGIN -------------
// req.oidc.isAuthenticated is provided from the auth router and returns true/false
app.get("/", (req, res) => {
  res.render("home", { loggedIn: req.oidc.isAuthenticated() });
});

app.get('/profile', requiresAuth(), (req, res) => {
  res.render("profile", { loggedIn: req.oidc.isAuthenticated(), fn: req.oidc.user.given_name, ln: req.oidc.user.family_name, email: req.oidc.user.email });
})

//other built in routes: /login, /logout, /callback
// ---------------------------------------------
module.exports = app
