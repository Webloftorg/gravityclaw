import puppeteer, { Browser, Page } from "puppeteer";
import type OpenAI from "openai";

let browserInstance: Browser | null = null;
let activePage: Page | null = null;

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }
    return browserInstance;
}

async function getPage() {
    const browser = await getBrowser();
    if (!activePage) {
        activePage = await browser.newPage();
        await activePage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    }
    return activePage;
}

export const browserTools: OpenAI.Chat.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "browser_navigate",
            description: "Navigate the browser to a URL.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The URL to navigate to" }
                },
                required: ["url"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "browser_click",
            description: "Click an element on the current page using a CSS selector.",
            parameters: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector of the element to click" }
                },
                required: ["selector"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "browser_type",
            description: "Type text into an element on the current page.",
            parameters: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector of the input field" },
                    text: { type: "string", description: "The text to type" }
                },
                required: ["selector", "text"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "browser_extract",
            description: "Extract text content or HTML from the current page.",
            parameters: {
                type: "object",
                properties: {
                    mode: { type: "string", enum: ["text", "html"], description: "Whether to extract plain text or full HTML" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "browser_screenshot",
            description: "Take a screenshot of the current page and save it to the current directory.",
            parameters: {
                type: "object",
                properties: {
                    filename: { type: "string", description: "Filename for the screenshot (e.g., 'screenshot.png')" }
                },
                required: ["filename"]
            }
        }
    }
];

export async function executeBrowserTool(name: string, args: Record<string, any>): Promise<string> {
    try {
        const page = await getPage();

        if (name === "browser_navigate") {
            await page.goto(args.url, { waitUntil: "networkidle2" });
            return `✅ Navigated to ${args.url}`;
        } else if (name === "browser_click") {
            await page.waitForSelector(args.selector, { timeout: 5000 });
            await page.click(args.selector);
            return `✅ Clicked element: ${args.selector}`;
        } else if (name === "browser_type") {
            await page.waitForSelector(args.selector, { timeout: 5000 });
            await page.type(args.selector, args.text);
            return `✅ Typed "${args.text}" into ${args.selector}`;
        } else if (name === "browser_extract") {
            if (args.mode === "html") {
                const html = await page.content();
                return html.slice(0, 10000); // Truncate if too long
            } else {
                const text = await page.evaluate(() => document.body.innerText);
                return text.slice(0, 10000);
            }
        } else if (name === "browser_screenshot") {
            await page.screenshot({ path: args.filename });
            return `✅ Screenshot saved to ${args.filename}`;
        }

        return `Error: Unknown browser tool ${name}`;
    } catch (err: any) {
        return `❌ Browser error: ${err.message}`;
    }
}
