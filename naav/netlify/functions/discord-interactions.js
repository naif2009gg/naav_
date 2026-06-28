const { verifyKey } = require("discord-interactions");

const DISCORD_API = "https://discord.com/api/v10";

const InteractionType = { PING: 1, MESSAGE_COMPONENT: 3 };
const InteractionResponseType = { PONG: 1, UPDATE_MESSAGE: 7 };

async function discordFetch(path, token, options = {}) {
  return fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

exports.handler = async function (event) {
  const {
    DISCORD_BOT_TOKEN,
    DISCORD_PUBLIC_KEY,
    DISCORD_GUILD_ID,
    ACCEPT_ROLE_ID,
    REJECT_ROLE_ID,
  } = process.env;

  const signature = event.headers["x-signature-ed25519"];
  const timestamp = event.headers["x-signature-timestamp"];
  const rawBody = event.body || "";

  const isValid =
    signature &&
    timestamp &&
    DISCORD_PUBLIC_KEY &&
    verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);

  if (!isValid) {
    return { statusCode: 401, body: "invalid request signature" };
  }

  const interaction = JSON.parse(rawBody);

  // Discord يرسل PING للتأكد من أن الرابط فعّال
  if (interaction.type === InteractionType.PING) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: InteractionResponseType.PONG }),
    };
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id || "";
    const [action, applicantId] = customId.split(":");

    if (action !== "accept" && action !== "reject") {
      return { statusCode: 400, body: "unknown action" };
    }

    const staffName =
      interaction.member?.nick ||
      interaction.member?.user?.global_name ||
      interaction.member?.user?.username ||
      "إداري";

    const acceptRole = ACCEPT_ROLE_ID;
    const rejectRole = REJECT_ROLE_ID;

    // 1) تحديث الرتب في السيرفر
    if (DISCORD_GUILD_ID && DISCORD_BOT_TOKEN) {
      try {
        if (action === "accept" && acceptRole) {
          await discordFetch(
            `/guilds/${DISCORD_GUILD_ID}/members/${applicantId}/roles/${acceptRole}`,
            DISCORD_BOT_TOKEN,
            { method: "PUT" }
          );
          if (rejectRole) {
            await discordFetch(
              `/guilds/${DISCORD_GUILD_ID}/members/${applicantId}/roles/${rejectRole}`,
              DISCORD_BOT_TOKEN,
              { method: "DELETE" }
            );
          }
        } else if (action === "reject" && rejectRole) {
          await discordFetch(
            `/guilds/${DISCORD_GUILD_ID}/members/${applicantId}/roles/${rejectRole}`,
            DISCORD_BOT_TOKEN,
            { method: "PUT" }
          );
        }
      } catch (err) {
        // نتجاهل خطأ الرتبة (مثلاً العضو غير موجود) ونكمل العملية
        console.error("role update failed", err);
      }
    }

    // 2) إرسال رسالة خاصة للمتقدم عند القبول فقط
    if (action === "accept" && DISCORD_BOT_TOKEN) {
      try {
        const dmChannelRes = await discordFetch(`/users/@me/channels`, DISCORD_BOT_TOKEN, {
          method: "POST",
          body: JSON.stringify({ recipient_id: applicantId }),
        });
        const dmChannel = await dmChannelRes.json();
        if (dmChannel.id) {
          await discordFetch(`/channels/${dmChannel.id}/messages`, DISCORD_BOT_TOKEN, {
            method: "POST",
            body: JSON.stringify({
              content:
                "✅ **تم قبولك مبدئيًا في إدارة naav.**\nيرجى التوجه إلى روم الدعم الفني وانتظار التواصل معك لإكمال باقي الإجراءات.",
            }),
          });
        }
      } catch (err) {
        console.error("dm failed", err);
      }
    }

    // 3) تحديث الرسالة الأصلية: نستبدل "قيد المراجعة" بالنتيجة الفعلية ونحذف الأزرار
    const original = interaction.message;
    const originalEmbed = original.embeds?.[0] || {};
    const decisionText = action === "accept" ? "✅ مقبول" : "❌ مرفوض";

    let newDescription = (originalEmbed.description || "").replace(
      /قيد المراجعة/u,
      decisionText
    );
    newDescription += `\n\nتم اتخاذ القرار بواسطة **${staffName}**`;

    const updatedEmbed = {
      ...originalEmbed,
      color: action === "accept" ? 0x2ecc71 : 0xe74c3c,
      description: newDescription,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: original.content,
          embeds: [updatedEmbed],
          components: [],
        },
      }),
    };
  }

  return { statusCode: 400, body: "unhandled interaction type" };
};
