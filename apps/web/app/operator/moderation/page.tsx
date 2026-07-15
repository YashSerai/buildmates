import {notFound} from "next/navigation";
import {requireUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {listModerationCases} from "@/src/moderation/service";
import {ModerationClient} from "./ModerationClient";
import styles from "./moderation.module.css";
export default async function ModerationPage(){const user=await requireUser("/operator/moderation");const{DB}=await getPlatformBindings();const operator=await DB.prepare("SELECT operator_role AS role FROM users WHERE id=? AND status='active'").bind(user.id).first<{role:string}>();if(operator?.role!=="admin"&&operator?.role!=="moderator")notFound();return <main className={styles.page}><header><a href="/">Buildmates</a><span>Restricted operator surface</span></header><section><p>Moderation queue</p><h1>Review reports with an audit trail.</h1><span>Every outcome is recorded. Restriction and suspension invalidate active matching state immediately.</span></section><ModerationClient initialCases={await listModerationCases(DB,"open")}/></main>}
