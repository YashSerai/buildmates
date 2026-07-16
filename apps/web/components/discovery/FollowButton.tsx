"use client";
import { useState } from "react";

export function FollowButton({targetKind,targetId,label="Follow"}:{targetKind:"profile"|"project"|"topic"|"cohort";targetId:string;label?:string}){
  const[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function toggle(){setBusy(true);setError("");try{const response=await fetch("/api/follows",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({targetKind,targetId,enabled:!enabled})});const body=await response.json() as {enabled?:boolean;error?:string};if(!response.ok)throw new Error(body.error??"Could not update follow");setEnabled(Boolean(body.enabled))}catch(reason){setError(reason instanceof Error?reason.message:"Could not update follow")}finally{setBusy(false)}}
  return <span><button type="button" aria-pressed={enabled} aria-busy={busy} disabled={busy} onClick={toggle}>{busy?"Saving…":enabled?"Following":label}</button>{error&&<span role="alert">{error}</span>}</span>
}
