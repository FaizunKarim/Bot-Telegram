import { Telegraf } from 'telegraf';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

console.log("🤖 OpenClaw Agent sedang bersiap...");

bot.on('text', async (ctx) => {
    const userMessage = ctx.message.text;
    await ctx.sendChatAction('typing');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage,
            config: {
                systemInstruction: "Kamu adalah OpenClaw, asisten AI pribadi yang cerdas, ramah, dan adaptif. Jawab pertanyaan dengan ringkas."
            }
        });

        await ctx.reply(response.text);
    } catch (error) {
        console.error("Error:", error);
        await ctx.reply("Waduh, otak AI-ku agak korslet sebentar!");
    }
});

bot.launch().then(() => {
    console.log("🚀 OpenClaw Agent sudah online di Telegram!");
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));