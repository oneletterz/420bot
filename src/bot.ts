import { Pool } from 'pg';
import schedule from 'node-schedule';
import { Response } from 'express';
import GroupmeHelper from './groupme-helpers';

export default class Bot {
  authToken: string;
  groupID: string;
  botID: string;

  pg: Pool;
  gh: GroupmeHelper;

  constructor(databaseURL: string, authToken: string, groupID: string, botID: string) {
    this.authToken = authToken;
    this.groupID = groupID;
    this.botID = botID;

    this.pg = new Pool({ connectionString: databaseURL });
    this.gh = new GroupmeHelper(authToken, groupID, botID);
    
    schedule.scheduleJob('15 16 * * *', () => {
      this.gh.postMessage('5 Minute warning!');
    });
    
    schedule.scheduleJob('20 16 * * *', () => {
      this.gh.postMessage('Happy 4:20!');
    });
  }

  async atEveryone(text: string) {
    type Attachment = { loci: number[][], type: string, user_ids: string[] };
    const attachments: Attachment[] = [{ loci: [], type: 'mentions', user_ids: [] }];

    // Add "mention" for each user
    let response;
    try {
      response = await this.gh.requestInfo(`groups/${this.groupID}`);
      console.log(response);
    } catch (err) {
      console.log(err);
    }
    for (let i = 0; i < response.members.length; i++) {
      const user = response.members[i];
      attachments[0].loci.push([i, i + 1]);
      attachments[0].user_ids.push(user.id);
    }

    return this.gh.postMessage(`${text} 📣📣📣`, attachments);
  }

  async respond(message: MessageResponse, response: Response) {
    if (message == null) return response.end();
    
    const name = message.name.replace(/'/g, '');
    const userID = message.user_id;

    const beerRegex = /[+-]\dbeer/i;
    const beerRegex2 = /[+-]\d\dbeer/i;

    // Check request against regexes
    if (message.sender_type === 'user' && message.text) {
      if (/(.*)@everyone(.*)/i.test(message.text)) {
        this.atEveryone(message.text);
      } else if (/smoke weed/i.test(message.text)) {
        this.gh.postMessage('everyday');
      } else if (/when/i.test(message.text) && /\?/.test(message.text)) {
        this.gh.postMessage('4:20');
      } else if ((/alcoholi/i.test(message.text) || (false && /total/i.test(message.text))) && /\?/.test(message.text)) {
        await this.postTotals();
      } else if (beerRegex.test(message.text) || beerRegex2.test(message.text)) {
        // Assign count and time to variables
        let strPos;
        let numBeers;

        if (beerRegex.test(message.text)) {
          strPos = message.text.search(beerRegex);
          numBeers = parseInt(message.text.charAt(strPos + 1), 10);
        } else {
          strPos = message.text.search(beerRegex2);
          numBeers = parseInt(message.text.substring(strPos + 1, strPos + 3), 10);
        }

        const currTime = new Date().toLocaleString();
        const addBeer = message.text.charAt(strPos) === '+';
        // Checks if positive or negative & negate if subtracting
        if (addBeer) {
          console.log(`Adding ${numBeers}beers for user_id: ${userID
          }, created_at: ${message.created_at}, currTime: ${currTime}`);
        } else {
          console.log(`Subtracting ${numBeers}beers for user_id: ${userID
          }, created_at: ${message.created_at}, currTime: ${currTime}`);
          numBeers *= -1;
        }

        // Call functions to update induvidual counts and total counts
        await this.addBeerUpdate(userID, numBeers, currTime);
        await this.updateTotals(userID, name, numBeers);
      }
      response.writeHead(200);
      response.end();
    }
  }

  async addBeerUpdate(user_id: string, numBeers: number, time: string) {
    const client = await this.pg.connect();
    try {
      // Create a new table for the user if it doesn't already exist
      const createTableCommand = `CREATE TABLE IF NOT EXISTS u${user_id} (date text, count int)`;
      await client.query(createTableCommand);

      // Add row with time and count value
      const insertUpdateCommand = `INSERT INTO u${user_id} VALUES ('${time}', ${numBeers})`;
      await client.query(insertUpdateCommand);
    } catch (err) {
      console.error(err);
    } finally {
      client.release();
    }
  }

  async updateTotals(user_id: string, userName: string, numBeers: number) {
    let groupTotal;
    let userTotal;
    let goalReached = false;
    const client = await this.pg.connect();
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
        this.gh.postMessage(`1 beer added! ${userName}'s new count: ${userTotal} Group total: ${groupTotal}`);
      } else if (numBeers < 1) {
        this.gh.postMessage(`Subtracted ${Math.abs(numBeers)} beers. ${userName}'s new count: ${userTotal} Group total: ${groupTotal}`);
      } else {
        this.gh.postMessage(`${numBeers} beers added! ${userName}'s new count: ${userTotal} Group total: ${groupTotal}`);
      }
      if (goalReached) {
        this.gh.postMessage("Congratulations! Here's to another 420!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      client.release();
    }
  }

  async postTotals() {
    const client = await this.pg.connect();
    try {
      let totalsMessage = '';

      const selectGroupCommand = "SELECT count FROM totals WHERE user_id = 'group'";
      let result;
      result = await client.query(selectGroupCommand);
      // Check if group row exists
      if (result.rows.length === 0) {
        this.gh.postMessage('No data found.');
      } else {
        totalsMessage += `Group total: ${result.rows[0].count}`;
      }
      const selectUsersCommand = "SELECT name, count FROM totals WHERE user_id != 'group'";
      result = await client.query(selectUsersCommand);

      // sort rows by name
      console.log(result.rows);
      result.rows.sort((a: number, b: number) => b - a);
      // loop throuthis.gh rows, adding counts to message
      for (let i = 0; i < result.rows.length; i++) {
        totalsMessage += `\r\n${result.rows[i].name}'s count: ${result.rows[i].count}`;
      }
      this.gh.postMessage(totalsMessage);
    } catch (err) {
      console.error(err);
    } finally {
      client.release();
    }
  }
}