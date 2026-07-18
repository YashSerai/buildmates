import type {Metadata} from "next";
import {requireUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {listBlockedBuilders} from "@/src/safety/service";
import {listReporterStatus} from "@/src/moderation/service";
import {SafetyClient} from "./SafetyClient";
import {SettingsShell} from "@/components/settings/SettingsShell";
import styles from "../settings.module.css";
export const metadata:Metadata={title:"Safety",description:"Manage blocks and reports.",robots:{index:false,follow:false}};
export default async function SafetyPage(){const user=await requireUser("/settings/safety");const{DB}=await getPlatformBindings();const[blocked,reports]=await Promise.all([listBlockedBuilders(DB,user.id),listReporterStatus(DB,user.id)]);return <SettingsShell current="safety" eyebrow="Safety" title="You decide who can reach you" description="Review blocks and submitted reports. Blocking closes active rooms and stops new introductions; unblocking does not reopen a past connection."><div className={styles.singleColumn}><SafetyClient initialBlocked={blocked} reports={reports}/></div></SettingsShell>}
