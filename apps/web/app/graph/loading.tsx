import { ProductHeader } from "../../components/discovery/ProductHeader";
import styles from "./state.module.css";

export default function GraphLoading(){return <main><ProductHeader signedIn={false}/><div className={styles.page}><div className={styles.heading}/><div className={styles.lead}/><div className={styles.stage}><span/><p>Mapping the network…</p></div></div></main>}
