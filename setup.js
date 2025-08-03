require('dotenv').config();
const Discord = require('discord.js-selfbot-v13');

const client = new Discord.Client({ checkUpdate: false });

module.exports = {
  client,
  env: {
    city: process.env.CITY,
    delay: Number(process.env.DELAY)
  }
};
