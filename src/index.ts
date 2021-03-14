const express = require('express');
const bot = require('./bot.js');

const app = express();
const port = Number(process.env.PORT || 5000);

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
