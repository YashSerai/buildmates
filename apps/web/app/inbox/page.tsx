import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { InboxClient } from "./InboxClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./inbox.module.css";
export const metadata:Metadata={title:"Inbox",description:"Buildmates introductions, messages, scheduling, and account activity.",robots:{index:false,follow:false}};
export default async function InboxPage(){await requireUser("/inbox");return <><ProductHeader signedIn/><main className={styles.page}><section className={styles.intro}><p>Activity</p><h1>Your Buildmates inbox.</h1><span>Introductions, messages, scheduling proposals, invitations, and account events appear here as they arrive.</span></section><InboxClient/></main></>}
