import type {Metadata} from "next";
import {requireUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {listBlockedBuilders} from "@/src/safety/service";
import {listReporterStatus} from "@/src/moderation/service";
import {SafetyClient} from "./SafetyClient";
import styles from "../settings.module.css";
export const metadata:Metadata={title:"Safety | Buildmates",description:"Manage blocks and reports.",robots:{index:false,follow:false}};
export default async function SafetyPage(){const user=await requireUser("/settings/safety");const{DB}=await getPlatformBindings();const[blocked,reports]=await Promise.all([listBlockedBuilders(DB,user.id),listReporterStatus(DB,user.id)]);return <main className={styles.page}><header className={styles.header}><a className={styles.wordmark} href="/">Buildmates</a><nav><a href="/settings/privacy">Privacy</a><a href="/connections">Connections</a></nav></header><section className={styles.intro}><p className={styles.eyebrow}>Safety</p><h1>You decide who can reach you.</h1><p>Blocking ends active rooms and stops future matching. Unblocking does not reopen a past connection.</p></section><div className={styles.singleColumn}><SafetyClient initialBlocked={blocked} reports={reports}/></div></main>}
