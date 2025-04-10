document.addEventListener("DOMContentLoaded", () => {
    // Backend API URL - use fixed localhost URL for all users in Live Share
    const API_BASE_URL = "http://localhost:3000/api";

    // Single shared user ID for all users in the Live Share environment
    const userId = "shared_user";

    // Auto-refresh interval in milliseconds (5 seconds)
    const REFRESH_INTERVAL = 500;

    // Variable to store the refresh interval ID so we can cancel it if needed
    let refreshIntervalId = null;

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

        // Only show alert on serious errors, not auto-refresh failures
        if (!error.silent) {
            alert(errorMessage + "\nPlease check the console for more details.");
        }
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
                error.silent = options.silent || false;
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${url}):`, error);
            throw error;
        }
    }

    // Load messages for current course - now with a silent option for auto-refresh
    async function loadMessages(courseId, silent = false) {
        if (!silent) showLoading();
        try {
            // Make the API request
            const data = await fetchAPI(`${API_BASE_URL}/messages/${courseId}`, { silent });

            // Sort messages by timestamp (oldest first, newest last)
            const sortedData = data.sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });

            if (!silent) hideLoading();
            return sortedData;
        } catch (error) {
            // If it's a silent refresh, don't show alerts or loading indicators
            if (silent) {
                console.log("Silent refresh failed, will try again later");
                return messages; // Return current messages if refresh fails
            } else {
                console.error("Error loading messages:", error);
                alert(`Failed to load messages: ${error.message}`);
                hideLoading();
                return [];
            }
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

    // Function to refresh messages automatically
    async function refreshMessages() {
        try {
            // Use silent mode to avoid showing loading indicator during auto-refresh
            const newMessages = await loadMessages(currentLV, true);

            // If we got messages back and they're different from what we have
            if (newMessages && JSON.stringify(newMessages) !== JSON.stringify(messages)) {
                // Save scroll position before updating
                const scrollPosition = chatMessages.scrollTop;
                const scrolledToBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 5;

                // Update messages array and render
                messages = newMessages;
                renderMessages(messages);

                // Restore scroll position or scroll to bottom if user was already at bottom
                if (scrolledToBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } else {
                    chatMessages.scrollTop = scrollPosition;
                }
            }
        } catch (error) {
            console.error("Auto-refresh failed:", error);
            // Don't show alerts for refresh failures
        }
    }

    // Start the auto-refresh interval
    function startAutoRefresh() {
        // Clear any existing interval first
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
        }

        // Set up new interval
        refreshIntervalId = setInterval(refreshMessages, REFRESH_INTERVAL);
        console.log("Auto-refresh started");
    }

    // Stop the auto-refresh interval
    function stopAutoRefresh() {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
            console.log("Auto-refresh stopped");
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

            // Scroll to bottom to see the latest messages
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Set up event listeners
            setupEventListeners();

            // Start auto-refresh
            startAutoRefresh();
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

            // Restart auto-refresh when changing courses
            stopAutoRefresh();

            // Load messages for new course
            messages = await loadMessages(currentLV);
            renderMessages(messages);

            // Scroll to bottom to see latest messages
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Restart auto-refresh
            startAutoRefresh();
        });

        // Form submission (new message)
        chatForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const messageText = chatInput.value.trim();
            if (messageText === "") return;

            const savedMessage = await saveMessage(currentLV, messageText);
            if (savedMessage) {
                // Instead of just adding to the array, refresh all messages
                // This ensures consistency with what's in the database
                messages = await loadMessages(currentLV);
                renderMessages(messages);

                // Clear the input field
                chatInput.value = "";

                // Scroll to bottom to show the new message
                chatMessages.scrollTop = chatMessages.scrollHeight;
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

        // Handle page visibility changes to conserve resources
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, slow down refresh to save resources
                stopAutoRefresh();
                refreshIntervalId = setInterval(refreshMessages, REFRESH_INTERVAL * 2);
            } else {
                // Page is visible again, restore normal refresh rate
                stopAutoRefresh();
                startAutoRefresh();
            }
        });

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            stopAutoRefresh();
        });
    }

    function renderMessages(msgArray) {
        chatMessages.innerHTML = "";

        // Render messages in chronological order (oldest first, newest last)
        msgArray.forEach(messageObj => appendMessage(messageObj));
    }

    function appendMessage(messageObj) {
        const message = document.createElement("div");
        message.dataset.id = messageObj.id;
        message.classList.add("message", "user");

        // Add timestamp
        const timestampSpan = document.createElement("small");
        const messageDate = new Date(messageObj.timestamp);
        timestampSpan.textContent = formatTimestamp(messageDate);
        timestampSpan.classList.add("message-timestamp");
        message.appendChild(timestampSpan);

        // Add user ID (first 6 chars only) - with safety check for undefined
        const userSpan = document.createElement("small");
        // Check if userId exists and handle the case where it's undefined
        const userIdText = messageObj.userId ? messageObj.userId.substring(0, 6) : 'anonymous';
        userSpan.textContent = ` (${userIdText}): `;
        userSpan.classList.add("message-user");
        message.appendChild(userSpan);

        // Create text span
        const textSpan = document.createElement("span");
        textSpan.textContent = messageObj.text;
        textSpan.classList.add("message-text");
        message.appendChild(textSpan);

        // Add a space after text
        message.appendChild(document.createTextNode(" "));

        // Only show edit and delete buttons if message is not deleted
        if (!messageObj.isDeleted) {
            // Edit button
            const editButton = document.createElement("button");
            editButton.textContent = "Edit";
            editButton.classList.add("edit-button");
            editButton.addEventListener("click", () => editMessage(messageObj.id));
            message.appendChild(editButton);

            // Add a space between buttons
            message.appendChild(document.createTextNode(" "));

            // Delete button
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.classList.add("delete-button");
            deleteButton.addEventListener("click", () => deleteMessage(messageObj.id));
            message.appendChild(deleteButton);
        }

        chatMessages.appendChild(message);
    }

    // Format timestamp to a nice readable format
    function formatTimestamp(date) {
        const now = new Date();
        const isToday = date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

        // Format: HH:MM for today, DD.MM.YYYY HH:MM for other days
        const timeString = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        if (isToday) {
            return timeString;
        } else {
            const dateString = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${dateString} ${timeString}`;
        }
    }

    async function deleteMessage(messageId) {
        if (confirm("Are you sure you want to delete this message?")) {
            const success = await deleteMessageApi(messageId);
            if (success) {
                // Instead of just updating the array, refresh all messages
                messages = await loadMessages(currentLV);
                renderMessages(messages);

                // Keep user at current scroll position
                chatMessages.scrollTop = chatMessages.scrollTop;
            }
        }
    }

    async function editMessage(messageId) {
        stopAutoRefresh(); // Pause auto-refresh during editing

        const messageToEdit = messages.find(msg => msg.id === messageId);
        if (!messageToEdit || messageToEdit.isDeleted) return;

        const messageElement = document.querySelector(`[data-id="${messageId}"]`);
        const currentText = messageToEdit.text;

        // Store the original content for restoration if editing is cancelled
        const originalContent = messageElement.innerHTML;

        // Clear the message element
        messageElement.innerHTML = "";

        // Create edit input
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.value = currentText;
        editInput.classList.add("edit-input");
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
                    // Refresh all messages to ensure consistency
                    messages = await loadMessages(currentLV);
                    renderMessages(messages);

                    // Try to keep the user at approximately the same position
                    const messageElements = document.querySelectorAll('.message');
                    for (let i = 0; i < messageElements.length; i++) {
                        if (messageElements[i].dataset.id === messageId) {
                            messageElements[i].scrollIntoView({ behavior: 'auto', block: 'nearest' });
                            break;
                        }
                    }
                }
                startAutoRefresh(); // Resume auto-refresh
            }
        });
        messageElement.appendChild(saveButton);

        // Add space
        messageElement.appendChild(document.createTextNode(" "));

        // Cancel button
        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", () => {
            // Restore original content
            messageElement.innerHTML = originalContent;
            startAutoRefresh(); // Resume auto-refresh
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