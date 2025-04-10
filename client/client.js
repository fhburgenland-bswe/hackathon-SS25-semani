document.addEventListener("DOMContentLoaded", () => {
    // Backend API URL - automatically use the same origin for API calls
    const API_BASE_URL = window.location.origin + "/api";
    
    // Simple user ID for demo purposes - in a real app, use proper authentication
    const userId = "user_" + Math.random().toString(36).substr(2, 9);
    
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatMessages = document.getElementById("chatMessages");
    const lvSelect = document.getElementById("lvSelect");
    const toggleBtn = document.getElementById("toggleLektorenBtn");
    const lektorList = document.getElementById("lektorList");
    const loadingIndicator = document.getElementById("loading");
    
    const lektoren = {
        mathematik: {
            name: "Dipl.-Ing. Dr. Lukas Gnam",
            email: "lukas.gnam@hochschule-burgenland.at",
            telefon: "+43 5 7705-4150",
            sprechstunde: "Nie!"
        },
        betriebssysteme: {
            name: "Dipl.-Ing. Franz Knipp",
            email: "Franz.Knipp@hochschule-burgenland.at",
            telefon: "+43 5 7705-4341",
            sprechstunde: "Dienstag, 14:00–16:00 Uhr"
        },
        algorithmenUndProgrammiertechniken: {
            name: "Dipl.-Ing.in Patrizia Sailer, BSc, MSc, MBA",
            email: "Patrizia.Sailer@hochschule-burgenland.at",
            telefon: "+43 5 7705-4337",
            sprechstunde: "Donnerstag, 09:00–11:00 Uhr"
        }
    };

    let currentLV = "mathematik"; // Default
    let messages = [];
    
    // Show loading indicator
    function showLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = "block";
        }
    }
    
    // Hide loading indicator
    function hideLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = "none";
        }
    }

    // Handle API errors
    function handleError(error) {
        console.error("API Error:", error);
        alert("An error occurred. Please try again later.");
        hideLoading();
    }

    // Load user preference (selected course)
    async function loadUserPreference() {
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/preferences/${userId}`);
            if (!response.ok) throw new Error("Failed to load user preference");
            const data = await response.json();
            return data.selectedCourse;
        } catch (error) {
            console.error("Error loading user preference:", error);
            return "mathematik"; // Default if error
        } finally {
            hideLoading();
        }
    }

    // Save user preference (selected course)
    async function saveUserPreference(courseId) {
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/preferences`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, selectedCourse: courseId })
            });
            if (!response.ok) throw new Error("Failed to save user preference");
        } catch (error) {
            console.error("Error saving user preference:", error);
        } finally {
            hideLoading();
        }
    }

    // Load messages for current course
    async function loadMessages(courseId) {
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/messages/${courseId}`);
            if (!response.ok) throw new Error("Failed to load messages");
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error loading messages:", error);
            return [];
        } finally {
            hideLoading();
        }
    }

    // Save a new message
    async function saveMessage(courseId, text) {
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/messages`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ courseId, text })
            });
            if (!response.ok) throw new Error("Failed to save message");
            return await response.json();
        } catch (error) {
            handleError(error);
            return null;
        } finally {
            hideLoading();
        }
    }

    // Update a message
    async function updateMessage(messageId, updateData) {
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
                method: "PUT",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) throw new Error("Failed to update message");
            return await response.json();
        } catch (error) {
            handleError(error);
            return null;
        } finally {
            hideLoading();
        }
    }

    // Delete a message (mark as deleted)
    async function deleteMessageApi(messageId) {
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error("Failed to delete message");
            return true;
        } catch (error) {
            handleError(error);
            return false;
        } finally {
            hideLoading();
        }
    }

    // Initialize the app
    async function initApp() {
        showLoading();
        try {
            // Load user preference
            const savedCourse = await loadUserPreference();
            if (savedCourse) {
                lvSelect.value = savedCourse;
                currentLV = savedCourse;
            }

            // Load messages for current course
            messages = await loadMessages(currentLV);
            renderMessages(messages);
            
            // Set up event listeners
            setupEventListeners();
        } catch (error) {
            console.error("Error initializing app:", error);
        } finally {
            hideLoading();
        }
    }

    function setupEventListeners() {
        // Course selection change
        lvSelect.addEventListener("change", async () => {
            currentLV = lvSelect.value;
            await saveUserPreference(currentLV);
            messages = await loadMessages(currentLV);
            renderMessages(messages);
        });

        // Form submission (new message)
        chatForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const messageText = chatInput.value.trim();
            if (messageText === "") return;
            
            const savedMessage = await saveMessage(currentLV, messageText);
            if (savedMessage) {
                messages.push(savedMessage);
                appendMessage(savedMessage);
                chatInput.value = "";
            }
        });

        // Toggle lecturer list
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
    }

    function renderMessages(msgArray) {
        chatMessages.innerHTML = "";
        msgArray.forEach(messageObj => appendMessage(messageObj));
    }

    function appendMessage(messageObj) {
        const message = document.createElement("div");
        message.dataset.id = messageObj.id;
        message.classList.add("message", "user");

        // Create text span
        const textSpan = document.createElement("span");
        textSpan.textContent = messageObj.text;
        message.appendChild(textSpan);

        // Add a space after text
        message.appendChild(document.createTextNode(" "));

        // Only show edit and delete buttons if message is not deleted
        if (!messageObj.isDeleted) {
            // Edit button
            const editButton = document.createElement("button");
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => editMessage(messageObj.id));
            message.appendChild(editButton);

            // Add a space between buttons
            message.appendChild(document.createTextNode(" "));

            // Delete button
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => deleteMessage(messageObj.id));
            message.appendChild(deleteButton);
        }

        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function deleteMessage(messageId) {
        if (confirm("Are you sure you want to delete this message?")) {
            const success = await deleteMessageApi(messageId);
            if (success) {
                // Update local messages array
                const index = messages.findIndex(msg => msg.id === messageId);
                if (index !== -1) {
                    messages[index].isDeleted = true;
                    messages[index].originalText = messages[index].originalText || messages[index].text;
                    messages[index].text = "Message deleted";
                    renderMessages(messages);
                }
            }
        }
    }

    async function editMessage(messageId) {
        const messageToEdit = messages.find(msg => msg.id === messageId);
        if (!messageToEdit || messageToEdit.isDeleted) return;

        const messageElement = document.querySelector(`[data-id="${messageId}"]`);
        const currentText = messageToEdit.text;

        // Clear the message element
        messageElement.innerHTML = "";

        // Create edit input
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.value = currentText;
        messageElement.appendChild(editInput);

        // Add space
        messageElement.appendChild(document.createTextNode(" "));

        // Save button
        const saveButton = document.createElement("button");
        saveButton.textContent = "Save";
        saveButton.addEventListener("click", async () => {
            const newText = editInput.value.trim();
            if (newText !== "") {
                const updatedMessage = await updateMessage(messageId, { text: newText });
                if (updatedMessage) {
                    // Update the message in our local array
                    const index = messages.findIndex(msg => msg.id === messageId);
                    if (index !== -1) {
                        messages[index] = updatedMessage;
                        renderMessages(messages);
                    }
                }
            }
        });
        messageElement.appendChild(saveButton);

        // Add space
        messageElement.appendChild(document.createTextNode(" "));

        // Cancel button
        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", () => {
            renderMessages(messages);
        });
        messageElement.appendChild(cancelButton);

        // Focus the input
        editInput.focus();
    }
    
    function renderLektorList() {
        lektorList.innerHTML = `<h3>Alle Lektor:innen</h3>`;

        for (const key in lektoren) {
            const entry = lektoren[key];
            lektorList.innerHTML += `
            <div class="lektor-entry">
                <p><strong>${entry.name}</strong></p>

                <div class="lektor-info-line">
                    <span>📧</span>
                    <a class="email-link" href="mailto:${entry.email}">${entry.email}</a>
                </div>

                <div class="lektor-info-line">
                    <span>📞</span>
                    <a class="tel-link" href="tel:${entry.telefon.replace(/\s+/g, '')}">${entry.telefon}</a>
                </div>

                <div class="lektor-info-line">
                    <span>🕒</span>
                    <span class="sprechzeit">${entry.sprechstunde}</span>
                </div>
            </div>
            `;
        }
    }
    
    // Initialize the app
    initApp();
});