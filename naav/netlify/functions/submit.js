const { QUESTIONS } = require("./_questions-data");

const DISCORD_API = "https://discord.com/api/v10";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, PING_ROLE_ID } = process.env;

  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: "السيرفر غير مهيأ بعد (إعدادات البوت ناقصة)." }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "بيانات غير صالحة." }) };
  }

  const answers = payload.answers || {};

  // آيدي الديسكورد مطلوب فقط حتى يقدر البوت يعطي الرتبة ويرسل الخاص للمتقدم
  const discordId = String(payload.discordId || "").trim();
  if (!/^[0-9]{16,21}$/.test(discordId)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "آيدي ديسكورد غير صحيح. تأكد من تفعيل Developer Mode ونسخ الآيدي بشكل صحيح." }),
    };
  }

  let answeredCount = 0;
  const lines = [];

  for (const q of QUESTIONS) {
    const given = (answers[q.id] || "").toString().trim();
    if (given) answeredCount += 1;
    lines.push(`**${q.label} :**\n${given || "—"}`);
  }

  lines.push(`**النتيجة :** قيد المراجعة`);
  lines.push(`**عدد الأسئلة المجاوب عليها :** ${answeredCount} / ${QUESTIONS.length}`);

  const embed = {
    title: "📋 استبيان المقابلات - طلب جديد",
    color: 0xe8a317,
    description: `${lines.join("\n\n")}\n\n**المتقدم:** <@${discordId}> (\`${discordId}\`)`,
    footer: { text: "naav · طلبات الإدارة" },
    timestamp: new Date().toISOString(),
  };

  const pingLines = [];
  pingLines.push("||@everyone||");
  if (PING_ROLE_ID) pingLines.push(`||<@&${PING_ROLE_ID}>||`);

  const body = {
    content: pingLines.join("\n"),
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "قبول", emoji: { name: "✅" }, custom_id: `accept:${discordId}` },
          { type: 2, style: 4, label: "رفض", emoji: { name: "❌" }, custom_id: `reject:${discordId}` },
        ],
      },
    ],
  };

  const res = await fetch(`${DISCORD_API}/channels/${DISCORD_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "تعذر إرسال الطلب إلى ديسكورد.", details: errText }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
