import {notFound} from "next/navigation";
import Link from "next/link";
import {requireUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {listModerationCases} from "@/src/moderation/service";
import {ModerationClient} from "./ModerationClient";
import styles from "./moderation.module.css";
export default async function ModerationPage(){const user=await requireUser("/operator/moderation");const{DB}=await getPlatformBindings();const operator=await DB.prepare("SELECT operator_role AS role FROM users WHERE id=? AND status='active'").bind(user.id).first<{role:string}>();if(operator?.role!=="admin"&&operator?.role!=="moderator")notFound();return <main className={styles.page}><header><Link href="/">Buildmates</Link><span>Operator access only</span></header><section><p>Safety queue</p><h1>Review reports and appeals.</h1><span>Every outcome is recorded. Restricting matching stops new introductions immediately. Suspending an account also ends its active Connections and rooms.</span></section><ModerationClient initialCases={await listModerationCases(DB,"open")}/></main>}
