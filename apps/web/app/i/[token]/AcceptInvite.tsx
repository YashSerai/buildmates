"use client";
import{useState}from"react";
import{useRouter}from"next/navigation";
import{userFacingError}from"@/src/client/user-facing-error";
import styles from"../../invite/invite.module.css";

export function AcceptInvite({token,authenticated}:{token:string;authenticated:boolean}){
  const router=useRouter();const[status,setStatus]=useState("");
  async function accept(){
    if(!authenticated){location.assign(`/api/auth/github/start?return_to=${encodeURIComponent(`/i/${token}`)}`);return;}
    setStatus("Accepting invitation...");
    const response=await fetch("/api/invites/accept",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});
    const body=await response.json()as{creatorHandle?:string;projectSlug?:string;error?:string};
    if(!response.ok){setStatus(userFacingError(body.error,"This invitation could not be accepted."));return;}
    setStatus("Invitation accepted.");
    router.push(body.projectSlug?`/projects/${body.projectSlug}`:body.creatorHandle?`/builders/${body.creatorHandle}`:"/onboarding");
  }
  return <><button onClick={accept}>{authenticated?"Accept invitation":"Sign in and accept"}</button>{status&&<p className={styles.status} role="status">{status}</p>}</>;
}
