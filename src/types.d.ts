interface MessageResponse {
  'id': string,
  'source_guid': string,
  'created_at': number,
  'user_id': string,
  'group_id': string,
  'name': string,
  'avatar_url': string,
  'text': string,
  'system': boolean,
  'favorited_by': Array<string>,
  'attachments': Array<Object>,
  'sender_type': string
}

type Attachment = { loci: number[][], type: string, user_ids: string[] };
