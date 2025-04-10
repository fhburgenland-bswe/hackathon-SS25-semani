document.addEventListener("DOMContentLoaded", () => {
    // Backend API URL
    const API_BASE_URL = "http://localhost:3000/api";
    
    // Auto-refresh interval in milliseconds (5 seconds)
    const REFRESH_INTERVAL = 5000;
    
    // Variable to store the refresh interval ID so we can cancel it if needed
    let refreshIntervalId = null;
    
    // Current user information
    let currentUser = null;

    // Get DOM elements
    const loginForm = document.getElementById("loginForm");
    const loginUsername = document.getElementById("loginUsername");
    const loginPassword = document.getElementById("loginPassword");
    const loginError = document.getElementById("loginError");
    const chatContainer = document.getElementById("chatContainer");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const chatMessages = document.getElementById("chatMessages");
    const lvSelect = document.getElementById("lvSelect");
    const toggleBtn = document.getElementById("toggleLektorenBtn");
    const lektorList = document.getElementById("lektorList");
    const loadingIndicator = document.getElementById("loading");
    const logoutBtn = document.getElementById("logoutBtn");
    const currentUserDisplay = document.getElementById("currentUser");

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
            loadingIndicator.style.display = "flex"; // Changed to flex for centering
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
        
        let errorMessage = "An error occurred: " + (error.message || "Unknown error");
        
        if (error.status) {
            errorMessage += ` (Status: ${error.status})`;
        }
        
        if (!error.silent) {
            alert(errorMessage + "\nPlease check the console for more details.");
        }
        hideLoading();
    }

    // Fetch API wrapper with error handling
    async function fetchAPI(url, options = {}) {
        console.log(`Fetching ${url} with options:`, options);
        
        // Default options
        const fetchOptions = {
            ...options,
            credentials: 'include', // CRITICAL: Include credentials (cookies) with every request
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, fetchOptions);
            console.log(`Response from ${url}:`, response);
            console.log(`Response status: ${response.status}`);
            
            // Log response headers for debugging
            const headers = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
            console.log('Response headers:', headers);
            
            if (response.status === 401 && !url.includes('/login')) {
                // Handle authentication error - show login screen
                showLoginScreen("Your session has expired. Please login again.");
                return null;
            }
            
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: `HTTP error ${response.status}` };
                }
                
                console.error('Error response data:', errorData);
                
                const error = new Error(errorData.error || `HTTP error ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                error.silent = options.silent || false;
                throw error;
            }
            
            // Parse response as JSON
            const data = await response.json();
            console.log(`Response data from ${url}:`, data);
            return data;
        } catch (error) {
            console.error(`API Error (${url}):`, error);
            if (loginError && url.includes('/login')) {
                loginError.textContent = error.message || "Login failed. Please try again.";
                loginError.style.display = "block";
            }
            throw error;
        }
    }

    // Test if session is working
    async function testSession() {
        try {
            const response = await fetchAPI(`${API_BASE_URL}/debug/session`);
            console.log('Session test result:', response);
            return response && response.user && typeof response.user !== 'string';
        } catch (error) {
            console.error('Session test failed:', error);
            return false;
        }
    }

    // User login
    async function login(username, password) {
        try {
            showLoading();
            console.log(`Attempting login for: ${username}`);
            
            const user = await fetchAPI(`${API_BASE_URL}/login`, {
                method: "POST",
                body: JSON.stringify({ username, password })
            });
            
            if (user) {
                console.log('Login successful, user data:', user);
                currentUser = user;
                localStorage.setItem('username', user.username);
                hideLoading();
                return user;
            }
            hideLoading();
            return null;
        } catch (error) {
            hideLoading();
            console.error("Login failed:", error);
            return null;
        }
    }

    // User logout
    async function logout() {
        try {
            showLoading();
            await fetchAPI(`${API_BASE_URL}/logout`, {
                method: "POST"
            });
            currentUser = null;
            localStorage.removeItem('username');
            showLoginScreen();
            
            // Stop auto-refresh
            stopAutoRefresh();
            hideLoading();
        } catch (error) {
            hideLoading();
            console.error("Logout failed:", error);
        }
    }

    // Check if user is logged in
    async function checkAuth() {
        try {
            showLoading();
            console.log('Checking if user is logged in...');
            const user = await fetchAPI(`${API_BASE_URL}/user`);
            if (user) {
                console.log('User is logged in:', user);
                currentUser = user;
                hideLoading();
                return true;
            }
            console.log('User is not logged in');
            hideLoading();
            return false;
        } catch (error) {
            hideLoading();
            console.error("Auth check failed:", error);
            return false;
        }
    }
    
    // Show login screen
    function showLoginScreen(errorMessage = null) {
        if (chatContainer) chatContainer.style.display = "none";
        if (loginForm) loginForm.style.display = "block";
        
        if (errorMessage && loginError) {
            loginError.textContent = errorMessage;
            loginError.style.display = "block";
        } else if (loginError) {
            loginError.style.display = "none";
        }
    }

    // Show chat screen
    function showChatScreen() {
        if (loginForm) loginForm.style.display = "none";
        if (chatContainer) chatContainer.style.display = "block";
        
        // Display current user
        if (currentUserDisplay && currentUser) {
            currentUserDisplay.textContent = `Logged in as: ${currentUser.displayName || currentUser.username}`;
        }
    }

    // Load messages for current course
    async function loadMessages(courseId, silent = false) {
        if (!silent) showLoading();
        try {
            const data = await fetchAPI(`${API_BASE_URL}/messages/${courseId}`, { silent });
            
            // Sort messages by timestamp (oldest first, newest last)
            const sortedData = data.sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            
            if (!silent) hideLoading();
            return sortedData;
        } catch (error) {
            if (silent) {
                console.log("Silent refresh failed, will try again later");
                return messages; // Return current messages if refresh fails
            } else {
                console.error("Error loading messages:", error);
                if (!error.silent) alert(`Failed to load messages: ${error.message}`);
                hideLoading();
                return [];
            }
        }
    }

    // Save a new message
    async function saveMessage(courseId, text) {
        showLoading();
        try {
            const savedMessage = await fetchAPI(`${API_BASE_URL}/messages`, {
                method: "POST",
                body: JSON.stringify({ courseId, text })
            });
            hideLoading();
            return savedMessage;
        } catch (error) {
            handleError(error);
            hideLoading();
            return null;
        }
    }

    // Update a message
    async function updateMessage(messageId, updateData) {
        showLoading();
        try {
            const updatedMessage = await fetchAPI(`${API_BASE_URL}/messages/${messageId}`, {
                method: "PUT",
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

    // Delete a message
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

    // Load user preferences
    async function loadUserPreference() {
        try {
            const preference = await fetchAPI(`${API_BASE_URL}/preferences`);
            return preference ? preference.selectedCourse : "mathematik";
        } catch (error) {
            console.error("Failed to load preferences:", error);
            return "mathematik";
        }
    }

    // Save user preferences
    async function saveUserPreference(courseId) {
        try {
            await fetchAPI(`${API_BASE_URL}/preferences`, {
                method: "POST",
                body: JSON.stringify({ selectedCourse: courseId })
            });
            return true;
        } catch (error) {
            console.error("Failed to save preferences:", error);
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

    // Initialize the app
    async function initApp() {
        showLoading();
        try {
            // Check if user is logged in
            const isLoggedIn = await checkAuth();
            
            if (!isLoggedIn) {
                showLoginScreen();
                hideLoading();
                return;
            }
            
            // Test if session is working
            const sessionWorks = await testSession();
            console.log('Session working:', sessionWorks);
            
            if (!sessionWorks) {
                console.warn('Session appears to be broken, returning to login');
                showLoginScreen("Session verification failed. Please login again.");
                hideLoading();
                return;
            }
            
            // Show chat screen if logged in
            showChatScreen();
            
            // Load user preference
            const savedCourse = await loadUserPreference();
            if (savedCourse) {
                currentLV = savedCourse;
                if (lvSelect) lvSelect.value = currentLV;
            }
            
            // Load messages for current course
            messages = await loadMessages(currentLV);
            renderMessages(messages);
            
            // Scroll to bottom to see the latest messages
            if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Set up event listeners
            setupEventListeners();
            
            // Start auto-refresh
            startAutoRefresh();
        } catch (error) {
            console.error("Error initializing app:", error);
            if (error.status === 401) {
                showLoginScreen();
            } else {
                alert(`Failed to initialize app: ${error.message}`);
            }
        } finally {
            hideLoading();
        }
    }

    function setupEventListeners() {
        // Login form submission
        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                
                const username = loginUsername.value.trim();
                const password = loginPassword.value;
                
                if (!username || !password) {
                    if (loginError) {
                        loginError.textContent = "Please enter both username and password";
                        loginError.style.display = "block";
                    }
                    return;
                }
                
                showLoading();
                const user = await login(username, password);
                hideLoading();
                
                if (user) {
                    loginPassword.value = "";
                    showChatScreen();
                    
                    // Verify session is working after login
                    const sessionWorks = await testSession();
                    console.log('Session working after login:', sessionWorks);
                    
                    if (!sessionWorks) {
                        showLoginScreen("Login was successful but session verification failed. This might be a server configuration issue.");
                        return;
                    }
                    
                    initApp(); // Reinitialize chat app after login
                } else {
                    if (loginError) {
                        loginError.textContent = "Invalid username or password";
                        loginError.style.display = "block";
                    }
                }
            });
        }
        
        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener("click", logout);
        }
        
        // Course selection change
        if (lvSelect) {
            lvSelect.addEventListener("change", async () => {
                currentLV = lvSelect.value;
                await saveUserPreference(currentLV);
                
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
        }

        // Chat form submission (new message)
        if (chatForm) {
            chatForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const messageText = chatInput.value.trim();
                if (messageText === "") return;

                const savedMessage = await saveMessage(currentLV, messageText);
                if (savedMessage) {
                    // Instead of just adding to the array, refresh all messages
                    messages = await loadMessages(currentLV);
                    renderMessages(messages);
                    
                    // Clear the input field
                    chatInput.value = "";
                    
                    // Scroll to bottom to show the new message
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            });
        }

        // Toggle lecturer list
        if (toggleBtn && lektorList) {
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
        if (!chatMessages) return;
        
        chatMessages.innerHTML = "";
        
        // Render messages in chronological order (oldest first, newest last)
        msgArray.forEach(messageObj => appendMessage(messageObj));
    }

    function appendMessage(messageObj) {
        const message = document.createElement("div");
        message.dataset.id = messageObj.id;
        
        // Determine if this message is from the current user
        const isCurrentUserMessage = currentUser && messageObj.userId === currentUser.username;
        
        // Apply different classes based on message sender
        message.classList.add("message");
        if (isCurrentUserMessage) {
            message.classList.add("my-message"); // Your messages on the right
        } else {
            message.classList.add("other-message"); // Other users' messages on the left
        }

        // Create message container for content
        const messageContent = document.createElement("div");
        messageContent.classList.add("message-content");
        message.appendChild(messageContent);

        // Add sender name
        const senderName = document.createElement("div");
        senderName.classList.add("message-sender");
        senderName.textContent = messageObj.displayName || messageObj.userId || "Unknown";
        messageContent.appendChild(senderName);

        // Add timestamp
        const timestampSpan = document.createElement("small");
        const messageDate = new Date(messageObj.timestamp);
        timestampSpan.textContent = formatTimestamp(messageDate);
        timestampSpan.classList.add("message-timestamp");
        messageContent.appendChild(timestampSpan);

        // Create text container
        const textContainer = document.createElement("div");
        textContainer.classList.add("message-text-container");
        messageContent.appendChild(textContainer);

        // Create text span
        const textSpan = document.createElement("span");
        textSpan.textContent = messageObj.text;
        textSpan.classList.add("message-text");
        textContainer.appendChild(textSpan);

        // Only show edit and delete buttons if message is not deleted and belongs to current user
        if (!messageObj.isDeleted && isCurrentUserMessage) {
            const buttonContainer = document.createElement("div");
            buttonContainer.classList.add("message-buttons");
            messageContent.appendChild(buttonContainer);

            // Edit button
            const editButton = document.createElement("button");
            editButton.textContent = "Edit";
            editButton.classList.add("edit-button");
            editButton.addEventListener("click", () => editMessage(messageObj.id));
            buttonContainer.appendChild(editButton);

            // Delete button
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.classList.add("delete-button");
            deleteButton.addEventListener("click", () => deleteMessage(messageObj.id));
            buttonContainer.appendChild(deleteButton);
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
        const timeString = date.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
        
        if (isToday) {
            return timeString;
        } else {
            const dateString = date.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'});
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
        const textElement = messageElement.querySelector('.message-text');
        const currentText = messageToEdit.text;

        // Store the original content for restoration if editing is cancelled
        const originalContent = textElement.innerHTML;
        const originalParentContent = messageElement.innerHTML;

        // Clear the text element
        textElement.innerHTML = "";

        // Create edit input
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.value = currentText;
        editInput.classList.add("edit-input");
        textElement.appendChild(editInput);

        // Create buttons container
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("edit-buttons");
        messageElement.appendChild(buttonContainer);

        // Save button
        const saveButton = document.createElement("button");
        saveButton.textContent = "Save";
        saveButton.classList.add("save-button");
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
        buttonContainer.appendChild(saveButton);

        // Cancel button
        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel";
        cancelButton.classList.add("cancel-button");
        cancelButton.addEventListener("click", () => {
            // Restore original content
            textElement.innerHTML = originalContent;
            messageElement.innerHTML = originalParentContent;
            startAutoRefresh(); // Resume auto-refresh
        });
        buttonContainer.appendChild(cancelButton);

        // Focus the input
        editInput.focus();
    }

    function renderLektorList() {
        if (!lektorList) return;
        
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