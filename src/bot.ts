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
    
    if (message.sender_type != 'user' || !message.text) {
      response.writeHead(200);
      response.end();
    }

    const userName = message.name.replace(/'/g, '');
    const userID = message.user_id;
    const text = message.text;

    if (/(.*)@everyone(.*)/i.test(message.text)) {
      this.gh.likeMessage(this.groupID, message.id)
      this.atEveryone(message.text);
    }

    if (/smoke weed/i.test(message.text)) {
      this.gh.likeMessage(this.groupID, message.id)
      this.gh.postMessage('everyday');
    }

    if (/when.*\?/i.test(message.text)) {
      this.gh.likeMessage(this.groupID, message.id)
      this.gh.postMessage('4:20');
    }

    if (/alcoholi.*\?/i.test(message.text)) {
      this.gh.likeMessage(this.groupID, message.id)
      this.postTotals();
    }

    let beerModifier = 0;
    const beerMatch = /([+-])\s*(\d+)\s*beer/i.exec(text);
    if (beerMatch && beerMatch.length >= 2) {
      const beerAdd = beerMatch[1] === '+';
      beerModifier = parseInt(beerMatch[2], 10) * (beerAdd ? 1 : -1);
    }
    if (beerModifier !== 0) {
      this.gh.likeMessage(this.groupID, message.id)
      await this.addBeerUpdate(userID, userName, beerModifier);
    }
        
    response.writeHead(200);
    response.end();
  }

  async addBeerUpdate(userID: string, userName: string, beerModifier: number) {
    console.log(`Adding ${beerModifier} beers to ${userName}'s total.`)
    const client = await this.pg.connect();
    try {
      // Create a new table for the user if it doesn't already exist
      const createTableCommand = `CREATE TABLE IF NOT EXISTS u${userID} (date text, count int)`;
      await client.query(createTableCommand);

      // Add row with time and count value
      const insertUpdateCommand = `INSERT INTO u${userID} VALUES ('${Date.now().toLocaleString()}', ${beerModifier})`;
      await client.query(insertUpdateCommand);
    } catch (err) {
      console.error(err);
    } finally {
      client.release();
    }
    await this.updateTotals(userID, userName, beerModifier);
  }

  async updateTotals(userID: string, userName: string, beerModifier: number) {
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
      const updateGroupTotal = `UPDATE totals SET count = count + ${beerModifier} WHERE user_id = 'group'`;
      await client.query(updateGroupTotal);
      if (groupTotal < 420 && groupTotal + beerModifier >= 420) { goalReached = true; }
      groupTotal += beerModifier;

      // USER
      // Retrieve totals & insert row if it doesn't exist
      const selectUserCommand = `SELECT name, count FROM totals WHERE user_id = '${userID}'`;
      result = await client.query(selectUserCommand);

      // Check if group row exists
      if (result.rows.length === 0) {
        var insertRowCommand = `INSERT INTO totals VALUES ('${userID}', '${userName}', 0)`;
        await client.query(insertRowCommand);
        userTotal = 0;
      } else {
        userTotal = result.rows[0].count;
      }
      // Update totals
      const updateUserTotal = `UPDATE totals SET count = count + ${beerModifier} WHERE user_id = '${userID}'`;
      result = await client.query(updateUserTotal);

      userTotal += beerModifier;
      // Update name
      const updateUserName = `UPDATE totals SET name = '${userName}' WHERE user_id = '${userID}'`;
      await client.query(updateUserName);
      console.log(updateUserName);

      // Send an update message to the group chat
      let updateMessage = '';
      if (beerModifier >= 0) {
        updateMessage = `${beerModifier} beer${beerModifier == 1 ? '' : 's'} added!`;
      } else {
        updateMessage = `Subtracted ${Math.abs(beerModifier)} beer${beerModifier == -1 ? '' : 's'}.`;
      }
      updateMessage = updateMessage + `${userName}'s new count: ${userTotal} Group total: ${groupTotal}`

      this.gh.postMessage(updateMessage);

      if (goalReached)
        this.gh.postMessage("Congratulations! Here's to another 420!");

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