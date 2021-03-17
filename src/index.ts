import express from 'express';
import Bot from './bot.js';
require('dotenv').config()

const app = express();
const port = Number(process.env.PORT || 5000);

const databseURL = process.env.DATABASE_URL;
const authToken = process.env.TOKEN;
const groupID = process.env.GROUP_ID;
const botID = process.env.BOT_ID;

if (!databseURL) throw new Error('Missing DATABASE_URL');
if (!authToken) throw new Error('Missing TOKEN');
if (!groupID) throw new Error('Missing GROUP_ID');
if (!botID) throw new Error('Missing BOT_ID');

const bot = new Bot(databseURL, authToken, groupID, botID);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World, I\'m 420bot!');
});

app.post('/', async (req, res) => {
  console.log(req.body);
  await bot.respond(req.body, res);
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
