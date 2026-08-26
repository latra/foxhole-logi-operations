/* ── Page shell — navbar + content container ─────────────────────── */

import Navbar from "./Navbar";

interface Props {
  children: React.ReactNode;
}

export default function PageShell({ children }: Props) {
  return (
    <>
      <Navbar />
      <main className="page-container">{children}</main>
    </>
  );
}
