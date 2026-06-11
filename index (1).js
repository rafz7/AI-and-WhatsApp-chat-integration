import makeWASocket, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys'
import fetch from 'node-fetch'
import readline from 'readline'

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const API_KEY = "YOUR_GROQ_API_KEY"

const processed = new Set()
const greetedUsers = new Set()

// 🔥 MEMORY
const userMemory = new Map()
const MAX_HISTORY = 10

const allowedGroups = [
    "123456@g.us",
    "987654@g.us"
]

// 🔥 AUTO AI GROUP
const autoAIGroup = new Map()

const emojis = ["😎","🤔","🔥","👌","💡"]

function detectIntent(text) {
    text = text.toLowerCase()

    if (
        text.includes("gambar") ||
        text.includes("buatkan gambar") ||
        text.includes("image") ||
        text.includes("foto")
    ) return "image"

    if (
        text.includes("audio") ||
        text.includes("suara") ||
        text.includes("bacakan")
    ) return "audio"

    return "chat"
}

async function askAI(text, sender) {
    try {
        if (!userMemory.has(sender)) {
            userMemory.set(sender, [])
        }

        const history = userMemory.get(sender)
        history.push({ role: "user", content: text })

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                temperature: 0.7,
                messages: [
                    {
                        role: "system",
                        content: `
Kamu adalah chatbot WhatsApp rafz yang santai, natural, dan tidak kaku.

Aturan:
- Balas chat seperti manusia
- Jangan membuat kalimat baru yang tidak diminta
- Jawab hanya dari teks user
- Jangan menambah hubungan atau kesimpulan sendiri
- Jangan mengaitkan ke hal lain di luar pesan user
- Dilarang memberi opini seperti "gue rasa", "kayaknya", dll
- Jawab HANYA berdasarkan pesan user
- Jangan menambah asumsi (cuaca, aktivitas, dll)
- Jangan mengarang informasi
- Gunakan bahasa santai seperti chat manusia pada umumnya
- Jika pesan user tidak jelas, tanyakan balik dengan natural
- Balas seperti manusia, bukan AI
- Susun kalimat berdasarkan Kamus Besar Bahasa Indonesia yang baik dan benar dan para frasa yang logis
- Gunakan bahasa sehari-hari (kayak orang chat biasa)
- sedikit berpemikiran kritis dan ilmiah
- Jangan terlalu formal atau seperti AI
- Gunakan bahasa chat sehari-hari (natural sedikit ilmiah)
- Balas sesuai konteks chat terakhir
- Boleh pakai sedikit ekspresi (haha, wkwk, dll) tapi jangan berlebihan
- Pakai pembuka dengan campuran British nuansa gaul, jangan simple.
- Langsung jawab inti jika sudah mengalir obrolannya.

Gaya WAJIB:
- Jangan banyak nanya.
- Bahasa gaul Gen-Z tapi tetap rapi, dan nyambung kata-katanya.
- Harus terasa natural kayak ngobrol, bukan formal.
- Sisipkan British nuance seperti:
  "fair enough", "not bad", "quite interesting", "makes sense"
- Gunakan tone santai, cool, dan percaya diri.
- Penggunaan kosakata harus jelas, rapi dan professional mencerminkan public speaking memiliki kredibilitas.

Cara jawab:
- Sedikit gaul, akur, asik, kritis dan nuansa british tapi nyambung dan tetap tertata dalam pemilihan kata kerja agar mudah dipahami.
- Santai, seperti teman chat
- Boleh pakai sedikit ekspresi (wkwk, haha), tapi secukupnya
- Fokus ke respon kritis, bukan narasi
- Harus nyambung banget sama pertanyaan, dan jawaban harus tertata rapi dan memiliki nuansa berpemikiran kritis.
- Jawaban nyambung dan kosakata serta penyusunan kata harus rapi dan mengalir, jangan terlalu kaku.
- Jangan selalu setuju, tetap kritis.
- Kalau ada yang kurang tepat, koreksi santai.
- Jika ada argumen yang membuat user ingin menyudahi pembicaraan, hook kembali.

Contoh gaya jawaban:
- "Fair enough, kalau dilihat dari situ, ini bukan soal malas doang."
- "Not bad sih, tapi kalau dipikir lagi, ada yang kurang tepat."
- "Quite interesting, tapi sebenarnya masalahnya di cara pendekatannya."

WAJIB:
Selalu gunakan gaya seperti contoh di atas.
                        `
                    },
                    ...history
                ]
            })
        })

        const data = await res.json()
        const reply = data?.choices?.[0]?.message?.content || "⚠️ Belum ada jawaban."

        history.push({ role: "assistant", content: reply })

        if (history.length > MAX_HISTORY * 2) {
            history.splice(0, history.length - MAX_HISTORY * 2)
        }

        return reply

    } catch {
        return "⚠️ Koneksi lagi kurang stabil."
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '24.0.0']
    })

    if (!state.creds.registered) {
        const phoneNumber = await new Promise(resolve => {
            rl.question('Masukkan nomor WhatsApp (contoh 628xxx): ', resolve)
        })
        const code = await sock.requestPairingCode(phoneNumber.trim())
        console.log(`PAIRING CODE: ${code}`)
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            if (shouldReconnect) {
                startBot()
            } else {
                console.log('Session logout, hapus folder session lalu pair ulang.')
            }
        }

        if (connection === 'open') {
            console.log('Bot connected successfully!')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg?.message) return

        if (msg.key.fromMe) {
            let check =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text || ""
            if (check.includes("©rafz assistant")) return
        }

        // 🔥 FIX DI SINI (NORMALISASI USER)
        const rawSender = msg.key.participant || msg.key.remoteJid
        const sender = rawSender.includes(":")
            ? rawSender.split(":")[0]
            : rawSender

        const jid = msg.key.remoteJid

        let text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            msg.message?.buttonsResponseMessage?.selectedButtonId ||
            msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            msg.message?.templateButtonReplyMessage?.selectedId

        if (!text) {
            try {
                text = Object.values(msg.message || {})[0]?.text
            } catch {}
        }

        if (!text) return

        if (text === ".menu") {
            return sock.sendMessage(jid, {
                image: { url: "https://files.catbox.moe/j8nsnb.jpg" },
                caption: `🪩 RPLAY ☇ ai ° auditorium 𖣂

( 👀 ) _Holaa ☇ use the bot feature wisely, the creator is not responsible for what you do with this bot, enjoy.._

⬡ Author: @ravzxz
⬡ Listmenu: .autoai on/off
⬡ Version: 1.0 AI integration 
⬡ Framework: Wangcap
⬡ Prefix: (.)
⬡ premium : ❌
\n\n
> ©rafztry 2025`
            })
        }

        if (jid.endsWith("@g.us")) {
            if (text === ".autoai on") {
                autoAIGroup.set(jid, true)
                return sock.sendMessage(jid, { text: "✅ Auto AI aktif di grup ini." })
            }

            if (text === ".autoai off") {
                autoAIGroup.set(jid, false)
                return sock.sendMessage(jid, { text: "❌ Auto AI dimatikan di grup ini." })
            }
        }

        const isGroup = jid.endsWith("@g.us")
        const isAuto = autoAIGroup.get(jid) || false

        if (isGroup && !isAuto) return

        const ai = await askAI(text, sender)
        const emoji = emojis[Math.floor(Math.random() * emojis.length)]

        let messageText = `> *_©rafz assistant.._*\n\n`

        if (!greetedUsers.has(sender)) {
            messageText += `olá!, im rafz assistant.\n\nClear, concise, and well reasoned—that’s how I answer.\n\n`
            greetedUsers.add(sender)
        }

        messageText += `${ai.trim()} ${emoji}`

        await sock.sendMessage(jid, {
            text: messageText
        })
    })
}

startBot()