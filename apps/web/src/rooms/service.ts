export type ConnectionListItem={id:string;roomId:string;otherUserId:string;otherName:string;otherSummary:string;connectionReason:string;sharedContext:string[];state:string;muted:boolean;createdAt:number;lastMessageAt:number|null};
export type RoomSummary={id:string;connectionId:string;otherUserId:string;otherName:string;themeLabel:string|null;status:string};
export type RoomMessage={id:string;senderUserId:string;body:string;createdAt:number;editedAt:number|null;mine:boolean};

export async function listConnections(DB:D1Database,userId:string):Promise<ConnectionListItem[]>{return (await listConnectionsPage(DB,userId,null,100)).items}

export async function listConnectionsPage(DB:D1Database,userId:string,after:string|null,limit=50):Promise<{items:ConnectionListItem[];nextCursor:string|null}>{
  const bounded=Math.max(1,Math.min(100,limit));
  const cursor=parseConnectionCursor(after);
  const rows=await DB.prepare(`WITH connection_rows AS (
    SELECT c.id,r.id AS roomId,CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END AS otherUserId,
      COALESCE(snapshot.display_name,'Buildmate') AS otherName,COALESCE(snapshot.summary,'Connected through mutual work') AS otherSummary,
      COALESCE(context.reason,'Buildmates found mutual relevance in your current work.') AS connectionReason,
      COALESCE(context.shared_context_json,'[]') AS sharedContextJson,c.state,side.muted,c.created_at AS createdAt,
      MAX(m.created_at) AS lastMessageAt,COALESCE(MAX(m.created_at),c.created_at) AS sortAt
    FROM connections c JOIN connection_sides side ON side.connection_id=c.id AND side.user_id=? JOIN rooms r ON r.connection_id=c.id
      JOIN match_pairs pair ON pair.id=c.match_pair_id LEFT JOIN connection_snapshots snapshot ON snapshot.connection_id=c.id
        AND snapshot.subject_user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END
      LEFT JOIN connection_context_snapshots context ON context.connection_id=c.id LEFT JOIN messages m ON m.room_id=r.id AND m.deleted_at IS NULL
    WHERE c.state<>'blocked' AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND
      ((b.blocker_user_id=? AND b.blocked_user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END)
      OR (b.blocker_user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END AND b.blocked_user_id=?)))
    GROUP BY c.id,r.id,otherUserId,snapshot.display_name,snapshot.summary,context.reason,context.shared_context_json,c.state,side.muted,c.created_at
  ) SELECT id,roomId,otherUserId,otherName,otherSummary,connectionReason,sharedContextJson,state,muted,createdAt,lastMessageAt,sortAt
    FROM connection_rows WHERE sortAt<? OR (sortAt=? AND id<?) ORDER BY sortAt DESC,id DESC LIMIT ?`)
    .bind(userId,userId,userId,userId,userId,userId,userId,cursor.at,cursor.at,cursor.id,bounded+1)
    .all<Omit<ConnectionListItem,"muted"|"sharedContext"> & {muted:number;sharedContextJson:string;sortAt:number}>();
  const page=rows.results.slice(0,bounded),items=page.map((row)=>({id:row.id,roomId:row.roomId,otherUserId:row.otherUserId,otherName:row.otherName,otherSummary:row.otherSummary,connectionReason:row.connectionReason,sharedContext:safeStringArray(row.sharedContextJson),state:row.state,muted:Boolean(row.muted),createdAt:row.createdAt,lastMessageAt:row.lastMessageAt??null}));
  return {items,nextCursor:rows.results.length>bounded&&page.length?connectionCursor(page[page.length-1]!):null};
}

export function connectionCursor(item:Pick<ConnectionListItem,"id"|"lastMessageAt"|"createdAt"> & {sortAt?:number}){return `c:${item.sortAt??item.lastMessageAt??item.createdAt}:${encodeURIComponent(item.id)}`}
function parseConnectionCursor(value:string|null){if(!value)return{at:Number.MAX_SAFE_INTEGER,id:"~"};if(!value.startsWith("c:"))throw new Error("invalid_connection_cursor");const parts=value.split(":");const at=Number(parts[1]);if(!Number.isSafeInteger(at)||at<0||!parts[2])throw new Error("invalid_connection_cursor");let id="";try{id=decodeURIComponent(parts.slice(2).join(":"))}catch{throw new Error("invalid_connection_cursor")}if(!id)throw new Error("invalid_connection_cursor");return{at,id}}

function safeStringArray(value:string):string[]{try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==="string").slice(0,4):[]}catch{return []}}

export async function getRoomSummary(DB:D1Database,roomId:string,userId:string):Promise<RoomSummary|null>{return DB.prepare(`SELECT r.id,r.connection_id AS connectionId,r.status,CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END AS otherUserId,COALESCE(snapshot.display_name,'Buildmate') AS otherName,t.label AS themeLabel FROM rooms r JOIN connections c ON c.id=r.connection_id AND c.state='active' JOIN room_memberships mine ON mine.room_id=r.id AND mine.user_id=? AND mine.left_at IS NULL JOIN match_pairs pair ON pair.id=r.match_pair_id LEFT JOIN connection_snapshots snapshot ON snapshot.connection_id=c.id AND snapshot.subject_user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END LEFT JOIN topics t ON t.id=r.theme_topic_id WHERE r.id=? AND r.status='active' AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.revoked_at IS NULL AND ((b.blocker_user_id=? AND b.blocked_user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END) OR (b.blocker_user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END AND b.blocked_user_id=?))) LIMIT 1`).bind(userId,userId,userId,roomId,userId,userId,userId,userId).first<RoomSummary>()}

