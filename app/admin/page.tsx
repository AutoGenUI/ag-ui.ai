/* eslint-disable @next/next/no-html-link-for-pages -- Sites sign-in must use top-level navigation. */
import Link from "next/link";
import { headers } from "next/headers";
import { isOwner } from "@/lib/news/runtime";
import { Admin } from "@/components/news/admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Owner workspace · AG-UI.AI",
  robots: { index: false, follow: false },
};
export default async function Owner() {
  if (!isOwner(await headers()))
    return (
      <div className="newsroom">
        <h1>站点所有者后台 / Owner workspace</h1>
        <p>
          请使用站点所有者的 ChatGPT 账户登录。 / Sign in with the site owner’s
          ChatGPT account.
        </p>
        <a
          className="n-button"
          target="_top"
          href="/signin-with-chatgpt?returnTo=%2Fadmin"
        >
          ChatGPT 登录 / Sign in
        </a>
        <p>
          <Link href="/zh">返回网站 / Back to site</Link>
        </p>
      </div>
    );
  return <Admin />;
}
