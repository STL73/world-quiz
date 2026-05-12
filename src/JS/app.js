document.addEventListener("DOMContentLoaded", function () {
  const userId          = document.body.getAttribute("data-user-id");
  const savedQuestion   = parseInt(document.body.getAttribute("data-saved-question"), 10) || 0;
  const csrfToken       = document.querySelector('meta[name="csrf-token"]')?.content;

  let currentQuestionId = null;
  let hintUsed          = false;

  // ── UI helpers ──────────────────────────────────────────────────────────────

  function showHintMessage(message) {
    const el = document.getElementById("hint-message");
    if (el) { el.innerText = message; el.style.display = "block"; }
  }

  function showError(message) {
    const el = document.getElementById("error-message");
    if (el) { el.textContent = message; el.style.display = "block"; }
  }

  function hideError() {
    const el = document.getElementById("error-message");
    if (el) { el.style.display = "none"; el.textContent = ""; }
  }

  function showFeedback(isCorrect, scoreChange) {
    const el = document.getElementById("answer-feedback");
    if (!el) return;
    el.textContent = isCorrect
      ? `Correct! +${scoreChange} star${scoreChange !== 1 ? "s" : ""}`
      : "Wrong! No stars this time.";
    el.className = isCorrect ? "correct" : "wrong";
    el.style.display = "flex";
  }

  function hideFeedback() {
    const el = document.getElementById("answer-feedback");
    if (el) { el.style.display = "none"; el.textContent = ""; el.className = ""; }
  }

  // ── Star animations ──────────────────────────────────────────────────────────

  function animateStar() {
    const star = document.getElementById("star");
    if (!star) return;
    star.classList.remove("star");
    void star.offsetWidth; // force reflow so re-adding the class restarts animation
    star.classList.add("star");
    setTimeout(() => star.classList.remove("star"), 2000);
  }

  function showStarGainPopup(amount) {
    const badge = document.querySelector(".quiz-token-badge");
    if (!badge || amount <= 0) return;

    const popup = document.createElement("span");
    popup.className = "star-gain-popup";
    popup.textContent = `+${amount}`;

    badge.style.position = "relative";
    badge.appendChild(popup);

    popup.addEventListener("animationend", () => popup.remove());
  }

  function bumpTokenCounter() {
    const el = document.getElementById("star-tokens");
    if (!el) return;
    el.classList.remove("token-bump");
    void el.offsetWidth;
    el.classList.add("token-bump");
    el.addEventListener("animationend", () => el.classList.remove("token-bump"), { once: true });
  }

  // ── Progress persistence ─────────────────────────────────────────────────────

  function saveProgress(questionId) {
    if (!questionId) return;
    fetch("save_progress.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ questionId }),
    }).catch(() => {}); // best-effort — ignore failures
  }

  function clearProgress() {
    return fetch("save_progress.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ questionId: 0 }),
    }).catch(() => {});
  }

  // ── Question loading ─────────────────────────────────────────────────────────

  function load_question(fromId) {
    const id = fromId !== undefined ? fromId : currentQuestionId;
    fetch(`get_question.php?id=${id || 0}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.id) return;
        currentQuestionId = data.id;
        saveProgress(currentQuestionId);

        document.getElementById("q-img").src = data.img_path;
        document.getElementById("q-img").setAttribute("data-question-id", data.id);
        document.getElementById("q-question").innerText = data.question;
        document.querySelector("label[for='answer1']").innerText = data.answer1;
        document.querySelector("label[for='answer2']").innerText = data.answer2;
        document.querySelector("label[for='answer3']").innerText = data.answer3;

        document.querySelectorAll("input[name='answer']").forEach((r) => { r.checked = false; });
      })
      .catch((err) => console.error("Error loading question:", err));

    hintUsed = false;
    const hintBtn = document.getElementById("get-hint");
    hintBtn.disabled = false;
    hintBtn.innerHTML = "<i class='bx bx-help-circle'></i> Get Hint";
  }

  // ── Start / Continue / Fresh ─────────────────────────────────────────────────

  function startGame(mode) {
    document.querySelector(".welcome").style.display = "none";
    document.querySelector(".question-box").style.display = "grid";

    if (mode === "continue" && savedQuestion > 0) {
      load_question(savedQuestion);
    } else {
      clearProgress().then(() => load_question(0));
    }
  }

  document.querySelectorAll(".start-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      startGame(this.dataset.mode);
    });
  });

  // Save progress before navigating away via the back button
  const backBtn = document.getElementById("back-to-dashboard");
  if (backBtn) {
    backBtn.addEventListener("click", function (e) {
      // If a game is in progress, save before leaving; otherwise just navigate
      if (currentQuestionId) {
        e.preventDefault();
        saveProgress(currentQuestionId);
        setTimeout(() => { window.location.href = "user_panel.php"; }, 150);
      }
    });
  }

  // ── Hint button ──────────────────────────────────────────────────────────────

  document.getElementById("get-hint").addEventListener("click", function () {
    if (!currentQuestionId) return;

    const hintBtn = document.getElementById("get-hint");
    if (hintUsed) {
      hintBtn.disabled = true;
      showHintMessage("You have already used a hint for this question.");
      return;
    }

    hintBtn.disabled = true;
    hintBtn.textContent = "Loading…";

    fetch("use_hint.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ userId, currentQuestionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showHintMessage("Error: " + data.error);
          hintBtn.disabled = false;
          hintBtn.innerHTML = "<i class='bx bx-help-circle'></i> Get Hint";
        } else {
          showHintMessage(data.hint);
          hintUsed = true;
          hintBtn.textContent = "Hint Used";
        }
      })
      .catch((err) => {
        console.error("Error using hint:", err);
        hintBtn.disabled = false;
        hintBtn.innerHTML = "<i class='bx bx-help-circle'></i> Get Hint";
      });
  });

  // ── Submit answer ────────────────────────────────────────────────────────────

  document.getElementById("submit-answer").addEventListener("click", function () {
    const selectedAnswer = document.querySelector("input[name='answer']:checked");
    if (!selectedAnswer) {
      showError("Please select an answer before submitting.");
      return;
    }
    hideError();

    const answerIndex = selectedAnswer.value;
    const submitBtn   = document.getElementById("submit-answer");
    submitBtn.disabled = true;
    submitBtn.textContent = "Checking…";

    fetch("check_answer.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ userId, currentQuestionId, answerIndex }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showError("Error: " + data.error);
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Answer";
          return;
        }

        // Update live badge
        document.getElementById("star-tokens").innerText = data.newTokens;
        document.getElementById("current-level").innerText = data.newLevel;

        // Animate
        if (data.isCorrect && data.scoreChange > 0) {
          animateStar();
          showStarGainPopup(data.scoreChange);
          bumpTokenCounter();
        }

        // Show feedback overlay
        const hintBox = document.getElementById("hint-message");
        if (hintBox) { hintBox.style.display = "none"; hintBox.innerText = ""; }
        showFeedback(data.isCorrect, data.scoreChange);

        setTimeout(() => {
          hideFeedback();
          hintUsed = false;
          document.getElementById("get-hint").disabled = false;
          document.getElementById("get-hint").innerHTML = "<i class='bx bx-help-circle'></i> Get Hint";
          document.querySelectorAll("input[name='answer']").forEach((r) => { r.checked = false; });
          load_question();
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Answer";
        }, 1500);
      })
      .catch((err) => {
        console.error("Error submitting answer:", err);
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Answer";
      });
  });
});