export async function listMessages(DB:D1Database,roomId:string,userId:string,after:string|null,limit=50):Promise<RoomMessage[]>{return (await listMessagesPage(DB,roomId,userId,after,limit)).items}
export async function listMessagesPage(DB:D1Database,roomId:string,userId:string,after:string|null,limit=50):Promise<{items:RoomMessage[];nextCursor:string|null}>{if(!await getRoomSummary(DB,roomId,userId))throw new Error("room_not_found");const bounded=Math.max(1,Math.min(100,limit));const cursor=parseMessageCursor(after);const rows=await DB.prepare("SELECT id,sender_user_id AS senderUserId,body,created_at AS createdAt,edited_at AS editedAt FROM messages WHERE room_id=? AND deleted_at IS NULL AND (created_at>? OR (created_at=? AND id>?)) ORDER BY created_at ASC,id ASC LIMIT ?").bind(roomId,cursor.createdAt,cursor.createdAt,cursor.id,bounded+1).all<Omit<RoomMessage,"mine">>();const items=rows.results.slice(0,bounded).map((row)=>({...row,mine:row.senderUserId===userId}));return {items,nextCursor:rows.results.length>bounded&&items.length?messageCursor(items[items.length-1]!):null}}
export function messageCursor(message:Pick<RoomMessage,"createdAt"|"id">){return `${message.createdAt}:${encodeURIComponent(message.id)}`}
function parseMessageCursor(value:string|null){if(!value)return{createdAt:0,id:""};const separator=value.indexOf(":");if(separator<1)throw new Error("invalid_room_message_cursor");const createdAt=Number(value.slice(0,separator));if(!Number.isSafeInteger(createdAt)||createdAt<0)throw new Error("invalid_room_message_cursor");try{const id=decodeURIComponent(value.slice(separator+1));if(!id)throw new Error("invalid_room_message_cursor");return{createdAt,id}}catch{throw new Error("invalid_room_message_cursor")}}

export async function sendMessage(DB:D1Database,input:{roomId:string;userId:string;clientMessageId:string;body:string;now:number}){
  const room=await getRoomSummary(DB,input.roomId,input.userId);if(!room||room.status!=="active")throw new Error("room_not_available");
  const sender=await DB.prepare("SELECT display_name AS displayName FROM profiles WHERE user_id=? LIMIT 1").bind(input.userId).first<{displayName:string}>();
  const blocked=await DB.prepare("SELECT 1 AS blocked FROM blocks WHERE revoked_at IS NULL AND ((blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)) LIMIT 1").bind(input.userId,room.otherUserId,room.otherUserId,input.userId).first();if(blocked)throw new Error("room_blocked");
  const window=Math.floor(input.now/60_000);const key=`message:${input.userId}:${window}`;
  await DB.prepare("INSERT INTO mcp_rate_limits (key,attempt_count,window_expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempt_count=attempt_count+1").bind(key,(window+1)*60_000).run();
  const rate=await DB.prepare("SELECT attempt_count AS attempts FROM mcp_rate_limits WHERE key=?").bind(key).first<{attempts:number}>();if((rate?.attempts??999)>30)throw new Error("message_rate_limited");
  const id=crypto.randomUUID();
  await DB.batch([
    DB.prepare("INSERT INTO messages (id,room_id,sender_user_id,client_message_id,body,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(room_id,sender_user_id,client_message_id) DO NOTHING").bind(id,input.roomId,input.userId,input.clientMessageId,input.body,input.now),
    DB.prepare("UPDATE connection_sides SET unread_at=?,updated_at=? WHERE connection_id=? AND user_id=? AND EXISTS (SELECT 1 FROM messages WHERE id=?)").bind(input.now,input.now,room.connectionId,room.otherUserId,id),
    DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,created_at) SELECT ?,?,'new_message','immediate',?,? WHERE EXISTS (SELECT 1 FROM messages WHERE id=?) AND EXISTS (SELECT 1 FROM connection_sides WHERE connection_id=? AND user_id=? AND muted=0)").bind(crypto.randomUUID(),room.otherUserId,JSON.stringify({roomId:input.roomId,connectionId:room.connectionId,senderName:sender?.displayName??"Buildmate"}),input.now,id,room.connectionId,room.otherUserId),
  ]);
  const stored=await DB.prepare("SELECT id,created_at AS createdAt FROM messages WHERE room_id=? AND sender_user_id=? AND client_message_id=?").bind(input.roomId,input.userId,input.clientMessageId).first<{id:string;createdAt:number}>();if(!stored)throw new Error("message_failed");return stored;
}

export async function editMessage(DB:D1Database,input:{roomId:string;messageId:string;userId:string;body:string;now:number}){const membership=await getRoomSummary(DB,input.roomId,input.userId);if(!membership)throw new Error("room_not_found");const result=await DB.prepare("UPDATE messages SET body=?,edited_at=? WHERE id=? AND room_id=? AND sender_user_id=? AND deleted_at IS NULL").bind(input.body,input.now,input.messageId,input.roomId,input.userId).run();if(Number(result.meta?.changes??0)!==1)throw new Error("message_not_found")}
export async function deleteMessage(DB:D1Database,input:{roomId:string;messageId:string;userId:string;now:number}){const membership=await getRoomSummary(DB,input.roomId,input.userId);if(!membership)throw new Error("room_not_found");const result=await DB.prepare("UPDATE messages SET body='',deleted_at=? WHERE id=? AND room_id=? AND sender_user_id=? AND deleted_at IS NULL").bind(input.now,input.messageId,input.roomId,input.userId).run();if(Number(result.meta?.changes??0)!==1)throw new Error("message_not_found")}
