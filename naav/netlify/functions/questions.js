const { QUESTIONS } = require("./_questions-data");

exports.handler = async function () {
  // فقط نص السؤال يصل للمتصفح - كل الأسئلة مفتوحة، لا يوجد إجابات صحيحة لإخفائها أصلاً
  const safeQuestions = QUESTIONS.map(({ id, label, question }) => ({
    id,
    label,
    question,
  }));

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ questions: safeQuestions }),
  };
};
