import Link from "next/link";

export default function NotFound() { return <main className="not-found"><span className="eyebrow">404 · SIGNAL LOST</span><h1>This route is outside the atlas.</h1><p>The technology may have moved, or the path may not exist.</p><Link className="button-primary" href="/en">Return to the atlas →</Link></main>; }
