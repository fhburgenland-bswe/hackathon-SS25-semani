document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatMessages = document.getElementById("chatMessages");
    const lvSelect = document.getElementById("lvSelect");

    let currentLV = lvSelect.value;
    let messages = loadMessages(currentLV);
    renderMessages(messages);

    // Bei Lehrveranstaltungswechsel
    lvSelect.addEventListener("change", () => {
        currentLV = lvSelect.value;
        messages = loadMessages(currentLV);
        renderMessages(messages);
    });

    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        if (messageText === "") return;

        messages.push(messageText);
        saveMessages(currentLV, messages);
        appendMessage(messageText);

        chatInput.value = "";
    });

    function loadMessages(lvKey) {
        return JSON.parse(localStorage.getItem("chat_" + lvKey)) || [];
    }

    function saveMessages(lvKey, msgArray) {
        localStorage.setItem("chat_" + lvKey, JSON.stringify(msgArray));
    }

    function renderMessages(msgArray) {
        chatMessages.innerHTML = "";
        msgArray.forEach(text => appendMessage(text));
    }

    function appendMessage(text) {
        const message = document.createElement("div");
        message.textContent = text;
        message.classList.add("message", "user");
        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});
