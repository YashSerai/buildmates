"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CollaborationDecision({ slug }: { slug: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  async function decide(accept: boolean) {
    const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/collaborators`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ accept }) });
    if (!response.ok) { setNotice("This invitation is no longer available."); return; }
    if (accept) router.push(`/projects/${encodeURIComponent(slug)}`);
    else router.push("/inbox");
    router.refresh();
  }
  return <section><h2>Choose what happens</h2><p>You can leave the invitation pending, accept it, or decline it.</p><div><button onClick={() => void decide(true)}>Accept collaboration</button><button onClick={() => void decide(false)}>Decline</button></div><p role="status">{notice}</p></section>;
}
