document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatMessages = document.getElementById("chatMessages");
    const lvSelect = document.getElementById("lvSelect");
    const toggleBtn = document.getElementById("toggleLektorenBtn");
    const lektorList = document.getElementById("lektorList");
    const lektoren = {
        mathematik: {
            name: "Dipl.-Ing. Dr. Lukas Gnam",
            email: "lukas.gnam(at)hochschule-burgenland.at",
            telefon: ""
            sprechstunde: "Nie!"
        },
        betriebssysteme: {
            name: "Dr. Max Weber",
            email: "max.weber@hs-info.de",
            sprechstunde: "Dienstag, 14:00–16:00 Uhr"
        },
        projektmanagement: {
            name: "Dipl.-Kfm. Lisa Meier",
            email: "lisa.meier@hs-wirtschaft.de",
            sprechstunde: "Donnerstag, 09:00–11:00 Uhr"
        }
    };    

    // Load current course from localStorage if available
    if (localStorage.getItem('selectedCourse')) {
        lvSelect.value = localStorage.getItem('selectedCourse');
    }

    // Save selected course to localStorage when changed
    lvSelect.addEventListener('change', function () {
        localStorage.setItem('selectedCourse', lvSelect.value);
    });
    
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

    toggleBtn.addEventListener("click", () => {
        if (lektorList.style.display === "none") {
            renderLektorList();
            lektorList.style.display = "block";
            toggleBtn.textContent = "📋 Lektoren ausblenden";
        } else {
            lektorList.style.display = "none";
            toggleBtn.textContent = "📋 Lektoren anzeigen";
        }
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

    function renderLektorList() {
        lektorList.innerHTML = `<h3>Alle Lektor:innen</h3>`;

        for (const key in lektoren) {
            const entry = lektoren[key];
            lektorList.innerHTML += `
                <div class="lektor-entry">
                    <p><strong>${entry.name}</strong><br />
                    <a href="mailto:${entry.email}">${entry.email}</a><br />
                    <small>Sprechstunde: ${entry.sprechstunde}</small></p>
                </div>
            `;
        }
    }
});
