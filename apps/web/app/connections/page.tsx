import type {Metadata} from "next";
import {requireUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {listConnections} from "@/src/rooms/service";
import {ConnectionsClient} from "./ConnectionsClient";
import styles from "./connections.module.css";
export const metadata:Metadata={title:"Connections",description:"People you met through your work.",robots:{index:false,follow:false}};
export default async function ConnectionsPage(){const user=await requireUser("/connections");const {DB}=await getPlatformBindings();const connections=await listConnections(DB,user.id);return <main className={styles.page}><header><a href="/">Buildmates</a><nav><a href="/matches">Matches</a><a href="/inbox">Inbox</a></nav></header><section className={styles.intro}><p>Your network</p><h1>People you met through building.</h1><span>A connection remains useful after the first conversation. Return to its room whenever your work overlaps again.</span></section>{connections.length?<ConnectionsClient initialConnections={connections}/>:<section className={styles.empty}><h2>Your network starts with mutual relevance.</h2><p>Connections appear after both Codex evaluations and the acceptance rules you chose are satisfied.</p><a href="/matches">Review matches</a></section>}</main>}
