"use client";
import Head from 'next/head';
import Script from 'next/script';

export default function Home() {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>تنفيذ الهوية على مباني الهيئة</title>
      </Head>

      <Script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js" strategy="beforeInteractive" />
      <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="beforeInteractive" />

      <Script src="/js/app.js" strategy="afterInteractive" />

      <div id="app"></div>
    </>
  );
}
