# Her AI Hour™

> *AI built around the woman who leads.*

**Live:** [heraihour.netlify.app](https://heraihour.netlify.app/)

---

## What this is

Her AI Hour™ is an AI platform built for women in senior leadership who are navigating the AI moment with intention. It's not a course. It's not a chatbot. It's not another tool that talks *at* her.

It's a space where the woman who already leads, in the C-suite, the boardroom, the founder's seat, the partnership track, meets AI on her own terms. With her own language. At her own level.

## The problem

Female C-suite executives are using AI **more often** than their male counterparts (50% vs 38%). And yet only **37%** of them rate themselves as proficient, compared to **54%** of men. (Source: Salesforce / YouGov, 2024)

This is not a skill gap. **It is a confidence gap.**

Every existing AI tool talks at women — assumes a deficit, hands them a tutorial, tells them to catch up. Meanwhile, **86%** of jobs at high risk of AI displacement are held by women (Brookings).

Her AI Hour does the opposite. It treats senior women as the strategists they already are. Their wisdom is the input. AI is the leverage.

## What it does

**Three paths, three voices:**

- 🌱 **Curious** — *"I know I need this. I just don't know where to start."* Glossary of AI vocabulary in plain language.
- 🪜 **Building** — *"I've started. I'm building. I'm not turning back."* Seven prompt patterns senior practitioners actually use.
- 👑 **Leading** — *"I'm using AI. Now I want to shape the future with it."* Five agents worth building, plus a portable file structure that works in Claude Projects, ChatGPT GPTs & Agents, or Gemini Gems.

**The Briefing** — Five live AI/leadership intelligence cards refreshed every 6 hours through a female leadership lens. Generated server-side by Claude Sonnet 4.6, cached for cost efficiency.

**The Trust Layer** — Five major AI tools (Claude, Perplexity, ChatGPT, Microsoft Copilot, Google Gemini) ranked honestly on data privacy and retention policy. So she knows what's safe to share before she shares it.

**Voices** — Nine real women already shaping the AI conversation: Fei-Fei Li, Joy Buolamwini, Rana el Kaliouby, Reshma Saujani, Ginni Rometty, Lisa Su, Amy Webb, Kate Crawford, Shoshana Zuboff. Plus a tenth seat — *hers*. With her name. With her words. *Her voice belongs here too.*

## The architecture

- **Frontend:** Single self-contained HTML file with embedded CSS and JavaScript. ~6,000 lines. Vanilla — no React, no framework. Designed to be readable, hackable, and fast.
- **API layer:** Netlify serverless function calls Anthropic Claude Sonnet 4.6 through the official SDK. 6-hour cache via Netlify Blobs keeps cost predictable (~$10/month at scale).
- **Graceful fallback:** If the API is unavailable for any reason, the page serves five static fallback cards. The page never breaks.
- **PWA:** Manifest + icons enable "Add to Home Screen" on iOS and Android. Launches full-screen, app-like.

## File structure

```
.
├── index.html              # The page (HTML/CSS/JS, all inline)
├── manifest.json           # PWA manifest
├── netlify.toml            # Netlify config (functions + redirects)
├── package.json            # Dependencies for the function
├── icons/                  # PWA + favicon assets
│   ├── icon-180.png        # iOS apple-touch-icon
│   ├── icon-192.png        # Android standard
│   ├── icon-512.png        # Android splash
│   ├── icon-512-maskable.png  # Android safe-zone
│   └── favicon-32.png      # Browser tab
└── netlify/
    └── functions/
        └── briefing.ts     # Server-side Briefing generator
```

## How to run locally

You can open `index.html` directly in a browser. The page will render fully — only the live Briefing API will fall back to static cards (which is the intended behavior offline).

To run the full stack including the live Briefing function, you need:

1. A free [Netlify account](https://netlify.com)
2. The [Netlify CLI](https://docs.netlify.com/cli/get-started/) — install with `npm install -g netlify-cli`
3. An [Anthropic API key](https://console.anthropic.com)

Then:

```bash
git clone https://github.com/YOUR-USERNAME/her-ai-hour.git
cd her-ai-hour
npm install

# Create a .env file with your key (never commit this!)
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run locally
netlify dev
```

Open [http://localhost:8888](http://localhost:8888) and the live Briefing function will be available at `/api/briefing`.

## How to deploy

1. Fork or clone this repo
2. Push to your own GitHub
3. Connect the repo to a new Netlify site
4. In Netlify → Site configuration → Environment variables → add `ANTHROPIC_API_KEY` with your sk-ant-... key
5. Deploy. Set up a $25 monthly spend cap on your Anthropic account.

## Why I built this

I am a first-time hackathon submitter. I am a corporate leader who saw the gap firsthand — women were using AI quietly, alone, and apologetically. I wanted to build the platform I wished existed for myself and the women in my network.

This is v1. There are imperfections. Every word, every color choice, every tile placement was a decision I made. The work is still becoming. So is the woman.

— *Deanna Leonard*

## License

MIT — free for anyone to fork, study, learn from. See [LICENSE](LICENSE).

---

*Her AI Hour™ — Where Artificial Intelligence, Emotional Intelligence, and Data Intelligence meet.*
