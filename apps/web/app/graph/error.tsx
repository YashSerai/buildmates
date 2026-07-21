"use client";

import { useEffect } from "react";
import styles from "./state.module.css";

export default function GraphError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error("Build graph failed",error)},[error]);return <main className={styles.errorPage}><section><p>Build graph</p><h1>The topic map could not load.</h1><p>The rest of Buildmates is still available. Try the graph again without losing your place.</p><button type="button" onClick={reset}>Try again</button><a href="/home">Return home</a></section></main>}
