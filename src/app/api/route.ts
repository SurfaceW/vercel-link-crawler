import { load } from 'cheerio';
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const maxDuration = 300; // This function can run for a maximum of 5 minutes llm invocation duration time

const CHROMIUM_PATH =
  "https://vomrghiulbmrfvmhlflk.supabase.co/storage/v1/object/public/chromium-pack/chromium-v123.0.0-pack.tar";

function removeAllEmptyLines(str: string) {
  return str.replace(/^\s*\n/gm, '');
}

async function getBrowser() {
  if (process.env.VERCEL_ENV === "production") {
    const chromium = await import("@sparticuz/chromium-min").then(
      (mod) => mod.default
    );

    const puppeteerCore = await import("puppeteer-core").then(
      (mod) => mod.default
    );

    const executablePath = await chromium.executablePath(CHROMIUM_PATH);

    const browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    return browser;
  } else {
    const puppeteer = await import("puppeteer").then((mod) => mod.default);

    const browser = await puppeteer.launch();
    return browser;
  }
}

export async function GET(request: NextRequest) {

  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url") || '';

  // WIP: auth for server invocation ak / sk for server invocations

  console.info('🔗 user request content url:', url);

  if (!url) {
    return new Response("URL query parameter is required", { status: 400 });
  }

  const browser = await getBrowser();

  const page = await browser.newPage();
  await page.goto(url, {
    timeout: 30000, // 30s
    waitUntil: 'load' // full page load
  });

  // Query for an element handle.
  let content = await page.content();

  try {
    const $ = await load(content);

    $('script').remove();
    $('link').remove();
    $('style').remove();

    let crawledText = 'empty';

    const articleQuery = $('article');

    if (articleQuery.length > 0) {
      crawledText = articleQuery.text();
    } else if ($('body main').length > 0) {
      crawledText = $('body main')?.first().text();
    } else {
      crawledText = $('body').text();
    }

    crawledText = removeAllEmptyLines(crawledText);
    console.info('🔗 crawled text:', crawledText);

    // release the page from memory
    await page.close();
    await browser.close();

    return NextResponse.json({
      text: crawledText
    });
  } catch (e) {
    console.error('🔗 error:', e);
    return new Response("Error while crawling the content", { status: 500 });
  }
}
