// server.js - Express server with MongoDB integration for chat app
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the client directory
// This serves files from the same directory as server.js
app.use(express.static(path.join(__dirname, './')));

// MongoDB Connection String
const uri = "mongodb+srv://semani:O125E33Jo8C8qEsW@cluster0.azieuf5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Database and Collection names
const dbName = 'chat_app';
const messagesCollection = 'messages';
const userPrefsCollection = 'user_preferences';

// Default user ID for all users in the Live Share environment
const DEFAULT_USER_ID = 'shared_user';

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

// Simplified connection function with error handling
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

// Test the MongoDB connection on startup
async function testConnection() {
  try {
    await withDatabase(async (db) => {
      await db.command({ ping: 1 });
      console.log("MongoDB connection test successful");
      
      // Make sure collections exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
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

// Start the server after testing the connection
testConnection()
  .then((success) => {
    if (success) {
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        console.log(`Access the application at: http://localhost:${port}`);
      });
    } else {
      console.error("Server not started due to MongoDB connection issues");
      process.exit(1);
    }
  })
  .catch(error => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });

// Serve the HTML file for the root path - modified to look in current directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './index.html'));
});

// API Endpoints

// Get messages for a specific course
app.get('/api/messages/:courseId', async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const messages = await withDatabase(async (db) => {
      return await db.collection(messagesCollection)
        .find({ courseId: courseId })
        .sort({ timestamp: 1 })
        .toArray();
    });
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add a new message
app.post('/api/messages', async (req, res) => {
  try {
    const { courseId, text } = req.body;
    
    if (!courseId || !text) {
      return res.status(400).json({ error: 'CourseId and text are required' });
    }
    
    const newMessage = {
      courseId,
      text,
      userId: DEFAULT_USER_ID, // Use default user ID for all
      id: new ObjectId().toString(),
      timestamp: new Date(),
      isDeleted: false
    };
    
    await withDatabase(async (db) => {
      await db.collection(messagesCollection).insertOne(newMessage);
    });
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Update a message
app.put('/api/messages/:messageId', async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const { text, isDeleted, originalText } = req.body;
    
    const updateData = {};
    if (text !== undefined) updateData.text = text;
    if (isDeleted !== undefined) updateData.isDeleted = isDeleted;
    if (originalText !== undefined) updateData.originalText = originalText;
    
    const updatedMessage = await withDatabase(async (db) => {
      const result = await db.collection(messagesCollection).updateOne(
        { id: messageId },
        { $set: updateData }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('Message not found');
      }
      
      return await db.collection(messagesCollection).findOne({ id: messageId });
    });
    
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
app.delete('/api/messages/:messageId', async (req, res) => {
  try {
    const messageId = req.params.messageId;
    
    await withDatabase(async (db) => {
      // First get the message to save its original text
      const message = await db.collection(messagesCollection).findOne({ id: messageId });
      
      if (!message) {
        throw new Error('Message not found');
      }
      
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
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    if (error.message === 'Message not found') {
      res.status(404).json({ error: 'Message not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
});

// Get user preference (selected course) - now ignores userId and returns default
app.get('/api/preferences/:userId', async (req, res) => {
  // Always return the default preference
  res.json({ selectedCourse: 'mathematik' });
});

// Save user preference (selected course) - now just returns success without saving
app.post('/api/preferences', async (req, res) => {
  // Just return success without actually saving
  res.status(201).json({ success: true });
});

// Add error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});