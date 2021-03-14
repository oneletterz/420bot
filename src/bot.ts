const HTTPS = require('https');
const fetch = require('node-fetch');
const { Pool } = require('pg');

const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const botID = process.env.BOT_ID;
const groupID = process.env.GROUP_ID;
const authToken = process.env.TOKEN;

const schedule = require('node-schedule');

const reminder = schedule.scheduleJob('15 16 * * *', () => {
  postMessage('5 Minute warning!');
});

const fourTwizzle = schedule.scheduleJob('20 16 * * *', () => {
  postMessage('Happy 4:20!');
});

async function respond(request, res) {
  if (request == null) {
    return res.end();
  }

  const everyoneRegex = /(.*)@everyone(.*)/i;
  const smokeWeedRegex = /smoke weed/i;
  const whenRegex = /when/i;
  const qMarkRegex = /\?/;
  const beerRegex = /[+-]\dbeer/i;
  const beerRegex2 = /[+-]\d\dbeer/i;
  const alcoholicRegex = /alcoholi/i;
  const totalsRegex = /total/i;

  if (process.env.COCKSUCKER_ID === request.user_id) {
    request.name = 'Cocksucker';
  }
  request.name = request.name.replace(/'/g, '');

  // Check request against regexes
  if (request.sender_type === 'user' && request.text) {
    if (everyoneRegex.test(request.text)) {
      atEveryone(request.text);
    } else if (smokeWeedRegex.test(request.text)) {
      postMessage('everyday');
    } else if (whenRegex.test(request.text) && qMarkRegex.test(request.text)) {
      postMessage('4:20');
    } else if ((alcoholicRegex.test(request.text) || (false && totalsRegex.test(request.text))) && qMarkRegex.test(request.text)) {
      await postTotals();
    } else if (beerRegex.test(request.text) || beerRegex2.test(request.text)) {
      // Assign count and time to variables
      let strPos;
      let numBeers;
      const currTime = new Date().toLocaleString();

      if (beerRegex.test(request.text)) {
        strPos = request.text.search(beerRegex);
        numBeers = parseInt(request.text.charAt(strPos + 1));
      } else {
        strPos = request.text.search(beerRegex2);
        numBeers = parseInt(request.text.substring(strPos + 1, strPos + 3));
      }

      const addBeer = request.text.charAt(strPos) === '+';
      // Checks if positive or negative & negate if subtracting
      if (addBeer) {
        console.log(`Adding ${numBeers}beers for user_id: ${request.user_id
        }, created_at: ${request.created_at}, currTime: ${currTime}`);
      } else {
        console.log(`Subtracting ${numBeers}beers for user_id: ${request.user_id
        }, created_at: ${request.created_at}, currTime: ${currTime}`);
        numBeers *= -1;
      }

      // Call functions to update induvidual counts and total counts
      await addBeerUpdate(request.user_id, numBeers, currTime);
      await updateTotals(request.user_id, request.name, numBeers);
    }
    res.writeHead(200);
    res.end();
  }
}

async function addBeerUpdate(user_id, numBeers, currTime) {
  const client = await pg.connect();
  try {
    // Create a new table for the user if it doesn't already exist
    const createTableCommand = `CREATE TABLE IF NOT EXISTS u${user_id} (date text, count int)`;
    await client.query(createTableCommand);

    // Add row with time and count value
    const insertUpdateCommand = `INSERT INTO u${user_id} VALUES ('${currTime}', ${numBeers})`;
    await client.query(insertUpdateCommand);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
  }
}

async function updateTotals(user_id, userName, numBeers) {
  let groupTotal;
  let userTotal;
  let goalReached = false;
  const client = await pg.connect();
  try {
    // Create a totals table if it doesn't exist
    const createTableCommand = 'CREATE TABLE IF NOT EXISTS totals (user_id text, name text, count int)';
    let result;
    result = await client.query(createTableCommand);

    // GROUP
    // Retrieve totals & insert row if it doesn't exist
    const selectGroupCommand = "SELECT count FROM totals WHERE user_id = 'group'";
    result = await client.query(selectGroupCommand);
    // Check if group row exists
    if (result.rows.length === 0) {
      var insertRowCommand = "INSERT INTO totals VALUES ('group', 'group', 0)";
      await client.query(insertRowCommand);
      groupTotal = 0;
    } else {
      groupTotal = result.rows[0].count;
    }

    // Update totals
    const updateGroupTotal = `UPDATE totals SET count = count + ${numBeers} WHERE user_id = 'group'`;
    await client.query(updateGroupTotal);
    if (groupTotal < 420 && groupTotal + numBeers >= 420) { goalReached = true; }
    groupTotal += numBeers;

    // USER
    // Retrieve totals & insert row if it doesn't exist
    const selectUserCommand = `SELECT name, count FROM totals WHERE user_id = '${user_id}'`;
    result = await client.query(selectUserCommand);

    // Check if group row exists
    if (result.rows.length === 0) {
      var insertRowCommand = `INSERT INTO totals VALUES ('${user_id}', '${userName}', 0)`;
      await client.query(insertRowCommand);
      userTotal = 0;
    } else {
      userTotal = result.rows[0].count;
    }
    // Update totals
    const updateUserTotal = `UPDATE totals SET count = count + ${numBeers} WHERE user_id = '${user_id}'`;
    result = await client.query(updateUserTotal);

    userTotal += numBeers;
    // Update name
    const updateUserName = `UPDATE totals SET name = '${userName}' WHERE user_id = '${user_id}'`;
    await client.query(updateUserName);
    console.log(updateUserName);

    // Send an update message to the group chat
    if (numBeers === 1) {
      postMessage(`1 beer added! ${userName}'s new count: ${userTotal} Group total: ${groupTotal}`);
    } else if (numBeers < 1) {
      postMessage(`Subtracted ${Math.abs(numBeers)} beers. ${userName}'s new count: ${userTotal} Group total: ${groupTotal}`);
    } else {
      postMessage(`${numBeers} beers added! ${userName}'s new count: ${userTotal} Group total: ${groupTotal}`);
    }
    if (goalReached) {
      postMessage("Congratulations! Here's to another 420!");
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
  }
}

async function postTotals() {
  const client = await pg.connect();
  try {
    let totalsMessage = '';

    const selectGroupCommand = "SELECT count FROM totals WHERE user_id = 'group'";
    let result;
    result = await client.query(selectGroupCommand);
    // Check if group row exists
    if (result.rows.length === 0) {
      postMessage('No data found.');
    } else {
      totalsMessage += `Group total: ${result.rows[0].count}`;
    }
    const selectUsersCommand = "SELECT name, count FROM totals WHERE user_id != 'group'";
    result = await client.query(selectUsersCommand);

    // sort rows by name
    console.log(result.rows);
    result.rows.sort(countCompare);
    // loop through rows, adding counts to message
    for (let i = 0; i < result.rows.length; i++) {
      totalsMessage += `\r\n${result.rows[i].name}'s count: ${result.rows[i].count}`;
    }
    postMessage(totalsMessage);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
  }
}

function countCompare(a, b) {
  if (a.count > b.count) { return -1; }
  if (a.count < b.count) { return 1; }
  return 0;
}

function postMessage(message, attachments = null) {
  setTimeout(() => {
    let options; let body; let
      botReq;
    options = {
      hostname: 'api.groupme.com',
      path: '/v3/bots/post',
      method: 'POST',
    };

    body = {
      bot_id: botID,
      text: message,
    };
    if (attachments) {
      body.attachments = attachments;
    }

    console.log(`sending ${message} to ${botID} with attachments: ${JSON.stringify(attachments)}`);

    botReq = HTTPS.request(options, (res) => {
      if (res.statusCode == 202) {
        // neat
      } else {
        console.log(`rejecting bad status code ${res.statusCode}`);
      }
    });

    botReq.on('error', (err) => {
      console.log(`error posting message ${JSON.stringify(err)}`);
    });
    botReq.on('timeout', (err) => {
      console.log(`timeout posting message ${JSON.stringify(err)}`);
    });
    botReq.end(JSON.stringify(body));
  }, 900);
}

async function requestInfo(info) {
  console.log(`requesting ${info}`);

  const res = await fetch(`https://api.groupme.com/v3/${info}`, {
    headers: {
      'X-Access-Token': authToken,
    },
  });
  console.log(res);
  if (res.status != 200) {
    console.log(`rejecting bad status code ${res.status}`);
  }
  json = await res.json();
  console.log(json);
  return json.response;
}

async function atEveryone(text) {
  const attachments = [{ loci: [], type: 'mentions', user_ids: [] }];

  // Add "mention" for each user
  let response;
  try {
    response = await requestInfo(`groups/${groupID}`);
    console.log(response);
  } catch (err) {
    console.log(err);
  }
  for (let i = 0; i < response.members.length; i++) {
    const user = response.members[i];
    attachments[0].loci.push([i, i + 1]);
    attachments[0].user_ids.push(user.id);
  }

  text = `${text} 📣📣📣`;
  postMessage(text, attachments);
}

exports.respond = respond;
