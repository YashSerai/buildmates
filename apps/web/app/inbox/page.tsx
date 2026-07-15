import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { InboxClient } from "./InboxClient";
import styles from "./inbox.module.css";
export const metadata:Metadata={title:"Inbox | Buildmates",description:"Buildmates introductions, messages, scheduling, and account activity.",robots:{index:false,follow:false}};
export default async function InboxPage(){await requireUser("/inbox");return <main className={styles.page}><header><a href="/">Buildmates</a><nav><a href="/matches">Matches</a><a href="/connections">Connections</a></nav></header><section className={styles.intro}><p>Activity</p><h1>Your Buildmates inbox.</h1><span>Introductions, messages, scheduling proposals, invitations, and account events appear here immediately.</span></section><InboxClient/></main>}
