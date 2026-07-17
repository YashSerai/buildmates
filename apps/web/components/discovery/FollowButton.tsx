"use client";
import { useState } from "react";
import { userFacingError } from "@/src/client/user-facing-error";

export function FollowButton({targetKind,targetId,label="Follow"}:{targetKind:"profile"|"project"|"topic";targetId:string;label?:string}){
  const[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function toggle(){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/follows",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({targetKind,targetId,enabled:!enabled})});
      const body=await response.json() as {enabled?:boolean;error?:string};
      if(!response.ok){setError(userFacingError(body.error,"This follow could not be updated."));return;}
      setEnabled(Boolean(body.enabled));
    }catch{setError("This follow could not be updated. Check your connection and try again.");}finally{setBusy(false);}
  }
  return <span><button type="button" aria-pressed={enabled} aria-busy={busy} disabled={busy} onClick={toggle}>{busy?"Saving...":enabled?"Following":label}</button>{error&&<span role="alert">{error}</span>}</span>;
}
