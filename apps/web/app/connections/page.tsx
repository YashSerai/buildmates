import type {Metadata} from "next";
import {requireUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {listConnections} from "@/src/rooms/service";
import {ConnectionsClient} from "./ConnectionsClient";
import {ProductHeader} from "@/components/discovery/ProductHeader";
import styles from "./connections.module.css";
export const metadata:Metadata={title:"Connections",description:"People you met through your work.",robots:{index:false,follow:false}};
export default async function ConnectionsPage(){const user=await requireUser("/connections");const {DB}=await getPlatformBindings();const connections=await listConnections(DB,user.id);return <><ProductHeader signedIn/><main className={styles.page}><section className={styles.intro}><p>Your network</p><h1>People you met through building.</h1><span>A Connection lasts beyond the introduction. Return to its room, keep private notes, or reconnect when your work becomes relevant again.</span></section>{connections.length?<ConnectionsClient initialConnections={connections}/>:<section className={styles.empty}><h2>Your network starts with mutual relevance.</h2><p>A Connection appears when both people&apos;s Codex reviews and chosen acceptance rules approve an introduction.</p><a href="/matches">Review matches</a></section>}</main></>}
