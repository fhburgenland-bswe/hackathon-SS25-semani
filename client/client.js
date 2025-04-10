document.addEventListener("DOMContentLoaded", () => {
    // Backend API URL - use fixed localhost URL for all users in Live Share
    const API_BASE_URL = "http://localhost:3000/api";
    
    // Single shared user ID for all users in the Live Share environment
    const userId = "shared_user";

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
            sprechstunde: "Montag 16:00 - 17:00 Uhr"
        },
        betriebssysteme: {
            name: "Dipl.-Ing. Franz Knipp",
            email: "Franz.Knipp@hochschule-burgenland.at",
            telefon: "+43 5 7705-4341",
            sprechstunde: "Dienstag 17:00 - 1:00 Uhr"
        },
        algorithmenUndProgrammiertechniken: {
            name: "Dipl.-Ing.in Patrizia Sailer, BSc, MSc, MBA",
            email: "Patrizia.Sailer@hochschule-burgenland.at",
            telefon: "+43 5 7705-4337",
            sprechstunde: "Mittwoch 16:00 - 17:00 Uhr"
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

    // Handle API errors with more detailed error reporting
    function handleError(error) {
        console.error("API Error:", error);
        
        // More informative error message
        let errorMessage = "An error occurred: " + (error.message || "Unknown error");
        
        // Add status code if available
        if (error.status) {
            errorMessage += ` (Status: ${error.status})`;
        }
        
        alert(errorMessage + "\nPlease check the console for more details.");
        hideLoading();
    }

    // Simplified fetch with error handling
    async function fetchAPI(url, options = {}) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error || `HTTP error ${response.status}`);
                error.status = response.status;
                throw error;
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error (${url}):`, error);
            throw error;
        }
    }

    // Load messages for current course - simplified with better error handling
    async function loadMessages(courseId) {
        showLoading();
        try {
            // First check if the server is running by making a simple request
            try {
                const data = await fetchAPI(`${API_BASE_URL}/messages/${courseId}`);
                hideLoading();
                return data;
            } catch (error) {
                // If the error is likely due to server not running, provide clearer message
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    throw new Error('Server is not running. Please start the server first.');
                }
                throw error;
            }
        } catch (error) {
            console.error("Error loading messages:", error);
            alert(`Failed to load messages: ${error.message}`);
            hideLoading();
            return [];
        }
    }

    // Save a new message - simplified
    async function saveMessage(courseId, text) {
        showLoading();
        try {
            const savedMessage = await fetchAPI(`${API_BASE_URL}/messages`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId, text, userId })
            });
            hideLoading();
            return savedMessage;
        } catch (error) {
            handleError(error);
            hideLoading();
            return null;
        }
    }

    // Update a message - simplified
    async function updateMessage(messageId, updateData) {
        showLoading();
        try {
            const updatedMessage = await fetchAPI(`${API_BASE_URL}/messages/${messageId}`, {
                method: "PUT",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            hideLoading();
            return updatedMessage;
        } catch (error) {
            handleError(error);
            hideLoading();
            return null;
        }
    }

    // Delete a message - simplified
    async function deleteMessageApi(messageId) {
        showLoading();
        try {
            await fetchAPI(`${API_BASE_URL}/messages/${messageId}`, {
                method: "DELETE"
            });
            hideLoading();
            return true;
        } catch (error) {
            handleError(error);
            hideLoading();
            return false;
        }
    }

    // Initialize the app - simplified to skip user preferences
    async function initApp() {
        showLoading();
        try {
            // Always use "mathematik" as the default course
            currentLV = "mathematik";
            lvSelect.value = currentLV;
            
            // Load messages for current course
            messages = await loadMessages(currentLV);
            renderMessages(messages);
            
            // Set up event listeners
            setupEventListeners();
        } catch (error) {
            console.error("Error initializing app:", error);
            alert(`Failed to initialize app: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    function setupEventListeners() {
        // Course selection change - simplified
        lvSelect.addEventListener("change", async () => {
            currentLV = lvSelect.value;
            // Skip saving user preference
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