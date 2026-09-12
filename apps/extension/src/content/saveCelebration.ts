interface SaveCelebrationMessage {
  type: "job-saved";
  title: string;
  company: string;
}

const CELEBRATION_DURATION_MS = 3_600;
const CONFETTI_COLORS = ["#b44a3c", "#d19b32", "#2f8278", "#1f2926", "#e5c7a2"];

function isSaveCelebrationMessage(message: unknown): message is SaveCelebrationMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<SaveCelebrationMessage>;
  return candidate.type === "job-saved"
    && typeof candidate.title === "string"
    && typeof candidate.company === "string";
}

function showSaveCelebration({ title, company }: SaveCelebrationMessage): void {
  document.getElementById("ghostboard-save-celebration")?.remove();

  const host = document.createElement("div");
  host.id = "ghostboard-save-celebration";
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .stage { position: fixed; inset: 0; overflow: hidden; font-family: ui-sans-serif, system-ui, sans-serif; }
    .notice { position: absolute; top: 24px; left: 50%; display: flex; align-items: center; gap: 12px; width: max-content; max-width: min( calc(100vw - 32px), 420px); padding: 13px 18px 13px 13px; color: #fffaf2; background: #1f2926; border: 1px solid rgba(255,250,242,.22); border-radius: 8px; box-shadow: 0 14px 40px rgba(31,41,38,.28); transform: translate(-50%, -18px); animation: notice-in 420ms cubic-bezier(.2,.8,.2,1) forwards, notice-out 500ms ease 3s forwards; }
    .check { display: grid; flex: 0 0 30px; place-items: center; width: 30px; height: 30px; color: #1f2926; background: #d19b32; border-radius: 50%; font-size: 19px; font-weight: 800; animation: check-pop 500ms cubic-bezier(.2,1.5,.4,1) 120ms both; }
    .copy { display: grid; gap: 2px; line-height: 1.2; }
    .headline { font-size: 15px; font-weight: 750; }
    .detail { max-width: 330px; overflow: hidden; color: rgba(255,250,242,.7); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .confetti { position: absolute; top: 66px; left: 50%; width: 8px; height: 14px; border-radius: 2px; background: var(--color); opacity: 0; animation: confetti-fall var(--duration) cubic-bezier(.15,.7,.25,1) var(--delay) forwards; }
    @keyframes notice-in { to { transform: translate(-50%, 0); } }
    @keyframes notice-out { to { opacity: 0; transform: translate(-50%, -10px); } }
    @keyframes check-pop { 0% { opacity: 0; transform: scale(.3) rotate(-20deg); } 70% { opacity: 1; transform: scale(1.15) rotate(4deg); } 100% { transform: scale(1) rotate(0); } }
    @keyframes confetti-fall { 0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0); } 100% { opacity: 0; transform: translate3d(var(--x), var(--y), 0) rotate(var(--rotation)); } }
    @media (prefers-reduced-motion: reduce) { .notice, .check, .confetti { animation-duration: 1ms; animation-delay: 0ms; } }
  `;
  shadow.append(style);

  const stage = document.createElement("div");
  stage.className = "stage";
  const notice = document.createElement("div");
  notice.className = "notice";
  notice.setAttribute("role", "status");
  notice.innerHTML = `<span class="check" aria-hidden="true">&#10003;</span><span class="copy"><span class="headline">First step complete</span><span class="detail"></span></span>`;
  const detail = notice.querySelector(".detail");
  if (detail) detail.textContent = `${company} - ${title}`;
  stage.append(notice);

  for (let index = 0; index < 28; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.setProperty("--color", CONFETTI_COLORS[index % CONFETTI_COLORS.length]);
    piece.style.setProperty("--x", `${(Math.random() - 0.5) * 560}px`);
    piece.style.setProperty("--y", `${150 + Math.random() * 300}px`);
    piece.style.setProperty("--rotation", `${(Math.random() - 0.5) * 900}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 180}ms`);
    piece.style.setProperty("--duration", `${1_700 + Math.random() * 900}ms`);
    piece.style.left = `${50 + (Math.random() - 0.5) * 5}%`;
    stage.append(piece);
  }

  shadow.append(stage);
  document.documentElement.append(host);
  window.setTimeout(() => host.remove(), CELEBRATION_DURATION_MS);
}

export function startSaveCelebration(): void {
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (isSaveCelebrationMessage(message)) showSaveCelebration(message);
  });
}
