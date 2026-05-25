import { Telegraf } from 'telegraf';
import { GoogleGenAI, Type } from '@google/genai';
import cron from 'node-cron';
import 'dotenv/config';
import http from 'http';

// --- IMPORT AMAN UNTUK PRISMA 7 ESM ---
// 1. Prisma Client
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;

// 2. PrismaPg Adapter (WAJIB pakai kurung kurawal)
import { PrismaPg } from '@prisma/adapter-pg';

// 3. PG Pool
import pgPkg from 'pg';
const { Pool } = pgPkg;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- INISIALISASI PRISMA 7 DENGAN ADAPTER ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- 1. FUNGSI UNTUK MENYIMPAN JADWAL KE POSTGRESQL ---
async function simpanJadwalKePostgres(tanggal, jam, agenda, userId) {
    try {
        const jadwalBaru = await prisma.jadwal.create({
            data: {
                userId: BigInt(userId),
                tanggal: tanggal,
                jam: jam,
                agenda: agenda
            }
        });
        
        console.log(`📌 Jadwal [ID: ${jadwalBaru.id}] berhasil dicatat ke PostgreSQL: ${agenda}`);
        return { 
            status: "sukses", 
            pesan: `Jadwal '${agenda}' berhasil disimpan di PostgreSQL cloud untuk tanggal ${tanggal} jam ${jam}.` 
        };
    } catch (error) {
        console.error("Gagal insert ke PostgreSQL via Prisma:", error);
        return { status: "gagal", pesan: "Gagal menyimpan jadwal ke database server cloud." };
    }
}

// --- 2. DEFINISI TOOLS UNTUK GEMINI ---
const buatJadwalTool = {
    name: 'simpanJadwalKePostgres',
    description: 'Digunakan untuk mencatat atau membuat jadwal pengingat baru ke dalam database berdasarkan request user.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            tanggal: { type: Type.STRING, description: 'Tanggal dalam format YYYY-MM-DD.' },
            jam: { type: Type.STRING, description: 'Jam dalam format HH:MM 24 jam.' },
            agenda: { type: Type.STRING, description: 'Nama kegiatan.' }
        },
        required: ['tanggal', 'jam', 'agenda'],
    },
};

// --- 3. LOGIKA CHATBOT TELEGRAM ---
bot.on('text', async (ctx) => {
    const userMessage = ctx.message.text;
    const userId = ctx.from.id;
    await ctx.sendChatAction('typing');

    const opsiWaktu = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Jakarta' };
    const waktuSekarang = new Date().toLocaleDateString('id-ID', opsiWaktu);
    const jamSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage,
            config: {
                systemInstruction: `Kamu adalah OpenClaw, asisten AI pribadi yang cerdas. Hari ini hari ${waktuSekarang} jam ${jamSekarang}. Jika user ingin dibuatkan jadwal pengingat, hitung parameter tanggal dan jam dengan tepat berdasarkan acuan waktu sekarang, lalu panggil tool 'simpanJadwalKePostgres'.`,
                tools: [{ functionDeclarations: [buatJadwalTool] }]
            }
        });

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === 'simpanJadwalKePostgres') {
                const { tanggal, jam, agenda } = call.args;
                
                const hasilDB = await simpanJadwalKePostgres(tanggal, jam, agenda, userId);
                await ctx.reply(`✅ **OpenClaw Agent:** ${hasilDB.pesan}`);
                return;
            }
        }

        await ctx.reply(response.text);
    } catch (error) {
        console.error("Error pada bot:", error);
        await ctx.reply("Waduh, ada kendala saat memproses pesanmu.");
    }
});

// --- 4. ENGINE CRON-JOB ---
cron.schedule('* * * * *', async () => {
    const sekarang = new Date();
    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, '0');
    const tgl = String(sekarang.getDate()).padStart(2, '0');
    const jam = String(sekarang.getHours()).padStart(2, '0');
    const menit = String(sekarang.getMinutes()).padStart(2, '0');
    
    const tglSekarangStr = `${tahun}-${bulan}-${tgl}`;
    const jamSekarangStr = `${jam}:${menit}`;

    try {
        const daftarJadwal = await prisma.jadwal.findMany({
            where: {
                tanggal: tglSekarangStr,
                jam: jamSekarangStr,
                sudahDiingatkan: false
            }
        });

        for (const jadwal of daftarJadwal) {
            await prisma.jadwal.update({
                where: { id: jadwal.id },
                data: { sudahDiingatkan: true }
            });

            const teksAlarm = `🔔 **PENGINGAT JADWAL (PostgreSQL Cloud)** 🔔\n\nHalo! Waktunya: \n👉 **${jadwal.agenda}**`;
            await bot.telegram.sendMessage(Number(jadwal.userId), teksAlarm);
            console.log(`⏰ Alarm PostgreSQL sukses dikirim untuk agenda: ${jadwal.agenda}`);
        }
    } catch (error) {
        console.error("Gagal menjalankan cron job PostgreSQL:", error);
    }
});

// --- 5. RUNNING BOT ENGINE ---
bot.launch().then(() => {
    console.log("🚀 OpenClaw Agent + Prisma PostgreSQL Cloud sudah online!");
});

// --- 6. WEB SERVER MINI (SYARAT RENDER.COM) ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OpenClaw Bot is Alive!\n');
}).listen(PORT, () => {
    console.log(`🌐 Dummy Web Server menyala di port ${PORT} (Untuk Render)`);
});

process.once('SIGINT', async () => { await prisma.$disconnect(); bot.stop('SIGINT'); });
process.once('SIGTERM', async () => { await prisma.$disconnect(); bot.stop('SIGTERM'); });