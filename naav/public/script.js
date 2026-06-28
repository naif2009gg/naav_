document.getElementById("year").textContent = new Date().getFullYear();

const introStep = document.getElementById("intro-step");
const loadingStep = document.getElementById("loading-step");
const formStep = document.getElementById("app-form");
const successStep = document.getElementById("success-step");
const questionsWrap = document.getElementById("questions-wrap");
const progressFill = document.getElementById("progress-fill");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const submitBtn = document.getElementById("submit-btn");
const errorMsg = document.getElementById("error-msg");
const startBtn = document.getElementById("start-btn");

let fields = []; // أول حقل ثابت = آيدي الديسكورد، بعده أسئلة الاستبيان القادمة من السيرفر
let current = 0;
const answers = {};
let discordId = "";

function showStep(step) {
  [introStep, loadingStep, formStep, successStep].forEach((s) => s.classList.remove("active"));
  step.classList.add("active");
}

showStep(introStep);

startBtn.addEventListener("click", async () => {
  showStep(loadingStep);
  try {
    const res = await fetch("/api/questions", { cache: "no-store" });
    const data = await res.json();

    fields = [
      {
        id: "__discordId",
        label: "آيدي حسابك في ديسكورد (Discord ID)",
        helper: "فعّل Developer Mode بإعدادات ديسكورد، ثم اضغط يمين على اسمك واختر Copy ID.",
        type: "discordId",
      },
      ...(data.questions || []).map((q) => ({ ...q, type: "text" })),
    ];

    renderFields();
    current = 0;
    updateView();
    showStep(formStep);
  } catch (e) {
    showStep(introStep);
    alert("تعذر تحميل الاستبيان، حاول مرة أخرى.");
  }
});

function renderFields() {
  questionsWrap.innerHTML = "";
  fields.forEach((f, idx) => {
    const block = document.createElement("div");
    block.className = "q-block";
    block.dataset.index = idx;

    const label = document.createElement("span");
    label.className = "q-label";
    label.textContent = f.label || f.question;
    block.appendChild(label);

    if (f.helper) {
      const helper = document.createElement("div");
      helper.className = "q-helper";
      helper.textContent = f.helper;
      block.appendChild(helper);
    }

    const isLong = ["q3", "q4", "q6", "q7"].includes(f.id);
    const input = document.createElement(isLong ? "textarea" : "input");
    input.className = "q-input";
    if (isLong) input.rows = 4;
    else input.type = "text";
    input.placeholder = "اكتب إجابتك هنا…";

    input.addEventListener("input", () => {
      if (f.type === "discordId") discordId = input.value.trim();
      else answers[f.id] = input.value;
    });

    block.appendChild(input);
    questionsWrap.appendChild(block);
  });
}

function updateView() {
  const blocks = questionsWrap.querySelectorAll(".q-block");
  blocks.forEach((b, idx) => b.classList.toggle("active", idx === current));

  progressFill.style.width = `${((current + 1) / fields.length) * 100}%`;
  prevBtn.style.visibility = current === 0 ? "hidden" : "visible";

  const isLast = current === fields.length - 1;
  nextBtn.hidden = isLast;
  submitBtn.hidden = !isLast;
  errorMsg.textContent = "";
}

function currentFieldAnswered() {
  const f = fields[current];
  if (f.type === "discordId") return /^[0-9]{16,21}$/.test(discordId);
  const val = answers[f.id];
  return typeof val === "string" && val.trim().length > 0;
}

nextBtn.addEventListener("click", () => {
  if (!currentFieldAnswered()) {
    const f = fields[current];
    errorMsg.textContent =
      f.type === "discordId"
        ? "أدخل آيدي ديسكورد صحيح (أرقام فقط، 16-21 رقم)."
        : "يرجى الإجابة على السؤال قبل الاستمرار.";
    return;
  }
  current = Math.min(current + 1, fields.length - 1);
  updateView();
});

prevBtn.addEventListener("click", () => {
  current = Math.max(current - 1, 0);
  updateView();
});

formStep.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentFieldAnswered()) {
    errorMsg.textContent = "يرجى تعبئة هذا الحقل قبل الإرسال.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "جاري الإرسال…";

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId, answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع.");
    showStep(successStep);
  } catch (err) {
    errorMsg.textContent = err.message || "تعذر إرسال الطلب، حاول مرة أخرى.";
    submitBtn.disabled = false;
    submitBtn.textContent = "إرسال الطلب";
  }
});
