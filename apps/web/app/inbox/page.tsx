import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { InboxClient } from "./InboxClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./inbox.module.css";
export const metadata:Metadata={title:"Activity",description:"Buildmates introductions, messages, scheduling, and account activity.",robots:{index:false,follow:false}};
export default async function InboxPage(){await requireUser("/inbox");return <><ProductHeader signedIn/><main className={styles.page}><section className={styles.intro}><p>Activity</p><h1>What needs your attention.</h1><span>Updates link back to the introduction, Connection, or Circle where the work happens. Conversations stay in their rooms.</span></section><InboxClient/></main></>}
