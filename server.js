// server.js - Express server with MongoDB integration and user authentication
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration - important for client-server communication
app.use(cors({
  origin: true, // Allow all origins
  credentials: true, // Important for cookies/session
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration - UPDATED
app.use(session({
  secret: 'chat-app-secret-key',
  resave: false, // Changed from true
  saveUninitialized: false, // Changed from true
  cookie: { 
    secure: false, // Changed to false for non-HTTPS development
    maxAge: 3600000,
    httpOnly: true,
    sameSite: 'lax' // Added for compatibility with modern browsers
  }
}));

// Serve static files - adjust path based on your file structure
app.use(express.static(path.join(__dirname, 'client')));

// MongoDB Connection String
const uri = "mongodb+srv://semani:O125E33Jo8C8qEsW@cluster0.azieuf5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Database and Collection names
const dbName = 'chat_app';
const messagesCollection = 'messages';
const userPrefsCollection = 'user_preferences';

// Load users from JSON file
let users = [];
try {
  const usersData = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
  users = JSON.parse(usersData);
  console.log('Loaded users from users.json:', users);
} catch (error) {
  console.error('Error loading users from file:', error);
  // Default users if file cannot be read
  users = [
    {
      "username": "user1",
      "password": "password1",
      "displayName": "User One"
    },
    {
      "username": "user2",
      "password": "password2",
      "displayName": "User Two"
    },
    {
      "username": "user3",
      "password": "password3",
      "displayName": "User Three"
    }
  ];
  console.log('Using default users');
}

// Function to create a new MongoDB client and connect
async function connectToMongo() {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Simplified database operation function
async function withDatabase(callback) {
  let client;
  try {
    client = await connectToMongo();
    const db = client.db(dbName);
    return await callback(db);
  } catch (error) {
    console.error("Database operation failed:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Test and initialize the MongoDB connection
async function testConnection() {
  try {
    await withDatabase(async (db) => {
      await db.command({ ping: 1 });
      console.log("MongoDB connection test successful");

      // Make sure collections exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);

      // Create collections if they don't exist
      if (!collectionNames.includes(messagesCollection)) {
        await db.createCollection(messagesCollection);
        console.log(`Created ${messagesCollection} collection`);
      }

      if (!collectionNames.includes(userPrefsCollection)) {
        await db.createCollection(userPrefsCollection);
        console.log(`Created ${userPrefsCollection} collection`);
      }
    });

    return true;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    return false;
  }
}

// Start the server but don't wait for MongoDB connection test
// This allows the server to function even if MongoDB is unavailable
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Access the application at: http://localhost:${port}`);
  
  // Test MongoDB connection after server start
  testConnection()
    .then(success => {
      if (success) {
        console.log("MongoDB connection ready for use");
      } else {
        console.warn("Server running without MongoDB connection - using fallback data");
      }
    })
    .catch(error => {
      console.warn("MongoDB connection test failed, using fallback data:", error);
    });
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

// Serve the HTML file for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/index.html'));
});

// Debug endpoint to check session
app.get('/api/debug/session', (req, res) => {
  res.json({
    session: req.session,
    sessionID: req.sessionID,
    cookies: req.cookies,
    user: req.session?.user || 'No user in session'
  });
});

// API Endpoints
app.post('/api/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    console.log('Current session before login:', req.session);
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    console.log('Checking user credentials against:', users);
    // Find user in our loaded users array
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
      console.log('User not found or password does not match');
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Set user info in session (without password)
    req.session.user = {
      username: user.username,
      displayName: user.displayName
    };
    
    // Save the session explicitly
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      
      console.log('User logged in successfully:', user.username);
      console.log('Session after login:', req.session);
      
      // Return user info (without password)
      res.json({
        username: user.username,
        displayName: user.displayName
      });
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login: ' + error.message });
  }
});

// User logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user
app.get('/api/user', (req, res) => {
  console.log('Current session in /api/user:', req.session);
  if (req.session && req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Get messages for a specific course
app.get('/api/messages/:courseId', requireAuth, async (req, res) => {
  try {
    const courseId = req.params.courseId;
    
    // For testing purposes, if MongoDB is unavailable, return mock data
    try {
      const messages = await withDatabase(async (db) => {
        return await db.collection(messagesCollection)
          .find({ courseId: courseId })
          .sort({ timestamp: 1 })
          .toArray();
      });
      
      res.json(messages);
    } catch (dbError) {
      console.error('Database error, using mock data:', dbError);
      // Return mock data if database is unavailable
      const mockData = [
        {
          id: "mockid1",
          courseId: courseId,
          text: "Welcome to the chat for " + courseId,
          userId: "system",
          displayName: "System",
          timestamp: new Date(),
          isDeleted: false
        }
      ];
      res.json(mockData);
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add a new message
app.post('/api/messages', requireAuth, async (req, res) => {
  try {
    const { courseId, text } = req.body;

    if (!courseId || !text) {
      return res.status(400).json({ error: 'CourseId and text are required' });
    }

    const newMessage = {
      courseId,
      text,
      userId: req.session.user.username,
      displayName: req.session.user.displayName,
      id: new ObjectId().toString(),
      timestamp: new Date(),
      isDeleted: false
    };

    try {
      await withDatabase(async (db) => {
        await db.collection(messagesCollection).insertOne(newMessage);
      });
    } catch (dbError) {
      console.error('Database error when adding message:', dbError);
      // If database fails, still return the message for UI purposes
      console.log('Returning message without DB persistence');
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Update a message
app.put('/api/messages/:messageId', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const { text, isDeleted, originalText } = req.body;

    let message;
    try {
      // Get the message to verify ownership
      message = await withDatabase(async (db) => {
        return await db.collection(messagesCollection).findOne({ id: messageId });
      });
    } catch (dbError) {
      console.error('Database error when fetching message for update:', dbError);
      // For testing, create a mock message
      message = {
        id: messageId,
        userId: req.session.user.username,
        text: text || "Original text"
      };
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only allow users to edit their own messages
    if (message.userId !== req.session.user.username) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    const updateData = {};
    if (text !== undefined) updateData.text = text;
    if (isDeleted !== undefined) updateData.isDeleted = isDeleted;
    if (originalText !== undefined) updateData.originalText = originalText;

    let updatedMessage;
    try {
      updatedMessage = await withDatabase(async (db) => {
        const result = await db.collection(messagesCollection).updateOne(
          { id: messageId },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          throw new Error('Message not found');
        }

        return await db.collection(messagesCollection).findOne({ id: messageId });
      });
    } catch (dbError) {
      console.error('Database error when updating message:', dbError);
      // For testing, create an updated mock message
      updatedMessage = {
        ...message,
        ...updateData,
        timestamp: new Date()
      };
    }

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error updating message:', error);
    if (error.message === 'Message not found') {
      res.status(404).json({ error: 'Message not found' });
    } else {
      res.status(500).json({ error: 'Failed to update message' });
    }
  }
});

// Delete a message (mark as deleted)
app.delete('/api/messages/:messageId', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.messageId;

    let message;
    try {
      // Get the message to verify ownership
      message = await withDatabase(async (db) => {
        return await db.collection(messagesCollection).findOne({ id: messageId });
      });
    } catch (dbError) {
      console.error('Database error when fetching message for delete:', dbError);
      // For testing, create a mock message
      message = {
        id: messageId,
        userId: req.session.user.username,
        text: "Message to delete"
      };
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only allow users to delete their own messages
    if (message.userId !== req.session.user.username) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    try {
      await withDatabase(async (db) => {
        await db.collection(messagesCollection).updateOne(
          { id: messageId },
          {
            $set: {
              isDeleted: true,
              originalText: message.originalText || message.text,
              text: "Message deleted"
            }
          }
        );
      });
    } catch (dbError) {
      console.error('Database error when deleting message:', dbError);
      // Continue without database update for testing
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get user preference (selected course)
app.get('/api/preferences', requireAuth, async (req, res) => {
  try {
    let preference;
    try {
      preference = await withDatabase(async (db) => {
        return await db.collection(userPrefsCollection).findOne({ userId: req.session.user.username });
      });
    } catch (dbError) {
      console.error('Database error when fetching preferences:', dbError);
      // Return default preference for testing
      preference = null;
    }

    res.json(preference || { selectedCourse: 'mathematik' }); // Default if not found
  } catch (error) {
    console.error('Error fetching user preference:', error);
    res.status(500).json({ error: 'Failed to fetch user preference' });
  }
});

// Save user preference (selected course)
app.post('/api/preferences', requireAuth, async (req, res) => {
  try {
    const { selectedCourse } = req.body;

    if (!selectedCourse) {
      return res.status(400).json({ error: 'selectedCourse is required' });
    }

    try {
      await withDatabase(async (db) => {
        await db.collection(userPrefsCollection).updateOne(
          { userId: req.session.user.username },
          { $set: { selectedCourse } },
          { upsert: true }
        );
      });
    } catch (dbError) {
      console.error('Database error when saving preferences:', dbError);
      // Continue without database update for testing
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error saving user preference:', error);
    res.status(500).json({ error: 'Failed to save user preference' });
  }
});

// Add error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});