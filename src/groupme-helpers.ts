import HTTPS from 'https';
import fetch from 'node-fetch';

export default class GroupmeHelper {
  private authToken: string;
  private groupID: string;
  private botID: string;

  constructor(authToken: string, groupID: string, botID: string) {
    this.authToken = authToken;
    this.groupID = groupID;
    this.botID = botID;
  }

  static timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async postMessage(message: string, attachments: any = null, botID = this.botID) {
    await GroupmeHelper.timeout(900);

    console.log(`sending ${message} to ${botID} with attachments: ${JSON.stringify(attachments)}`);

    const body: any = {
      bot_id: botID,
      text: message,
      attachments,
    };

    return fetch(`https://api.groupme.com/v3/bots/post`, {
      method: 'POST',
      headers: {
        'X-Access-Token': this.authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });
  }

  async likeMessage(conversationID: string, messageID: string) {
    return fetch(`https://api.groupme.com/v3/messages/${conversationID}/${messageID}/like`, {
      method: 'POST',
      headers: {
        'X-Access-Token': this.authToken
      }
    });
  }

  async requestInfo(info: string) {
    console.log(`requesting ${info}`);

    const res = await fetch(`https://api.groupme.com/v3/${info}`, {
      headers: {
        'X-Access-Token': this.authToken,
      },
    });
    console.log(res);
    if (res.status !== 200) {
      console.log(`rejecting bad status code ${res.status}`);
    }
    const json = await res.json();
    console.log(json);
    return json.response;
  }
}
