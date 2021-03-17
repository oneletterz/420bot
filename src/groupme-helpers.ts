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

  async postMessage(message: string, attachments: any = null) {
    await GroupmeHelper.timeout(900);

    console.log(`sending ${message} to ${this.botID} with attachments: ${JSON.stringify(attachments)}`);

    const body: any = {
      bot_id: this.botID,
      text: message,
      attachments,
    };

    const res = await fetch(`https://api.groupme.com/v3/post`, {
      method: 'POST',
      headers: {
        'X-Access-Token': this.authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });
    console.log(res.body);
    return res.json();
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
