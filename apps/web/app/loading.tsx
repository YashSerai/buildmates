export default function Loading() {
  return <main
    aria-busy="true"
    aria-live="polite"
    style={{ minHeight: "100vh", padding: "4rem 6vw", background: "#f0f2e9", color: "#171915" }}
  >
    <p>Loading Buildmates…</p>
  </main>;
}
