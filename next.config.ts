import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * /newsletters と /announcements は横断検索（GlobalSearch）に吸収した。
   *
   * 広報しんとくの全文（約3MB）を毎回HTMLに埋めていたため、/newsletters だけで
   * 3.29MB を配っていた。素材は検索の材料として残し（weekly-sync / daily-scrape は継続）、
   * ページとしては畳む。
   *
   * 301 を明示する（`permanent: true` は 308 を返すため）。外からのリンクや
   * 検索エンジンの登録が残っているので、恒久的な移動として通知する。
   */
  async redirects() {
    return [
      { source: "/newsletters", destination: "/gikai/sessions", statusCode: 301 },
      { source: "/announcements", destination: "/gikai/sessions", statusCode: 301 },
    ];
  },
};

export default nextConfig;
