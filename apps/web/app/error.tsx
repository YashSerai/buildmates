"use client";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main style={{minHeight:"100vh",padding:"4rem 6vw",background:"#f0f2e9",color:"#171915"}}><h1>This view could not load.</h1><p>Your data was not changed. Try the request again.</p><button type="button" onClick={reset}>Try again</button></main>}
